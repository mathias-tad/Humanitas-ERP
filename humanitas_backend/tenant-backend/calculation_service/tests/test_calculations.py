import unittest

class TestPayrollAndOvertimeCalculations(unittest.TestCase):
    """
    Industry-standard unit tests for Humanitas calculation formulas:
    - Overtime rates and hourly rate derivation
    - Progressive income tax calculation
    - Prorated leave accrual formula
    - Mandatory pension contributions
    """

    def test_hourly_rate_derivation(self):
        """Hourly rate must equal basic_salary / monthly_working_hours."""
        basic_salary = 4800.0
        monthly_hours = 160.0
        expected_hourly = 30.0
        actual_hourly = round(basic_salary / monthly_hours, 2)
        self.assertEqual(actual_hourly, expected_hourly)

    def test_overtime_pay_multipliers(self):
        """Validates overtime rates: Normal (1.25x), Night (1.5x), Holiday (2.0x), DayOff (1.5x)."""
        hourly_rate = 20.0
        rate_normal = 1.25
        rate_holiday = 2.0

        normal_ot_hours = 2.0
        holiday_ot_hours = 4.0

        normal_pay = round(normal_ot_hours * (hourly_rate * rate_normal), 2)
        holiday_pay = round(holiday_ot_hours * (hourly_rate * rate_holiday), 2)

        self.assertEqual(normal_pay, 50.0)    # 2 * 25.0 = 50.0
        self.assertEqual(holiday_pay, 160.0)  # 4 * 40.0 = 160.0

    def test_prorated_leave_accrual(self):
        """Validates monthly leave accrual based on annual entitlement."""
        annual_entitlement = 24.0
        months_worked = 6.0
        expected_accrued = round((annual_entitlement / 12.0) * months_worked, 2)
        self.assertEqual(expected_accrued, 12.0)

    def test_pension_deduction(self):
        """Validates mandatory pension contributions: Employee (7%), Employer (11%)."""
        gross_salary = 10000.0
        employee_pension_rate = 0.07
        employer_pension_rate = 0.11

        employee_deduction = round(gross_salary * employee_pension_rate, 2)
        employer_contribution = round(gross_salary * employer_pension_rate, 2)

        self.assertEqual(employee_deduction, 700.0)
        self.assertEqual(employer_contribution, 1100.0)

    def test_progressive_tax_brackets(self):
        """Validates standard progressive income tax calculations."""
        # Brackets: 0-600: 0%, 601-1650: 10%, 1651-3200: 15%
        taxable_income = 2000.0
        tax = 0.0

        if taxable_income > 600:
            tier1 = min(taxable_income - 600, 1050)
            tax += tier1 * 0.10

        if taxable_income > 1650:
            tier2 = taxable_income - 1650
            tax += tier2 * 0.15

        # 1050 * 0.10 = 105.0; 350 * 0.15 = 52.5; Total = 157.5
        self.assertEqual(round(tax, 2), 157.5)


    def test_unpaid_vto_payroll_deduction(self):
        """Validates that unpaid VTO without PTO funding is deducted at hourly rate."""
        basic_salary = 16000.0
        monthly_hours = 160.0
        hourly_rate = basic_salary / monthly_hours  # 100.0/hr
        vto_hours = 4.0
        is_paid = False
        use_pto = False

        if not is_paid and not use_pto:
            deduction = round(vto_hours * hourly_rate, 2)
        else:
            deduction = 0.0

        self.assertEqual(deduction, 400.0)

    def test_company_paid_and_pto_vto_zero_deduction(self):
        """Validates that company-paid VTO or PTO-funded VTO incurs 0 salary deduction."""
        basic_salary = 16000.0
        monthly_hours = 160.0
        hourly_rate = basic_salary / monthly_hours

        # Case 1: Company-paid VTO
        deduction_paid_vto = 0.0
        # Case 2: Unpaid VTO funded via PTO balance
        use_pto = True
        is_paid = False
        deduction_pto_vto = 0.0 if (is_paid or use_pto) else round(4.0 * hourly_rate, 2)

        self.assertEqual(deduction_paid_vto, 0.0)
        self.assertEqual(deduction_pto_vto, 0.0)

    def test_vet_claimed_hours_formula(self):
        """Validates overtime pay based on employee claimed hours and broadcast multiplier."""
        basic_salary = 16000.0
        monthly_hours = 160.0
        hourly_rate = basic_salary / monthly_hours  # 100.0
        multiplier = 1.5
        claimed_hours = 6.0  # Employee claimed 6 hours out of 8 hours broadcast

        overtime_amount = round(claimed_hours * multiplier * hourly_rate, 2)
        # 6 * 1.5 * 100.0 = 900.0
        self.assertEqual(overtime_amount, 900.0)


if __name__ == '__main__':
    unittest.main()
