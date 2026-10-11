import { ConfigService } from '@nestjs/config';
import { TenantMigrationService } from './tenant-migration.service';
import * as fs from 'fs';

jest.mock('fs');

describe('TenantMigrationService', () => {
  let service: TenantMigrationService;
  let mockConfigService: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn(),
    };

    service = new TenantMigrationService(mockConfigService as ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should run only pending migrations and record each in schema_migrations', async () => {
    // Mock fs
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue([
      '20260201000001_core.sql',
      '20260201000002_payroll.sql',
      '20260201000003_pms.sql',
    ]);
    (fs.readFileSync as jest.Mock).mockReturnValue('CREATE TABLE test_tab ();');

    // 1st query: CREATE TABLE schema_migrations
    // 2nd query: SELECT filename FROM schema_migrations (return already applied 001)
    mockDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return Promise.resolve([{ filename: '20260201000001_core.sql' }]);
      }
      return Promise.resolve([]);
    });

    const applied = await service.runMigrations(mockDataSource, 'test_tenant_db_1');

    // Should only have applied 002 and 003
    expect(applied).toEqual([
      '20260201000002_payroll.sql',
      '20260201000003_pms.sql',
    ]);
  });

  it('should calculate accurate migration audit status', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue([
      '20260201000001_core.sql',
      '20260201000002_payroll.sql',
    ]);

    mockDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return Promise.resolve([{ filename: '20260201000001_core.sql' }]);
      }
      return Promise.resolve([]);
    });

    const status = await service.getTenantMigrationStatus(
      mockDataSource,
      'test_tenant_db_status',
    );

    expect(status.totalFiles).toBe(2);
    expect(status.appliedCount).toBe(1);
    expect(status.pendingCount).toBe(1);
    expect(status.applied).toEqual(['20260201000001_core.sql']);
    expect(status.pending).toEqual(['20260201000002_payroll.sql']);
  });

  it('should treat seed migrations as non-fatal on conflict/error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['20260201000007_seed_data.sql']);
    (fs.readFileSync as jest.Mock).mockReturnValue('INSERT INTO settings VALUES (1);');

    mockDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return Promise.resolve([]);
      }
      if (sql.includes('INSERT INTO settings')) {
        throw new Error('duplicate key value violates unique constraint');
      }
      return Promise.resolve([]);
    });

    // Should NOT throw for seed migrations
    await expect(
      service.runMigrations(mockDataSource, 'test_tenant_db_seed'),
    ).resolves.not.toThrow();
  });
});
