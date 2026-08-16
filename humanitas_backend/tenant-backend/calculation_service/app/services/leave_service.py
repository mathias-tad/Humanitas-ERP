from sqlalchemy import text
from typing import Optional
from datetime import datetime, date
from app.database import db_manager


class LeaveService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    async def get_hr_settings(self, session) -> dict:
        """Get HR settings from database"""
        try:
            result = await session.execute(
                text("SELECT data FROM settings WHERE category = 'hr'")
            )
            row = result.fetchone()
            return row[0] if row else {}
        except:
            return {}

    def get_years_of_service(self, hire_date: date) -> int:
        """Calculate completed years of service"""
        today = date.today()
        years = today.year - hire_date.year
        if (today.month, today.day) < (hire_date.month, hire_date.day):
            years -= 1
        return max(0, years)

    def calculate_annual_leave(self, base_leave: float, increase_per_year: float, years: int) -> float:
        """Calculate annual leave based on years of service"""
        return base_leave + (years * increase_per_year)

    async def get_user_leave_status(self, user_id: str) -> dict:
        """Get user's leave status including probation info"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            hr_settings = await self.get_hr_settings(session)
            probation_days = hr_settings.get('probation_period_days', 0)
            leave_increase = hr_settings.get('leave_increase_per_year', 0)

            result = await session.execute(
                text("SELECT hire_date FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            row = result.fetchone()

            if not row or not row[0]:
                return {"error": "User not found or no hire date"}

            hire_date = row[0] if isinstance(row[0], date) else datetime.strptime(str(row[0]), '%Y-%m-%d').date()
            today = date.today()
            days_since_hire = (today - hire_date).days
            in_probation = days_since_hire < probation_days
            years_of_service = self.get_years_of_service(hire_date)

            probation_end = hire_date + timedelta(days=probation_days) if probation_days > 0 else hire_date

            return {
                "user_id": user_id,
                "hire_date": str(hire_date),
                "days_since_hire": days_since_hire,
                "in_probation": in_probation,
                "probation_days": probation_days,
                "probation_remaining": max(0, probation_days - days_since_hire),
                "probation_end_date": str(probation_end),
                "years_of_service": years_of_service,
                "leave_increase_per_year": leave_increase,
            }

    async def calculate_user_leave_balance(self, user_id: str) -> dict:
        """Calculate leave balance for a user based on accrual rules"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            hr_settings = await self.get_hr_settings(session)
            probation_days = hr_settings.get('probation_period_days', 0)
            leave_increase = hr_settings.get('leave_increase_per_year', 0)
            leave_types = hr_settings.get('leave_types', [])

            # Get user hire date
            result = await session.execute(
                text("SELECT hire_date FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            row = result.fetchone()

            if not row or not row[0]:
                return {"error": "User not found or no hire date", "balances": []}

            hire_date = row[0] if isinstance(row[0], date) else datetime.strptime(str(row[0]), '%Y-%m-%d').date()
            today = date.today()
            days_since_hire = (today - hire_date).days

            # Check probation
            if days_since_hire < probation_days:
                return {
                    "message": "User is in probation period",
                    "in_probation": True,
                    "probation_remaining": probation_days - days_since_hire,
                    "balances": []
                }

            years_of_service = self.get_years_of_service(hire_date)
            days_past_probation = days_since_hire - probation_days
            current_year = today.year
            balances = []

            for leave_type in leave_types:
                base_annual = leave_type.get('days_per_year', 0)
                current_annual = self.calculate_annual_leave(base_annual, leave_increase, years_of_service)

                # Calculate accrued: (annual_leave / 365) × days_past_probation
                daily_accrual = current_annual / 365
                accrued_days = min(daily_accrual * days_past_probation, current_annual)
                accrued_days = round(accrued_days, 2)

                # Get used days from leave_balances
                used_result = await session.execute(
                    text("""
                        SELECT used_days FROM leave_balances 
                        WHERE user_id = :user_id AND leave_type_id = :type_id AND year = :year
                    """),
                    {"user_id": user_id, "type_id": leave_type['id'], "year": current_year}
                )
                used_row = used_result.fetchone()
                used_days = float(used_row[0]) if used_row else 0

                # Get carry over from previous year
                carry_result = await session.execute(
                    text("""
                        SELECT total_days, used_days FROM leave_balances 
                        WHERE user_id = :user_id AND leave_type_id = :type_id AND year = :year
                    """),
                    {"user_id": user_id, "type_id": leave_type['id'], "year": current_year - 1}
                )
                carry_row = carry_result.fetchone()
                carry_over = max(0, float(carry_row[0]) - float(carry_row[1])) if carry_row else 0

                total_days = accrued_days + carry_over

                # Update balance in database
                await session.execute(
                    text("""
                        INSERT INTO leave_balances (id, user_id, leave_type_id, leave_type_name, total_days, used_days, year)
                        VALUES (gen_random_uuid(), :user_id, :type_id, :type_name, :total, :used, :year)
                        ON CONFLICT (user_id, leave_type_id, year) 
                        DO UPDATE SET total_days = :total, updated_at = NOW()
                    """),
                    {
                        "user_id": user_id,
                        "type_id": leave_type['id'],
                        "type_name": leave_type['name'],
                        "total": total_days,
                        "used": used_days,
                        "year": current_year
                    }
                )

                balances.append({
                    "leave_type_id": leave_type['id'],
                    "leave_type_name": leave_type['name'],
                    "base_annual_leave": base_annual,
                    "current_annual_leave": current_annual,
                    "accrued_days": accrued_days,
                    "carry_over": carry_over,
                    "total_days": total_days,
                    "used_days": used_days,
                    "available_days": max(0, total_days - used_days),
                    "is_paid": leave_type.get('is_paid', True),
                })

            await session.commit()

            return {
                "user_id": user_id,
                "years_of_service": years_of_service,
                "days_past_probation": days_past_probation,
                "in_probation": False,
                "balances": balances,
            }

    async def run_monthly_accrual(self) -> dict:
        """Run monthly leave accrual for all eligible users"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            hr_settings = await self.get_hr_settings(session)
            probation_days = hr_settings.get('probation_period_days', 0)
            leave_increase = hr_settings.get('leave_increase_per_year', 0)
            leave_types = hr_settings.get('leave_types', [])

            # Get all active users with hire_date
            result = await session.execute(
                text("SELECT id, hire_date FROM users WHERE is_active = true AND hire_date IS NOT NULL")
            )
            users = result.fetchall()

            today = date.today()
            current_year = today.year
            results = []
            processed = 0
            skipped_probation = 0

            for user in users:
                user_id = str(user[0])
                hire_date = user[1] if isinstance(user[1], date) else datetime.strptime(str(user[1]), '%Y-%m-%d').date()
                days_since_hire = (today - hire_date).days

                # Skip users in probation
                if days_since_hire < probation_days:
                    skipped_probation += 1
                    continue

                years_of_service = self.get_years_of_service(hire_date)
                processed += 1

                for leave_type in leave_types:
                    base_annual = leave_type.get('days_per_year', 0)
                    current_annual = self.calculate_annual_leave(base_annual, leave_increase, years_of_service)
                    monthly_accrual = round(current_annual / 12, 2)

                    # Get existing balance
                    bal_result = await session.execute(
                        text("""
                            SELECT total_days, used_days FROM leave_balances 
                            WHERE user_id = :user_id AND leave_type_id = :type_id AND year = :year
                        """),
                        {"user_id": user_id, "type_id": leave_type['id'], "year": current_year}
                    )
                    bal_row = bal_result.fetchone()
                    current_total = float(bal_row[0]) if bal_row else 0
                    used_days = float(bal_row[1]) if bal_row else 0

                    new_total = round(current_total + monthly_accrual, 2)

                    # Update balance
                    await session.execute(
                        text("""
                            INSERT INTO leave_balances (id, user_id, leave_type_id, leave_type_name, total_days, used_days, year)
                            VALUES (gen_random_uuid(), :user_id, :type_id, :type_name, :total, :used, :year)
                            ON CONFLICT (user_id, leave_type_id, year) 
                            DO UPDATE SET total_days = :total, updated_at = NOW()
                        """),
                        {
                            "user_id": user_id,
                            "type_id": leave_type['id'],
                            "type_name": leave_type['name'],
                            "total": new_total,
                            "used": used_days,
                            "year": current_year
                        }
                    )

                    results.append({
                        "user_id": user_id,
                        "leave_type": leave_type['name'],
                        "monthly_accrual": monthly_accrual,
                        "previous_total": current_total,
                        "new_total": new_total,
                    })

            await session.commit()

            return {
                "message": "Monthly leave accrual completed",
                "total_users": len(users),
                "processed": processed,
                "skipped_probation": skipped_probation,
                "accrual_date": str(today),
                "results": results,
            }


from datetime import timedelta
