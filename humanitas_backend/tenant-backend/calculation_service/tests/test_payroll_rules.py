"""Tests that exercise the real payroll/leave service functions (not re-derived
formulas). Tax brackets mirror the seeded Ethiopian monthly table in
migrations/tenant/20260201000007_seed_data.sql."""
import contextlib
import io
import unittest
from datetime import date
from types import SimpleNamespace
from unittest import mock

from app.services.payroll_service import PayrollService
from app.services import leave_service as leave_module
from app.services.leave_service import LeaveService

SEEDED_BRACKETS = [
    # (min, max, rate %, deductible)
    (0, 600, 0, 0),
    (601, 1650, 10, 60),
    (1651, 3200, 15, 142.5),
    (3201, 5250, 20, 302.5),
    (5251, 7800, 25, 565),
    (7801, 10900, 30, 955),
    (10901, 99999999, 35, 1500),
]


def rules(brackets=SEEDED_BRACKETS):
    return [SimpleNamespace(min_salary=a, max_salary=b, tax_rate=r, deductible=d) for a, b, r, d in brackets]


class IncomeTaxTests(unittest.TestCase):
    def setUp(self):
        self.svc = PayrollService("tenant-test")

    def tax(self, income, pro_rata=1.0, tax_rules=None):
        with contextlib.redirect_stdout(io.StringIO()):  # the service prints debug lines
            return self.svc.calculate_income_tax(income, income, rules() if tax_rules is None else tax_rules, pro_rata)

    def test_values_inside_each_bracket(self):
        cases = {
            500: 0.0,
            1000: 40.0,      # 10% - 60
            2500: 232.5,     # 15% - 142.5
            5000: 697.5,     # 20% - 302.5
            7000: 1185.0,    # 25% - 565
            10000: 2045.0,   # 30% - 955
            20000: 5500.0,   # 35% - 1500
        }
        for income, expected in cases.items():
            with self.subTest(income=income):
                self.assertAlmostEqual(self.tax(income), expected, places=6)

    def test_upper_edges_use_their_bracket(self):
        for income, expected in {600: 0.0, 1650: 105.0, 3200: 337.5, 5250: 747.5, 7800: 1385.0, 10900: 2315.0}.items():
            with self.subTest(income=income):
                self.assertAlmostEqual(self.tax(income), expected, places=6)

    def test_incomes_in_the_one_unit_gaps_are_taxed(self):
        # Regression: these used to match no bracket and were taxed 0.
        cases = {601: 0.1, 600.5: 0.05, 1650.5: 105.075, 1651: 105.15, 3200.4: 337.58, 3201: 337.7,
                 5251: 747.75, 7801: 1385.3, 10901: 2315.35}
        for income, expected in cases.items():
            with self.subTest(income=income):
                self.assertAlmostEqual(self.tax(income), expected, places=6)

    def test_tax_is_continuous_across_bracket_edges(self):
        for edge in (600, 1650, 3200, 5250, 7800, 10900):
            with self.subTest(edge=edge):
                self.assertLess(abs(self.tax(edge + 0.5) - self.tax(edge)), 1.0)
                self.assertGreaterEqual(self.tax(edge + 0.5), self.tax(edge))

    def test_no_tax_without_income_or_rules(self):
        self.assertEqual(self.tax(0), 0)
        self.assertEqual(self.tax(-100), 0)
        self.assertEqual(self.tax(5000, tax_rules=[]), 0)

    def test_deduction_is_pro_rated(self):
        # Half a month: 10% of 1000 minus half the 60 deduction.
        self.assertAlmostEqual(self.tax(1000, pro_rata=0.5), 70.0, places=6)

    def test_rule_order_does_not_matter(self):
        shuffled = list(reversed(rules()))
        for income in (500, 1650.5, 5000, 20000):
            with self.subTest(income=income):
                self.assertAlmostEqual(self.tax(income, tax_rules=shuffled), self.tax(income), places=6)

    def test_income_below_the_lowest_bracket_is_not_taxed(self):
        no_zero_bracket = rules(SEEDED_BRACKETS[1:])  # table that starts at 601
        self.assertEqual(self.tax(300, tax_rules=no_zero_bracket), 0)
        self.assertAlmostEqual(self.tax(1000, tax_rules=no_zero_bracket), 40.0, places=6)


class PerDiemTests(unittest.TestCase):
    def setUp(self):
        self.svc = PayrollService("tenant-test")

    def emp(self, fixed=None, percent=None):
        return SimpleNamespace(per_diem_no_receipt_fixed=fixed, per_diem_no_receipt_percent=percent)

    def test_none_configured(self):
        self.assertEqual(self.svc.calculate_per_diem(self.emp(), 6000), 0)

    def test_fixed_amount(self):
        self.assertEqual(self.svc.calculate_per_diem(self.emp(fixed=500), 6000), 500)

    def test_percent_of_basic_salary_wins_over_fixed(self):
        self.assertAlmostEqual(self.svc.calculate_per_diem(self.emp(fixed=500, percent=10), 6000), 600.0)


class LeaveEntitlementTests(unittest.TestCase):
    def setUp(self):
        self.svc = LeaveService("tenant-test")

    def test_annual_leave_grows_with_service(self):
        self.assertEqual(self.svc.calculate_annual_leave(16, 1, 0), 16)
        self.assertEqual(self.svc.calculate_annual_leave(16, 1, 4), 20)
        self.assertEqual(self.svc.calculate_annual_leave(14, 2, 3), 20)

    def test_years_of_service_counts_completed_years(self):
        class FixedDate(date):
            @classmethod
            def today(cls):
                return cls(2026, 11, 15)

        with mock.patch.object(leave_module, "date", FixedDate):
            self.assertEqual(self.svc.get_years_of_service(date(2020, 11, 15)), 6)  # anniversary today
            self.assertEqual(self.svc.get_years_of_service(date(2020, 11, 16)), 5)  # anniversary tomorrow
            self.assertEqual(self.svc.get_years_of_service(date(2027, 1, 1)), 0)    # future hire date


if __name__ == "__main__":
    unittest.main()
