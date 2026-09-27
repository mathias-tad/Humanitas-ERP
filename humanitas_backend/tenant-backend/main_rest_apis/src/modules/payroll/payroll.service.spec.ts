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
// 2. calculateEstimatedNetSalary
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
