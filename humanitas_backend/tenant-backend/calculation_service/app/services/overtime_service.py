import asyncio
from sqlalchemy import text
from datetime import date, datetime, timedelta, time
from calendar import monthrange
from app.database import db_manager

class OvertimeService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    async def calculate_daily_ot_with_session(self, session, target_date: date, period_start: date = None, period_end: date = None, period_label: str = None):
        """
        Calculates OT for a single date using an active session.
        Accepts optional period tracking params.
        Returns detailed result dict.
        """
        # 1. Fetch Tenant Settings
        gen_settings = {}
        pay_settings = {}
        hr_settings = {}
        
        try:
            async with session.begin_nested():
                general_res = await session.execute(text("SELECT data FROM settings WHERE category = 'general'"))
                row = general_res.fetchone()
                gen_settings = row[0] if row else {}
                
                payroll_res = await session.execute(text("SELECT data FROM settings WHERE category = 'payroll'"))
                row = payroll_res.fetchone()
                pay_settings = row[0] if row else {}
                
                hr_res = await session.execute(text("SELECT data FROM settings WHERE category = 'hr'"))
                row = hr_res.fetchone()
                hr_settings = row[0] if row else {}
        except Exception as e:
            print(f"[OT Service] Error fetching settings: {e}")

        std_working_days = gen_settings.get('working_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
        
        # Rates
        rate_normal = float(pay_settings.get('ot_rate_normal', 1.25))
        rate_night = float(pay_settings.get('ot_rate_night', 1.5))
        rate_holiday = float(pay_settings.get('ot_rate_holiday', 2.0))
        rate_dayoff = float(pay_settings.get('ot_rate_dayoff', 1.5))
        monthly_hours = float(pay_settings.get('monthly_working_hours', 160))
        min_ot_mins = float(pay_settings.get('minimum_ot_duration', 30))
        max_ot_hours = float(hr_settings.get('overtime_threshold_hours', 0))

        # 2. Check Holiday
        is_holiday = False
        holiday_name = None
        try:
            async with session.begin_nested():
                hol_res = await session.execute(text("SELECT name FROM holidays WHERE date = :date"), {'date': target_date})
                hol = hol_res.fetchone()
                if hol:
                    is_holiday = True
                    holiday_name = hol.name
        except Exception:
            pass

        # 3. Load Salaries
        user_salaries = {}
        try:
            async with session.begin_nested():
                sal_res = await session.execute(text("SELECT id, COALESCE(basic_salary, 0) as salary FROM users"))
                for row in sal_res.fetchall():
                    user_salaries[row.id] = float(row.salary)
        except Exception:
            pass

        # 4. Fetch Attendance/Schedule
        rows = []
        try:
            query = text("""
                SELECT ar.id as attendance_id, ar.user_id, ar.actual_in, ar.actual_out,
                       ar.scheduled_in, ar.scheduled_out, ar.shift_id,
                       s.is_override, s.is_day_off as override_day_off,
                       u.full_name
                FROM attendance_records ar
                LEFT JOIN schedules s ON ar.user_id = s.user_id AND s.date = :date
                LEFT JOIN users u ON ar.user_id = u.id
                WHERE ar.date = :date
            """)
            rec_res = await session.execute(query, {'date': target_date})
            rows = rec_res.fetchall()
        except Exception as e:
            print(f"[OT Service] Error fetching records: {e}")
            return {"error": str(e)}

        updatable_entries = []
        attendance_updates = []
        processed_users = []

        for row in rows:
            if not row.actual_in or not row.actual_out: continue
            
            work_duration = (row.actual_out - row.actual_in).total_seconds() / 3600.0
            if work_duration <= 0: continue

            day_name = target_date.strftime('%a')
            is_std = day_name in std_working_days
            
            ot_rec = {"normal": 0.0, "night": 0.0, "holiday": 0.0, "dayoff": 0.0}

            if is_holiday:
                ot_rec["holiday"] = work_duration
            elif row.override_day_off or (not row.shift_id and not is_std):
                ot_rec["dayoff"] = work_duration
            else:
                if row.scheduled_in and row.scheduled_out:
                    sc_in = datetime.combine(target_date, row.scheduled_in)
                    sc_out = datetime.combine(target_date, row.scheduled_out)
                    act_in = row.actual_in
                    act_out = row.actual_out
                    
                    if sc_out < sc_in: sc_out += timedelta(days=1)

                    early = (sc_in - act_in).total_seconds()
                    late = (act_out - sc_out).total_seconds()
                    
                    total_ot = 0
                    if early > 0: total_ot += early
                    if late > 0: total_ot += late
                    
                    if total_ot > 0:
                        ot_rec["normal"] = total_ot / 3600.0
                else:
                    ot_rec["normal"] = max(0, work_duration - 8)

            # Apply Thresholds
            raw_total = sum(ot_rec.values())
            
            # Min Check
            if (raw_total * 60) < min_ot_mins:
                ot_rec = {k: 0.0 for k in ot_rec}
                raw_total = 0.0
            
            # Max Check
            if max_ot_hours > 0 and raw_total > max_ot_hours:
                scale = max_ot_hours / raw_total
                ot_rec = {k: v * scale for k, v in ot_rec.items()}
                raw_total = max_ot_hours

            # Calculate Amount
            salary = user_salaries.get(row.user_id, 0.0)
            hourly = salary / monthly_hours if monthly_hours > 0 else 0
            
            amount = (ot_rec["normal"] * hourly * rate_normal) + \
                     (ot_rec["night"] * hourly * rate_night) + \
                     (ot_rec["holiday"] * hourly * rate_holiday) + \
                     (ot_rec["dayoff"] * hourly * rate_dayoff)

            total_amount = amount 
            
        requires_approval = pay_settings.get('ot_requires_approval', True) # Default True
        default_status = 'Pending' if requires_approval else 'Approved'

        # ... (skip to logic) ...

        for row in rows:
            # ...
            
            # ...
            
            # Apply Thresholds
            # ...

            # Calculate Amount
            # ...
            
            # Prepare Updates
            attendance_updates.append({
                "id": row.attendance_id,
                "ot_normal": round(ot_rec['normal'], 2),
                "ot_holiday": round(ot_rec['holiday'], 2),
                "ot_dayoff": round(ot_rec['dayoff'], 2)
            })

            if raw_total > 0:
                updatable_entries.append({
                    "user_id": row.user_id,
                    "date": target_date,
                    "attendance_id": row.attendance_id,
                    "normal": ot_rec['normal'],
                    "night": ot_rec['night'],
                    "holiday": ot_rec['holiday'],
                    "dayoff": ot_rec['dayoff'],
                    "total": raw_total,
                    "amount": total_amount,
                    "status": default_status,
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_label": period_label
                })
                processed_users.append({
                    "user_id": str(row.user_id),
                    "name": row.full_name,
                    "hours": {
                        "normal": round(ot_rec['normal'], 2),
                        "night": round(ot_rec['night'], 2),
                        "holiday": round(ot_rec['holiday'], 2),
                        "dayoff": round(ot_rec['dayoff'], 2),
                        "total": round(raw_total, 2)
                    },
                    "amount": round(total_amount, 2)
                })

        # Batch Execute
        if updatable_entries:
            await session.execute(text("""
                INSERT INTO overtime_entries (user_id, date, attendance_id, normal_ot_hours, night_ot_hours, holiday_ot_hours, dayoff_ot_hours, total_amount, status, period_start, period_end, period_label)
                VALUES (:user_id, :date, :attendance_id, :normal, :night, :holiday, :dayoff, :amount, :status, :period_start, :period_end, :period_label)
                ON CONFLICT (user_id, date) DO UPDATE SET
                    normal_ot_hours = EXCLUDED.normal_ot_hours,
                    night_ot_hours = EXCLUDED.night_ot_hours,
                    holiday_ot_hours = EXCLUDED.holiday_ot_hours,
                    dayoff_ot_hours = EXCLUDED.dayoff_ot_hours,
                    total_amount = EXCLUDED.total_amount,
                    period_start = EXCLUDED.period_start,
                    period_end = EXCLUDED.period_end,
                    period_label = EXCLUDED.period_label,
                    status = :status 
            """), updatable_entries)
        
        if attendance_updates:
            for att in attendance_updates:
                await session.execute(text("""
                    UPDATE attendance_records SET
                        ot_duration_normal = make_interval(secs => :ot_normal * 3600),
                        ot_duration_holiday = make_interval(secs => :ot_holiday * 3600),
                        ot_duration_dayoff = make_interval(secs => :ot_dayoff * 3600)
                    WHERE id = :id
                """), att)

        return {
            "date": str(target_date),
            "is_holiday": is_holiday,
            "processed": len(updatable_entries),
            "details": processed_users
        }

    async def calculate_period(self, session, year: int = None, month: int = None, start_date: str = None, end_date: str = None):
        """
        Calculates Overtime for a range of dates.
        """
        # 1. Fetch Payroll Run Day if needed
        payroll_run_day = 25
        if not start_date or not end_date:
            try:
                # Use 'payroll' category to match NestJS
                hr_res = await session.execute(text("SELECT data FROM settings WHERE category = 'payroll'"))
                row = hr_res.fetchone()
                if row and row[0]:
                    payroll_run_day = int(row[0].get('payroll_run_day', 25))
            except Exception:
                pass
        
        # Apply -2 offset logic
        cutoff_day = payroll_run_day - 2

        today = date.today()
        
        # 2. Determine Date Range
        if start_date and end_date:
            s_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        else:
            t_year = year or today.year
            t_month = month or today.month

            days_target = monthrange(t_year, t_month)[1]
            e_day = min(cutoff_day, days_target)
            e_date = date(t_year, t_month, e_day)

            if t_month == 1:
                p_month = 12
                p_year = t_year - 1
            else:
                p_month = t_month - 1
                p_year = t_year
            
            days_prev = monthrange(p_year, p_month)[1]
            
            # Period start is cutoff of previous month + 1 day
            # e.g. if Run=25, Cutoff=23. Prev Cutoff=23. Start=24.
            s_day = min(cutoff_day, days_prev) + 1
            
            if s_day > days_prev:
                # Handle edge case where start day wraps to 1st of current month? 
                # No, if s_day (24) > days_prev (e.g. 30), it's fine.
                # But if days_prev was 28 (Feb), and s_day is 29...
                # Actually, s_day is cutoff(23) + 1 = 24. Always valid in prev month unless month has < 24 days (unlikely)
                s_date = date(p_year, p_month, s_day)
            else:
                s_date = date(p_year, p_month, s_day)
        
        # 3. Iterate and Calculate
        dates_to_process = []
        curr = s_date
        while curr <= e_date:
            dates_to_process.append(curr)
            curr += timedelta(days=1)
        
        # Generate period label (e.g., "2024-12" based on end date)
        period_label = f"{e_date.year}-{str(e_date.month).zfill(2)}"
            
        all_results = []
        aggregated_users = {}
        total_created = 0

        for d in dates_to_process:
            print(f"[OT Service] Processing date: {d}")
            try:
                res = await self.calculate_daily_ot_with_session(session, d, s_date, e_date, period_label)
                print(f"[OT Service] Date {d} result: {res.get('details', [])[:2]}...")  # First 2 results
                if 'details' in res:
                    processed = res['details']
                    total_created += len(processed)
                    all_results.append({
                        "date": str(d),
                        "users_processed": len(processed)
                    })
                    
                    for user in processed:
                        uid = user['user_id']
                        if uid not in aggregated_users:
                            aggregated_users[uid] = {
                                "user_id": uid,
                                "name": user['name'],
                                "hours": {"normal": 0.0, "night": 0.0, "holiday": 0.0, "dayoff": 0.0, "total": 0.0},
                                "amount": 0.0
                            }
                        agg = aggregated_users[uid]
                        agg['amount'] += user['amount']
                        for k in agg['hours']:
                            agg['hours'][k] += user['hours'].get(k, 0)
            except Exception as e:
                 all_results.append({"date": str(d), "error": str(e)})
            
            # Commit processing for this day to release DB locks
            await session.commit()
            # Yield control briefly to allow other services (NestJS) to access DB
            await asyncio.sleep(0.1)

        # Round Aggregates
        final_agg = []
        for uid, data in aggregated_users.items():
            data['amount'] = round(data['amount'], 2)
            for k in data['hours']:
                data['hours'][k] = round(data['hours'][k], 2)
            final_agg.append(data)

        return {
            "status": "success",
            "period": {
                "start": str(s_date),
                "end": str(e_date),
                "payroll_run_day": payroll_run_day
            },
            "days_processed": len(dates_to_process),
            "total_entries_created": total_created,
            "daily_results": all_results,
            "aggregated_details": final_agg
        }

