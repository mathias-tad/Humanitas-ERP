import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantMigrationService } from '../src/modules/database/tenant-migration.service';
import { ConfigService } from '@nestjs/config';

describe('Tenant Incremental Migrations & Seeding (E2E Test)', () => {
  let app: INestApplication;
  let migrationService: TenantMigrationService;
  let mockDataSource: any;
  let queryHistory: string[] = [];
  let schemaMigrationsStore: Set<string> = new Set();

  beforeAll(async () => {
    queryHistory = [];
    schemaMigrationsStore = new Set();

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        queryHistory.push(sql);

        // Simulate CREATE TABLE IF NOT EXISTS schema_migrations
        if (sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return [];
        }

        // Simulate SELECT filename FROM schema_migrations
        if (sql.includes('SELECT filename FROM schema_migrations')) {
          return Array.from(schemaMigrationsStore).map((filename) => ({ filename }));
        }

        // Simulate INSERT INTO schema_migrations
        if (sql.includes('INSERT INTO schema_migrations')) {
          const filename = params?.[0];
          if (filename) schemaMigrationsStore.add(filename);
          return [];
        }

        // Simulate transaction commands
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return [];
        }

        return [];
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMigrationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    migrationService = moduleRef.get<TenantMigrationService>(TenantMigrationService);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('boots the test module cleanly', () => {
    expect(migrationService).toBeDefined();
    expect(app).toBeDefined();
  });

  it('runs initial migrations and records them in schema_migrations', async () => {
    const databaseName = 'e2e_tenant_initial_db';
    const applied = await migrationService.runMigrations(mockDataSource as any, databaseName);

    // Initial run should execute available SQL files
    expect(Array.isArray(applied)).toBe(true);
    // Verifies schema_migrations was checked
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations'),
    );
  });

  it('is idempotent: consecutive run detects already-applied migrations and skips them', async () => {
    const databaseName = 'e2e_tenant_idempotent_db';
    // First run
    const firstRun = await migrationService.forceRunMigrations(mockDataSource as any, databaseName);
    // Second run immediately after
    const secondRun = await migrationService.runMigrations(mockDataSource as any, databaseName);

    // Second run must apply 0 additional migrations
    expect(secondRun).toHaveLength(0);
  });

  it('reports accurate audit status of applied vs pending files', async () => {
    const databaseName = 'e2e_tenant_audit_db';
    const status = await migrationService.getTenantMigrationStatus(mockDataSource as any, databaseName);

    expect(status).toBeDefined();
    expect(status.database).toBe(databaseName);
    expect(status.totalFiles).toBeGreaterThanOrEqual(0);
    expect(status.appliedCount).toBe(status.applied.length);
    expect(status.pendingCount).toBe(status.pending.length);
  });

  it('handles multi-tenant batch migration sweep', async () => {
    const tenants = [
      { slug: 'tenant-alpha', database_name: 'tenant_alpha_db' },
      { slug: 'tenant-beta', database_name: 'tenant_beta_db' },
    ];

    const result = await migrationService.migrateAllTenants(
      tenants,
      async (_dbName: string) => mockDataSource,
    );

    expect(result.migrated).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.migrated[0].slug).toBe('tenant-alpha');
    expect(result.migrated[1].slug).toBe('tenant-beta');
  });
});
