/**
 * PayrollService — Unit Tests
 *
 * Tests cover the five pure calculation helpers that contain all of the
 * business logic for Ethiopian payroll.  These functions have no DB access,
 * so no mocking of DatabaseService or NotificationsService is required.
 *
 * Run:  npx jest payroll.service.spec.ts --verbose
 */

import { PayrollService } from './payroll.service';

// ─── Minimal test harness — no DI container needed ───────────────────────────

function makeService(): PayrollService {
  // PayrollService only uses its injected deps in async DB methods.
  // The pure calc helpers need no deps, so we pass null/undefined safely.
  return new PayrollService(null as any, null as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. calculateIncomeTax
// ─────────────────────────────────────────────────────────────────────────────

describe('PayrollService.calculateIncomeTax', () => {
  const svc = makeService();

  // ── Fallback brackets (empty rules array) ────────────────────────────────

  describe('hardcoded 2024 fallback brackets', () => {
    it('returns 0 tax for salary ≤ 600 ETB', () => {
      expect(svc.calculateIncomeTax(600, 600, [])).toBe(0);
      expect(svc.calculateIncomeTax(0, 0, [])).toBe(0);
    });

    it('applies 10% bracket (600–1650) correctly', () => {
      // basic = 1000, pension deducted outside → pass taxableIncome directly
      // tax = 1000 × 0.10 − 60 = 40
      expect(svc.calculateIncomeTax(1000, 1000, [])).toBeCloseTo(40);
    });

    it('applies 15% bracket (1650–3200)', () => {
      // basic = 2000, tax = 2000 × 0.15 − 142.5 = 157.5
      expect(svc.calculateIncomeTax(2000, 2000, [])).toBeCloseTo(157.5);
    });

    it('applies 20% bracket (3200–5250)', () => {
      // basic = 4000, tax = 4000 × 0.20 − 302.5 = 497.5
      expect(svc.calculateIncomeTax(4000, 4000, [])).toBeCloseTo(497.5);
    });

    it('applies 25% bracket (5250–7800)', () => {
      // basic = 6000, tax = 6000 × 0.25 − 565 = 935
      expect(svc.calculateIncomeTax(6000, 6000, [])).toBeCloseTo(935);
    });

    it('applies 30% bracket (7800–10900)', () => {
      // basic = 9000, tax = 9000 × 0.30 − 955 = 1745
      expect(svc.calculateIncomeTax(9000, 9000, [])).toBeCloseTo(1745);
    });

    it('applies 35% top bracket (> 10900)', () => {
      // basic = 15000, tax = 15000 × 0.35 − 1500 = 3750
      expect(svc.calculateIncomeTax(15000, 15000, [])).toBeCloseTo(3750);
    });

    it('never returns a negative tax (clamps to 0)', () => {
      // Very low taxable income might produce negative before clamp
      expect(svc.calculateIncomeTax(1000, 50, [])).toBeGreaterThanOrEqual(0);
    });

    it('scales deductible by proRataFactor for partial months', () => {
      // 10% bracket: tax = taxable × 0.10 − 60 × proRata
      // At 50% proRata: tax = 500 × 0.10 − 30 = 20
      expect(svc.calculateIncomeTax(1000, 500, [], 0.5)).toBeCloseTo(20);
    });
  });

  // ── DB-loaded rules (configurable brackets) ──────────────────────────────

  describe('DB-loaded tax rules', () => {
    const rules = [
      { min_salary: 0,    max_salary: 600,   tax_rate: 0,   deductible: 0     },
      { min_salary: 600,  max_salary: 1650,  tax_rate: 10,  deductible: 60    },
      { min_salary: 1650, max_salary: 3200,  tax_rate: 15,  deductible: 142.5 },
      { min_salary: 3200, max_salary: 5250,  tax_rate: 20,  deductible: 302.5 },
      { min_salary: 5250, max_salary: 7800,  tax_rate: 25,  deductible: 565   },
      { min_salary: 7800, max_salary: 10900, tax_rate: 30,  deductible: 955   },
      { min_salary: 10900, max_salary: null, tax_rate: 35,  deductible: 1500  },
    ];

    it('matches fallback for 1000 ETB (10% bracket)', () => {
      expect(svc.calculateIncomeTax(1000, 1000, rules)).toBeCloseTo(40);
    });

    it('matches fallback for 15000 ETB (35% bracket)', () => {
      expect(svc.calculateIncomeTax(15000, 15000, rules)).toBeCloseTo(3750);
    });

    it('handles max_salary = null as "no upper bound" (top bracket)', () => {
      expect(svc.calculateIncomeTax(50000, 50000, rules)).toBeCloseTo(50000 * 0.35 - 1500);
    });

    it('falls back to last bracket if salary exceeds all max values', () => {
      const limitedRules = [
        { min_salary: 0,    max_salary: 1000, tax_rate: 10, deductible: 60 },
        { min_salary: 1000, max_salary: 5000, tax_rate: 20, deductible: 300 },
      ];
      // 9000 > 5000 → should use last rule (20%)
      expect(svc.calculateIncomeTax(9000, 9000, limitedRules)).toBeCloseTo(9000 * 0.2 - 300);
    });

    it('returns 0 for salary in the zero-rate bracket', () => {
      expect(svc.calculateIncomeTax(500, 500, rules)).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. calculateTransportAllowance
// ─────────────────────────────────────────────────────────────────────────────

describe('PayrollService.calculateTransportAllowance', () => {
  const svc = makeService();

  it('returns 2200 ETB for management category', () => {
    expect(svc.calculateTransportAllowance('management')).toBe(2200);
  });

  it('returns 2200 ETB for field category', () => {
    expect(svc.calculateTransportAllowance('field')).toBe(2200);
  });

  it('returns 600 ETB for general category', () => {
    expect(svc.calculateTransportAllowance('general')).toBe(600);
  });

  it('defaults to 600 ETB for any unknown category slug', () => {
    expect(svc.calculateTransportAllowance('intern')).toBe(600);
    expect(svc.calculateTransportAllowance('')).toBe(600);
    expect(svc.calculateTransportAllowance('cleaner')).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. calculatePerDiem
// ─────────────────────────────────────────────────────────────────────────────

describe('PayrollService.calculatePerDiem', () => {
  const svc = makeService();

  it('returns 0 when category is null or undefined', () => {
    expect(svc.calculatePerDiem(null, 5000)).toBe(0);
    expect(svc.calculatePerDiem(undefined, 5000)).toBe(0);
  });

  it('returns fixed amount when it is higher than percentage', () => {
    const category = { per_diem_no_receipt_fixed: '800', per_diem_no_receipt_percent: '5' };
    // 5% of 5000 = 250 < 800 → fixed wins
    expect(svc.calculatePerDiem(category, 5000)).toBe(800);
  });

  it('returns percentage amount when it is higher than fixed', () => {
    const category = { per_diem_no_receipt_fixed: '100', per_diem_no_receipt_percent: '10' };
    // 10% of 5000 = 500 > 100 → percentage wins
    expect(svc.calculatePerDiem(category, 5000)).toBe(500);
  });

  it('returns 0 when both fixed and percentage are 0', () => {
    const category = { per_diem_no_receipt_fixed: '0', per_diem_no_receipt_percent: '0' };
    expect(svc.calculatePerDiem(category, 5000)).toBe(0);
  });

  it('handles missing fields (returns 0 for each missing field)', () => {
    expect(svc.calculatePerDiem({}, 5000)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. calculateAdvancedOvertime
// ─────────────────────────────────────────────────────────────────────────────

describe('PayrollService.calculateAdvancedOvertime', () => {
  const svc = makeService();

  const defaultSettings = {
    ot_rate_normal: 1.25,
    ot_rate_dayoff: 2.0,
    ot_rate_holiday: 2.5,
  };

  it('returns zero amount and empty breakdown when no OT worked', () => {
    const records = [
      { date: '2025-01-13', work_hours: '7', status: 'Present' }, // Monday, no OT
      { date: '2025-01-14', work_hours: '8', status: 'Present' }, // Tuesday, exactly 8h — no OT
    ];
    const result = svc.calculateAdvancedOvertime(records, [], 100, defaultSettings);
    expect(result.amount).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it('calculates normal OT correctly (weekday, 1.25×)', () => {
    // Monday 2025-01-13: 10 hours worked → 2 OT hours at 1.25× rate
    const records = [{ date: '2025-01-13', work_hours: '10', status: 'Present' }];
    const result = svc.calculateAdvancedOvertime(records, [], 100, defaultSettings);
    // 2 hours × 100 ETB/h × 1.25 = 250
    expect(result.amount).toBeCloseTo(250);
    expect(result.breakdown[0].type).toBe('Normal OT');
    expect(result.breakdown[0].hours).toBe(2);
  });

  it('calculates day-off OT correctly (Sunday, 2.0×)', () => {
    // Sunday 2025-01-12: 10 hours → 2 OT hours at 2.0×
    const records = [{ date: '2025-01-12', work_hours: '10', status: 'Present' }];
    const result = svc.calculateAdvancedOvertime(records, [], 100, defaultSettings);
    // 2 × 100 × 2.0 = 400
    expect(result.amount).toBeCloseTo(400);
    expect(result.breakdown[0].type).toBe('Day Off OT');
  });

  it('calculates holiday OT correctly (public holiday, 2.5×)', () => {
    // Monday 2025-01-13 but it is a public holiday
    const records = [{ date: '2025-01-13', work_hours: '11', status: 'Present' }];
    const holidayDates = ['2025-01-13'];
    const result = svc.calculateAdvancedOvertime(records, holidayDates, 100, defaultSettings);
    // 3 × 100 × 2.5 = 750
    expect(result.amount).toBeCloseTo(750);
    expect(result.breakdown[0].type).toBe('Holiday OT');
  });

  it('accumulates OT across multiple days', () => {
    const records = [
      { date: '2025-01-13', work_hours: '10', status: 'Present' }, // Normal OT: 2h × 100 × 1.25 = 250
      { date: '2025-01-14', work_hours: '9',  status: 'Present' }, // Normal OT: 1h × 100 × 1.25 = 125
    ];
    const result = svc.calculateAdvancedOvertime(records, [], 100, defaultSettings);
    expect(result.amount).toBeCloseTo(375);
    expect(result.breakdown).toHaveLength(2);
  });

  it('uses custom rates from settings', () => {
    const customSettings = { ot_rate_normal: 1.5, ot_rate_dayoff: 3.0, ot_rate_holiday: 4.0 };
    const records = [{ date: '2025-01-13', work_hours: '10', status: 'Present' }];
    const result = svc.calculateAdvancedOvertime(records, [], 100, customSettings);
    // 2 × 100 × 1.5 = 300
    expect(result.amount).toBeCloseTo(300);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. calculateEstimatedNetSalary
// ─────────────────────────────────────────────────────────────────────────────

describe('PayrollService.calculateEstimatedNetSalary', () => {
  const svc = makeService();

  const defaultSettings = { employee_pension_rate: 7 };

  it('deducts 7% pension and calculates tax on (salary − pension)', () => {
    // basic = 1000, pension = 70, taxable = 930
    // tax = 930 × 0.10 − 60 = 33
    // net = 1000 − 70 − 33 = 897
    const net = svc.calculateEstimatedNetSalary(1000, defaultSettings, []);
    expect(net).toBeCloseTo(897);
  });

  it('adds optional allowances to the net (post-deduction)', () => {
    // Same as above but allowances = 200 → net = 897 + 200 = 1097
    const net = svc.calculateEstimatedNetSalary(1000, defaultSettings, [], 200);
    expect(net).toBeCloseTo(1097);
  });

  it('handles 11% employer pension correctly (separate — does not affect net)', () => {
    // Employee pension is the only deduction from net, employer pension is a cost to the company
    const netWithCustomSettings = svc.calculateEstimatedNetSalary(
      1000,
      { employee_pension_rate: 7, employer_pension_rate: 11 },
      [],
    );
    // employer rate must NOT affect employee net
    const netWithDefaultSettings = svc.calculateEstimatedNetSalary(1000, defaultSettings, []);
    expect(netWithCustomSettings).toBeCloseTo(netWithDefaultSettings);
  });

  it('returns correct net for zero-tax salary bracket', () => {
    // basic = 500 (≤ 600 → 0% tax), pension = 35
    // net = 500 − 35 − 0 = 465
    const net = svc.calculateEstimatedNetSalary(500, defaultSettings, []);
    expect(net).toBeCloseTo(465);
  });

  it('handles missing employee_pension_rate by defaulting to 7%', () => {
    const net = svc.calculateEstimatedNetSalary(1000, {}, []);
    const netDefault = svc.calculateEstimatedNetSalary(1000, defaultSettings, []);
    expect(net).toBeCloseTo(netDefault);
  });
});
