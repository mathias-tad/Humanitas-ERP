from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.services.kpi_service import KPIService

router = APIRouter()


class KPICalculationRequest(BaseModel):
    tenant_id: str
    month: int
    year: int
    department_id: Optional[str] = None  # None means all departments


@router.post("/calculate")
async def calculate_kpi(request: KPICalculationRequest):
    """Calculate KPIs for specified month/year"""
    try:
        service = KPIService(request.tenant_id)
        result = await service.calculate_kpi(
            month=request.month,
            year=request.year,
            department_id=request.department_id
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{tenant_id}")
async def get_kpi_summary(tenant_id: str, month: int, year: int):
    """Get KPI summary for a tenant"""
    try:
        service = KPIService(tenant_id)
        result = await service.get_summary(month=month, year=year)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
