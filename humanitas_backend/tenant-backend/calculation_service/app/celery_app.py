# Celery App Configuration
from celery import Celery
from app.config import get_settings

settings = get_settings()

# Use Redis URL from settings, default to localhost
redis_url = settings.redis_url or "redis://localhost:6379/0"

# Create the Celery app instance
celery_app = Celery(
    "calculation_service",
    broker=redis_url,
    backend=redis_url,
    include=["app.celery_tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max per task
    worker_prefetch_multiplier=1,  # Process one task at a time
    task_acks_late=True,  # Acknowledge after completion (for retries on crash)
)
