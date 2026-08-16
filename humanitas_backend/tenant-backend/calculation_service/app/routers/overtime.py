from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.job_queue import job_queue

router = APIRouter(tags=["Overtime"])

class OTCalculationRequest(BaseModel):
    tenant_id: str
    date_str: str
    log_id: Optional[str] = None

class OTCalculatePeriodRequest(BaseModel):
    tenant_id: str
    year: Optional[int] = None
    month: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    log_id: Optional[str] = None

@router.post("/calculate")
async def calculate_overtime(request: OTCalculationRequest):
    """
    Queue daily overtime calculation job.
    """
    print(f"[OT API] Received Daily OT Request for Tenant: {request.tenant_id} on {request.date_str}, LogID: {request.log_id}")
    
    try:
        job_id = job_queue.enqueue("calculate_overtime_daily", {
            "tenant_id": request.tenant_id,
            "date_str": request.date_str,
            "log_id": request.log_id
        })
        return {"status": "queued", "job_id": job_id, "message": "Daily overtime calculation queued successfully."}
    except Exception as e:
        print(f"[OT API] Error queuing job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/calculate-period")
async def calculate_overtime_period(request: OTCalculatePeriodRequest):
    """
    Queue period overtime calculation job.
    """
    print(f"[OT API] Received Period OT Request for Tenant: {request.tenant_id}, LogID: {request.log_id}")

    try:
        job_id = job_queue.enqueue("calculate_overtime_period", {
            "tenant_id": request.tenant_id,
            "year": request.year,
            "month": request.month,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "log_id": request.log_id
        })
        return {"status": "queued", "job_id": job_id, "message": "Period overtime calculation queued successfully."}
    except Exception as e:
        print(f"[OT API] Error queuing job: {e}")
        raise HTTPException(status_code=500, detail=str(e))
