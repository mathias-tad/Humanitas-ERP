import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';

/**
 * TenantMigrationService
 *
 * Replaces the ~900-line initializeTenantTables() + ensurePayrollTables() approach.
 *
 * Strategy
 * --------
 * - Reads all SQL files from src/migrations/tenant/ in ascending filename order.
 * - Maintains a schema_migrations table in each tenant DB to track which
 *   migrations have already run — idempotent on every call.
 * - Runs only the NEW migrations each time (never re-runs completed ones).
 * - Called ONCE during tenant DB creation, and again lazily on first connection
 *   to apply any new migrations added since the tenant was created.
 *
 * This is the node-pg-migrate pattern implemented directly in TypeScript so we
 * don't need an extra CLI tool or a separate migration runner process.
 */
@Injectable()
export class TenantMigrationService {
  private readonly logger = new Logger(TenantMigrationService.name);

  // In-memory set of DB names that have already been migrated in this process
  // lifetime. Avoids re-checking schema_migrations on every getTenantConnection()
  // call for hot connections.
  private readonly migratedDbs = new Set<string>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Run all pending tenant migrations against the given DataSource.
   * Safe to call multiple times — only new migrations are applied.
   */
  async runMigrations(dataSource: DataSource, databaseName: string): Promise<void> {
    // Skip if already migrated in this process (hot path optimisation)
    if (this.migratedDbs.has(databaseName)) return;

    try {
      // 1. Ensure the migration tracking table exists
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Load all migration filenames already applied in this DB
      const applied: { filename: string }[] = await dataSource.query(
        `SELECT filename FROM schema_migrations ORDER BY filename ASC`
      );
      const appliedSet = new Set(applied.map((r) => r.filename));

      // 3. Read migration files from disk
      const migrationsDir = this.getMigrationsDir();
      if (!fs.existsSync(migrationsDir)) {
        this.logger.warn(`Migrations directory not found: ${migrationsDir}`);
        return;
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort(); // ascending — timestamp prefix guarantees correct order

      const pending = files.filter((f) => !appliedSet.has(f));

      if (pending.length === 0) {
        this.migratedDbs.add(databaseName);
        return; // Nothing to do
      }

      this.logger.log(
        `[${databaseName}] Running ${pending.length} pending migration(s): ${pending.join(', ')}`
      );

      // 4. Apply each pending migration in a transaction
      for (const filename of pending) {
        const filePath = path.join(migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Seed/data migrations are "soft": failures are logged but never block login.
        // Schema migrations (tables, indexes) are "hard": failures throw and stop startup.
        const isSeedMigration = filename.includes('seed');

        await dataSource.query('BEGIN');
        try {
          await dataSource.query(sql);
          await dataSource.query(
            `INSERT INTO schema_migrations (filename) VALUES ($1)`,
            [filename]
          );
          await dataSource.query('COMMIT');
          this.logger.log(`[${databaseName}] ✅ Applied: ${filename}`);
        } catch (err) {
          await dataSource.query('ROLLBACK');

          if (isSeedMigration) {
            // Soft failure: mark as applied so we never retry, but do NOT throw.
            // This handles legacy databases that already have data with different constraints.
            this.logger.warn(
              `[${databaseName}] ⚠️ Seed migration failed (non-fatal): ${filename} — ${err.message}. ` +
              `Marking as applied to prevent login blocks.`
            );
            try {
              await dataSource.query(
                `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
                [filename]
              );
            } catch (_) { /* ignore — tracking table write failure is harmless */ }
          } else {
            // Hard failure: schema migrations must succeed.
            this.logger.error(
              `[${databaseName}] ❌ Failed: ${filename} — ${err.message}`
            );
            throw new Error(
              `Migration failed for ${databaseName} on file ${filename}: ${err.message}`
            );
          }
        }
      }

      this.migratedDbs.add(databaseName);
      this.logger.log(`[${databaseName}] All migrations up to date.`);
    } catch (err) {
      // Do NOT silently swallow. The caller (DatabaseService) will handle it.
      this.logger.error(`[${databaseName}] Migration error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Force-rerun migrations for a specific DB (clears in-memory cache).
   * Used by the admin /system/migrate endpoint.
   */
  async forceRunMigrations(dataSource: DataSource, databaseName: string): Promise<void> {
    this.migratedDbs.delete(databaseName);
    await this.runMigrations(dataSource, databaseName);
  }

  /**
   * Run migrations for ALL known tenant databases.
   * Used by admin-triggered global migration (POST /system/migrate-all).
   */
  async migrateAllTenants(
    tenants: Array<{ slug: string; database_name: string }>,
    connectionFactory: (dbName: string) => Promise<DataSource>
  ): Promise<{ migrated: string[]; errors: Array<{ tenant: string; error: string }> }> {
    const migrated: string[] = [];
    const errors: Array<{ tenant: string; error: string }> = [];

    this.logger.log(`Starting migration sweep for ${tenants.length} tenant(s)`);

    for (const tenant of tenants) {
      try {
        const ds = await connectionFactory(tenant.database_name);
        await this.forceRunMigrations(ds, tenant.database_name);
        migrated.push(tenant.slug);
      } catch (err) {
        this.logger.error(`Failed to migrate tenant ${tenant.slug}: ${err.message}`);
        errors.push({ tenant: tenant.slug, error: err.message });
      }
    }

    this.logger.log(
      `Migration sweep complete. Success: ${migrated.length}, Errors: ${errors.length}`
    );
    return { migrated, errors };
  }

  /** Resolve the migrations directory — works in both ts-node (src/) and dist/ */
  private getMigrationsDir(): string {
    // In production (dist/) the SQL files are copied here by nest-cli assets config
    const distPath = path.join(__dirname, '..', '..', 'migrations', 'tenant');
    if (fs.existsSync(distPath)) return distPath;

    // In development (ts-node / nest start --watch) files live in src/
    const srcPath = path.join(process.cwd(), 'src', 'migrations', 'tenant');
    return srcPath;
  }
}
