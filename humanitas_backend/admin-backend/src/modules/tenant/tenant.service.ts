import * as fs from 'fs';
import * as path from 'path';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, SubscriptionStatus, SubscriptionPlan } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { EmailService } from '../email/email.service';
import { TenantMigrationService } from './tenant-migration.service';
import { buildAdminSslConfig } from '../../database/ssl-config.helper';

@Injectable()
export class TenantService implements OnModuleInit {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly tenantMigrationService: TenantMigrationService,
  ) { }

  async onModuleInit() {
    // [FIX] Ensure critical columns exist to prevent crashes
    await this.repairTenantSchema();
  }

  private parseDatabaseUrl(url: string) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432'),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      };
    } catch (e) {
      console.warn('Invalid DATABASE_URL, falling back to env vars');
      return {};
    }
  }

  private async createTenantDatabase(databaseName: string): Promise<void> {
    console.log(`🔧 Creating tenant database: ${databaseName}`);

    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const sslEnabled = this.configService.get<string>('DATABASE_SSL') === 'true';

    // Parse URL if available, otherwise fallback to env vars
    const { host, port, username, password } = dbUrl ? this.parseDatabaseUrl(dbUrl) : {
      host: this.configService.get<string>('DATABASE_HOST'),
      port: this.configService.get<number>('DATABASE_PORT', 5432),
      username: this.configService.get<string>('DATABASE_USERNAME'),
      password: this.configService.get<string>('DATABASE_PASSWORD'),
    };

    // Connect to default postgres database to create new database
    const { DataSource } = require('typeorm');
    const adminDataSource = new DataSource({
      type: 'postgres',
      host,
      port,
      username,
      password,
      database: 'postgres',
      ssl: buildAdminSslConfig({
        sslEnabled,
        ca: this.configService.get<string>('DATABASE_SSL_CA'),
        explicitReject: this.configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED'),
      }),
    });

    try {
      await adminDataSource.initialize();
      console.log(`📊 Connected to postgres database for admin operations`);

      // Check if database already exists
      const dbExists = await adminDataSource.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [databaseName]
      );

      if (dbExists.length > 0) {
        console.warn(`⚠️ Database ${databaseName} already exists. Dropping it to ensure fresh state.`);
        // [FIX] Forcefully drop existing database to clear "Zombie" data
        try {
          await adminDataSource.query(
            `SELECT pg_terminate_backend(pg_stat_activity.pid)
             FROM pg_stat_activity
             WHERE pg_stat_activity.datname = $1
             AND pid <> pg_backend_pid()`,
            [databaseName]
          );
          await adminDataSource.query(`DROP DATABASE "${databaseName}"`);
          console.log(`✅ Dropped stale database: ${databaseName}`);
        } catch (dropError) {
          console.error(`❌ Failed to drop stale database ${databaseName}:`, dropError.message);
          // Proceeding to create might fail, but we try anyway
        }
      }

      // Create the database
      await adminDataSource.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`✅ Database ${databaseName} created`);

      await adminDataSource.destroy();

      // Now connect to the new database and create tables
      await this.initializeTenantTables(databaseName);

    } catch (error) {
      console.error(`❌ Failed to create database ${databaseName}:`, error.message);
      if (adminDataSource.isInitialized) {
        await adminDataSource.destroy();
      }
      throw error;
    }
  }

  private async initializeTenantTables(databaseName: string): Promise<void> {
    console.log(`📝 Initializing tables in database: ${databaseName}`);

    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const sslEnabled = this.configService.get<string>('DATABASE_SSL') === 'true';

    // Parse URL if available, otherwise fallback to env vars
    const { host, port, username, password } = dbUrl ? this.parseDatabaseUrl(dbUrl) : {
      host: this.configService.get<string>('DATABASE_HOST'),
      port: this.configService.get<number>('DATABASE_PORT', 5432),
      username: this.configService.get<string>('DATABASE_USERNAME'),
      password: this.configService.get<string>('DATABASE_PASSWORD'),
    };

    const { DataSource } = require('typeorm');
    const tenantDataSource = new DataSource({
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

    try {
      await tenantDataSource.initialize();

      const schemaPath = path.join(__dirname, 'tenant-schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await tenantDataSource.query(schemaSql);

      // Verify tables were created
      const tableCheck = await tenantDataSource.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);

      console.log(`✅ Tables created in database ${databaseName}:`, tableCheck.map((t: { table_name: string }) => t.table_name).join(', '));

      // Automatically execute all pending migrations and seeds for newly initialized tenant
      try {
        const applied = await this.tenantMigrationService.runMigrations(tenantDataSource, databaseName);
        console.log(`✅ Automatically applied ${applied.length} initial migration(s)/seed(s) for ${databaseName}`);
      } catch (migError) {
        console.warn(`⚠️ Warning: Initial migration sweep encountered an issue for ${databaseName}:`, migError.message);
      }

      await tenantDataSource.destroy();

    } catch (error) {
      console.error(`❌ Failed to initialize tables in ${databaseName}:`, error.message);
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
      throw error;
    }
  }

  // [FIX] Self-healing schema for Tenants table
  private async repairTenantSchema() {
    console.log('🔧 Attempting to repair tenant schema...');
    try {
      await this.dataSource.query(`
            ALTER TABLE tenants 
            ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255),
            ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS monthly_fee DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS per_user_fee DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 50,
            ADD COLUMN IF NOT EXISTS current_users INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 10,
            ADD COLUMN IF NOT EXISTS current_devices INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS storage_limit_gb DECIMAL(10, 2) DEFAULT 10,
            ADD COLUMN IF NOT EXISTS storage_used_gb DECIMAL(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enabled_features TEXT,
            ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
            ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
            ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS is_setup_complete BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS setup_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP;
          `);
      console.log('✅ Tenant schema repaired successfully.');
    } catch (e) {
      console.error('❌ Failed to repair tenant schema:', e.message);
    }
  }

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Ensure schema is up to date before querying
    await this.repairTenantSchema();

    // Check if slug already exists
    const existingSlug = await this.tenantRepository.findOne({
      where: { slug: createTenantDto.slug },
    });
    if (existingSlug) {
      throw new ConflictException('Tenant slug already exists');
    }

    // Check if email already used
    const existingEmail = await this.tenantRepository.findOne({
      where: { contact_email: createTenantDto.contact_email },
    });
    if (existingEmail) {
      throw new ConflictException('Contact email already registered');
    }

    // Generate database name from slug
    const database_name = `tenant_${createTenantDto.slug.replace(/-/g, '_')}`;

    // Set trial end date (14 days)
    const trial_ends_at = new Date();
    trial_ends_at.setDate(trial_ends_at.getDate() + 14);

    // Set limits based on plan
    const planLimits = this.getPlanLimits(createTenantDto.subscription_plan || SubscriptionPlan.BASIC);

    // Use user-provided enabled_features if available, otherwise use plan defaults
    const enabled_features = createTenantDto.enabled_features || planLimits.enabled_features;

    // Generate setup token (expires in 7 days)
    const setup_token = uuidv4();
    const setup_token_expires_at = new Date();
    setup_token_expires_at.setDate(setup_token_expires_at.getDate() + 7);

    const tenant = this.tenantRepository.create({
      ...createTenantDto,
      database_name,
      trial_ends_at,
      subscription_status: SubscriptionStatus.TRIAL,
      ...planLimits,
      enabled_features,
      is_setup_complete: false,
      setup_token,
      setup_token_expires_at,
    });

    const savedTenant = await this.tenantRepository.save(tenant);
    console.log(`✅ Tenant record created: ${savedTenant.company_name} (${savedTenant.slug})`);

    // Create tenant schema immediately
    try {
      await this.createTenantDatabase(database_name);
    } catch (schemaError) {
      console.error(`⚠️ Schema creation failed for ${database_name}:`, schemaError.message);
      // Continue - schema will be created on first tenant login if needed
    }

    // Send welcome email with setup link
    try {
      const emailSent = await this.emailService.sendTenantWelcomeEmail(
        savedTenant.contact_email,
        savedTenant.company_name,
        setup_token,
      );
      if (emailSent) {
        console.log(`📧 Welcome email sent to ${savedTenant.contact_email}`);
      } else {
        console.warn(`⚠️ Welcome email NOT sent - SMTP not configured`);
      }
    } catch (emailError) {
      console.error(`❌ Failed to send welcome email:`, emailError.message);
      // Don't throw - tenant was created, just log the email failure
    }

    return savedTenant;
  }

  /**
   * Fetches real-time usage statistics from a tenant's database.
   * Returns counts of users, devices, and storage used.
   */
  private async getTenantUsageStats(databaseName: string): Promise<{
    current_users: number;
    current_devices: number;
    storage_used_gb: number;
  }> {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const sslEnabled = this.configService.get<string>('DATABASE_SSL') === 'true';

    const { host, port, username, password } = dbUrl ? this.parseDatabaseUrl(dbUrl) : {
      host: this.configService.get<string>('DATABASE_HOST'),
      port: this.configService.get<number>('DATABASE_PORT', 5432),
      username: this.configService.get<string>('DATABASE_USERNAME'),
      password: this.configService.get<string>('DATABASE_PASSWORD'),
    };

    const { DataSource } = require('typeorm');
    const tenantDataSource = new DataSource({
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

    try {
      await tenantDataSource.initialize();

      // Count active users
      const usersResult = await tenantDataSource.query(`
        SELECT COUNT(*) as count FROM users WHERE is_active = true
      `);
      const current_users = parseInt(usersResult[0]?.count || '0', 10);

      // Count active biometric devices (table may not exist)
      let current_devices = 0;
      try {
        const devicesResult = await tenantDataSource.query(`
          SELECT COUNT(*) as count FROM biometric_devices WHERE is_active = true
        `);
        current_devices = parseInt(devicesResult[0]?.count || '0', 10);
      } catch {
        // Table might not exist yet
      }

      // Get database size in bytes
      const sizeResult = await tenantDataSource.query(`
        SELECT pg_database_size(current_database()) as size_bytes
      `);
      let totalSizeBytes = parseInt(sizeResult[0]?.size_bytes || '0', 10);

      // Measure tenant uploaded files (avatars, attachments, receipts, penalties, etc.)
      const fileQueries = [
        `SELECT avatar_url AS file_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != ''`,
        `SELECT attachment_url AS file_url FROM user_penalties WHERE attachment_url IS NOT NULL AND attachment_url != ''`,
        `SELECT receipt_file_url AS file_url FROM per_diem_claims WHERE receipt_file_url IS NOT NULL AND receipt_file_url != ''`,
        `SELECT file_url FROM task_attachments WHERE file_url IS NOT NULL AND file_url != ''`,
        `SELECT file_url FROM message_attachments WHERE file_url IS NOT NULL AND file_url != ''`,
        `SELECT logo_url AS file_url FROM company_settings WHERE logo_url IS NOT NULL AND logo_url != ''`,
      ];

      for (const queryStr of fileQueries) {
        try {
          const rows = await tenantDataSource.query(queryStr);
          for (const row of rows) {
            if (row?.file_url) {
              const cleanUrl = String(row.file_url).split('?')[0];
              const relPath = cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl;
              const fullPath = path.join(process.cwd(), relPath);
              if (fs.existsSync(fullPath)) {
                try {
                  const stat = fs.statSync(fullPath);
                  if (stat.isFile()) {
                    totalSizeBytes += stat.size;
                  }
                } catch {
                  // ignore file stat error
                }
              }
            }
          }
        } catch {
          // Table or column might not exist in this tenant schema yet
        }
      }

      // Also check uploads folder for files prefixed with tenant slug/name
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const slugPrefix = databaseName.replace(/^tenant_/, '').replace(/_/g, '');
          const files = fs.readdirSync(uploadsDir);
          for (const file of files) {
            const lowerFile = file.toLowerCase();
            if (lowerFile.startsWith(slugPrefix) || lowerFile.includes(databaseName)) {
              try {
                const fullPath = path.join(uploadsDir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                  totalSizeBytes += stat.size;
                }
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const storage_used_gb = parseFloat((totalSizeBytes / (1024 * 1024 * 1024)).toFixed(4));

      await tenantDataSource.destroy();

      return { current_users, current_devices, storage_used_gb };
    } catch (error) {
      console.warn(`⚠️ Could not fetch stats for ${databaseName}:`, error.message);
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
      return { current_users: 0, current_devices: 0, storage_used_gb: 0 };
    }
  }

  async findAll(params?: {
    status?: SubscriptionStatus;
    plan?: SubscriptionPlan;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Tenant[]; total: number; page: number; limit: number }> {
    const { status, plan, search, page = 1, limit = 10 } = params || {};

    const queryBuilder = this.tenantRepository.createQueryBuilder('tenant');

    if (status) {
      queryBuilder.andWhere('tenant.subscription_status = :status', { status });
    }

    if (plan) {
      queryBuilder.andWhere('tenant.subscription_plan = :plan', { plan });
    }

    if (search) {
      queryBuilder.andWhere(
        '(tenant.company_name ILIKE :search OR tenant.slug ILIKE :search OR tenant.contact_email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy('tenant.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    try {
      const [data, total] = await queryBuilder.getManyAndCount();

      // Enrich each tenant with real-time usage stats
      const enrichedData = await Promise.all(
        data.map(async (tenant) => {
          if (tenant.database_name) {
            const stats = await this.getTenantUsageStats(tenant.database_name);
            return {
              ...tenant,
              current_users: stats.current_users,
              current_devices: stats.current_devices,
              storage_used_gb: stats.storage_used_gb,
            };
          }
          return tenant;
        }),
      );

      return { data: enrichedData as Tenant[], total, page, limit };
    } catch (error) {
      // [FIX] Auto-repair schema if column is missing (code 42703)
      if (error.code === '42703') {
        console.warn('⚠️ Schema drift detected during findAll. Attempting repair...');
        await this.repairTenantSchema();
        const [data, total] = await queryBuilder.getManyAndCount();
        return { data, total, page, limit };
      }
      throw error;
    }
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['user_mappings'],
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);

    // If updating slug, check uniqueness
    if (updateTenantDto.slug && updateTenantDto.slug !== tenant.slug) {
      const existingSlug = await this.tenantRepository.findOne({
        where: { slug: updateTenantDto.slug },
      });
      if (existingSlug) {
        throw new ConflictException('Tenant slug already exists');
      }
    }

    Object.assign(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async suspend(id: string, reason?: string): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (tenant.subscription_status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Tenant is already suspended');
    }

    tenant.subscription_status = SubscriptionStatus.SUSPENDED;
    tenant.is_active = false;

    return this.tenantRepository.save(tenant);
  }

  async reactivate(id: string): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (tenant.subscription_status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Tenant is not suspended');
    }

    tenant.subscription_status = SubscriptionStatus.ACTIVE;
    tenant.is_active = true;

    return this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    // [FIX] Use Raw SQL to fetch tenant details to bypass "Missing Column" errors
    const result = await this.dataSource.query(
      `SELECT database_name, company_name FROM tenants WHERE id = $1`,
      [id]
    );

    if (result.length === 0) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    const tenant = result[0];

    // Drop the tenant schema (for Neon/managed PostgreSQL)
    try {
      await this.dataSource.query(`DROP SCHEMA IF EXISTS "${tenant.database_name}" CASCADE`);
      console.log(`✅ Dropped tenant schema: ${tenant.database_name}`);
    } catch (error) {
      console.error(`⚠️ Failed to drop tenant schema ${tenant.database_name}:`, error.message);
      // Try dropping as database (for self-hosted PostgreSQL)
      try {
        // [FIX] Kill active connections before dropping database
        await this.dataSource.query(
          `SELECT pg_terminate_backend(pg_stat_activity.pid)
           FROM pg_stat_activity
           WHERE pg_stat_activity.datname = $1
           AND pid <> pg_backend_pid()`,
          [tenant.database_name]
        );

        await this.dataSource.query(`DROP DATABASE IF EXISTS "${tenant.database_name}"`);
        console.log(`✅ Dropped tenant database: ${tenant.database_name}`);
      } catch (dbError) {
        console.error(`⚠️ Failed to drop tenant database ${tenant.database_name}:`, dbError.message);
      }
    }

    // [FIX] Use Raw SQL to delete the record, bypassing ORM checks
    await this.dataSource.query(`DELETE FROM tenants WHERE id = $1`, [id]);
    console.log(`✅ Tenant record deleted: ${tenant.company_name}`);
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    trial: number;
    suspended: number;
    by_plan: { plan: string; count: number }[];
  }> {
    const total = await this.tenantRepository.count();
    const active = await this.tenantRepository.count({
      where: { subscription_status: SubscriptionStatus.ACTIVE },
    });
    const trial = await this.tenantRepository.count({
      where: { subscription_status: SubscriptionStatus.TRIAL },
    });
    const suspended = await this.tenantRepository.count({
      where: { subscription_status: SubscriptionStatus.SUSPENDED },
    });

    const by_plan = await this.tenantRepository
      .createQueryBuilder('tenant')
      .select('tenant.subscription_plan', 'plan')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tenant.subscription_plan')
      .getRawMany();

    return { total, active, trial, suspended, by_plan };
  }

  private getPlanLimits(plan: SubscriptionPlan): Partial<Tenant> {
    const limits = {
      [SubscriptionPlan.BASIC]: {
        max_users: 50,
        max_devices: 10,
        storage_limit_gb: 10,
        enabled_features: ['attendance', 'leave', 'pms'],
      },
      [SubscriptionPlan.PROFESSIONAL]: {
        max_users: 200,
        max_devices: 20,
        storage_limit_gb: 50,
        enabled_features: ['attendance', 'leave', 'pms', 'payroll'],
      },
      [SubscriptionPlan.ENTERPRISE]: {
        max_users: 999999,
        max_devices: 100,
        storage_limit_gb: 500,
        enabled_features: ['attendance', 'leave', 'pms', 'payroll', 'reports', 'analytics'],
      },
    };

    return limits[plan] || limits[SubscriptionPlan.BASIC];
  }
}
