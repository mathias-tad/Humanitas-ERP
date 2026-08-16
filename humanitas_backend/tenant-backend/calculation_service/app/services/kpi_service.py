from sqlalchemy import text
from typing import Optional

from app.database import db_manager


class KPIService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
    
    async def calculate_kpi(
        self,
        month: int,
        year: int,
        department_id: Optional[str] = None
    ) -> dict:
        """
        Calculate KPIs for the specified period.
        Placeholder - will be customized based on your requirements.
        """
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            # Attendance KPIs
            attendance_query = """
                SELECT 
                    COUNT(DISTINCT user_id) as total_employees,
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_count,
                    COUNT(CASE WHEN status = 'Late' THEN 1 END) as late_count,
                    COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_count
                FROM attendance_records
                WHERE EXTRACT(MONTH FROM date) = :month
                  AND EXTRACT(YEAR FROM date) = :year
            """
            result = await session.execute(
                text(attendance_query),
                {"month": month, "year": year}
            )
            attendance_stats = result.fetchone()
            
            # Leave KPIs
            leave_query = """
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
                FROM leave_requests
                WHERE EXTRACT(MONTH FROM created_at) = :month
                  AND EXTRACT(YEAR FROM created_at) = :year
            """
            leave_result = await session.execute(
                text(leave_query),
                {"month": month, "year": year}
            )
            leave_stats = leave_result.fetchone()
            
            # Calculate percentages
            total_records = attendance_stats[1] or 1
            
            return {
                "month": month,
                "year": year,
                "attendance": {
                    "total_employees": attendance_stats[0] or 0,
                    "total_records": attendance_stats[1] or 0,
                    "present_count": attendance_stats[2] or 0,
                    "late_count": attendance_stats[3] or 0,
                    "absent_count": attendance_stats[4] or 0,
                    "attendance_rate": round(((attendance_stats[2] or 0) / total_records) * 100, 2),
                    "punctuality_rate": round((1 - ((attendance_stats[3] or 0) / total_records)) * 100, 2),
                },
                "leave": {
                    "total_requests": leave_stats[0] or 0,
                    "approved": leave_stats[1] or 0,
                    "rejected": leave_stats[2] or 0,
                    "pending": leave_stats[3] or 0,
                }
            }
    
    async def get_summary(self, month: int, year: int) -> dict:
        """Get KPI summary"""
        return await self.calculate_kpi(month, year)
