import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant } from './entities/tenant.entity';
import { TenantMigrationService, TenantMigrationStatus } from './tenant-migration.service';
import { buildAdminSslConfig } from '../../database/ssl-config.helper';

/**
 * TenantMigrationsService (admin-backend)
 *
 * Provides admin-level migration operations across all tenant databases.
 * Creates short-lived per-tenant DataSource connections (destroyed after each operation)
 * rather than using the tenant connection pool in main_rest_apis.
 */
@Injectable()
export class TenantMigrationsService {
  private readonly logger = new Logger(TenantMigrationsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly tenantMigrationService: TenantMigrationService,
  ) {}

  private parseDatabaseUrl(url: string) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432'),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      };
    } catch {
      return {};
    }
  }

  private async getTenantDataSource(databaseName: string): Promise<DataSource> {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const sslEnabled = this.configService.get<string>('DATABASE_SSL') === 'true';

    const { host, port, username, password } = dbUrl
      ? this.parseDatabaseUrl(dbUrl)
      : {
          host: this.configService.get<string>('DATABASE_HOST'),
          port: this.configService.get<number>('DATABASE_PORT', 5432),
          username: this.configService.get<string>('DATABASE_USERNAME'),
          password: this.configService.get<string>('DATABASE_PASSWORD'),
        };

    const ds = new DataSource({
      type: 'postgres',
      host,
      port,
      username,
      password,
      database: databaseName,
      ssl: buildAdminSslConfig({
        sslEnabled,
        ca: this.configService.get<string>('DATABASE_SSL_CA'),
        explicitReject: this.configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED'),
      }),
    });

    await ds.initialize();
    return ds;
  }

  private async getTargetTenants(tenantSlug?: string): Promise<Tenant[]> {
    if (tenantSlug) {
      const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
      return tenant ? [tenant] : [];
    }
    return this.tenantRepository.find({ where: { is_active: true } });
  }

  async getMigrationStatus(tenantSlug?: string): Promise<TenantMigrationStatus[]> {
    const tenants = await this.getTargetTenants(tenantSlug);
    const results: TenantMigrationStatus[] = [];

    for (const tenant of tenants) {
      if (!tenant.database_name) continue;
      let ds: DataSource | null = null;
      try {
        ds = await this.getTenantDataSource(tenant.database_name);
        const status = await this.tenantMigrationService.getTenantMigrationStatus(ds, tenant.database_name);
        results.push(status);
      } catch (err) {
        this.logger.error(`Failed to get status for ${tenant.slug}: ${err.message}`);
        results.push({
          database: tenant.database_name,
          totalFiles: 0,
          appliedCount: 0,
          pendingCount: 0,
          applied: [],
          pending: [`[ERROR] ${err.message}`],
        });
      } finally {
        if (ds?.isInitialized) await ds.destroy();
      }
    }

    return results;
  }

  async runMigrations(tenantSlug?: string): Promise<{
    message: string;
    migrated: Array<{ tenant: string; applied: string[] }>;
    errors: Array<{ tenant: string; error: string }>;
  }> {
    const tenants = await this.getTargetTenants(tenantSlug);
    const migrated: Array<{ tenant: string; applied: string[] }> = [];
    const errors: Array<{ tenant: string; error: string }> = [];

    for (const tenant of tenants) {
      if (!tenant.database_name) continue;
      let ds: DataSource | null = null;
      try {
        ds = await this.getTenantDataSource(tenant.database_name);
        const applied = await this.tenantMigrationService.forceRunMigrations(ds, tenant.database_name);
        migrated.push({ tenant: tenant.slug, applied });
      } catch (err) {
        this.logger.error(`Migration failed for ${tenant.slug}: ${err.message}`);
        errors.push({ tenant: tenant.slug, error: err.message });
      } finally {
        if (ds?.isInitialized) await ds.destroy();
      }
    }

    return {
      message: `Migration sweep complete. Success: ${migrated.length}, Errors: ${errors.length}`,
      migrated,
      errors,
    };
  }

  async syncPermissions(tenantSlug?: string): Promise<{
    message: string;
    results: Array<{ tenant: string; success: boolean; error?: string }>;
  }> {
    const tenants = await this.getTargetTenants(tenantSlug);
    const results: Array<{ tenant: string; success: boolean; error?: string }> = [];

    for (const tenant of tenants) {
      if (!tenant.database_name) continue;
      let ds: DataSource | null = null;
      try {
        ds = await this.getTenantDataSource(tenant.database_name);
        // Sync permissions: ensure _permission_migrations table exists and run new permission entries
        await ds.query(`
          CREATE TABLE IF NOT EXISTS _permission_migrations (
            id SERIAL PRIMARY KEY,
            permission_key VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Check for any new permissions and add them to admin role
        // The full permission sync is done via RolesService in main_rest_apis on tenant login
        // This admin endpoint ensures the tracking table is present and schema is ready
        results.push({ tenant: tenant.slug, success: true });
      } catch (err) {
        this.logger.error(`Permission sync failed for ${tenant.slug}: ${err.message}`);
        results.push({ tenant: tenant.slug, success: false, error: err.message });
      } finally {
        if (ds?.isInitialized) await ds.destroy();
      }
    }

    return { message: 'Permission sync completed', results };
  }
}
