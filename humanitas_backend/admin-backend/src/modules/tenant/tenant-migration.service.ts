import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';

export interface TenantMigrationStatus {
  database: string;
  totalFiles: number;
  appliedCount: number;
  pendingCount: number;
  applied: string[];
  pending: string[];
}

/**
 * TenantMigrationService (admin-backend copy)
 *
 * Incremental and manual database migration & seeding engine for multi-tenant databases.
 * Placed in admin-backend so that platform admins can trigger and monitor migrations
 * across ALL tenant databases without going through the tenant-facing API.
 *
 * Strategy:
 * - Reads all SQL files from src/migrations/tenant/ in ascending filename order.
 * - Maintains a schema_migrations table in each tenant DB to track which
 *   migrations have already run — idempotent on every call.
 * - Runs only the NEW migrations each time (never re-runs completed ones).
 * - Distinguishes between schema migrations (strict fail) and seed migrations (soft fail).
 */
@Injectable()
export class TenantMigrationService {
  private readonly logger = new Logger(TenantMigrationService.name);
  private readonly migratedDbs = new Set<string>();

  constructor(private readonly configService: ConfigService) {}

  async runMigrations(dataSource: DataSource, databaseName: string): Promise<string[]> {
    if (this.migratedDbs.has(databaseName)) return [];

    try {
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const applied: { filename: string }[] = await dataSource.query(
        `SELECT filename FROM schema_migrations ORDER BY filename ASC`,
      );
      const appliedSet = new Set(applied.map((r) => r.filename));

      const migrationsDir = this.getMigrationsDir();
      if (!fs.existsSync(migrationsDir)) {
        this.logger.warn(`Migrations directory not found: ${migrationsDir}`);
        return [];
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      const pending = files.filter((f) => !appliedSet.has(f));

      if (pending.length === 0) {
        this.migratedDbs.add(databaseName);
        return [];
      }

      this.logger.log(`[${databaseName}] Running ${pending.length} pending migration(s): ${pending.join(', ')}`);

      const newlyApplied: string[] = [];

      for (const filename of pending) {
        const filePath = path.join(migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf8');
        const isSeedMigration = filename.includes('seed');

        await dataSource.query('BEGIN');
        try {
          await dataSource.query(sql);
          await dataSource.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
          await dataSource.query('COMMIT');
          newlyApplied.push(filename);
          this.logger.log(`[${databaseName}] ✅ Applied: ${filename}`);
        } catch (err) {
          await dataSource.query('ROLLBACK');
          if (isSeedMigration) {
            this.logger.warn(`[${databaseName}] ⚠️ Seed migration failed (non-fatal): ${filename} — ${err.message}`);
            try {
              await dataSource.query(
                `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
                [filename],
              );
            } catch (_) {}
          } else {
            this.logger.error(`[${databaseName}] ❌ Failed: ${filename} — ${err.message}`);
            throw new Error(`Migration failed for ${databaseName} on file ${filename}: ${err.message}`);
          }
        }
      }

      this.migratedDbs.add(databaseName);
      return newlyApplied;
    } catch (err) {
      this.logger.error(`[${databaseName}] Migration error: ${err.message}`);
      throw err;
    }
  }

  async getTenantMigrationStatus(dataSource: DataSource, databaseName: string): Promise<TenantMigrationStatus> {
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const appliedRows: { filename: string }[] = await dataSource.query(
      `SELECT filename FROM schema_migrations ORDER BY filename ASC`,
    );
    const applied = appliedRows.map((r) => r.filename);
    const appliedSet = new Set(applied);

    const migrationsDir = this.getMigrationsDir();
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
      : [];

    const pending = files.filter((f) => !appliedSet.has(f));

    return {
      database: databaseName,
      totalFiles: files.length,
      appliedCount: applied.length,
      pendingCount: pending.length,
      applied,
      pending,
    };
  }

  async forceRunMigrations(dataSource: DataSource, databaseName: string): Promise<string[]> {
    this.migratedDbs.delete(databaseName);
    return this.runMigrations(dataSource, databaseName);
  }

  async migrateAllTenants(
    tenants: Array<{ slug: string; database_name: string }>,
    connectionFactory: (dbName: string) => Promise<DataSource>,
  ): Promise<{ migrated: Array<{ slug: string; applied: string[] }>; errors: Array<{ tenant: string; error: string }> }> {
    const migrated: Array<{ slug: string; applied: string[] }> = [];
    const errors: Array<{ tenant: string; error: string }> = [];

    this.logger.log(`Starting migration sweep for ${tenants.length} tenant(s)`);

    for (const tenant of tenants) {
      try {
        const ds = await connectionFactory(tenant.database_name);
        const applied = await this.forceRunMigrations(ds, tenant.database_name);
        migrated.push({ slug: tenant.slug, applied });
      } catch (err) {
        this.logger.error(`Failed to migrate tenant ${tenant.slug}: ${err.message}`);
        errors.push({ tenant: tenant.slug, error: err.message });
      }
    }

    this.logger.log(`Migration sweep complete. Success: ${migrated.length}, Errors: ${errors.length}`);
    return { migrated, errors };
  }

  /** Resolve the migrations directory — works in both ts-node (src/) and dist/ */
  private getMigrationsDir(): string {
    // For admin-backend: dist/ path is 3 levels up from modules/tenant/ (modules/tenant -> modules -> src -> dist-root)
    const distPath = path.join(__dirname, '..', '..', '..', 'migrations', 'tenant');
    if (fs.existsSync(distPath)) return distPath;
    const srcPath = path.join(process.cwd(), 'src', 'migrations', 'tenant');
    return srcPath;
  }
}
