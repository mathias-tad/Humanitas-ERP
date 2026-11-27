"""
Unit tests for the inventory valuation engine (AGENTS.md rule 8, featureslist §2).

The costing maths lives in the calculation service, so it is tested here exactly as the other
engine formulas are — plain unittest, which is how CI discovers these (`python -m unittest
discover -s tests`). Only the pure functions are exercised (no database): FIFO layer
consumption, AVCO averaging, and the inbound/outbound/internal direction rule. Money and
quantities use NUMERIC(18,4), so every figure is rounded to 4 dp half-up (rule 24.7).
"""
import unittest

from decimal import Decimal

from app.services.valuation_service import ValuationService, avco_average, fifo_consume


def d(x):
    return Decimal(str(x))


class TestFifoConsumption(unittest.TestCase):
    def test_consumes_oldest_layer_first(self):
        layers = [
            {"id": "old", "remaining_qty": d("10"), "remaining_value": d("100")},   # cost 10
            {"id": "new", "remaining_qty": d("10"), "remaining_value": d("200")},   # cost 20
        ]
        layers, consumed, overflow = fifo_consume(layers, d("5"))
        # 5 units come out of the oldest layer at cost 10.
        self.assertEqual(layers[0]["remaining_qty"], d("5"))
        self.assertEqual(layers[0]["remaining_value"], d("50"))
        self.assertEqual(layers[1]["remaining_qty"], d("10"))
        self.assertEqual(consumed, d("50"))
        self.assertEqual(overflow, d("0"))

    def test_spans_two_layers_pro_rata(self):
        layers = [
            {"id": "old", "remaining_qty": d("3"), "remaining_value": d("30")},   # cost 10
            {"id": "new", "remaining_qty": d("10"), "remaining_value": d("200")},  # cost 20
        ]
        _, consumed, overflow = fifo_consume(layers, d("5"))
        # 3 @ 10 + 2 @ 20 = 30 + 40 = 70
        self.assertEqual(consumed, d("70"))
        self.assertEqual(overflow, d("0"))

    def test_uncovered_tail_is_overflow_not_lost(self):
        layers = [
            {"id": "old", "remaining_qty": d("2"), "remaining_value": d("20")},
        ]
        _, consumed, overflow = fifo_consume(layers, d("5"))
        self.assertEqual(consumed, d("20"))   # only what the open layer held
        self.assertEqual(overflow, d("3"))     # the uncovered tail, recorded as negative stock


class TestAvcoAverage(unittest.TestCase):
    def test_weighted_average_across_layers(self):
        layers = [
            {"remaining_qty": d("10"), "remaining_value": d("100")},
            {"remaining_qty": d("10"), "remaining_value": d("200")},
        ]
        self.assertEqual(avco_average(layers), d("15.0000"))

    def test_folds_in_new_inbound(self):
        layers = [
            {"remaining_qty": d("10"), "remaining_value": d("100")},  # cost 10
        ]
        # Arrives: 10 more at cost 30 -> (100 + 300) / 20 = 20
        self.assertEqual(avco_average(layers, inbound_qty=10, inbound_value=300), d("20.0000"))

    def test_zero_quantity_returns_zero_not_error(self):
        self.assertEqual(avco_average([], inbound_qty=0, inbound_value=0), d("0"))


class TestRounding(unittest.TestCase):
    def test_rounds_half_up_to_four_dp(self):
        # 100 / 3 = 33.333333... -> 33.3333 (4 dp)
        layers = [{"remaining_qty": d("3"), "remaining_value": d("100")}]
        self.assertEqual(avco_average(layers), d("33.3333"))


class TestMoveDirection(unittest.TestCase):
    def test_inbound(self):
        self.assertEqual(ValuationService.direction({"to_location_id": "loc"}), "inbound")

    def test_outbound(self):
        self.assertEqual(ValuationService.direction({"from_location_id": "loc"}), "outbound")

    def test_internal(self):
        self.assertEqual(ValuationService.direction({"from_location_id": "a", "to_location_id": "b"}), "internal")


if __name__ == "__main__":
    unittest.main()
