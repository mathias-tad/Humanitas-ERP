"""Authenticated callbacks from the calculation service to the tenant API.

The tenant API's overtime webhook rejects any request without the shared
INTERNAL_SERVICE_SECRET in the `x-internal-service-key` header.

Environment:
  TENANT_API_INTERNAL_URL  e.g. http://tenant-api:3001/api/v1  (default: http://localhost:3001/api/v1)
  INTERNAL_SERVICE_SECRET  same value as on the tenant API (min 32 chars)
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

WEBHOOK_PATH = "/overtime/webhook/notification"


def _webhook_url() -> str:
    base = os.getenv("TENANT_API_INTERNAL_URL", "http://localhost:3001/api/v1").rstrip("/")
    return f"{base}{WEBHOOK_PATH}"


def notify_tenant_api(payload: dict, timeout: int = 5):
    """POST a notification to the tenant API webhook. Never raises."""
    secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not secret:
        logger.error("INTERNAL_SERVICE_SECRET is not set; webhook to tenant API will be rejected.")
    try:
        return requests.post(
            _webhook_url(),
            json=payload,
            headers={"x-internal-service": "calculation-service", "x-internal-service-key": secret},
            timeout=timeout,
        )
    except Exception as err:  # network errors must not break calculations
        logger.warning("Webhook to tenant API failed: %s", err)
        return None
