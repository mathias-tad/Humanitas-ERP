# Celery Tasks for Calculation Service
import asyncio
from celery import shared_task
from app.services.overtime_service import OvertimeService
from app.database import db_manager
import requests

# Helper to run async code in sync Celery tasks
def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def calculate_overtime_daily_task(self, tenant_id: str, date_str: str, log_id: str = None):
    """
    Calculate overtime for a single day.
    """
    print(f"[Celery Task] Starting Daily OT Calculation for Tenant: {tenant_id} on {date_str}")
    
    async def _run():
        session = await db_manager.get_tenant_session(tenant_id)
        async with session:
            service = OvertimeService(tenant_id)
            result = await service.calculate_daily_ot_with_session(session, date_str)
            return result
    
    try:
        result = run_async(_run())
        print(f"[Celery Task] Daily OT Completed: {result}")
        
        # Send webhook notification
        if log_id:
            try:
                requests.post("http://localhost:3001/api/v1/overtime/webhook/notification", json={
                    "tenantId": tenant_id,
                    "type": "OVERTIME_CALCULATION_COMPLETED",
                    "logId": log_id,
                    "payload": result,
                    "status": "COMPLETED"
                }, timeout=5)
            except Exception as we:
                print(f"[Celery Task] Webhook failed: {we}")
        
        return result
    except Exception as e:
        print(f"[Celery Task] Error: {e}")
        
        # Send failure webhook
        if log_id:
            try:
                requests.post("http://localhost:3001/api/v1/overtime/webhook/notification", json={
                    "tenantId": tenant_id,
                    "type": "OVERTIME_CALCULATION_FAILED",
                    "logId": log_id,
                    "error": str(e),
                    "status": "FAILED"
                }, timeout=5)
            except:
                pass
        
        # Retry the task
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def calculate_overtime_period_task(self, tenant_id: str, year: int = None, month: int = None, 
                                    start_date: str = None, end_date: str = None, log_id: str = None):
    """
    Calculate overtime for a period.
    """
    print(f"[Celery Task] Starting Period OT Calculation for Tenant: {tenant_id}")
    
    async def _run():
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
            return result
    
    try:
        result = run_async(_run())
        print(f"[Celery Task] Period OT Completed: {result}")
        
        # Send webhook notification
        if log_id:
            try:
                requests.post("http://localhost:3001/api/v1/overtime/webhook/notification", json={
                    "tenantId": tenant_id,
                    "type": "OVERTIME_CALCULATION_COMPLETED",
                    "logId": log_id,
                    "payload": result,
                    "status": "COMPLETED"
                }, timeout=5)
            except Exception as we:
                print(f"[Celery Task] Webhook failed: {we}")
        
        return result
    except Exception as e:
        print(f"[Celery Task] Error: {e}")
        
        # Send failure webhook
        if log_id:
            try:
                requests.post("http://localhost:3001/api/v1/overtime/webhook/notification", json={
                    "tenantId": tenant_id,
                    "type": "OVERTIME_CALCULATION_FAILED",
                    "logId": log_id,
                    "error": str(e),
                    "status": "FAILED"
                }, timeout=5)
            except:
                pass
        
        # Retry the task
        raise self.retry(exc=e)
