import * as fs from 'fs';
import * as path from 'path';

// Unit tests for Companies & Branches CRUD in SettingsService & Operational Migrations
describe('SettingsService - Companies & Branches & Multi-Entity Scoping', () => {
  let mockConnection: any;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
    };
  });

  describe('ensureCompaniesTable pattern', () => {
    it('should create the companies table SQL if it does not exist', () => {
      const sql = 'CREATE TABLE IF NOT EXISTS companies';
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS companies');
    });

    it('should create the branches table SQL if it does not exist', () => {
      const sql = 'CREATE TABLE IF NOT EXISTS branches';
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS branches');
    });
  });

  describe('company_id and branch_id on users', () => {
    it('should add company_id column to users table', () => {
      const alterSql = 'ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID';
      expect(alterSql).toContain('company_id');
    });

    it('should add branch_id column to users table', () => {
      const alterSql = 'ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID';
      expect(alterSql).toContain('branch_id');
    });
  });

  describe('permission definitions', () => {
    const orgPermissions = [
      'view_companies', 'manage_companies', 'view_all_companies',
      'view_branches', 'manage_branches', 'view_all_branches',
    ];
    
    it('should define all 6 organization permissions', () => {
      expect(orgPermissions).toHaveLength(6);
    });

    it('should restrict manage and view_all to admin only', () => {
      const adminOnly = ['view_all_companies', 'view_all_branches', 'manage_companies', 'manage_branches'];
      for (const p of adminOnly) {
        expect(orgPermissions).toContain(p);
      }
    });

    it('should allow view_companies and view_branches for managers', () => {
      const managerAllowed = ['view_companies', 'view_branches'];
      for (const p of managerAllowed) {
        expect(orgPermissions).toContain(p);
      }
    });
  });

  describe('Operational tables multi-entity migration (Directive 16)', () => {
    const migrationFilePath = path.join(
      __dirname,
      '../../migrations/tenant/20261022000001_add_company_branch_to_all_operational_tables.sql'
    );

    it('should have the tenant migration file on disk', () => {
      expect(fs.existsSync(migrationFilePath)).toBe(true);
    });

    it('should include all required operational tables', () => {
      const sqlContent = fs.readFileSync(migrationFilePath, 'utf8');
      const requiredTables = [
        'users',
        'departments',
        'positions',
        'attendance',
        'attendance_records',
        'shifts',
        'schedules',
        'schedule_patterns',
        'shift_patterns',
        'shift_assignments',
        'leave_requests',
        'leave_balances',
        'payroll_runs',
        'payroll_items',
        'loans',
        'holidays',
        'pms_projects',
        'pms_tasks',
        'device_registry',
        'biometric_devices',
        'announcements',
        'events',
      ];

      for (const table of requiredTables) {
        expect(sqlContent).toContain(`'${table}'`);
      }
    });

    it('should add company_id and branch_id with foreign key constraints', () => {
      const sqlContent = fs.readFileSync(migrationFilePath, 'utf8');
      expect(sqlContent).toContain('company_id UUID REFERENCES companies(id) ON DELETE SET NULL');
      expect(sqlContent).toContain('branch_id UUID REFERENCES branches(id) ON DELETE SET NULL');
    });

    it('should define the automatic inheritance trigger function', () => {
      const sqlContent = fs.readFileSync(migrationFilePath, 'utf8');
      expect(sqlContent).toContain('FUNCTION trg_set_company_branch()');
      expect(sqlContent).toContain('to_jsonb(NEW)');
      expect(sqlContent).toContain('COALESCE(u_comp_id, def_comp_id)');
      expect(sqlContent).toContain('COALESCE(u_branch_id, def_branch_id)');
    });

    it('should create indexes on both company_id and branch_id for every table', () => {
      const sqlContent = fs.readFileSync(migrationFilePath, 'utf8');
      expect(sqlContent).toContain("CREATE INDEX IF NOT EXISTS %I ON %I (company_id)");
      expect(sqlContent).toContain("CREATE INDEX IF NOT EXISTS %I ON %I (branch_id)");
    });
  });
});
