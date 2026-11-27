"""
Inventory valuation endpoint (AGENTS.md rule 8).

The tenant-backend POSTs a batch of stock moves that just became done. This handler runs the
FIFO layer consumption and the AVCO recalculation on the engine's clock and writes the results to
the valuation tables. It does no business validation of the moves themselves (the tenant-backend
already moved the stock atomically); it only does the costing maths the ledger deferred to it.

Auth: when INTERNAL_SERVICE_SECRET is set, the request must carry the matching
`x-internal-service-key` (the tenant-backend sends it via internalServiceHeaders, like the AI
module). When unset the endpoint is open, matching the rest of the calculation service so a local
/dev deployment without a shared secret still works.
"""
import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.services.valuation_service import ValuationService

router = APIRouter()


class ValuationMove(BaseModel):
    move_id: Optional[str] = None
    product_id: Optional[str] = None
    lot_id: Optional[str] = None
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    quantity: "float | str" = 0
    unit_cost: "float | str" = 0


class ValuationRequest(BaseModel):
    tenant_id: str
    moves: List[ValuationMove] = []


def _assert_internal(x_internal_service_key: Optional[str]) -> None:
    """Fail closed when a shared secret is configured and the key is missing or wrong."""
    secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not secret:
        return
    if not x_internal_service_key or x_internal_service_key != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing internal service key")


@router.post("/valuation")
async def valuation(
    request: ValuationRequest,
    x_internal_service_key: Optional[str] = Header(default=None, alias="x-internal-service-key"),
):
    """Consume FIFO layers and recalc AVCO for the moves the tenant-backend just posted."""
    _assert_internal(x_internal_service_key)
    try:
        service = ValuationService(request.tenant_id)
        result = await service.process([m.model_dump() for m in request.moves])
        return result
    except ValueError as e:
        # No database connection for this tenant: report it clearly, do not 500 with a stack.
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
