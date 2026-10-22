import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseService } from '../database/database.service';
import { Tenant } from '../auth/entities/tenant.entity';
import {
  GeneralSettingsDto,
  CompanySettingsDto,
  NotificationSettingsDto,
  HRSettingsDto,
  PayrollSettingsDto,
  TaskSettingsDto,
  KPISettingsDto,
  EmailSettingsDto,
  ThemeSettingsDto,
  IntegrationsSettingsDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly databaseService: DatabaseService,
  ) { }

  private async getTenantDatabaseName(tenantSlug: string): Promise<string> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantSlug}`);
    }
    return tenant.database_name;
  }

  private async ensureSettingsTable(connection: any): Promise<void> {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getSettings(tenantIdentifier: string, category?: string) {
    let connection;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);

    if (isUUID) {
      connection = await this.databaseService.getTenantConnectionById(tenantIdentifier);
    } else {
      const databaseName = await this.getTenantDatabaseName(tenantIdentifier);
      connection = await this.databaseService.getTenantConnection(databaseName);
    }

    await this.ensureSettingsTable(connection);

    if (category) {
      const result = await connection.query(
        `SELECT * FROM settings WHERE category = $1`,
        [category],
      );
      return result[0]?.data || {};
    }

    const result = await connection.query(`SELECT * FROM settings`);
    const settings: Record<string, any> = {};
    for (const row of result) {
      settings[row.category] = row.data;
    }
    return settings;
  }

  async getGeneralSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'general');
  }

  async updateGeneralSettings(tenantSlug: string, dto: GeneralSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'general');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('general', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  async getCompanySettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'company');
  }

  async updateCompanySettings(tenantSlug: string, dto: CompanySettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'company');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('company', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  async getNotificationSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'notifications');
  }

  async updateNotificationSettings(
    tenantSlug: string,
    dto: NotificationSettingsDto,
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'notifications');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('notifications', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  // Departments CRUD
  private async ensureDepartmentsTable(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        parent_id UUID,
        manager_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getDepartments(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureDepartmentsTable(connection);

    const result = await connection.query(
      `SELECT * FROM departments WHERE is_active = true ORDER BY name`,
    );
    return result;
  }

  async createDepartment(
    tenantSlug: string,
    data: { name: string; description?: string; parent_id?: string },
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureDepartmentsTable(connection);

    const result = await connection.query(
      `INSERT INTO departments (name, description, parent_id) VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.description || null, data.parent_id || null],
    );
    return result[0];
  }

  async updateDepartment(
    tenantSlug: string,
    id: string,
    data: { name?: string; description?: string; parent_id?: string },
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.parent_id !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      values.push(data.parent_id);
    }

    if (updates.length === 0) {
      const existing = await connection.query(
        `SELECT * FROM departments WHERE id = $1`,
        [id],
      );
      return existing[0];
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await connection.query(
      `UPDATE departments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return result[0];
  }

  async deleteDepartment(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await connection.query(
      `UPDATE departments SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { message: 'Department deleted' };
  }

  // =============================================
  // Companies CRUD
  // =============================================
  private async ensureCompaniesTable(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        legal_name VARCHAR(200),
        registration_number VARCHAR(100),
        tax_number VARCHAR(100),
        industry VARCHAR(100),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        phone VARCHAR(50),
        email VARCHAR(200),
        website VARCHAR(200),
        logo_url TEXT,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ensure there is always at least one default company
    const existing = await connection.query(`SELECT id FROM companies WHERE is_default = true LIMIT 1`);
    if (existing.length === 0) {
      await connection.query(`
        INSERT INTO companies (name, is_default, is_active)
        SELECT 'Default Company', true, true
        WHERE NOT EXISTS (SELECT 1 FROM companies)
      `);
    }
  }

  async getCompanies(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    await this.ensureCompaniesTable(connection);
    return connection.query(`SELECT * FROM companies WHERE is_active = true ORDER BY is_default DESC, name ASC`);
  }

  async getCompanyById(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    await this.ensureCompaniesTable(connection);
    const result = await connection.query(`SELECT * FROM companies WHERE id = $1`, [id]);
    if (!result || result.length === 0) throw new NotFoundException(`Company not found: ${id}`);
    return result[0];
  }

  async createCompany(tenantSlug: string, data: {
    name: string; legal_name?: string; registration_number?: string; tax_number?: string;
    industry?: string; address?: string; city?: string; state?: string; country?: string;
    postal_code?: string; phone?: string; email?: string; website?: string; logo_url?: string; is_default?: boolean;
  }) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    await this.ensureCompaniesTable(connection);
    if (data.is_default) {
      await connection.query(`UPDATE companies SET is_default = false WHERE is_default = true`);
    }
    const result = await connection.query(
      `INSERT INTO companies (name, legal_name, registration_number, tax_number, industry, address, city, state, country, postal_code, phone, email, website, logo_url, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [data.name, data.legal_name||null, data.registration_number||null, data.tax_number||null,
       data.industry||null, data.address||null, data.city||null, data.state||null, data.country||null,
       data.postal_code||null, data.phone||null, data.email||null, data.website||null, data.logo_url||null, data.is_default||false]
    );
    return result[0];
  }

  async updateCompany(tenantSlug: string, id: string, data: {
    name?: string; legal_name?: string; registration_number?: string; tax_number?: string;
    industry?: string; address?: string; city?: string; state?: string; country?: string;
    postal_code?: string; phone?: string; email?: string; website?: string; logo_url?: string; is_default?: boolean;
  }) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    if (data.is_default) {
      await connection.query(`UPDATE companies SET is_default = false WHERE is_default = true AND id != $1`, [id]);
    }
    const fields = ['name','legal_name','registration_number','tax_number','industry','address','city','state','country','postal_code','phone','email','website','logo_url','is_default'];
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (data[f as keyof typeof data] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        values.push(data[f as keyof typeof data]);
      }
    }
    if (updates.length === 0) return this.getCompanyById(tenantSlug, id);
    updates.push(`updated_at = NOW()`);
    values.push(id);
    const result = await connection.query(
      `UPDATE companies SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    return result[0];
  }

  async deleteCompany(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    const existing = await connection.query(`SELECT is_default FROM companies WHERE id = $1`, [id]);
    if (existing[0]?.is_default) throw new BadRequestException('Cannot delete the default company. Set another company as default first.');
    await connection.query(`UPDATE companies SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    return { message: 'Company deleted' };
  }

  // =============================================
  // Branches CRUD
  // =============================================
  private async ensureBranchesTable(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        name VARCHAR(200) NOT NULL,
        code VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        phone VARCHAR(50),
        email VARCHAR(200),
        manager_id UUID,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ensure there is always at least one default branch per default company
    const existing = await connection.query(`SELECT id FROM branches WHERE is_default = true LIMIT 1`);
    if (existing.length === 0) {
      const defaultCompany = await connection.query(`SELECT id FROM companies WHERE is_default = true LIMIT 1`);
      const companyId = defaultCompany[0]?.id || null;
      await connection.query(`
        INSERT INTO branches (company_id, name, is_default, is_active)
        SELECT $1, 'Main Branch', true, true
        WHERE NOT EXISTS (SELECT 1 FROM branches)
      `, [companyId]);
    }
  }

  async getBranches(tenantSlug: string, companyId?: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    await this.ensureCompaniesTable(connection);
    await this.ensureBranchesTable(connection);
    if (companyId) {
      const compIds = companyId.split(',').map(s => s.trim()).filter(Boolean);
      if (compIds.length === 1) {
        return connection.query(
          `SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE b.is_active = true AND b.company_id = $1 ORDER BY b.is_default DESC, b.name ASC`,
          [compIds[0]]
        );
      } else if (compIds.length > 1) {
        const placeholders = compIds.map((_, i) => `$${i + 1}`).join(', ');
        return connection.query(
          `SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE b.is_active = true AND b.company_id IN (${placeholders}) ORDER BY b.is_default DESC, b.name ASC`,
          compIds
        );
      }
    }
    return connection.query(
      `SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE b.is_active = true ORDER BY b.is_default DESC, b.name ASC`
    );
  }

  async getBranchById(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    await this.ensureCompaniesTable(connection);
    await this.ensureBranchesTable(connection);
    const result = await connection.query(
      `SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE b.id = $1`,
      [id]
    );
    if (!result || result.length === 0) throw new NotFoundException(`Branch not found: ${id}`);
    return result[0];
  }

  async createBranch(tenantSlug: string, data: {
    company_id: string; name: string; code?: string; address?: string; city?: string;
    state?: string; country?: string; postal_code?: string; phone?: string; email?: string;
    manager_id?: string; is_default?: boolean;
  }) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    await this.ensureCompaniesTable(connection);
    await this.ensureBranchesTable(connection);
    if (data.is_default) {
      await connection.query(`UPDATE branches SET is_default = false WHERE company_id = $1 AND is_default = true`, [data.company_id]);
    }
    const result = await connection.query(
      `INSERT INTO branches (company_id, name, code, address, city, state, country, postal_code, phone, email, manager_id, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.company_id, data.name, data.code||null, data.address||null, data.city||null,
       data.state||null, data.country||null, data.postal_code||null, data.phone||null,
       data.email||null, data.manager_id||null, data.is_default||false]
    );
    return result[0];
  }

  async updateBranch(tenantSlug: string, id: string, data: {
    company_id?: string; name?: string; code?: string; address?: string; city?: string;
    state?: string; country?: string; postal_code?: string; phone?: string; email?: string;
    manager_id?: string; is_default?: boolean;
  }) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    if (data.is_default && data.company_id) {
      await connection.query(`UPDATE branches SET is_default = false WHERE company_id = $1 AND is_default = true AND id != $2`, [data.company_id, id]);
    }
    const fields = ['company_id','name','code','address','city','state','country','postal_code','phone','email','manager_id','is_default'];
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (data[f as keyof typeof data] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        values.push(data[f as keyof typeof data]);
      }
    }
    if (updates.length === 0) return this.getBranchById(tenantSlug, id);
    updates.push(`updated_at = NOW()`);
    values.push(id);
    const result = await connection.query(
      `UPDATE branches SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    return result[0];
  }

  async deleteBranch(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);
    const existing = await connection.query(`SELECT is_default FROM branches WHERE id = $1`, [id]);
    if (existing[0]?.is_default) throw new BadRequestException('Cannot delete the default branch. Set another branch as default first.');
    await connection.query(`UPDATE branches SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    return { message: 'Branch deleted' };
  }

  // HR Settings

  async getHRSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'hr');
  }

  async updateHRSettings(tenantSlug: string, dto: HRSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'hr');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('hr', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  // Payroll Settings
  async getPayrollSettings(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    // Ensure payroll tables and seed defaults exist
    await this.ensurePayrollTables(connection);
    await this.seedDefaultCategories(connection);
    await this.seedDefaultIncomeTypes(connection);

    // Get specific payroll settings (JSON)
    const existing = await this.getSettings(tenantSlug, 'payroll');

    // Get income types from SQL Table (Source of Truth)
    const incomeTypes = await connection.query(
      `SELECT * FROM income_types WHERE is_active = true ORDER BY name`,
    );

    // Convert DB fields to DTO if needed (e.g. calculation_type)
    // Here we assume keys match reasonably well or we map them.
    // IncomeTypeDto has: id, name, taxable, pensionable, tax_rate, calculation_type...
    // DB has: id, name, is_taxable, is_pensionable, tax_rate, calculation_type...
    const mappedIncomeTypes = incomeTypes.map((it: any) => ({
      id: it.id,
      name: it.name,
      taxable: it.is_taxable,
      pensionable: it.is_pensionable,
      tax_rate: it.tax_rate,
      custom_tax_rate: it.custom_tax_rate ? parseFloat(it.custom_tax_rate) : undefined,
      calculation_type: it.calculation_type,
      is_category_specific: it.is_category_specific,
      universal_calculation_mode: it.universal_calculation_mode,
      universal_fixed_amount: it.universal_fixed_amount ? parseFloat(it.universal_fixed_amount) : null,
      universal_percentage_value: it.universal_percentage_value ? parseFloat(it.universal_percentage_value) : null,
      category_rules: [], // Will be populated below
    }));

    // Fetch category rules for each income type
    for (const incomeType of mappedIncomeTypes) {
      if (incomeType.is_category_specific) {
        const rules = await connection.query(
          `
            SELECT 
              itcr.employee_category_id as category_id,
              ec.name as category_name,
              itcr.calculation_mode,
              itcr.fixed_amount,
              itcr.percentage_value
            FROM income_type_category_rules itcr
            LEFT JOIN employee_categories ec ON itcr.employee_category_id = ec.id
            WHERE itcr.income_type_id = $1
          `,
          [incomeType.id],
        );
        incomeType.category_rules = rules || [];
      }
    }

    return {
      ...existing,
      income_types: mappedIncomeTypes,
      acting_allowance_percentage: existing.acting_allowance_percentage || 10.0,
      acting_allowance_additional_type: existing.acting_allowance_additional_type || 'NONE',
      acting_allowance_additional_value: existing.acting_allowance_additional_value || 0
    };
  }

  async updatePayrollSettings(tenantSlug: string, dto: PayrollSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    // 1. Update basic payroll settings (JSON)
    const existing = await this.getSettings(tenantSlug, 'payroll');
    // Exclude income_types from JSON blob to avoid duplication/staleness?
    // Or keep it for backup? Let's just save non-income settings to JSON.
    const { income_types, ...restDto } = dto;
    const merged = { ...existing, ...restDto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('payroll', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    // 2. Sync Income Types to SQL Table
    if (income_types) {
      // Logic: Upsert based on ID? Or Name?
      // If ID exists, update. If no ID, insert.
      // What about deletions? The DTO list represents the *current* state.
      // So we should strictly probably mark others as inactive or delete them.

      // A. Get current IDs in DB
      const current = await connection.query(
        `SELECT id FROM income_types WHERE is_active = true`,
      );
      const currentIds = current.map((c: any) => c.id);
      const incomingIds = income_types.filter((i) => i.id).map((i) => i.id);

      // B. Delete/Archive missing IDs
      const toDelete = currentIds.filter(
        (id: string) => !incomingIds.includes(id),
      );
      if (toDelete.length > 0) {
        // Use parameterized query with ANY
        await connection.query(
          `UPDATE income_types SET is_active = false WHERE id = ANY($1)`,
          [toDelete],
        );
      }

      // C. Upsert incoming
      for (const inc of income_types) {
        let incomeTypeId = inc.id;

        if (inc.id && incomingIds.includes(inc.id)) {
          // Update
          await connection.query(
            `
            UPDATE income_types 
            SET name = $1, is_taxable = $2, is_pensionable = $3, 
                tax_rate = $4, custom_tax_rate = $5, calculation_type = $6,
                is_category_specific = $7, universal_calculation_mode = $8,
                universal_fixed_amount = $9, universal_percentage_value = $10,
                updated_at = NOW()
            WHERE id = $11
          `,
            [
              inc.name,
              inc.taxable,
              inc.pensionable,
              inc.tax_rate,
              inc.custom_tax_rate || null,
              inc.calculation_type || 'fixed',
              inc.is_category_specific || false,
              inc.universal_calculation_mode || 'both_highest',
              inc.universal_fixed_amount,
              inc.universal_percentage_value,
              inc.id,
            ],
          );
        } else {
          // Insert
          const result = await connection.query(
            `
            INSERT INTO income_types (
              name, is_taxable, is_pensionable, tax_rate, custom_tax_rate, calculation_type,
              is_category_specific, universal_calculation_mode, universal_fixed_amount, universal_percentage_value
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `,
            [
              inc.name,
              inc.taxable ?? true,
              inc.pensionable ?? false,
              inc.tax_rate || 'standard',
              inc.custom_tax_rate || null,
              inc.calculation_type || 'fixed',
              inc.is_category_specific || false,
              inc.universal_calculation_mode || 'both_highest',
              inc.universal_fixed_amount,
              inc.universal_percentage_value,
            ],
          );
          incomeTypeId = result[0].id;
        }

        // Handle category rules
        if (inc.category_rules && Array.isArray(inc.category_rules)) {
          // Delete existing rules
          await connection.query(
            `DELETE FROM income_type_category_rules WHERE income_type_id = $1`,
            [incomeTypeId],
          );

          // Insert new rules
          for (const rule of inc.category_rules) {
            await connection.query(
              `
              INSERT INTO income_type_category_rules(
                income_type_id,
                employee_category_id,
                calculation_mode,
                fixed_amount,
                percentage_value
              )
              VALUES($1, $2, $3, $4, $5)
              `,
              [
                incomeTypeId,
                rule.category_id,
                rule.calculation_mode || 'both_highest',
                rule.fixed_amount,
                rule.percentage_value,
              ],
            );
          }
        }
      }
    }

    // Return the full object including re-fetched income types
    return this.getPayrollSettings(tenantSlug);
  }

  // Task Settings
  async getTaskSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'tasks');
  }

  async updateTaskSettings(tenantSlug: string, dto: TaskSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'tasks');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('tasks', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  // KPI Settings
  async getKPISettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'kpi');
  }

  async updateKPISettings(tenantSlug: string, dto: KPISettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'kpi');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('kpi', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  // Email Settings
  async getEmailSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'email');
  }

  async updateEmailSettings(tenantSlug: string, dto: EmailSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'email');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('email', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  // Integrations Settings
  async getIntegrationsSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'integrations');
  }

  async updateIntegrationsSettings(tenantSlug: string, dto: IntegrationsSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'integrations');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('integrations', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }

  // Comprehensive list of timezones
  getTimezones() {
    return [
      // UTC
      {
        value: 'UTC',
        label: 'UTC (Coordinated Universal Time)',
        offset: '+00:00',
      },

      // Africa
      { value: 'Africa/Abidjan', label: 'Abidjan (GMT)', offset: '+00:00' },
      { value: 'Africa/Accra', label: 'Accra (GMT)', offset: '+00:00' },
      {
        value: 'Africa/Addis_Ababa',
        label: 'Addis Ababa (EAT)',
        offset: '+03:00',
      },
      { value: 'Africa/Algiers', label: 'Algiers (CET)', offset: '+01:00' },
      { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: '+02:00' },
      {
        value: 'Africa/Casablanca',
        label: 'Casablanca (WET)',
        offset: '+01:00',
      },
      {
        value: 'Africa/Johannesburg',
        label: 'Johannesburg (SAST)',
        offset: '+02:00',
      },
      { value: 'Africa/Lagos', label: 'Lagos (WAT)', offset: '+01:00' },
      { value: 'Africa/Nairobi', label: 'Nairobi (EAT)', offset: '+03:00' },
      { value: 'Africa/Tunis', label: 'Tunis (CET)', offset: '+01:00' },

      // America
      {
        value: 'America/Anchorage',
        label: 'Anchorage (AKST)',
        offset: '-09:00',
      },
      {
        value: 'America/Argentina/Buenos_Aires',
        label: 'Buenos Aires (ART)',
        offset: '-03:00',
      },
      { value: 'America/Bogota', label: 'Bogota (COT)', offset: '-05:00' },
      { value: 'America/Caracas', label: 'Caracas (VET)', offset: '-04:00' },
      { value: 'America/Chicago', label: 'Chicago (CST)', offset: '-06:00' },
      { value: 'America/Denver', label: 'Denver (MST)', offset: '-07:00' },
      { value: 'America/Halifax', label: 'Halifax (AST)', offset: '-04:00' },
      { value: 'America/Havana', label: 'Havana (CST)', offset: '-05:00' },
      { value: 'America/Lima', label: 'Lima (PET)', offset: '-05:00' },
      {
        value: 'America/Los_Angeles',
        label: 'Los Angeles (PST)',
        offset: '-08:00',
      },
      {
        value: 'America/Mexico_City',
        label: 'Mexico City (CST)',
        offset: '-06:00',
      },
      { value: 'America/New_York', label: 'New York (EST)', offset: '-05:00' },
      { value: 'America/Phoenix', label: 'Phoenix (MST)', offset: '-07:00' },
      { value: 'America/Santiago', label: 'Santiago (CLT)', offset: '-03:00' },
      {
        value: 'America/Sao_Paulo',
        label: 'Sao Paulo (BRT)',
        offset: '-03:00',
      },
      { value: 'America/Toronto', label: 'Toronto (EST)', offset: '-05:00' },
      {
        value: 'America/Vancouver',
        label: 'Vancouver (PST)',
        offset: '-08:00',
      },

      // Asia
      { value: 'Asia/Almaty', label: 'Almaty (ALMT)', offset: '+06:00' },
      { value: 'Asia/Amman', label: 'Amman (EET)', offset: '+02:00' },
      { value: 'Asia/Baghdad', label: 'Baghdad (AST)', offset: '+03:00' },
      { value: 'Asia/Bahrain', label: 'Bahrain (AST)', offset: '+03:00' },
      { value: 'Asia/Baku', label: 'Baku (AZT)', offset: '+04:00' },
      { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: '+07:00' },
      { value: 'Asia/Beirut', label: 'Beirut (EET)', offset: '+02:00' },
      { value: 'Asia/Colombo', label: 'Colombo (IST)', offset: '+05:30' },
      { value: 'Asia/Damascus', label: 'Damascus (EET)', offset: '+02:00' },
      { value: 'Asia/Dhaka', label: 'Dhaka (BST)', offset: '+06:00' },
      { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+04:00' },
      {
        value: 'Asia/Ho_Chi_Minh',
        label: 'Ho Chi Minh (ICT)',
        offset: '+07:00',
      },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: '+08:00' },
      { value: 'Asia/Istanbul', label: 'Istanbul (TRT)', offset: '+03:00' },
      { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', offset: '+07:00' },
      { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)', offset: '+02:00' },
      { value: 'Asia/Kabul', label: 'Kabul (AFT)', offset: '+04:30' },
      { value: 'Asia/Karachi', label: 'Karachi (PKT)', offset: '+05:00' },
      { value: 'Asia/Kathmandu', label: 'Kathmandu (NPT)', offset: '+05:45' },
      { value: 'Asia/Kolkata', label: 'Kolkata (IST)', offset: '+05:30' },
      {
        value: 'Asia/Kuala_Lumpur',
        label: 'Kuala Lumpur (MYT)',
        offset: '+08:00',
      },
      { value: 'Asia/Kuwait', label: 'Kuwait (AST)', offset: '+03:00' },
      { value: 'Asia/Manila', label: 'Manila (PHT)', offset: '+08:00' },
      { value: 'Asia/Muscat', label: 'Muscat (GST)', offset: '+04:00' },
      { value: 'Asia/Qatar', label: 'Qatar (AST)', offset: '+03:00' },
      { value: 'Asia/Riyadh', label: 'Riyadh (AST)', offset: '+03:00' },
      { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: '+09:00' },
      { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: '+08:00' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00' },
      { value: 'Asia/Taipei', label: 'Taipei (CST)', offset: '+08:00' },
      { value: 'Asia/Tehran', label: 'Tehran (IRST)', offset: '+03:30' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
      { value: 'Asia/Yangon', label: 'Yangon (MMT)', offset: '+06:30' },

      // Atlantic
      { value: 'Atlantic/Azores', label: 'Azores (AZOT)', offset: '-01:00' },
      {
        value: 'Atlantic/Reykjavik',
        label: 'Reykjavik (GMT)',
        offset: '+00:00',
      },

      // Australia
      {
        value: 'Australia/Adelaide',
        label: 'Adelaide (ACST)',
        offset: '+09:30',
      },
      {
        value: 'Australia/Brisbane',
        label: 'Brisbane (AEST)',
        offset: '+10:00',
      },
      { value: 'Australia/Darwin', label: 'Darwin (ACST)', offset: '+09:30' },
      { value: 'Australia/Hobart', label: 'Hobart (AEST)', offset: '+10:00' },
      {
        value: 'Australia/Melbourne',
        label: 'Melbourne (AEST)',
        offset: '+10:00',
      },
      { value: 'Australia/Perth', label: 'Perth (AWST)', offset: '+08:00' },
      { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00' },

      // Europe
      { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', offset: '+01:00' },
      { value: 'Europe/Athens', label: 'Athens (EET)', offset: '+02:00' },
      { value: 'Europe/Belgrade', label: 'Belgrade (CET)', offset: '+01:00' },
      { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: '+01:00' },
      { value: 'Europe/Brussels', label: 'Brussels (CET)', offset: '+01:00' },
      { value: 'Europe/Bucharest', label: 'Bucharest (EET)', offset: '+02:00' },
      { value: 'Europe/Budapest', label: 'Budapest (CET)', offset: '+01:00' },
      {
        value: 'Europe/Copenhagen',
        label: 'Copenhagen (CET)',
        offset: '+01:00',
      },
      { value: 'Europe/Dublin', label: 'Dublin (GMT)', offset: '+00:00' },
      { value: 'Europe/Helsinki', label: 'Helsinki (EET)', offset: '+02:00' },
      { value: 'Europe/Kiev', label: 'Kyiv (EET)', offset: '+02:00' },
      { value: 'Europe/Lisbon', label: 'Lisbon (WET)', offset: '+00:00' },
      { value: 'Europe/London', label: 'London (GMT)', offset: '+00:00' },
      { value: 'Europe/Madrid', label: 'Madrid (CET)', offset: '+01:00' },
      { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: '+03:00' },
      { value: 'Europe/Oslo', label: 'Oslo (CET)', offset: '+01:00' },
      { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+01:00' },
      { value: 'Europe/Prague', label: 'Prague (CET)', offset: '+01:00' },
      { value: 'Europe/Rome', label: 'Rome (CET)', offset: '+01:00' },
      { value: 'Europe/Stockholm', label: 'Stockholm (CET)', offset: '+01:00' },
      { value: 'Europe/Vienna', label: 'Vienna (CET)', offset: '+01:00' },
      { value: 'Europe/Warsaw', label: 'Warsaw (CET)', offset: '+01:00' },
      { value: 'Europe/Zurich', label: 'Zurich (CET)', offset: '+01:00' },

      // Indian
      { value: 'Indian/Maldives', label: 'Maldives (MVT)', offset: '+05:00' },
      { value: 'Indian/Mauritius', label: 'Mauritius (MUT)', offset: '+04:00' },

      // Pacific
      { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: '+12:00' },
      { value: 'Pacific/Fiji', label: 'Fiji (FJT)', offset: '+12:00' },
      { value: 'Pacific/Guam', label: 'Guam (ChST)', offset: '+10:00' },
      { value: 'Pacific/Honolulu', label: 'Honolulu (HST)', offset: '-10:00' },
      { value: 'Pacific/Samoa', label: 'Samoa (SST)', offset: '-11:00' },
    ];
  }

  async testEmailSettings(tenantSlug: string, testEmail: string) {
    const settings = await this.getEmailSettings(tenantSlug);

    // Check for Brevo API key (stored in smtp_pass or brevo_api_key field)
    const brevoApiKey = settings?.brevo_api_key || settings?.smtp_pass;

    if (!brevoApiKey || brevoApiKey.length < 10) {
      throw new Error(
        'Brevo API key is not configured. Please enter your Brevo API key.',
      );
    }

    try {
      const fromName = settings.from_name || 'Humanitas System';
      const fromEmail = settings.from_email || 'noreply@humanitas.com';

      console.log(
        '[TestEmail] Sending test email via Brevo API to:',
        testEmail,
      );

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: testEmail }],
          subject: 'Test Email Configuration',
          htmlContent:
            '<p>This is a test email to verify your Brevo email configuration. If you received this, your email settings are working correctly.</p>',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          '[TestEmail] Brevo API error:',
          response.status,
          errorText,
        );
        throw new Error(`Brevo API error: ${errorText}`);
      }

      const result = await response.json();
      console.log('[TestEmail] Success! MessageId:', result.messageId);

      return {
        success: true,
        message: 'Test email sent successfully via Brevo API',
      };
    } catch (error) {
      console.error('Test email failed:', error);
      throw new Error(`Failed to send test email: ${error.message}`);
    }
  }

  // ==================== SEEDING HELPERS ====================
  // Duplicated from PayrollService to ensure settings page triggers seeding
  private async ensurePayrollTables(connection: any) {
    // Basic tables needed for settings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS income_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_taxable BOOLEAN DEFAULT true,
        is_pensionable BOOLEAN DEFAULT false,
        calculation_type VARCHAR(20) DEFAULT 'fixed',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        check(calculation_type in ('fixed', 'percentage'))
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS income_type_category_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        income_type_id UUID NOT NULL REFERENCES income_types(id) ON DELETE CASCADE,
        employee_category_id UUID NOT NULL REFERENCES employee_categories(id) ON DELETE CASCADE,
        fixed_amount DECIMAL(15,2) DEFAULT NULL,
        percentage_value DECIMAL(5,2) DEFAULT NULL,
        calculation_mode VARCHAR(20) DEFAULT 'both_highest',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(income_type_id, employee_category_id),
        CHECK(calculation_mode IN ('fixed_only', 'percentage_only', 'both_highest'))
      )
    `);

    // Add columns if missing
    await connection.query(`
      DO $$ BEGIN
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS is_category_specific BOOLEAN DEFAULT false;
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS universal_fixed_amount DECIMAL(15,2) DEFAULT NULL;
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS universal_percentage_value DECIMAL(5,2) DEFAULT NULL;
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS universal_calculation_mode VARCHAR(20) DEFAULT 'both_highest';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Ensure is_active column exists (Fix for 500 error)
    await connection.query(`
      DO $$ BEGIN
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
  }

  private async seedDefaultCategories(connection: any) {
    const categories = [
      { slug: 'management', name: 'Management', description: 'Senior Management Members' },
      { slug: 'field', name: 'Field Worker', description: 'Employees working mostly outside' },
      { slug: 'general', name: 'General Staff', description: 'Standard office employees' },
    ];

    await connection.query(`
      CREATE TABLE IF NOT EXISTS employee_categories(
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        default_transport_allowance DECIMAL(10, 2) DEFAULT 0,
        default_per_diem_fixed DECIMAL(10, 2) DEFAULT 0,
        per_diem_no_receipt_fixed DECIMAL(10, 2) DEFAULT 0,
        per_diem_no_receipt_percent DECIMAL(5, 2) DEFAULT 0,
        per_diem_receipt_fixed DECIMAL(10, 2) DEFAULT 0,
        per_diem_receipt_percent DECIMAL(5, 2) DEFAULT 0,
        desert_min_percent DECIMAL(5, 2) DEFAULT 0,
        desert_mid_percent DECIMAL(5, 2) DEFAULT 0,
        desert_max_percent DECIMAL(5, 2) DEFAULT 0,
        hardship_min_percent DECIMAL(5, 2) DEFAULT 0,
        hardship_mid_percent DECIMAL(5, 2) DEFAULT 0,
        hardship_max_percent DECIMAL(5, 2) DEFAULT 0,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const cat of categories) {
      await connection.query(`
        INSERT INTO employee_categories (slug, name, description, is_system)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (slug) DO NOTHING
      `, [cat.slug, cat.name, cat.description]);
    }
  }

  private async seedDefaultIncomeTypes(connection: any) {
    // 1. Transport Allowance (Category Specific)
    const transportCheck = await connection.query(`SELECT id FROM income_types WHERE name = 'Transport Allowance'`);
    let transportId: string;

    if (transportCheck.length === 0) {
      const res = await connection.query(`
        INSERT INTO income_types (name, description, is_taxable, is_pensionable, calculation_type, is_category_specific, universal_calculation_mode)
        VALUES ('Transport Allowance', 'Standard transport allowance based on category', false, false, 'fixed', true, 'both_highest')
        RETURNING id
      `);
      transportId = res[0].id;
    } else {
      transportId = transportCheck[0].id;
      // Ensure it is set to category specific if it exists but wasn't
      await connection.query(`UPDATE income_types SET is_category_specific = true WHERE id = $1`, [transportId]);
    }

    // Seed Transport Rules
    const cats = await connection.query(`SELECT id, slug FROM employee_categories WHERE slug IN ('management', 'field-worker', 'general-staff')`);
    const catMap = new Map(cats.map((c: any) => [c.slug, c.id]));

    const transportRules = [
      { slug: 'management', amount: 2200 },
      { slug: 'field-worker', amount: 2200 },
      { slug: 'general-staff', amount: 600 },
    ];

    for (const rule of transportRules) {
      const catId = catMap.get(rule.slug);
      if (catId) {
        await connection.query(`
          INSERT INTO income_type_category_rules (income_type_id, employee_category_id, calculation_mode, fixed_amount, percentage_value)
          VALUES ($1, $2, 'fixed_only', $3, 0)
          ON CONFLICT (income_type_id, employee_category_id) DO UPDATE
          SET fixed_amount = $3, calculation_mode = 'fixed_only'
        `, [transportId, catId, rule.amount]);
      }
    }

    // 2. Desert Allowances (Max 40%, Mid 30%, Min 20%)
    const desertTypes = [
      { name: 'Desert Allowance (Max)', percent: 40 },
      { name: 'Desert Allowance (Mid)', percent: 30 },
      { name: 'Desert Allowance (Min)', percent: 20 },
    ];

    for (const type of desertTypes) {
      const check = await connection.query(`SELECT id FROM income_types WHERE name = $1`, [type.name]);
      if (check.length === 0) {
        await connection.query(`
          INSERT INTO income_types (
            name, description, is_taxable, is_pensionable, calculation_type, 
            is_category_specific, universal_calculation_mode, universal_percentage_value
          )
          VALUES ($1, 'Desert allowance', true, true, 'percentage', false, 'percentage_only', $2)
        `, [type.name, type.percent]);
      }
    }

    // 3. Hardship Allowances (Max 60%, Mid 50%, Min 40%)
    const hardshipTypes = [
      { name: 'Hardship Allowance (Max)', percent: 60 },
      { name: 'Hardship Allowance (Mid)', percent: 50 },
      { name: 'Hardship Allowance (Min)', percent: 40 },
    ];

    for (const type of hardshipTypes) {
      const check = await connection.query(`SELECT id FROM income_types WHERE name = $1`, [type.name]);
      if (check.length === 0) {
        await connection.query(`
          INSERT INTO income_types (
            name, description, is_taxable, is_pensionable, calculation_type, 
            is_category_specific, universal_calculation_mode, universal_percentage_value
          )
          VALUES ($1, 'Hardship allowance', true, true, 'percentage', false, 'percentage_only', $2)
        `, [type.name, type.percent]);
      }
    }
  }

  async getIncomeTypes(tenantSlug: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const connection = await this.databaseService.getTenantConnection(
      tenant.database_name,
    );

    // Ensure table structure exists (including is_active column)
    await this.ensurePayrollTables(connection);

    const result = await connection.query(`
      SELECT id, name, description, is_taxable, is_pensionable, calculation_type, 
             is_category_specific, is_active
      FROM income_types
      WHERE is_active = true
      ORDER BY name ASC
    `);

    return result;
  }
  // Theme Settings
  async getThemeSettings(tenantSlug: string) {
    return this.getSettings(tenantSlug, 'theme');
  }

  async updateThemeSettings(tenantSlug: string, dto: ThemeSettingsDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureSettingsTable(connection);

    const existing = await this.getSettings(tenantSlug, 'theme');
    const merged = { ...existing, ...dto };

    await connection.query(
      `INSERT INTO settings (category, data) VALUES ('theme', $1)
       ON CONFLICT (category) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(merged)],
    );

    return merged;
  }
}
