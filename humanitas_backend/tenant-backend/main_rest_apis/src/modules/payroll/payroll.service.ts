import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) { }

  // Seed default Ethiopian tax rules (2024 brackets)
  async seedDefaultTaxRules(tenantId: string) {
    try {
      const connection = await this.databaseService.getTenantConnectionById(tenantId);

      const taxBrackets = [
        { min_salary: 0, max_salary: 600, rate: 0, deduction: 0 },
        { min_salary: 600, max_salary: 1650, rate: 10, deduction: 60 },
        { min_salary: 1650, max_salary: 3200, rate: 15, deduction: 142.5 },
        { min_salary: 3200, max_salary: 5250, rate: 20, deduction: 302.5 },
        { min_salary: 5250, max_salary: 7800, rate: 25, deduction: 565 },
        { min_salary: 7800, max_salary: 10900, rate: 30, deduction: 955 },
        { min_salary: 10900, max_salary: null, rate: 35, deduction: 1500 },
      ];

      await connection.query(`ALTER TABLE tax_rules ALTER COLUMN max_salary DROP NOT NULL`);
      await connection.query(`UPDATE tax_rules SET is_active = false WHERE is_active = true`);

      for (const bracket of taxBrackets) {
        await connection.query(
          `INSERT INTO tax_rules (min_salary, max_salary, tax_rate, deductible, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [bracket.min_salary, bracket.max_salary, bracket.rate, bracket.deduction]
        );
      }

      return {
        success: true,
        message: 'Ethiopian tax rules seeded successfully',
        brackets: taxBrackets.length,
        rules: taxBrackets
      };
    } catch (error) {
      this.logger.error('Error seeding tax rules', error.stack);
      throw new BadRequestException(`Failed to seed tax rules: ${error.message}`);
    }
  }

  // Check payroll job status for a specific month/year
  async getPayrollStatus(tenantId: string, month: number, year: number) {
    try {
      const connection = await this.databaseService.getTenantConnectionById(tenantId);

      const result = await connection.query(
        `SELECT id, status, 
                COALESCE(total_employees, 0) as total_employees, 
                COALESCE(total_gross, 0) as total_gross, 
                COALESCE(total_net, 0) as total_net
         FROM payroll_runs 
         WHERE month = $1 AND year = $2
         LIMIT 1`,
        [month, year]
      );

      if (!result || result.length === 0) {
        return { status: 'not_found', message: 'No payroll run found for this period' };
      }

      const run = result[0];

      let statusMessage = null;
      try {
        const msgResult = await connection.query(
          `SELECT status_message FROM payroll_runs WHERE id = $1`,
          [run.id]
        );
        statusMessage = msgResult[0]?.status_message || null;
      } catch (err) {
        this.logger.debug('status_message column not yet created (will be added on next payroll run)');
      }

      return {
        status: run.status,
        payroll_run_id: run.id,
        total_employees: run.total_employees || 0,
        total_gross: run.total_gross || 0,
        total_net: run.total_net || 0,
        message: statusMessage
      };
    } catch (error) {
      this.logger.error('Get status error', error.stack);
      return {
        status: 'error',
        message: `Backend error: ${error.message}`,
        details: String(error)
      };
    }
  }

  // ── Private calculation helpers ───────────────────────────────────────────
  // These are pure functions with no DB access — easy to unit test.

  /**
   * Calculate Ethiopian income tax from configurable tax brackets.
   * @param fullBasicSalary  Used to determine which bracket applies.
   * @param taxableIncome    Pro-rated income to apply the rate against.
   * @param taxRules         DB-loaded brackets; falls back to hardcoded 2024 brackets when empty.
   * @param proRataFactor    Scales the fixed deductible when salary is partial-month.
   */
  calculateIncomeTax(
    fullBasicSalary: number,
    taxableIncome: number,
    taxRules: any[],
    proRataFactor: number = 1,
  ): number {
    if (!taxRules || taxRules.length === 0) {
      // Hardcoded 2024 Ethiopian brackets (fallback)
      let rate = 0;
      let deductible = 0;

      if (fullBasicSalary <= 600) { rate = 0; deductible = 0; }
      else if (fullBasicSalary <= 1650) { rate = 0.1; deductible = 60; }
      else if (fullBasicSalary <= 3200) { rate = 0.15; deductible = 142.5; }
      else if (fullBasicSalary <= 5250) { rate = 0.2; deductible = 302.5; }
      else if (fullBasicSalary <= 7800) { rate = 0.25; deductible = 565; }
      else if (fullBasicSalary <= 10900) { rate = 0.3; deductible = 955; }
      else { rate = 0.35; deductible = 1500; }

      return Math.max(0, taxableIncome * rate - deductible * proRataFactor);
    }

    const sorted = [...taxRules].sort((a, b) => a.min_salary - b.min_salary);

    let rule = sorted.find((r) => {
      const min = parseFloat(r.min_salary) || 0;
      const max = parseFloat(r.max_salary) || Infinity;
      return fullBasicSalary >= min && fullBasicSalary <= max;
    });

    // Above the highest bracket
    if (!rule) {
      const last = sorted[sorted.length - 1];
      if (last && fullBasicSalary > parseFloat(last.max_salary)) rule = last;
    }

    if (rule) {
      const rate = parseFloat(rule.tax_rate) / 100;
      const deductible = parseFloat(rule.deductible) || 0;
      return Math.max(0, taxableIncome * rate - deductible * proRataFactor);
    }

    return 0;
  }



  /**
   * Estimate net salary for loan affordability checks.
   * Taxable income = basic − pension. No allowances included (conservative).
   */
  calculateEstimatedNetSalary(
    basicSalary: number,
    settings: any,
    taxRules: any[],
    allowances: number = 0,
  ): number {
    const employeePensionRate = (settings.employee_pension_rate || 7) / 100;
    const pension = basicSalary * employeePensionRate;
    const taxableIncome = Math.max(0, basicSalary - pension);
    const tax = this.calculateIncomeTax(basicSalary, taxableIncome, taxRules);
    return basicSalary + allowances - pension - tax;
  }

  // ── Income Types ──────────────────────────────────────────────────────────

  async getIncomeTypes(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `SELECT * FROM income_types WHERE is_active = true ORDER BY name`
    );

    const incomeTypes = result || [];
    for (const incomeType of incomeTypes) {
      const rules = await connection.query(
        `SELECT 
          itcr.employee_category_id as category_id,
          ec.name as category_name,
          itcr.calculation_mode,
          itcr.fixed_amount,
          itcr.percentage_value
        FROM income_type_category_rules itcr
        LEFT JOIN employee_categories ec ON itcr.employee_category_id = ec.id
        WHERE itcr.income_type_id = $1`,
        [incomeType.id],
      );
      incomeType.category_rules = rules || [];
    }

    return incomeTypes;
  }

  async createIncomeType(tenantId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `INSERT INTO income_types(
        name, description, is_taxable, is_pensionable, calculation_type,
        is_category_specific, universal_fixed_amount, universal_percentage_value, universal_calculation_mode
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.name,
        data.description,
        data.taxable ?? data.is_taxable ?? true,
        data.pensionable ?? data.is_pensionable ?? false,
        data.calculation_type || 'fixed',
        data.is_category_specific ?? false,
        data.universal_fixed_amount ?? null,
        data.universal_percentage_value ?? null,
        data.universal_calculation_mode || 'both_highest',
      ],
    );

    const incomeType = result[0];

    if (data.category_rules && Array.isArray(data.category_rules) && data.category_rules.length > 0) {
      for (const rule of data.category_rules) {
        await connection.query(
          `INSERT INTO income_type_category_rules(income_type_id, employee_category_id, calculation_mode, fixed_amount, percentage_value)
          VALUES($1, $2, $3, $4, $5)
          ON CONFLICT (income_type_id, employee_category_id) 
          DO UPDATE SET calculation_mode = EXCLUDED.calculation_mode, fixed_amount = EXCLUDED.fixed_amount, percentage_value = EXCLUDED.percentage_value`,
          [incomeType.id, rule.category_id, rule.calculation_mode || 'both_highest', rule.fixed_amount, rule.percentage_value],
        );
      }
    }

    return incomeType;
  }

  async updateIncomeType(tenantId: string, id: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `UPDATE income_types SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_taxable = COALESCE($3, is_taxable),
        is_pensionable = COALESCE($4, is_pensionable),
        is_category_specific = COALESCE($5, is_category_specific),
        universal_fixed_amount = $6,
        universal_percentage_value = $7,
        universal_calculation_mode = COALESCE($8, universal_calculation_mode),
        updated_at = NOW()
      WHERE id = $9`,
      [
        data.name,
        data.description,
        data.taxable ?? data.is_taxable,
        data.pensionable ?? data.is_pensionable,
        data.is_category_specific,
        data.universal_fixed_amount !== undefined ? data.universal_fixed_amount : null,
        data.universal_percentage_value !== undefined ? data.universal_percentage_value : null,
        data.universal_calculation_mode,
        id,
      ],
    );

    if (data.category_rules && Array.isArray(data.category_rules)) {
      await connection.query(`DELETE FROM income_type_category_rules WHERE income_type_id = $1`, [id]);
      for (const rule of data.category_rules) {
        await connection.query(
          `INSERT INTO income_type_category_rules(income_type_id, employee_category_id, calculation_mode, fixed_amount, percentage_value)
          VALUES($1, $2, $3, $4, $5)`,
          [id, rule.category_id, rule.calculation_mode || 'both_highest', rule.fixed_amount, rule.percentage_value],
        );
      }
    }

    const updatedResult = await connection.query(`SELECT * FROM income_types WHERE id = $1`, [id]);
    const updatedIncomeType = updatedResult[0];
    const rules = await connection.query(
      `SELECT itcr.employee_category_id as category_id, ec.name as category_name,
              itcr.calculation_mode, itcr.fixed_amount, itcr.percentage_value
       FROM income_type_category_rules itcr
       LEFT JOIN employee_categories ec ON itcr.employee_category_id = ec.id
       WHERE itcr.income_type_id = $1`,
      [id],
    );
    updatedIncomeType.category_rules = rules || [];
    return updatedIncomeType;
  }

  async deleteIncomeType(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(`UPDATE income_types SET is_active = false WHERE id = $1`, [id]);
    return { message: 'Income type deleted' };
  }

  async calculateIncomeAmount(
    tenantId: string,
    incomeTypeId: string,
    userId: string,
  ): Promise<{ amount: number; details: string }> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const incomeTypeResult = await connection.query(
      `SELECT * FROM income_types WHERE id = $1 AND is_active = true`, [incomeTypeId],
    );
    if (!incomeTypeResult || incomeTypeResult.length === 0) return { amount: 0, details: 'Income type not found' };
    const incomeType = incomeTypeResult[0];

    const userResult = await connection.query(
      `SELECT basic_salary, employee_category_id FROM users WHERE id = $1`, [userId],
    );
    if (!userResult || userResult.length === 0) return { amount: 0, details: 'User not found' };
    const user = userResult[0];
    const basicSalary = parseFloat(user.basic_salary) || 0;

    let rules: { fixed_amount: number | null; percentage_value: number | null; calculation_mode: string };

    if (incomeType.is_category_specific) {
      if (!user.employee_category_id) return { amount: 0, details: 'User has no employee category assigned' };

      const categoryRuleResult = await connection.query(
        `SELECT * FROM income_type_category_rules WHERE income_type_id = $1 AND employee_category_id = $2`,
        [incomeTypeId, user.employee_category_id],
      );
      if (!categoryRuleResult || categoryRuleResult.length === 0) return { amount: 0, details: 'No calculation rule defined for this category' };
      const rule = categoryRuleResult[0];
      rules = { fixed_amount: rule.fixed_amount, percentage_value: rule.percentage_value, calculation_mode: rule.calculation_mode };
    } else {
      rules = {
        fixed_amount: incomeType.universal_fixed_amount,
        percentage_value: incomeType.universal_percentage_value,
        calculation_mode: incomeType.universal_calculation_mode || 'both_highest',
      };
    }

    let amount = 0;
    let details = '';

    if (rules.calculation_mode === 'fixed_only') {
      amount = parseFloat(rules.fixed_amount?.toString() || '0');
      details = `Fixed: ${amount.toFixed(2)}`;
    } else if (rules.calculation_mode === 'percentage_only') {
      const percentage = parseFloat(rules.percentage_value?.toString() || '0');
      amount = (basicSalary * percentage) / 100;
      details = `${percentage}% of ${basicSalary.toFixed(2)} = ${amount.toFixed(2)}`;
    } else if (rules.calculation_mode === 'both_highest') {
      const fixedAmt = parseFloat(rules.fixed_amount?.toString() || '0');
      const percentage = parseFloat(rules.percentage_value?.toString() || '0');
      const percentAmt = (basicSalary * percentage) / 100;
      amount = Math.max(fixedAmt, percentAmt);
      details = `Max(Fixed: ${fixedAmt.toFixed(2)}, ${percentage}% = ${percentAmt.toFixed(2)}) = ${amount.toFixed(2)}`;
    }

    return { amount, details };
  }

  // ── User Incomes ──────────────────────────────────────────────────────────

  async getUserIncomes(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `SELECT ui.*, it.name as income_type_name, it.is_taxable as default_taxable, it.is_pensionable as default_pensionable
      FROM user_incomes ui
      JOIN income_types it ON ui.income_type_id = it.id
      WHERE ui.user_id = $1 AND ui.is_active = true
      ORDER BY it.name, ui.created_at`,
      [userId],
    );
    return result || [];
  }

  async assignUserIncome(tenantId: string, userId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const incomeTypeResult = await connection.query(
      `SELECT * FROM income_types WHERE id = $1 AND is_active = true`, [data.income_type_id],
    );
    if (!incomeTypeResult || incomeTypeResult.length === 0) throw new Error('Income type not found');
    const incomeType = incomeTypeResult[0];

    const isCategoryDependent = await connection.query(
      `SELECT 1 FROM income_type_category_rules WHERE income_type_id = $1 LIMIT 1`, [data.income_type_id]
    );
    if (isCategoryDependent.length > 0) {
      const userCheck = await connection.query(`SELECT employee_category_id FROM users WHERE id = $1`, [userId]);
      if (!userCheck[0]?.employee_category_id) {
        throw new BadRequestException('Employee must be categorized before assigning this category-dependent income type.');
      }
    }

    const existingAssignments = await connection.query(
      `SELECT * FROM user_incomes WHERE user_id = $1 AND income_type_id = $2 AND is_active = true`,
      [userId, data.income_type_id],
    );
    const baseAssignment = existingAssignments.find((a) => a.is_taxable === null);
    const isCreatingBase = !baseAssignment && !data.alias;
    const startDate = data.start_date || new Date().toISOString().split('T')[0];
    const endDate = data.end_date || null;

    if (isCreatingBase) {
      const calculated = await this.calculateIncomeAmount(tenantId, data.income_type_id, userId);
      if (calculated.amount === 0) throw new Error(`Cannot create base assignment: ${calculated.details}`);
      const result = await connection.query(
        `INSERT INTO user_incomes(user_id, income_type_id, amount, is_taxable, alias, start_date, end_date)
         VALUES($1, $2, $3, NULL, NULL, $4, $5) RETURNING *`,
        [userId, data.income_type_id, calculated.amount, startDate, endDate],
      );
      return { ...result[0], calculation_details: calculated.details, is_base: true };
    } else {
      if (!data.amount) throw new Error('Amount is required for additional assignments');
      if (incomeType.is_taxable) {
        const result = await connection.query(
          `INSERT INTO user_incomes(user_id, income_type_id, amount, is_taxable, alias, start_date, end_date)
           VALUES($1, $2, $3, true, $4, $5, $6) RETURNING *`,
          [userId, data.income_type_id, data.amount, data.alias || 'Additional (Taxable)', startDate, endDate]
        );
        return { ...result[0], is_base: false, merged: false };
      } else {
        const result = await connection.query(
          `INSERT INTO user_incomes(user_id, income_type_id, amount, is_taxable, alias, start_date, end_date)
           VALUES($1, $2, $3, true, $4, $5, $6) RETURNING *`,
          [userId, data.income_type_id, data.amount, data.alias || 'Additional (Taxable)', startDate, endDate],
        );
        return { ...result[0], is_base: false, enforced_taxable: true, message: 'Created separate taxable assignment (base remains non-taxable)' };
      }
    }
  }

  async updateUserIncome(tenantId: string, id: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `UPDATE user_incomes 
      SET amount = COALESCE($1, amount),
          is_taxable = $2,
          alias = COALESCE($3, alias),
          updated_at = NOW()
      WHERE id = $4 RETURNING *`,
      [data.amount, data.is_taxable !== undefined ? data.is_taxable : null, data.alias, id],
    );
    return { message: 'User income updated', income: result[0] };
  }

  async removeUserIncome(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(`UPDATE user_incomes SET is_active = false WHERE id = $1`, [id]);
    return { message: 'User income removed' };
  }

  async recalculateUserBaseIncomes(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const baseIncomes = await connection.query(
      `SELECT ui.*, it.is_category_specific, it.universal_fixed_amount, it.universal_percentage_value
       FROM user_incomes ui
       JOIN income_types it ON ui.income_type_id = it.id
       WHERE ui.user_id = $1 AND ui.is_taxable IS NULL AND ui.is_active = true`,
      [userId],
    );

    for (const income of baseIncomes) {
      const calculated = await this.calculateIncomeAmount(tenantId, income.income_type_id, userId);
      if (calculated.amount > 0) {
        await connection.query(
          `UPDATE user_incomes SET amount = $1, updated_at = NOW() WHERE id = $2`,
          [calculated.amount, income.id],
        );
      }
    }

    return { message: `Recalculated ${baseIncomes.length} base income assignments`, recalculated_count: baseIncomes.length };
  }

  // ── Employee Categories ───────────────────────────────────────────────────

  async getEmployeeCategories(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    return connection.query(`SELECT * FROM employee_categories ORDER BY name`);
  }

  async updateEmployeeCategory(tenantId: string, id: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `UPDATE employee_categories SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        default_transport_allowance = COALESCE($3, default_transport_allowance),
        default_per_diem_fixed = COALESCE($4, default_per_diem_fixed),
        per_diem_no_receipt_fixed = COALESCE($5, per_diem_no_receipt_fixed),
        per_diem_no_receipt_percent = COALESCE($6, per_diem_no_receipt_percent),
        per_diem_receipt_fixed = COALESCE($7, per_diem_receipt_fixed),
        per_diem_receipt_percent = COALESCE($8, per_diem_receipt_percent),
        desert_min_percent = COALESCE($9, desert_min_percent),
        desert_mid_percent = COALESCE($10, desert_mid_percent),
        desert_max_percent = COALESCE($11, desert_max_percent),
        hardship_min_percent = COALESCE($12, hardship_min_percent),
        hardship_mid_percent = COALESCE($13, hardship_mid_percent),
        hardship_max_percent = COALESCE($14, hardship_max_percent),
        updated_at = NOW()
      WHERE id = $15`,
      [
        data.name,
        data.description,
        data.default_transport_allowance,
        data.default_per_diem_fixed,
        data.per_diem_no_receipt_fixed,
        data.per_diem_no_receipt_percent,
        data.per_diem_receipt_fixed,
        data.per_diem_receipt_percent,
        data.desert_min_percent,
        data.desert_mid_percent,
        data.desert_max_percent,
        data.hardship_min_percent,
        data.hardship_mid_percent,
        data.hardship_max_percent,
        id,
      ],
    );
    return { message: 'Category details updated' };
  }

  // ── Tax Rules ─────────────────────────────────────────────────────────────

  async getTaxRules(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(`SELECT * FROM tax_rules WHERE is_active = true ORDER BY min_salary ASC`);
    return result || [];
  }

  async createTaxRule(tenantId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `INSERT INTO tax_rules(min_salary, max_salary, tax_rate, deductible, description)
      VALUES($1, $2, $3, $4, $5) RETURNING *`,
      [data.min_salary, data.max_salary, data.tax_rate, data.deductible || 0, data.description],
    );
    return result[0];
  }

  async updateTaxRule(tenantId: string, id: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `UPDATE tax_rules SET
        min_salary = COALESCE($1, min_salary),
        max_salary = COALESCE($2, max_salary),
        tax_rate = COALESCE($3, tax_rate),
        deductible = COALESCE($4, deductible),
        description = COALESCE($5, description),
        updated_at = NOW()
      WHERE id = $6`,
      [data.min_salary, data.max_salary, data.tax_rate, data.deductible, data.description, id],
    );
    return { message: 'Tax rule updated' };
  }

  async deleteTaxRule(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(`UPDATE tax_rules SET is_active = false WHERE id = $1`, [id]);
    return { message: 'Tax rule deleted' };
  }

  // ── Holidays ──────────────────────────────────────────────────────────────

  async getHolidays(tenantId: string, year?: number) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    let query = `SELECT * FROM holidays WHERE is_active = true`;
    const params: any[] = [];
    if (year) {
      query += ` AND (EXTRACT(YEAR FROM date) = $1 OR is_recurring = true)`;
      params.push(year);
    }
    query += ` ORDER BY date`;
    return (await connection.query(query, params)) || [];
  }

  async createHoliday(tenantId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `INSERT INTO holidays(name, date, is_recurring, description)
      VALUES($1, $2, $3, $4)
      ON CONFLICT(date) DO UPDATE SET name = $1, is_recurring = $3, description = $4, updated_at = NOW()
      RETURNING *`,
      [data.name, data.date, data.is_recurring ?? false, data.description],
    );
    return result[0];
  }

  async updateHoliday(tenantId: string, id: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `UPDATE holidays SET
        name = COALESCE($1, name),
        date = COALESCE($2, date),
        is_recurring = COALESCE($3, is_recurring),
        description = COALESCE($4, description),
        updated_at = NOW()
      WHERE id = $5`,
      [data.name, data.date, data.is_recurring, data.description, id],
    );
    return { message: 'Holiday updated' };
  }

  async deleteHoliday(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(`DELETE FROM holidays WHERE id = $1`, [id]);
    return { message: 'Holiday deleted' };
  }


  // ── Loans ─────────────────────────────────────────────────────────────────

  async getLoans(tenantId: string, userId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    let query = `SELECT l.*, u.full_name as user_name, u.email FROM loans l JOIN users u ON l.user_id = u.id WHERE l.status = 'active'`;
    const params: any[] = [];
    if (userId) { query += ` AND l.user_id = $1`; params.push(userId); }
    query += ` ORDER BY l.created_at DESC`;
    return (await connection.query(query, params)) || [];
  }

  async createLoan(tenantId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const userResult = await connection.query(
      `SELECT basic_salary, employee_category_id FROM users WHERE id = $1`, [data.user_id],
    );
    if (!userResult || userResult.length === 0) throw new Error('User not found');
    const basicSalary = parseFloat(userResult[0].basic_salary) || 0;

    const hrSettingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
    const payrollSettingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'payroll'`);
    const hrSettings = hrSettingsRes?.[0]?.data || {};
    const payrollSettings = payrollSettingsRes?.[0]?.data || {};
    const taxRules = await this.getTaxRules(tenantId);

    const estimatedNet = this.calculateEstimatedNetSalary(basicSalary, hrSettings, taxRules);
    const maxDeductionPercent = payrollSettings.max_deduction_percent || 33.333;
    const maxDeductionLimit = estimatedNet * (maxDeductionPercent / 100);

    if (parseFloat(data.monthly_deduction) > maxDeductionLimit) {
      throw new Error(
        `Loan monthly deduction (${data.monthly_deduction}) exceeds ${maxDeductionPercent}% of estimated net salary (${estimatedNet.toFixed(2)}). Limit: ${maxDeductionLimit.toFixed(2)}`
      );
    }

    const result = await connection.query(
      `INSERT INTO loans(user_id, loan_type, description, total_amount, monthly_deduction, remaining_balance, start_date, end_date)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.user_id, data.loan_type, data.description, data.total_amount, data.monthly_deduction, data.total_amount, data.start_date, data.end_date],
    );
    return result[0];
  }

  async updateLoan(tenantId: string, id: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `UPDATE loans SET loan_type = COALESCE($1, loan_type), description = COALESCE($2, description), monthly_deduction = COALESCE($3, monthly_deduction), updated_at = NOW() WHERE id = $4`,
      [data.loan_type, data.description, data.monthly_deduction, id],
    );
    return { message: 'Loan updated' };
  }

  async deleteLoan(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(`UPDATE loans SET status = 'cancelled' WHERE id = $1`, [id]);
    return { message: 'Loan cancelled' };
  }

  // ── Payroll ───────────────────────────────────────────────────────────────

  async getPayrollHistory(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    return (await connection.query(`SELECT * FROM payroll_runs ORDER BY year DESC, month DESC`)) || [];
  }


  async getPayrollDetails(tenantId: string, month: number, year: number) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    return (await connection.query(
      `SELECT pi.*, u.full_name as employee_name, u.email, u.department
      FROM payroll_items pi
      JOIN users u ON pi.user_id = u.id
      JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
      WHERE pr.month = $1 AND pr.year = $2 ORDER BY u.full_name`,
      [month, year],
    )) || [];
  }

  async getMyPayslips(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    return (await connection.query(
      `SELECT pi.id, pi.gross_salary, pi.net_salary, pi.total_deductions, 
             pr.month, pr.year, pr.status, pr.completed_at, pr.run_at
      FROM payroll_items pi JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
      WHERE pi.user_id = $1 AND pr.status = 'completed'
      ORDER BY pr.year DESC, pr.month DESC`,
      [userId]
    )) || [];
  }

  async getMyPayslipDetail(tenantId: string, userId: string, payrollItemId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const result = await connection.query(
      `SELECT pi.*, pr.month, pr.year, pr.completed_at, pr.run_at,
             u.full_name, u.department, u.position, u.tin, u.basic_salary as contract_salary
      FROM payroll_items pi
      JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
      JOIN users u ON pi.user_id = u.id
      WHERE pi.id = $1 AND pi.user_id = $2`,
      [payrollItemId, userId]
    );
    if (result.length === 0) throw new NotFoundException('Payslip not found');
    return result[0];
  }

  async exportPayroll(tenantId: string, month: number, year: number) {
    return this.getPayrollDetails(tenantId, month, year);
  }

  async getCategoryAllowances(tenantId: string, categoryId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    return connection.query(
      `SELECT ca.id, ca.amount, ca.min_amount, ca.mid_amount, ca.max_amount, ca.default_tier, ca.is_active,
             it.id as income_type_id, it.name as income_type_name, it.calculation_type, it.is_taxable, it.is_pensionable
      FROM category_allowances ca JOIN income_types it ON ca.income_type_id = it.id
      WHERE ca.employee_category_id = $1 ORDER BY it.name ASC`,
      [categoryId]
    );
  }

  async notifyPayrollCompletion(tenantId: string, payrollRunId: string, month: number, year: number) {
    try {
      const connection = await this.databaseService.getTenantConnectionById(tenantId);
      const payrollItems = await connection.query(
        `SELECT user_id, net_salary FROM payroll_items WHERE payroll_run_id = $1`, [payrollRunId]
      );

      if (!payrollItems || payrollItems.length === 0) {
        this.logger.warn(`[Payroll] No payroll items found for run ${payrollRunId} — skipping notifications`);
        return;
      }

      let currency = 'ETB';
      try {
        const settingsResult = await connection.query(`SELECT data FROM settings WHERE category = 'payroll' LIMIT 1`);
        currency = settingsResult?.[0]?.data?.currency || 'ETB';
      } catch (e) { }

      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const periodName = `${months[month - 1]} ${year}`;

      for (const item of payrollItems) {
        await this.notificationsService.createNotification(tenantId, item.user_id, {
          type: 'payroll',
          referenceId: payrollRunId,
          title: 'Payslip Ready',
          message: `Your payslip for ${periodName} is ready to view. Net pay: ${currency} ${parseFloat(item.net_salary).toLocaleString()}`,
          priority: 'normal',
        });
      }

      this.logger.log(`Sent ${payrollItems.length} payslip notifications for ${periodName}`);
    } catch (error) {
      this.logger.error('Failed to send payroll completion notifications', error.stack);
      throw error;
    }
  }

  /**
   * Calculates acting allowances for an employee for a specific pay period [startDate, endDate].
   * Handles proration across days active, delegator base salary percentage, or fixed allowance.
   */
  async getActingAllowancesForPeriod(
    tenantId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    total_acting_allowance: number;
    breakdown: Array<{
      delegation_id: string;
      acting_position: string;
      delegator_name: string;
      delegator_salary: number;
      allowance_rate: string;
      active_days: number;
      period_days: number;
      prorated_amount: number;
    }>;
  }> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const tableCheck = await connection.query(`SELECT to_regclass('user_delegations') as tbl`);
    if (!tableCheck[0]?.tbl) {
      return { total_acting_allowance: 0, breakdown: [] };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalPeriodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const activeAssignments = await connection.query(
      `SELECT d.*, 
        u_from.first_name as delegator_first_name, 
        u_from.last_name as delegator_last_name,
        u_from.email as delegator_email,
        u_from.basic_salary as delegator_basic_salary,
        u_from.position as delegator_position
       FROM user_delegations d
       JOIN users u_from ON d.delegator_id = u_from.id
       WHERE d.delegatee_id = $1
         AND d.is_acting_assignment = true
         AND d.status = 'active'
         AND d.start_date <= $2
         AND d.end_date >= $3
       ORDER BY d.start_date ASC`,
      [userId, endDate, startDate],
    );

    let totalActingAllowance = 0;
    const breakdown: any[] = [];

    for (const assignment of activeAssignments) {
      const assignStart = new Date(assignment.start_date);
      const assignEnd = new Date(assignment.end_date);

      const overlapStart = assignStart > start ? assignStart : start;
      const overlapEnd = assignEnd < end ? assignEnd : end;
      const overlapDays = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      if (overlapDays <= 0) continue;

      const delegatorSalary = parseFloat(assignment.delegator_basic_salary) || 0;
      let monthlyRate = 0;
      let rateDescription = '';

      if (assignment.acting_allowance_type === 'fixed_amount') {
        monthlyRate = parseFloat(assignment.acting_allowance_amount) || 0;
        rateDescription = `${monthlyRate.toFixed(2)} Fixed`;
      } else {
        const pct = parseFloat(assignment.acting_allowance_percentage) || 0;
        monthlyRate = (delegatorSalary * pct) / 100;
        rateDescription = `${pct}% of ${delegatorSalary.toFixed(2)}`;
      }

      const proratedAmount = Number(((monthlyRate * overlapDays) / totalPeriodDays).toFixed(2));
      totalActingAllowance += proratedAmount;

      const delegatorName = [assignment.delegator_first_name, assignment.delegator_last_name].filter(Boolean).join(' ') || assignment.delegator_email;
      const actingPosition = assignment.acting_position_title || assignment.delegator_position || 'Acting Role';

      breakdown.push({
        delegation_id: assignment.id,
        acting_position: actingPosition,
        delegator_name: delegatorName,
        delegator_salary: delegatorSalary,
        allowance_rate: rateDescription,
        active_days: overlapDays,
        period_days: totalPeriodDays,
        prorated_amount: proratedAmount,
      });
    }

    return {
      total_acting_allowance: Number(totalActingAllowance.toFixed(2)),
      breakdown,
    };
  }
}
