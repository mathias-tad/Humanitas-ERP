from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.services.leave_service import LeaveService

router = APIRouter(prefix="/leave", tags=["Leave Accrual"])


@router.get("/status/{user_id}")
async def get_user_leave_status(
    user_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id")
):
    """Get user's leave status including probation info"""
    try:
        service = LeaveService(x_tenant_id)
        return await service.get_user_leave_status(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/balance/{user_id}")
async def calculate_user_leave_balance(
    user_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id")
):
    """Calculate and return user's leave balance based on accrual rules"""
    try:
        service = LeaveService(x_tenant_id)
        return await service.calculate_user_leave_balance(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accrual/run")
async def run_monthly_accrual(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id")
):
    """Run monthly leave accrual for all eligible users"""
    try:
        service = LeaveService(x_tenant_id)
        return await service.run_monthly_accrual()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
