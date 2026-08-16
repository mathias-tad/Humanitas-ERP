from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import db_manager
from app.routers import payroll, kpi, health, leave, overtime, pms_kpi, system


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    
    # Configure logging
    import logging
    root_logger = logging.getLogger()
    # Check if handler already exists to avoid duplication
    if not any(isinstance(h, logging.FileHandler) for h in root_logger.handlers):
        file_handler = logging.FileHandler("app.log", encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        root_logger.addHandler(file_handler)
        print(f"[{settings.service_name}] File logging enabled to app.log")
    
    await db_manager.init_admin_connection(settings.admin_database_url)
    print(f"[{settings.service_name}] Connected to admin database")
    yield
    # Shutdown
    await db_manager.close()
    print(f"[{settings.service_name}] Closed all connections")


app = FastAPI(
    title="Calculation Service",
    description="Handles payroll calculations, KPI calculations, and report generation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])
app.include_router(kpi.router, prefix="/api/kpi", tags=["KPI"])
app.include_router(leave.router, prefix="/api", tags=["Leave"])
app.include_router(overtime.router, prefix="/api/overtime", tags=["Overtime"])
app.include_router(pms_kpi.router, prefix="/api/pms/kpi", tags=["PMS KPI"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
