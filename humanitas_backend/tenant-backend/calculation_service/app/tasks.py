from app.procrastinate_app import procrast_app
from app.services.payroll_service import PayrollService
from app.services.kpi_service import KPIService
from app.services.overtime_service import OvertimeService
from app.database import db_manager
from sqlalchemy import text
from datetime import date, datetime, timedelta
import calendar
import requests

@procrast_app.task(queue="calculation_jobs", retry=3)
async def payroll_calculation(tenant_id: str, month: int, year: int, employee_ids: list[str] = None):
    print(f"[Task] Starting Payroll Calculation for Tenant: {tenant_id}")
    try:
        service = PayrollService(tenant_id)
        result = await service.calculate_payroll(month=month, year=year, employee_ids=employee_ids)
        print(f"[Task] Payroll Calculated: {result}")
    except Exception as e:
        print(f"[Task] Error in payroll_calculation: {e}")
        raise e

@procrast_app.task(queue="calculation_jobs")
async def payroll_export(tenant_id: str, month: int, year: int):
    print(f"[Task] Starting Payroll Export for Tenant: {tenant_id}")
    try:
        service = PayrollService(tenant_id)
        excel_data = await service.export_to_excel(month=month, year=year)
        print(f"[Task] Payroll Exported associated with tenant {tenant_id}")
    except Exception as e:
        print(f"[Task] Error in payroll_export: {e}")
        raise e

@procrast_app.task(queue="calculation_jobs")
async def kpi_calculation(tenant_id: str, month: int, year: int, department_id: str = None):
    print(f"[Task] Starting KPI Calculation for Tenant: {tenant_id}")
    try:
        service = KPIService(tenant_id)
        result = await service.calculate_kpi(month=month, year=year, department_id=department_id)
        print(f"[Task] KPI Calculated: {result}")
    except Exception as e:
        print(f"[Task] Error in kpi_calculation: {e}")
        raise e

@procrast_app.task(queue="calculation_jobs", retry=3)
async def calculate_overtime_period_task(tenant_id: str, start_date: str = None, end_date: str = None, notification_user_id: str = None, year: int = None, month: int = None, log_id: str = None):
    """
    Calculates Overtime for a range of dates.
    Intended for Async Worker execution.
    """
    print(f"[Task] Starting Period OT Calculation for Tenant: {tenant_id} ({start_date} to {end_date})")
    
    try:
        # Ensure DB connection is available in worker context
        # (db_manager should be initialized in worker startup)
        session = await db_manager.get_tenant_session(tenant_id)
        async with session:
            service = OvertimeService(tenant_id)
            result = await service.calculate_period(
                session=session,
                start_date=start_date,
                end_date=end_date,
                year=year,
                month=month
            )
            
            print(f"[Task] OT Calculated. Entries: {result.get('total_entries_created')}")
            
            # Send Notification via Webhook to NestJS
            # Assuming NestJS runs on localhost:3000 (standard dev) logic
            # or use env var for NEST_API_URL
            webhook_url = "http://localhost:3000/api/overtime/webhook/notification"
            payload = {
                "tenantId": tenant_id,
                "type": "OVERTIME_CALCULATION_COMPLETED",
                "payload": result,
                "logId": log_id,
                "status": "COMPLETED"
            }
            if notification_user_id:
                payload['userId'] = notification_user_id

            try:
                requests.post(webhook_url, json=payload, timeout=5)
                print(f"[Task] Webhook sent to NestJS")
            except Exception as werr:
                 print(f"[Task] Webhook failed: {werr}")

    except Exception as e:
        print(f"[Task] Error in calculate_overtime_period_task: {e}")
        # Send Webhook on Failure if log_id exists
        if log_id:
             webhook_url = "http://localhost:3000/api/overtime/webhook/notification"
             try:
                requests.post(webhook_url, json={
                    "tenantId": tenant_id,
                    "type": "OVERTIME_CALCULATION_FAILED",
                    "logId": log_id,
                    "error": str(e),
                    "status": "FAILED"
                }, timeout=5)
             except: pass
        raise e

@procrast_app.task(queue="calculation_jobs", retry=3)
async def calculate_overtime_daily_task(tenant_id: str, date_str: str, log_id: str = None):
    """
    Calculates Overtime for a single day.
    """
    print(f"[Task] Starting Daily OT Calculation for Tenant: {tenant_id} on {date_str}")
    
    try:
        session = await db_manager.get_tenant_session(tenant_id)
        async with session:
            service = OvertimeService(tenant_id)
            result = await service.calculate_daily(
                session=session,
                date_str=date_str
            )
            
            print(f"[Task] Daily OT Calculated. Result: {result}")
            
            # Send Webhook
            webhook_url = "http://localhost:3000/api/overtime/webhook/notification"
            payload = {
                "tenantId": tenant_id,
                "type": "OVERTIME_CALCULATION_COMPLETED",
                "payload": result,
                "logId": log_id,
                "status": "COMPLETED"
            }

            try:
                requests.post(webhook_url, json=payload, timeout=5)
                print(f"[Task] Webhook sent to NestJS")
            except Exception as werr:
                 print(f"[Task] Webhook failed: {werr}")

    except Exception as e:
        print(f"[Task] Error in calculate_overtime_daily_task: {e}")
        if log_id:
             webhook_url = "http://localhost:3000/api/overtime/webhook/notification"
             try:
                requests.post(webhook_url, json={
                    "tenantId": tenant_id,
                    "type": "OVERTIME_CALCULATION_FAILED",
                    "logId": log_id,
                    "error": str(e),
                    "status": "FAILED"
                }, timeout=5)
             except: pass
        raise e

@procrast_app.task(queue="periodic", retry=3)
async def check_daily_cutoff():
    """
    Daily Periodic Task.
    Iterates all tenants, checks if Today == Payroll Run Day - 2.
    If yes, triggers calculate_overtime_period_task.
    """
    print(f"[Task] Checking Daily Cutoff for all tenants")
    today = date.today()
    
    try:
        # 1. Fetch all tenants from Admin DB
        admin_session = db_manager.get_admin_session() # Helper? Or create manually
        # db_manager doesn't expose get_admin_session easily unless we use the internal engine?
        # worker.py initializes `db_manager.init_admin_connection`.
        # db_manager has `_admin_session_maker`.
        
        async with db_manager._admin_session_maker() as session:
            res = await session.execute(text("SELECT id, schema_name FROM tenants"))
            tenants = res.fetchall()
            
        print(f"[Task] Check Cutoff: Found {len(tenants)} tenants")

        for tenant in tenants:
            t_id = str(tenant.id)
            try:
                # Connect to Tenant DB to get Settings
                tenant_session = await db_manager.get_tenant_session(t_id)
                async with tenant_session:
                    hr_res = await tenant_session.execute(text("SELECT data FROM settings WHERE category = 'hr'"))
                    hr_row = hr_res.fetchone()
                    
                    payroll_run_day = 25
                    if hr_row and hr_row[0]:
                        payroll_run_day = int(hr_row[0].get('payroll_run_day', 25))
                    
                    # Logic: Trigger if Today = Run Day - 2
                    # Handle month wrapping? 
                    # Simpler: Calculate next run date.
                    # Current month run date:
                    run_date_this_month = date(today.year, today.month, min(payroll_run_day, 28)) # simplistic
                    
                    cutoff_date = run_date_this_month - timedelta(days=2)
                    
                    if today == cutoff_date:
                        print(f"[Task] Triggering Auto-Calc for Tenant {t_id}")
                        # Calculate Period: (PrevMonth RunDay+1) -> (Today)
                        # Re-use logic or let Service handle defaults? Service handles defaults if None passed.
                        # But task expects strings.
                        
                        # Let's calculate precise dates to be safe
                        # ... (Using Service logic or simplified)
                        # We defer the task with empty dates? Service: "if not start_date... Auto-calculate".
                        # Yes, passing None relies on Service auto-calc.
                        
                        await calculate_overtime_period_task.defer_async(
                            tenant_id=t_id,
                            start_date=None,
                            end_date=None
                        )
            except Exception as te:
                print(f"[Task] Error checking tenant {t_id}: {te}")

    except Exception as e:
        print(f"[Task] Error in check_daily_cutoff: {e}")
        # Reschedule itself is handled by periodic trigger?
        # Procrastinate periodic via '@periodic' needs worker support.
        # If we use self-deferral pattern:
        # await check_daily_cutoff.defer_async(schedule_in={'seconds': 86400})
        pass
