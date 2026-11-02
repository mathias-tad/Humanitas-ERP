from sqlalchemy import text
from typing import Optional
import pandas as pd
from io import BytesIO
from datetime import datetime, date
from decimal import Decimal
import json

from app.database import db_manager


class PayrollService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
    
    async def calculate_payroll(
        self,
        month: int,
        year: int,
        user_id: str = "system-auto",
        employee_ids: Optional[list[str]] = None
    ) -> dict:
        """
        Calculate payroll for the specified period and SAVE to database.
        This is the main calculation engine ported from NestJS.
        """
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            # Ensure payroll tables exist
            await self.ensure_payroll_tables(session)
            
            # Get HR settings
            hr_settings = {}
            try:
                settings_result = await session.execute(
                    text("SELECT data FROM settings WHERE category = 'hr' LIMIT 1")
                )
                row = settings_result.fetchone()
                if row:
                    hr_settings = row[0] if isinstance(row[0], dict) else {}
            except Exception as e:
                print(f"[Payroll] Error fetching HR settings: {e}")
            
            # Get Payroll settings
            payroll_settings = {}
            try:
                settings_result = await session.execute(
                    text("SELECT data FROM settings WHERE category = 'payroll' LIMIT 1")
                )
                row = settings_result.fetchone()
                if row:
                    payroll_settings = row[0] if isinstance(row[0], dict) else {}
            except Exception as e:
                print(f"[Payroll] Error fetching payroll settings: {e}")
            
            # Extract settings
            late_penalty_per_minute = float(hr_settings.get('late_penalty_per_minute', 0))
            currency = payroll_settings.get('currency', 'ETB')
            employee_pension_rate = float(hr_settings.get('employee_pension_rate', 7)) / 100
            employer_pension_rate = float(hr_settings.get('employer_pension_rate', 11)) / 100
            work_hours_per_month = float(hr_settings.get('work_hours_per_month', 192))
            acting_allowance_percentage = float(payroll_settings.get('acting_allowance_percentage', 10.0))
            
            # Days in Month Mode: FIXED_30 or ACTUAL
            days_in_month_mode = hr_settings.get('days_in_month_mode', 'FIXED_30')
            
            # Penalty Deduction Base: NET or GROSS
            penalty_deduction_base = payroll_settings.get('penalty_deduction_base', 'NET')
            
            # Get tax rules
            tax_rules_result = await session.execute(
                text("SELECT * FROM tax_rules WHERE is_active = true ORDER BY min_salary ASC")
            )
            tax_rules = tax_rules_result.fetchall()
            print(f"[Payroll] Loaded {len(tax_rules)} tax rules")
            
            # Validation Checks
            if not tax_rules:
                error_msg = "Missing Tax Rules - Please configure tax rules in Settings before running payroll."
                print(f"[Payroll] Validation Error: {error_msg}")
                raise Exception(error_msg)
                
            if work_hours_per_month <= 0:
                 raise Exception("Invalid Work Hours Per Month setting (must be > 0)")
            
            # Check if payroll already exists - delete if so
            existing_result = await session.execute(
                text("SELECT id FROM payroll_runs WHERE month = :month AND year = :year"),
                {"month": month, "year": year}
            )
            existing = existing_result.fetchone()
            
            
            if existing:
                # CRITICAL: Restore loan balances before deleting payroll
                # When re-running payroll, we need to reverse the loan deductions from the previous run
                print(f"[Payroll] Existing payroll run found for {month}/{year}. Restoring loan balances...")
                
                # Get all loan deductions from the existing payroll items with breakdown
                loan_deductions_result = await session.execute(
                    text("""
                        SELECT user_id, loan_deduction, loans_breakdown
                        FROM payroll_items
                        WHERE payroll_run_id = :run_id AND loan_deduction > 0
                    """),
                    {"run_id": existing[0]}
                )
                loan_deductions = loan_deductions_result.fetchall()
                
                # Restore loan balances using specific loan IDs from breakdown
                for item in loan_deductions:
                    user_id = item.user_id
                    loans_breakdown = item.loans_breakdown
                    
                    # Parse loans breakdown if it's a string
                    if isinstance(loans_breakdown, str):
                        loans_breakdown = json.loads(loans_breakdown)
                    
                    # Restore each specific loan
                    if loans_breakdown and isinstance(loans_breakdown, list):
                        for loan_entry in loans_breakdown:
                            loan_id = loan_entry.get('loan_id')
                            amount = float(loan_entry.get('amount', 0))
                            
                            if loan_id and amount > 0:
                                await session.execute(
                                    text("""
                                        UPDATE loans
                                        SET remaining_balance = remaining_balance + :amount,
                                            status = CASE 
                                                WHEN status = 'completed' AND remaining_balance + :amount > 0 THEN 'active'
                                                ELSE status
                                            END,
                                            updated_at = NOW()
                                        WHERE id = :loan_id
                                    """),
                                    {"amount": amount, "loan_id": loan_id}
                                )
                                print(f"[Payroll] Restored {amount} to loan {loan_id} for user {user_id}")
                    else:
                        # Fallback: if no breakdown, restore to any active/completed loan
                        amount_to_restore = float(item.loan_deduction)
                        await session.execute(
                            text("""
                                UPDATE loans
                                SET remaining_balance = remaining_balance + :amount,
                                    status = CASE 
                                        WHEN status = 'completed' AND remaining_balance + :amount > 0 THEN 'active'
                                        ELSE status
                                    END,
                                    updated_at = NOW()
                                WHERE user_id = :user_id 
                                AND (status = 'active' OR status = 'completed')
                                ORDER BY updated_at DESC
                                LIMIT 1
                            """),
                            {"amount": amount_to_restore, "user_id": user_id}
                        )
                        print(f"[Payroll] Restored {amount_to_restore} to loans for user {user_id} (fallback)")
                
                # Now safe to delete payroll items and run
                await session.execute(
                    text("DELETE FROM payroll_items WHERE payroll_run_id = :id"),
                    {"id": existing[0]}
                )
                await session.execute(
                    text("DELETE FROM payroll_runs WHERE id = :id"),
                    {"id": existing[0]}
                )
                await session.commit()
                print(f"[Payroll] Old payroll run deleted and loan balances restored")
            
            # Create new payroll run
            created_by = None if user_id == 'system-auto' else user_id
            run_result = await session.execute(
                text("""
                    INSERT INTO payroll_runs(month, year, status, created_by)
                    VALUES(:month, :year, 'processing', :created_by)
                    RETURNING *
                """),
                {"month": month, "year": year, "created_by": created_by}
            )
            payroll_run = run_result.fetchone()
            await session.commit()
            
            # Get all active employees with TIN, Account Number, and Hire Date
            employee_query = """
                SELECT u.id, u.full_name, u.department, u.position, 
                       COALESCE(u.basic_salary, 0) as basic_salary,
                       u.tin, u.account_number, u.hire_date,
                       u.desert_allowance_percent, u.hardship_allowance_percent,
                       ec.slug as category_slug, ec.id as category_id,
                       ec.per_diem_no_receipt_fixed, ec.per_diem_no_receipt_percent,
                       ec.default_transport_allowance, ec.use_transport_allowance, ec.use_per_diem
                FROM users u
                LEFT JOIN employee_categories ec ON u.employee_category_id = ec.id
                WHERE u.is_active = true
            """
            
            if employee_ids:
                employee_query += " AND u.id = ANY(:employee_ids)"
                employees_result = await session.execute(
                    text(employee_query),
                    {"employee_ids": employee_ids}
                )
            else:
                employees_result = await session.execute(text(employee_query))
            
            employees = employees_result.fetchall()
            
            # Date calculations - USE date OBJECTS not strings
            import calendar
            start_date = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            end_date = date(year, month, last_day)
            
            # Working Days Calculation
            standard_total_days = 30 if days_in_month_mode == 'FIXED_30' else last_day
            
            # Get holidays for OT calculation
            holiday_dates = await self.get_holiday_dates(session, year, month)
            
            payroll_items = []
            total_gross = 0
            total_deductions = 0
            total_net = 0
            total_tax = 0
            total_pension_employee = 0
            total_pension_employer = 0
            total_pension_employer = 0
            
            skipped_employees = []
            
            for emp in employees:
                full_basic_salary = float(emp.basic_salary or 0)
                hourly_rate = full_basic_salary / work_hours_per_month if work_hours_per_month > 0 else 0
                
                # Skip if no hire date (require users to set hire_date first)
                # Skip if no hire date (require users to set hire_date first)
                if not emp.hire_date:
                    print(f"[Payroll] Skipping {emp.full_name} - no hire_date set")
                    skipped_employees.append({"name": emp.full_name, "reason": "Missing Hire Date"})
                    continue
                
                # Calculate effective working period based on hire_date
                hire_date_obj = emp.hire_date if isinstance(emp.hire_date, date) else date.fromisoformat(str(emp.hire_date))
                effective_start_date = max(start_date, hire_date_obj)
                
                # If hired after the payroll period, skip
                # If hired after the payroll period, skip
                if effective_start_date > end_date:
                    print(f"[Payroll] Skipping {emp.full_name} - hired after period ({hire_date_obj})")
                    skipped_employees.append({"name": emp.full_name, "reason": f"Hired after period ({hire_date_obj})"})
                    continue
                
                # Get user incomes (allowances)
                incomes_result = await session.execute(
                    text("""
                        SELECT ui.amount, it.id as income_type_id, it.name, 
                               it.is_taxable, it.is_pensionable, it.calculation_type
                        FROM user_incomes ui
                        JOIN income_types it ON ui.income_type_id = it.id
                        WHERE ui.user_id = :user_id AND ui.is_active = true AND it.is_active = true
                          AND (ui.start_date IS NULL OR ui.start_date <= :end_date)
                          AND (ui.end_date IS NULL OR ui.end_date >= :start_date)
                    """),
                    {"user_id": str(emp.id), "end_date": end_date, "start_date": start_date}
                )
                incomes = incomes_result.fetchall()
                
                total_allowances = 0
                taxable_allowances = 0
                non_taxable_allowances = 0
                pensionable_allowances = 0
                allowances_breakdown = []
                processed_income_type_ids = set()
                
                # Process user-specific incomes
                for income in incomes:
                    processed_income_type_ids.add(str(income.income_type_id))
                    raw_amount = float(income.amount or 0)
                    amount = raw_amount
                    
                    if income.calculation_type == 'percentage':
                        amount = full_basic_salary * (raw_amount / 100)
                    
                    total_allowances += amount
                    allowances_breakdown.append({
                        "name": income.name,
                        "amount": amount,
                        "is_taxable": income.is_taxable,
                        "is_pensionable": income.is_pensionable
                    })
                    
                    if income.is_taxable:
                        taxable_allowances += amount
                    else:
                        non_taxable_allowances += amount
                    
                    if income.is_pensionable:
                        pensionable_allowances += amount
                
                # Category allowances (if not overridden by user-specific)
                if emp.category_id:
                    category_allowances_result = await session.execute(
                        text("""
                            SELECT ca.amount, ca.min_amount, ca.mid_amount, ca.max_amount, ca.default_tier,
                                   it.id as income_type_id, it.name, it.is_taxable, it.is_pensionable, it.calculation_type
                            FROM category_allowances ca
                            JOIN income_types it ON ca.income_type_id = it.id
                            WHERE ca.employee_category_id = :category_id AND ca.is_active = true AND it.is_active = true
                        """),
                        {"category_id": str(emp.category_id)}
                    )
                    category_allowances = category_allowances_result.fetchall()
                    
                    for cat_allow in category_allowances:
                        if str(cat_allow.income_type_id) not in processed_income_type_ids:
                            raw_amount = float(cat_allow.amount or 0)
                            tier_amount = raw_amount
                            
                            # Determine tier
                            if cat_allow.default_tier == 'min':
                                tier_amount = float(cat_allow.min_amount or 0)
                            elif cat_allow.default_tier == 'mid':
                                tier_amount = float(cat_allow.mid_amount or 0)
                            elif cat_allow.default_tier == 'max':
                                tier_amount = float(cat_allow.max_amount or 0)
                            
                            if tier_amount == 0 and raw_amount > 0:
                                tier_amount = raw_amount
                            
                            amount = tier_amount
                            if cat_allow.calculation_type == 'percentage':
                                amount = full_basic_salary * (tier_amount / 100)
                            
                            if amount > 0:
                                total_allowances += amount
                                allowances_breakdown.append({
                                    "name": f"{cat_allow.name} (Category)",
                                    "amount": amount,
                                    "is_taxable": cat_allow.is_taxable,
                                    "is_pensionable": cat_allow.is_pensionable
                                })
                                
                                if cat_allow.is_taxable:
                                    taxable_allowances += amount
                                else:
                                    non_taxable_allowances += amount
                                
                                if cat_allow.is_pensionable:
                                    pensionable_allowances += amount
                
                # Transport Allowance (Category Default)
                # Check explicit flag use_transport_allowance (default True if None)
                use_transport = emp.use_transport_allowance
                if use_transport is None:
                    use_transport = True
                    
                if use_transport:
                    transport_amt = float(emp.default_transport_allowance or 0)
                    if transport_amt > 0:
                        total_allowances += transport_amt
                        # Transport allowance is typically non-taxable up to a limit (600 ETB old, higher now).
                        # Treating as non-taxable for now as per common usage.
                        non_taxable_allowances += transport_amt
                        allowances_breakdown.append({
                            "name": "Transport Allowance (Category)",
                            "amount": transport_amt,
                            "is_taxable": False, 
                            "is_pensionable": False
                        })
                
                # Per Diem (Category Formula)
                # Check explicit flag use_per_diem (default True if None)
                use_per_diem = emp.use_per_diem
                if use_per_diem is None:
                    use_per_diem = True
                    
                if use_per_diem:
                    per_diem_amt = self.calculate_per_diem(emp, full_basic_salary)
                    if per_diem_amt > 0:
                        total_allowances += per_diem_amt
                        non_taxable_allowances += per_diem_amt
                        allowances_breakdown.append({
                            "name": "Per Diem (Category Formula)",
                            "amount": per_diem_amt,
                            "is_taxable": False,
                            "is_pensionable": False
                        })
                
                # Desert Allowance
                desert_percent = float(emp.desert_allowance_percent or 0)
                if desert_percent > 0:
                    desert_amt = full_basic_salary * (desert_percent / 100)
                    total_allowances += desert_amt
                    taxable_allowances += desert_amt
                    pensionable_allowances += desert_amt
                    allowances_breakdown.append({
                        "name": f"Desert Allowance({desert_percent}%)",
                        "amount": desert_amt,
                        "is_taxable": True,
                        "is_pensionable": True
                    })
                
                # Hardship Allowance
                hardship_percent = float(emp.hardship_allowance_percent or 0)
                if hardship_percent > 0:
                    hardship_amt = full_basic_salary * (hardship_percent / 100)
                    total_allowances += hardship_amt
                    taxable_allowances += hardship_amt
                    pensionable_allowances += hardship_amt
                    allowances_breakdown.append({
                        "name": f"Hardship Allowance({hardship_percent}%)",
                        "amount": hardship_amt,
                        "is_taxable": True,
                        "is_pensionable": True
                    })
                
                # Acting Allowance (to be implemented if needed - complex logic)
                # Skipped for now to keep initial implementation manageable
                
                # Get active loans
                loans_result = await session.execute(
                    text("""
                        SELECT id, loan_type, monthly_deduction, remaining_balance
                        FROM loans
                        WHERE user_id = :user_id AND status = 'active' AND remaining_balance > 0
                    """),
                    {"user_id": str(emp.id)}
                )
                loans = loans_result.fetchall()
                
                loan_deduction = 0
                loans_breakdown = []
                
                for loan in loans:
                    deduction = min(
                        float(loan.monthly_deduction),
                        float(loan.remaining_balance)
                    )
                    loan_deduction += deduction
                    loans_breakdown.append({
                        "loan_type": loan.loan_type,
                        "amount": deduction,
                        "loan_id": str(loan.id)
                    })
                    
                    # Update loan balance
                    await session.execute(
                        text("""
                            UPDATE loans 
                            SET remaining_balance = remaining_balance - :deduction,
                                updated_at = NOW()
                            WHERE id = :id
                        """),
                        {"deduction": deduction, "id": str(loan.id)}
                    )
                    
                    # Mark as completed if fully paid
                    new_balance = float(loan.remaining_balance) - deduction
                    if new_balance <= 0:
                        await session.execute(
                            text("UPDATE loans SET status = 'completed' WHERE id = :id"),
                            {"id": str(loan.id)}
                        )
                
                # Get attendance data (remove check_in/check_out - they don't exist)
                attendance_result = await session.execute(
                    text("""
                        SELECT date, status, work_hours,
                               CASE WHEN status = 'Late' AND actual_in IS NOT NULL AND scheduled_in IS NOT NULL 
                                    THEN GREATEST(0, EXTRACT(EPOCH FROM (actual_in::time - scheduled_in::time)) / 60)
                                    ELSE 0 END as late_minutes
                        FROM attendance_records
                        WHERE user_id = :user_id AND date >= :effective_start AND date <= :end_date
                    """),
                    {"user_id": str(emp.id), "effective_start": effective_start_date, "end_date": end_date}
                )
                attendance_records = attendance_result.fetchall()
                
                attendance_days_worked = 0
                days_absent = 0
                late_minutes = 0
                
                for record in attendance_records:
                    if record.status in ['Present', 'Late']:
                        attendance_days_worked += 1
                    if record.status == 'Absent':
                        days_absent += 1
                    late_minutes += float(record.late_minutes or 0)
                
                late_deduction = round(late_minutes) * late_penalty_per_minute
                
                # TODO: Implement Advanced Overtime (complex - skipped for now)
                overtime_pay = 0
                
                # Get approved leave days
                leave_result = await session.execute(
                    text("""
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN start_date >= :start_date AND end_date <= :end_date THEN
                                    (end_date::date - start_date::date + 1)
                                WHEN start_date < :start_date AND end_date >= :start_date AND end_date <= :end_date THEN
                                    (end_date::date - start_date::date + 1)
                                WHEN start_date >= :start_date AND start_date <= :end_date AND end_date > :end_date THEN
                                    (end_date::date - start_date::date + 1)
                                WHEN start_date < :start_date AND end_date > :end_date THEN
                                    (end_date::date - start_date::date + 1)
                                ELSE 0
                            END
                        ), 0) as leave_days
                        FROM leave_requests
                        WHERE user_id = :user_id 
                          AND status = 'approved'
                          AND (
                              (start_date >= :start_date AND start_date <= :end_date) OR
                              (end_date >= :start_date AND end_date <= :end_date) OR
                              (start_date < :start_date AND end_date > :end_date)
                          )
                    """),
                    {"user_id": str(emp.id), "start_date": effective_start_date, "end_date": end_date}
                )
                approved_leave_days = int(leave_result.fetchone()[0] or 0)
                
                # Calculate working days considering hire date
                # If hired mid-month, calculate days from hire date
                if effective_start_date > start_date:
                    # Hired mid-month - calculate days from hire date to end of month
                    total_days_in_period = (end_date - effective_start_date).days + 1
                    # Adjust standard days proportionally
                    adjusted_standard_days = total_days_in_period if days_in_month_mode == 'ACTUAL' else int((total_days_in_period / last_day) * 30)
                else:
                    adjusted_standard_days = standard_total_days
                
                # Working Days = Adjusted Standard Days - Days Absent
                working_days = max(0, adjusted_standard_days - days_absent)
                
                # Pro-rata calculation
                pro_rata_factor = min(working_days / standard_total_days, 1) if standard_total_days > 0 else 1
                basic_salary = full_basic_salary * pro_rata_factor
                absent_deduction = full_basic_salary - basic_salary
                
                # Total days worked for reporting (reflects paid days)
                days_worked = int(working_days)
                print(f"[Payroll] DEBUG Days: Worker={emp.full_name}, DaysWorked={days_worked}, working_days={working_days}, Adj={adjusted_standard_days}, Absent={days_absent}, Mode={days_in_month_mode}, Std={standard_total_days}")
                
                # Pro-rata allowances
                pro_rata_total_allowances = total_allowances * pro_rata_factor
                pro_rata_taxable_allowances = taxable_allowances * pro_rata_factor
                pro_rata_non_taxable_allowances = non_taxable_allowances * pro_rata_factor
                pro_rata_pensionable_allowances = pensionable_allowances * pro_rata_factor
                
                # Calculate pension - ONLY from basic salary (not allowances)
                # Ethiopian pension: 7% employee, 11% employer
                pensionable_income = basic_salary  # For reporting purposes
                pension_employee = basic_salary * employee_pension_rate
                pension_employer = basic_salary * employer_pension_rate
                
                # Calculate taxable income - BEFORE pension deduction
                # Taxable income = Basic salary + Taxable allowances
                taxable_income = basic_salary + pro_rata_taxable_allowances
                
                # Calculate income tax
                income_tax = self.calculate_income_tax(
                    full_basic_salary,
                    taxable_income,
                    tax_rules,
                    pro_rata_factor
                )
                
                # Gross salary
                gross_salary = basic_salary + pro_rata_total_allowances
                
                # Fetch penalties - ensure table has required columns first
                penalty_deduction = 0
                penalty_breakdown = []
                
                # Note: user_penalties table may need migration to add status, penalty_type, month, year columns
                # For now, fetch all penalties for the user and sum them
                try:
                    penalty_result = await session.execute(
                        text("""
                            SELECT id, amount, reason, created_at
                            FROM user_penalties
                            WHERE user_id = :user_id
                        """),
                        {"user_id": str(emp.id)}
                    )
                    penalties = penalty_result.fetchall()
                    
                    if penalties and len(penalties) > 0:
                        for p in penalties:
                            # Sum all penalties for this user
                            # TODO: Filter by month/year once columns are added to table
                            amount = float(p.amount or 0)
                            penalty_deduction += amount
                            penalty_breakdown.append({
                                "type": "Manual",  # Default since penalty_type column doesn't exist yet
                                "amount": amount,
                                "reason": p.reason if hasattr(p, 'reason') else None,
                                "date": str(p.created_at) if hasattr(p, 'created_at') else None
                            })
                        print(f"[Payroll] Applied {len(penalties)} penalties totaling {penalty_deduction} for {emp.full_name}")
                except Exception as e:
                    print(f"[Payroll] Could not fetch penalties for {emp.full_name}: {e}")
                    # Continue without penalties rather than failing entire payroll

                # Process Unpaid VTO (Voluntary Time Off) deductions
                try:
                    vto_result = await session.execute(
                        text("""
                            SELECT c.id, COALESCE(c.hours, o.hours, 0) as hours, o.date, o.title
                            FROM wfm_opportunity_claims c
                            JOIN wfm_opportunities o ON c.opportunity_id = o.id
                            WHERE c.user_id = :user_id
                              AND c.claim_type = 'VTO'
                              AND c.status = 'approved'
                              AND (c.is_paid = false OR c.is_paid IS NULL)
                              AND (c.use_pto_balance = false OR c.use_pto_balance IS NULL)
                              AND (o.vto_compensation_type = 'unpaid' OR o.vto_compensation_type IS NULL)
                              AND o.date >= :start_date AND o.date <= :end_date
                        """),
                        {"user_id": str(emp.id), "start_date": effective_start_date, "end_date": end_date}
                    )
                    vto_claims = vto_result.fetchall()
                    if vto_claims and len(vto_claims) > 0:
                        hourly_rate = full_basic_salary / work_hours_per_month if work_hours_per_month > 0 else 0
                        for vto in vto_claims:
                            vto_hrs = float(vto.hours or 0)
                            vto_amt = round(vto_hrs * hourly_rate, 2)
                            penalty_deduction += vto_amt
                            penalty_breakdown.append({
                                "type": "Unpaid VTO",
                                "amount": vto_amt,
                                "hours": vto_hrs,
                                "reason": f"Unpaid Voluntary Time Off ({vto_hrs}h) - {vto.title}",
                                "date": str(vto.date)
                            })
                        print(f"[Payroll] Applied {len(vto_claims)} unpaid VTO deductions for {emp.full_name}")
                except Exception as e:
                    print(f"[Payroll] Could not process unpaid VTO deductions for {emp.full_name}: {e}")
                
                # Apply Deduction Base Logic
                total_penalties = loan_deduction + late_deduction + penalty_deduction
                actual_tax = income_tax
                
                if penalty_deduction_base == 'GROSS':
                    # Deduct penalties BEFORE tax
                    taxable_income_after_penalties = max(0, taxable_income - total_penalties)
                    actual_tax = self.calculate_income_tax(
                        full_basic_salary,
                        taxable_income_after_penalties,
                        tax_rules,
                        pro_rata_factor
                    )
                    total_deductions_for_emp = actual_tax + pension_employee + total_penalties
                    net_salary = gross_salary - total_deductions_for_emp
                else:
                    # NET base: Deduct penalties AFTER tax
                    total_deductions_for_emp = income_tax + pension_employee + total_penalties
                    net_salary = gross_salary - total_deductions_for_emp
                
                # Insert payroll item with TIN and Account Number
                await session.execute(
                    text("""
                        INSERT INTO payroll_items(
                            payroll_run_id, user_id, basic_salary, total_allowances,
                            taxable_allowances, non_taxable_allowances, pensionable_income, taxable_income,
                            gross_salary, income_tax, pension_employee, pension_employer,
                            loan_deduction, late_deduction, other_deductions,
                            total_deductions, net_salary, days_worked, days_absent, late_minutes,
                            allowances_breakdown, loans_breakdown, penalty_breakdown,
                            tin, account_number
                        ) VALUES(
                            :payroll_run_id, :user_id, :basic_salary, :total_allowances,
                            :taxable_allowances, :non_taxable_allowances, :pensionable_income, :taxable_income,
                            :gross_salary, :income_tax, :pension_employee, :pension_employer,
                            :loan_deduction, :late_deduction, :penalty_deduction,
                            :total_deductions, :net_salary, :days_worked, :days_absent, :late_minutes,
                            :allowances_breakdown, :loans_breakdown, :penalty_breakdown,
                            :tin, :account_number
                        )
                    """),
                    {
                        "payroll_run_id": payroll_run.id,
                        "user_id": str(emp.id),
                        "basic_salary": basic_salary,
                        "total_allowances": total_allowances,
                        "taxable_allowances": taxable_allowances,
                        "non_taxable_allowances": non_taxable_allowances,
                        "pensionable_income": pensionable_income,
                        "taxable_income": taxable_income,
                        "gross_salary": gross_salary,
                        "income_tax": income_tax,
                        "pension_employee": pension_employee,
                        "pension_employer": pension_employer,
                        "loan_deduction": loan_deduction,
                        "late_deduction": late_deduction,
                        "penalty_deduction": penalty_deduction,
                        "total_deductions": total_deductions_for_emp,
                        "net_salary": net_salary,
                        "days_worked": days_worked,
                        "days_absent": days_absent,
                        "late_minutes": late_minutes,
                        "allowances_breakdown": json.dumps(allowances_breakdown),
                        "loans_breakdown": json.dumps(loans_breakdown),
                        "penalty_breakdown": json.dumps(penalty_breakdown),
                        "tin": emp.tin,
                        "account_number": emp.account_number
                    }
                )
                
                total_gross += gross_salary
                total_deductions += total_deductions_for_emp
                total_net += net_salary
                total_tax += income_tax
                total_pension_employee += pension_employee
                total_pension_employer += pension_employer
            
            # Update payroll run totals
            await session.execute(
                text("""
                    UPDATE payroll_runs SET
                        status = 'completed',
                        total_employees = :total_employees,
                        total_gross = :total_gross,
                        total_deductions = :total_deductions,
                        total_net = :total_net,
                        total_tax = :total_tax,
                        total_pension_employee = :total_pension_employee,
                        total_pension_employer = :total_pension_employer,
                        completed_at = NOW()
                    WHERE id = :id
                """),
                {
                    "total_employees": len(employees),
                    "total_gross": total_gross,
                    "total_deductions": total_deductions,
                    "total_net": total_net,
                    "total_tax": total_tax,
                    "total_pension_employee": total_pension_employee,
                    "total_pension_employer": total_pension_employer,
                    "id": payroll_run.id
                }
            )
            
            await session.commit()
            
            # Trigger notification webhook to NestJS
            try:
                import httpx
                import os
                nestjs_url = os.getenv("NESTJS_API_URL", "http://localhost:3000")
                webhook_url = f"{nestjs_url}/payroll/webhook/completed"
                
                async with httpx.AsyncClient() as client:
                    await client.post(
                        webhook_url,
                        json={
                            "tenant_id": tenant_id,
                            "payroll_run_id": str(payroll_run.id),
                            "month": month,
                            "year": year,
                            "total_employees": len(employees)
                        },
                        timeout=10.0
                    )
                print(f"[Payroll] Triggered notification webhook for {month}/{year}")
            except Exception as e:
                print(f"[Payroll] Failed to trigger notification webhook: {e}")
                # Don't fail payroll if webhook fails
            
            return {
                "payroll_run_id": str(payroll_run.id),
                "month": month,
                "year": year,
                "total_employees": len(employees),
                "total_gross": total_gross,
                "total_deductions": total_deductions,
                "total_net": total_net,
                "total_tax": total_tax,
                "total_pension_employee": total_pension_employee,
                "total_pension_employer": total_pension_employer,
                "currency": currency
            }
    
    def calculate_per_diem(self, emp, basic_salary: float) -> float:
        """Calculate per diem based on category formula"""
        if not emp.per_diem_no_receipt_fixed and not emp.per_diem_no_receipt_percent:
            return 0
        
        fixed = float(emp.per_diem_no_receipt_fixed or 0)
        percent = float(emp.per_diem_no_receipt_percent or 0)
        
        if percent > 0:
            return basic_salary * (percent / 100)
        return fixed
    
    def calculate_income_tax(
        self,
        full_basic_salary: float,
        taxable_income: float,
        tax_rules: list,
        pro_rata_factor: float
    ) -> float:
        """Calculate income tax based on progressive tax rules"""
        print(f"[Tax] Calculating: taxable={taxable_income}, rules_count={len(tax_rules) if tax_rules else 0}")
        if taxable_income <= 0 or not tax_rules:
            print(f"[Tax] No calculation: taxable_income={taxable_income}, has_rules={bool(tax_rules)}")
            return 0
        
        tax = 0
        
        # Find the applicable bracket based on taxable income
        for rule in tax_rules:
            min_salary = float(rule.min_salary or 0)
            max_salary = float(rule.max_salary) if rule.max_salary else float('inf')
            rate = float(rule.tax_rate or 0) / 100
            deduction = float(rule.deductible or 0)
            
            # Check if taxable income falls within this bracket
            if taxable_income > min_salary and (taxable_income <= max_salary or max_salary == float('inf')):
                # Apply tax formula: (taxable_income * rate) - deduction
                tax = taxable_income * rate - (deduction * pro_rata_factor)
                print(f"[Tax] Applied bracket {min_salary}-{max_salary}: rate={rate*100}%, deduction={deduction}, tax={tax}")
                break
        
        return max(tax, 0)
    
    async def get_holiday_dates(self, session, year: int, month: int) -> list:
        """Get list of holiday dates for the month"""
        try:
            holidays_result = await session.execute(
                text("""
                    SELECT date FROM holidays 
                    WHERE EXTRACT(YEAR FROM date) = :year 
                      AND EXTRACT(MONTH FROM date) = :month
                """),
                {"year": year, "month": month}
            )
            holidays = holidays_result.fetchall()
            return [h.date for h in holidays]
        except:
            return []
    
    async def ensure_payroll_tables(self, session):
        """Ensure payroll tables exist with all required columns"""
        try:
            # Add TIN and account_number to payroll_items
            await session.execute(text("""
                ALTER TABLE payroll_items 
                ADD COLUMN IF NOT EXISTS tin VARCHAR(50),
                ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
                ADD COLUMN IF NOT EXISTS penalty_breakdown JSONB DEFAULT '[]'::jsonb
            """))
            
            # Add penalty tracking columns to user_penalties
            await session.execute(text("""
                ALTER TABLE user_penalties
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending',
                ADD COLUMN IF NOT EXISTS penalty_type VARCHAR(50) DEFAULT 'Manual',
                ADD COLUMN IF NOT EXISTS month INTEGER,
                ADD COLUMN IF NOT EXISTS year INTEGER
            """))
            
            # Add summary columns to payroll_runs
            await session.execute(text("""
                ALTER TABLE payroll_runs
                ADD COLUMN IF NOT EXISTS total_employees INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS total_gross DECIMAL(15, 2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS total_net DECIMAL(15, 2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS status_message TEXT
            """))
            
            await session.commit()
            print("[Payroll] Table schema updated with penalty tracking columns")
        except Exception as e:
            print(f"[Payroll] Table alteration note: {e}")
    
    async def export_to_excel(self, month: int, year: int) -> bytes:
        """Export payroll data to Excel file (placeholder - export handled by NestJS)"""
        # For now, return minimal implementation
        # Real export with dual sheets is in NestJS controller
        payroll_result = await self.calculate_payroll(month, year)
        
        df = pd.DataFrame([{
            "Month": month,
            "Year": year,
            "Total Employees": payroll_result.get("total_employees", 0),
            "Total Net": payroll_result.get("total_net", 0)
        }])
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Payroll', index=False)
        
        output.seek(0)
        return output.getvalue()
