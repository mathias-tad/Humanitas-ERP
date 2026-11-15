import unittest
from decimal import Decimal

from app.services.payroll_service import money
from app.database import mask_db_url


class TestMoneyRounding(unittest.TestCase):
    def test_half_up_not_bankers(self):
        # float 2.675 is 2.67499999... in binary; payroll must still round to 2.68
        self.assertEqual(money(2.675), Decimal("2.68"))
        self.assertEqual(money(0.125), Decimal("0.13"))

    def test_none_and_decimal(self):
        self.assertEqual(money(None), Decimal("0.00"))
        self.assertEqual(money(Decimal("10.005")), Decimal("10.01"))

    def test_components_sum_exactly(self):
        gross = money(10000.333)
        deductions = money(1500.125) + money(700.0049)
        net = gross - deductions
        self.assertEqual(net + deductions, gross)


class TestMaskDbUrl(unittest.TestCase):
    def test_password_with_at_sign_is_hidden(self):
        masked = mask_db_url("postgresql://postgres:Pa@ss@db.internal:5432/humanitas")
        self.assertNotIn("Pa@ss", masked)
        self.assertNotIn("postgres:", masked.split("://", 1)[1])
        self.assertTrue(masked.endswith("db.internal:5432/humanitas"))


if __name__ == "__main__":
    unittest.main()
