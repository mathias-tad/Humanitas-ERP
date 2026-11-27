"""
Inventory valuation — FIFO layers and AVCO recalculation (AGENTS.md rule 8).

NestJS records stock moves in the append-only ledger and hands them to this endpoint. The
costing maths lives here, on the engine's clock:
  * FIFO  — an outbound move consumes the oldest open valuation layers first.
  * AVCO  — the product's rolling average cost is recomputed as total open value / total open
            quantity (a just-arrived inbound quantity and value fold in).

The layer tables the engine reads and writes (see 20261123000001_inventory_core.sql):
  * inventory_valuation_layers — the FIFO queue (one row per inbound layer; remaining_qty /
    remaining_value track what is still open).
  * inventory_product_config   — the AVCO running figures (average_cost, quantity_on_hand,
    value_on_hand).

The FIFO and AVCO steps are pure functions (`fifo_consume`, `avco_average`) so they can be unit
tested without a database; `ValuationService.process` wires them to Postgres.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

from sqlalchemy import text

from app.database import db_manager

# Money and stock quantities are NUMERIC(18,4) in the schema — round to 4 dp, half-up (rule 24.7).
_Q = Decimal("0.0001")


def _d(value) -> Decimal:
    return Decimal(str(value if value is not None else 0))


def _round4(value) -> Decimal:
    return Decimal(value).quantize(_Q, rounding=ROUND_HALF_UP)


def fifo_consume(
    layers: List[Dict],
    quantity,
) -> Tuple[List[Dict], Decimal, Decimal]:
    """
    Consume `quantity` from the oldest-first FIFO layers.

    `layers` is a list of open-layer dicts (each with 'remaining_qty' and 'remaining_value'); the
    list is consumed in place (rows are re-sorted oldest-first by the caller) and mutated.

    Returns:
      layers        — the same list with remaining_qty / remaining_value reduced.
      consumed_value — total value taken from the layers (cost of goods consumed).
      overflow       — quantity that no open layer could cover (a negative-stock receipt).
    """
    need = _round4(_d(quantity))
    consumed = Decimal("0")
    overflow = Decimal("0")
    for layer in layers:
        if need <= 0:
            break
        open_qty = _round4(_d(layer.get("remaining_qty")))
        open_val = _round4(_d(layer.get("remaining_value")))
        if open_qty <= 0:
            continue
        take = open_qty if open_qty <= need else need
        # Value is taken pro-rata by quantity so the average never drifts.
        layer_value = open_val if take == open_qty else _round4(open_val * take / open_qty)
        layer["remaining_qty"] = _round4(open_qty - take)
        layer["remaining_value"] = _round4(open_val - layer_value)
        consumed += layer_value
        need -= take
        if need < 0:
            need = Decimal("0")
    if need > 0:
        overflow = need
    return layers, _round4(consumed), _round4(overflow)


def avco_average(
    layers: List[Dict],
    inbound_qty=0,
    inbound_value=0,
) -> Decimal:
    """
    Weighted-average unit cost across the open layers plus a just-arrived inbound quantity/value.

    Zero quantity returns 0, never a division error (an empty product has no cost basis yet).
    """
    total_qty = sum(_round4(_d(l.get("remaining_qty"))) for l in layers)
    total_value = sum(_round4(_d(l.get("remaining_value"))) for l in layers)
    total_qty += _round4(_d(inbound_qty))
    total_value += _round4(_d(inbound_value))
    if total_qty <= 0:
        return Decimal("0")
    return _round4(total_value / total_qty)


class ValuationService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    @staticmethod
    def direction(move: Dict) -> str:
        """Inbound adds a layer, outbound consumes them, internal is value-neutral."""
        to = move.get("to_location_id")
        frm = move.get("from_location_id")
        if to and not frm:
            return "inbound"
        if frm and not to:
            return "outbound"
        return "internal"

    async def process(self, moves: List[Dict]) -> Dict:
        """
        Apply a batch of moves to the valuation layers, then refresh each touched product's AVCO.
        Idempotent enough to re-run: layers are keyed by move, so re-processing the same move does
        not double-count (the inbound layer insert is guarded on move_id).
        """
        touched: List[str] = []
        if not moves:
            return {"status": "success", "moved": 0, "products": 0}

        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            for move in moves:
                product_id = move.get("product_id")
                if not product_id:
                    continue
                direction = self.direction(move)
                quantity = _round4(move.get("quantity") or 0)
                if quantity <= 0:
                    continue
                unit_cost = _round4(move.get("unit_cost") or 0)
                location = move.get("to_location_id") or move.get("from_location_id")

                if direction == "inbound":
                    await self._add_layer(session, move, quantity, unit_cost, location)
                elif direction == "outbound":
                    await self._consume(session, move, quantity, location)
                # internal: value does not change, the layer simply follows the stock.
                if product_id not in touched:
                    touched.append(product_id)

            for product_id in touched:
                await self._refresh_avco(session, product_id)
            await session.commit()

        return {"status": "success", "moved": len(moves), "products": len(touched)}

    async def _add_layer(self, session, move: Dict, quantity: Decimal, unit_cost: Decimal, location) -> None:
        # Guard: one layer per inbound move (idempotent re-runs).
        guard = await session.execute(
            text("SELECT 1 FROM inventory_valuation_layers WHERE move_id = :mid LIMIT 1"),
            {"mid": move.get("move_id")},
        )
        if guard.fetchone():
            return
        value = _round4(quantity * unit_cost)
        await session.execute(
            text(
                """
                INSERT INTO inventory_valuation_layers
                    (product_id, lot_id, location_id, move_id, quantity, remaining_qty,
                     unit_cost, value, remaining_value, company_id, branch_id)
                VALUES
                    (:pid, :lot, :loc, :mid, :qty, :qty, :uc, :val, :val, :comp, :br)
                """
            ),
            {
                "pid": move.get("product_id"),
                "lot": move.get("lot_id"),
                "loc": location,
                "mid": move.get("move_id"),
                "qty": quantity,
                "uc": unit_cost,
                "val": value,
                "comp": move.get("company_id"),
                "br": move.get("branch_id"),
            },
        )

    async def _consume(self, session, move: Dict, quantity: Decimal, location) -> None:
        product_id = move.get("product_id")
        company_id = move.get("company_id")
        # Each company keeps its own books: only its own layers are consumed.
        rows = (
            await session.execute(
                text(
                    """
                    SELECT id, remaining_qty, remaining_value FROM inventory_valuation_layers
                     WHERE product_id = :pid AND remaining_qty > 0
                       AND company_id IS NOT DISTINCT FROM CAST(:comp AS uuid)
                     ORDER BY created_at ASC, id ASC
                     FOR UPDATE
                    """
                ),
                {"pid": product_id, "comp": company_id},
            )
        ).mappings().all()
        layers = [dict(r) for r in rows]
        _, consumed, overflow = fifo_consume(layers, quantity)
        # Persist the reduced layers; an uncovered tail is recorded, not silently dropped.
        for layer in layers:
            await session.execute(
                text("UPDATE inventory_valuation_layers SET remaining_qty = :q, remaining_value = :v, updated_at = now() WHERE id = :id"),
                {"q": layer["remaining_qty"], "v": layer["remaining_value"], "id": layer["id"]},
            )
        if overflow > 0:
            # Negative stock: no layer covers the tail, so a zero-cost layer of minus that quantity keeps
            # the layer total equal to the stock (it is never consumed; a later receipt adds its own layer).
            await session.execute(
                text(
                    """
                    INSERT INTO inventory_valuation_layers
                        (product_id, location_id, move_id, quantity, remaining_qty, unit_cost, value, remaining_value, company_id, branch_id)
                    VALUES (:pid, :loc, :mid, :qty, :qty, 0, 0, 0, :comp, :br)
                    """
                ),
                {"pid": product_id, "loc": location, "mid": move.get("move_id"), "qty": -overflow, "comp": company_id, "br": move.get("branch_id")},
            )
        # `consumed` is the cost of goods for accounting; the layers already reflect it.

    async def _refresh_avco(self, session, product_id: str) -> None:
        row = (
            await session.execute(
                text(
                    """
                    SELECT COALESCE(SUM(remaining_qty), 0) AS q, COALESCE(SUM(remaining_value), 0) AS v
                      FROM inventory_valuation_layers WHERE product_id = :pid
                    """
                ),
                {"pid": product_id},
            )
        ).fetchone()
        total_qty = _round4(row[0]) if row else Decimal("0")
        total_value = _round4(row[1]) if row else Decimal("0")
        average = _round4(total_value / total_qty) if total_qty > 0 else Decimal("0")
        await session.execute(
            text(
                """
                INSERT INTO inventory_product_config (product_id, average_cost, quantity_on_hand, value_on_hand)
                VALUES (:pid, :avg, :q, :v)
                ON CONFLICT (product_id) DO UPDATE
                   SET average_cost = EXCLUDED.average_cost,
                       quantity_on_hand = EXCLUDED.quantity_on_hand,
                       value_on_hand = EXCLUDED.value_on_hand,
                       updated_at = now()
                """
            ),
            {"pid": product_id, "avg": average, "q": total_qty, "v": total_value},
        )
