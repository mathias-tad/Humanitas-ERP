# PostgreSQL Job Queue Worker
import time
import asyncio
import traceback
import logging
from app.job_queue import job_queue
from app.config import get_settings
from app.services.overtime_service import OvertimeService
from app.services.payroll_service import PayrollService
from app.database import db_manager
import requests

# Task handlers - maps task_name to handler function
async def handle_calculate_overtime_daily(payload: dict):
    """Handle daily overtime calculation"""
    tenant_id = payload["tenant_id"]
    date_str = payload["date_str"]
    log_id = payload.get("log_id")
    
    print(f"[Worker] Processing daily OT for {tenant_id} on {date_str}")
    
    session = await db_manager.get_tenant_session(tenant_id)
    async with session:
        service = OvertimeService(tenant_id)
        result = await service.calculate_daily_ot_with_session(session, date_str)
        
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
            except Exception as e:
                print(f"[Worker] Webhook failed: {e}")
        
        return result


async def handle_calculate_overtime_period(payload: dict):
    """Handle period overtime calculation"""
    tenant_id = payload["tenant_id"]
    year = payload.get("year")
    month = payload.get("month")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    log_id = payload.get("log_id")
    
    print(f"[Worker] Processing period OT for {tenant_id}")
    
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
            except Exception as e:
                print(f"[Worker] Webhook failed: {e}")
        
        return result


async def handle_payroll_calculation(payload: dict):
    """Handle payroll calculation for a specific month/year"""
    tenant_id = payload["tenant_id"]
    month = payload["month"]
    year = payload["year"]
    user_id = payload.get("user_id", "system-auto")
    
    print(f"[Worker] Processing payroll for {tenant_id} - {month}/{year}")
    
    service = PayrollService(tenant_id)
    result = await service.calculate_payroll(
        month=month,
        year=year,
        user_id=user_id
    )
    
    print(f"[Worker] Payroll completed for {tenant_id} - {result.get('total_employees', 0)} employees")
    return result


# Task registry
TASK_HANDLERS = {
    "calculate_overtime_daily": handle_calculate_overtime_daily,
    "calculate_overtime_period": handle_calculate_overtime_period,
    "payroll_calculation": handle_payroll_calculation,
}


async def process_job(job: dict):
    """Process a single job"""
    task_name = job["task_name"]
    payload = job["payload"]
    
    handler = TASK_HANDLERS.get(task_name)
    if not handler:
        raise ValueError(f"Unknown task: {task_name}")
    
    return await handler(payload)


async def send_failure_webhook(payload: dict, error: str):
    """Send failure notification"""
    log_id = payload.get("log_id")
    tenant_id = payload.get("tenant_id")
    
    if log_id:
        try:
            requests.post("http://localhost:3001/api/v1/overtime/webhook/notification", json={
                "tenantId": tenant_id,
                "type": "OVERTIME_CALCULATION_FAILED",
                "logId": log_id,
                "error": error,
                "status": "FAILED"
            }, timeout=5)
        except:
            pass


async def run_worker():
    """Main worker loop"""
    settings = get_settings()

    # Configure logging
    root_logger = logging.getLogger()
    if not any(isinstance(h, logging.FileHandler) for h in root_logger.handlers):
        file_handler = logging.FileHandler("app.log", encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        root_logger.addHandler(file_handler)
        root_logger.setLevel(logging.INFO)

    if not settings.admin_database_url:
        logging.error("[Worker] Error: No database URL found")
        return
    
    # Initialize database manager
    await db_manager.init_admin_connection(settings.admin_database_url)
    
    # Initialize job queue schema
    job_queue.init_schema()
    
    logging.info("[Worker] Worker started, waiting for jobs...")
    
    while True:
        try:
            job = job_queue.fetch_pending_job()
            
            if job:
                logging.info(f"[Worker] Processing job {job['id']}: {job['task_name']}")
                try:
                    await process_job(job)
                    job_queue.mark_completed(job["id"])
                except Exception as e:
                    error_msg = str(e)
                    logging.error(f"[Worker] Job {job['id']} failed: {error_msg}")
                    traceback.print_exc()
                    
                    can_retry = job["attempts"] < job["max_attempts"]
                    job_queue.mark_failed(job["id"], error_msg, can_retry)
                    
                    if not can_retry:
                        await send_failure_webhook(job["payload"], error_msg)
            else:
                # No pending jobs, sleep briefly
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("[Worker] Shutting down...")
            break
        except Exception as e:
            print(f"[Worker] Error in worker loop: {e}")
            traceback.print_exc()
            time.sleep(5)  # Wait before retrying on error


def main():
    print("[Worker] Starting PostgreSQL Job Queue Worker...")
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
