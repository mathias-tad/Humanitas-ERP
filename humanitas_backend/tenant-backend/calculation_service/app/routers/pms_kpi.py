from fastapi import APIRouter, HTTPException
from app.services.pms_kpi_service import PMSKPIService
import traceback

router = APIRouter(
    tags=["PMS KPI"]
)

@router.get("/user/{tenant_id}/{user_id}")
async def get_user_kpis(tenant_id: str, user_id: str):
    """Get calculated KPIs for a specific user"""
    try:
        service = PMSKPIService(tenant_id)
        result = await service.get_user_kpis(user_id)
        return {"status": "success", "data": result}
    except Exception as e:
        traceback.print_exc()  # [DEBUG] Print full traceback to console
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{tenant_id}/{project_id}")
async def get_project_kpis(tenant_id: str, project_id: str):
    """Get calculated KPIs for a specific project"""
    try:
        service = PMSKPIService(tenant_id)
        result = await service.get_project_kpis(project_id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tenant/{tenant_id}")
async def get_tenant_kpis(tenant_id: str):
    """Get aggregated KPIs for the entire tenant"""
    try:
        service = PMSKPIService(tenant_id)
        result = await service.get_tenant_kpis()
        return {"status": "success", "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all-users/{tenant_id}")
async def get_all_users_kpis(tenant_id: str):
    """Get KPIs for all users in the tenant, sorted by score"""
    try:
        service = PMSKPIService(tenant_id)
        result = await service.get_all_users_kpis()
        return {"status": "success", "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

