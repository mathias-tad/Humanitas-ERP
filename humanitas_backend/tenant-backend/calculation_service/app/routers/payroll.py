from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import date
import io

from app.services.payroll_service import PayrollService
from app.job_queue import job_queue

router = APIRouter()


class PayrollCalculationRequest(BaseModel):
    tenant_id: str
    month: int
    year: int
    employee_ids: Optional[list[str]] = None  # None means all employees


class PayrollExportRequest(BaseModel):
    tenant_id: str
    month: int
    year: int


class RunPayrollRequest(BaseModel):
    tenant_id: str
    month: int
    year: int
    user_id: Optional[str] = "system-auto"


@router.post("/run")
async def run_payroll(request: RunPayrollRequest):
    """
    Queue payroll calculation job.
    This endpoint enqueues the job and returns immediately.
    The worker will process the calculation asynchronously.
    """
    try:
        job_id = job_queue.enqueue("payroll_calculation", {
            "tenant_id": request.tenant_id,
            "month": request.month,
            "year": request.year,
            "user_id": request.user_id
        })
        return {
            "status": "queued",
            "job_id": job_id,
            "message": f"Payroll calculation queued for {request.month}/{request.year}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate")
async def calculate_payroll(request: PayrollCalculationRequest):
    """Calculate payroll for specified month/year"""
    try:
        service = PayrollService(request.tenant_id)
        result = await service.calculate_payroll(
            month=request.month,
            year=request.year,
            employee_ids=request.employee_ids
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/excel")
async def export_payroll_excel(request: PayrollExportRequest):
    """Export payroll to Excel file"""
    try:
        service = PayrollService(request.tenant_id)
        excel_buffer = await service.export_to_excel(
            month=request.month,
            year=request.year
        )
        
        filename = f"payroll_{request.year}_{request.month:02d}.xlsx"
        
        return StreamingResponse(
            io.BytesIO(excel_buffer),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}")
async def get_payroll_job_status(job_id: str):
    """Get status of a payroll calculation job"""
    # TODO: Implement job status tracking
    return {"job_id": job_id, "status": "pending"}


@router.post("/fix-loans")
async def fix_broken_loans(request: RunPayrollRequest):
    """
    TEMPORARY DEBUG ENDPOINT: Fix loans that were broken by multiple test payroll runs.
    This resets all completed loans with 0 balance back to active status.
    
    WARNING: This is a temporary fix for development/testing. Remove in production!
    """
    try:
        from app.database import db_manager
        from sqlalchemy import text
        
        # Get a proper database session - must await the coroutine first
        session = await db_manager.get_tenant_session(request.tenant_id)
        
        try:
            # Find all completed loans with 0 balance (likely broken by testing)
            result = await session.execute(
                text("""
                    SELECT id, user_id, loan_type, monthly_deduction, 
                           total_amount, remaining_balance
                    FROM loans
                    WHERE status = 'completed' AND remaining_balance <= 0
                """)
            )
            broken_loans = result.fetchall()
            
            fixed_count = 0
            for loan in broken_loans:
                # Reset to: total_amount - monthly_deduction
                # (Assuming only 1 month should have been deducted)
                new_balance = float(loan.total_amount or 0) - float(loan.monthly_deduction or 0)
                
                if new_balance > 0:
                    await session.execute(
                        text("""
                            UPDATE loans
                            SET remaining_balance = :new_balance,
                                status = 'active',
                                updated_at = NOW()
                            WHERE id = :id
                        """),
                        {"new_balance": new_balance, "id": loan.id}
                    )
                    fixed_count += 1
                    print(f"[Fix Loans] Reset loan {loan.id}: {loan.total_amount} - {loan.monthly_deduction} = {new_balance}")
            
            await session.commit()
            
            return {
                "status": "success",
                "message": f"Fixed {fixed_count} broken loan(s)",
                "fixed_count": fixed_count,
                "details": [{"id": str(l.id), "type": l.loan_type} for l in broken_loans]
            }
        finally:
            await session.close()
            
    except Exception as e:
        import traceback
        print(f"[Fix Loans] Error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
