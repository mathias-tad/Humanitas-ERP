import {
  Injectable,
  OnModuleDestroy,
  OnApplicationBootstrap,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TenantMigrationService, TenantMigrationStatus } from './tenant-migration.service';

// TypeORM entities (used by the tenant connection pool for type-safe queries in
// modules that opt in to repository injection via getTenantConnection())
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { EmployeeCategory } from '../users/entities/employee-category.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Project } from '../pms/entities/project.entity';
import { Sprint } from '../pms/entities/sprint.entity';
import { Task } from '../pms/entities/task.entity';
import { PMSSettings } from '../pms/entities/pms-settings.entity';
import { ProjectMember } from '../pms/entities/project-member.entity';
import { Team } from '../pms/entities/team.entity';
import { TeamMember } from '../pms/entities/team-member.entity';
import { ProjectTeam } from '../pms/entities/project-team.entity';
import { TaskComment } from '../pms/entities/task-comment.entity';
import { TaskAttachment } from '../pms/entities/task-attachment.entity';
import { TaskTimeLog } from '../pms/entities/task-time-log.entity';
import { TaskDependency } from '../pms/entities/task-dependency.entity';
import { TaskActivityLog } from '../pms/entities/task-activity-log.entity';
import { Shift } from '../scheduling/entities/shift.entity';
import { Schedule } from '../scheduling/entities/schedule.entity';
import { ShiftPattern } from '../scheduling/entities/shift-pattern.entity';
import { UserShiftPattern } from '../scheduling/entities/user-shift-pattern.entity';
import { ManualKPIMetric } from '../pms/entities/manual-kpi-metric.entity';
import { ManualKPIScore } from '../pms/entities/manual-kpi-score.entity';
import { Conversation } from '../messaging/entities/conversation.entity';
import { ConversationParticipant } from '../messaging/entities/conversation-participant.entity';
import { Message } from '../messaging/entities/message.entity';
import { MessageAttachment } from '../messaging/entities/message-attachment.entity';
import { MessageReaction } from '../messaging/entities/message-reaction.entity';
import { MessageReadReceipt } from '../messaging/entities/message-read-receipt.entity';
import { BlockedUser } from '../messaging/entities/blocked-user.entity';
import { MessageSettings } from '../messaging/entities/message-settings.entity';
// Phase 2.3 — New entities
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';
import { Loan } from '../payroll/entities/loan.entity';
import { IncomeType } from '../payroll/entities/income-type.entity';
import { UserIncome } from '../payroll/entities/user-income.entity';
import { ActingAssignment } from '../payroll/entities/acting-assignment.entity';
import { Role } from '../roles/entities/role.entity';
import { Department } from '../users/entities/department.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { OvertimeEntry } from '../overtime/entities/overtime-entry.entity';

/** All tenant entities registered with every tenant DataSource */
const TENANT_ENTITIES = [
  TenantUser, EmployeeCategory, AuditLog,
  Project, Sprint, Task, PMSSettings, ProjectMember,
  Team, TeamMember, ProjectTeam, TaskComment, TaskAttachment,
  TaskTimeLog, TaskDependency, TaskActivityLog,
  Shift, Schedule, ShiftPattern, UserShiftPattern,
  ManualKPIMetric, ManualKPIScore,
  Conversation, ConversationParticipant, Message, MessageAttachment,
  MessageReaction, MessageReadReceipt, BlockedUser, MessageSettings,
  // Phase 2.3 additions
  PayrollRun, PayrollItem, Loan, IncomeType, UserIncome, ActingAssignment,
  Role, Department, AttendanceRecord, LeaveRequest, OvertimeEntry,
];

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseService.name);

  /** Live tenant DataSource pool — keyed by database name */
  private readonly connections = new Map<string, DataSource>();

  /** Cache of tenantId → database_name to avoid master DB lookups */
  private readonly tenantDbNames = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly migrationService: TenantMigrationService,
    @InjectDataSource() private readonly masterDataSource: DataSource,
  ) {}

  /**
   * Automatically sweeps all registered tenants upon application startup
   * to ensure all pending migrations and seeds are eagerly applied.
   */
  async onApplicationBootstrap() {
    const autoMigrate = this.configService.get<string>('AUTO_MIGRATE_TENANTS_ON_BOOT', 'true') !== 'false';
    if (!autoMigrate) {
      this.logger.log('AUTO_MIGRATE_TENANTS_ON_BOOT disabled — skipping startup migration sweep');
      return;
    }

    this.logger.log('Executing automated on-boot tenant migration sweep...');
    setTimeout(() => {
      this.runManualMigration()
        .then((result) => {
          this.logger.log(
            `Boot migration sweep finished: ${result.migrated.length} tenant(s) verified, ${result.errors.length} error(s).`,
          );
        })
        .catch((err) => {
          this.logger.error(`Boot migration sweep encountered error: ${err.message}`);
        });
    }, 2000); // 2-second deferral so HTTP server port binds first
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────

  /**
   * Returns an initialised DataSource for the given tenant database name.
   * Migrations are run automatically on first connection (lazy).
   */
  async getTenantConnection(databaseName: string): Promise<DataSource> {
    // Return cached connection if still alive
    const cached = this.connections.get(databaseName);
    if (cached?.isInitialized) return cached;

    this.logger.log(`Opening connection to tenant DB: ${databaseName}`);

    const dataSource = new DataSource(this.buildConnectionOptions(databaseName));
    await dataSource.initialize();

    // Run any pending migrations before returning the connection
    await this.migrationService.runMigrations(dataSource, databaseName);

    // Remove from pool if the underlying pool emits an error (e.g. DB restart)
    const driver = dataSource.driver as any;
    if (driver?.master) {
      driver.master.on('error', (err: Error) => {
        this.logger.error(`Connection pool error for ${databaseName}: ${err.message}`);
        this.connections.delete(databaseName);
      });
    }

    this.connections.set(databaseName, dataSource);
    this.logger.log(`Connected to tenant DB: ${databaseName}`);
    return dataSource;
  }

  /**
   * Looks up the tenant's database_name from the master DB, then delegates
   * to getTenantConnection(). Result is cached to avoid repeated master queries.
   */
  async getTenantConnectionById(tenantId: string): Promise<DataSource> {
    const cached = this.tenantDbNames.get(tenantId);
    if (cached) return this.getTenantConnection(cached);

    const rows = await this.masterDataSource.query(
      `SELECT database_name FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!rows.length) throw new NotFoundException(`Tenant not found: ${tenantId}`);

    const dbName: string = rows[0].database_name;
    this.tenantDbNames.set(tenantId, dbName);
    return this.getTenantConnection(dbName);
  }

  /**
   * Creates a brand-new PostgreSQL database for a tenant, then runs all
   * migrations so the schema is fully initialised before the first request.
   */
  async createTenantDatabase(databaseName: string): Promise<void> {
    this.logger.log(`Checking/creating tenant database: ${databaseName}`);

    // 1. If database already exists and is accessible directly, skip CREATE DATABASE
    try {
      const testDs = new DataSource(this.buildConnectionOptions(databaseName));
      await testDs.initialize();
      await testDs.destroy();
      this.logger.log(`Tenant database "${databaseName}" already exists and is connectable.`);
      await this.getTenantConnection(databaseName);
      this.logger.log(`Tenant database ready: ${databaseName}`);
      return;
    } catch (testErr) {
      this.logger.log(
        `Tenant database "${databaseName}" not directly accessible (${testErr.message}). Attempting database creation...`,
      );
    }

    // 2. If not connectable, attempt creation via postgres administrative connection
    const { host, port, username, password } = this.parseConnectionCredentials();
    const adminDs = new DataSource({
      type: 'postgres',
      host, port, username, password,
      database: 'postgres',
      ssl: this.buildSslConfig(),
    });

    try {
      await adminDs.initialize();

      const exists = await adminDs.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [databaseName],
      );

      if (exists.length === 0) {
        await adminDs.query(`CREATE DATABASE "${databaseName}"`);
        this.logger.log(`Database created: ${databaseName}`);
      } else {
        this.logger.log(`Database already exists: ${databaseName}`);
      }
    } catch (adminErr) {
      this.logger.warn(
        `Administrative database creation query failed (${adminErr.message}). Proceeding with connection attempt...`,
      );
    } finally {
      if (adminDs.isInitialized) await adminDs.destroy();
    }

    // 3. Open a connection to the DB and run migrations immediately
    // (ensures schema is ready before the first tenant request arrives)
    await this.getTenantConnection(databaseName);
    this.logger.log(`Tenant database ready: ${databaseName}`);
  }

  /** Destroy and remove a specific connection from the pool */
  async resetConnection(databaseName: string): Promise<void> {
    const ds = this.connections.get(databaseName);
    if (ds?.isInitialized) await ds.destroy();
    this.connections.delete(databaseName);
    this.logger.log(`Reset connection for: ${databaseName}`);
  }

  /** Returns all tenants from the master database */
  async getAllTenants(): Promise<Array<{ id: string; slug: string; database_name: string }>> {
    return this.masterDataSource.query(`SELECT id, slug, database_name FROM tenants`);
  }

  /**
   * Admin endpoint helper — runs any pending migrations across ALL tenant DBs (or a specific tenant if slug provided).
   */
  async runManualMigration(targetTenantSlug?: string): Promise<{
    migrated: Array<{ slug: string; applied: string[] }>;
    errors: Array<{ tenant: string; error: string }>;
  }> {
    if (targetTenantSlug) {
      this.logger.log(`Starting targeted manual migration for tenant: ${targetTenantSlug}`);
      const rows = await this.masterDataSource.query(
        `SELECT id, slug, database_name FROM tenants WHERE slug = $1`,
        [targetTenantSlug],
      );
      if (!rows.length) {
        throw new NotFoundException(`Tenant not found: ${targetTenantSlug}`);
      }
      return this.migrationService.migrateAllTenants(
        rows,
        (dbName) => this.getTenantConnection(dbName),
      );
    }

    this.logger.log('Starting manual migration sweep across all tenants');
    const tenants = await this.getAllTenants();
    return this.migrationService.migrateAllTenants(
      tenants,
      (dbName) => this.getTenantConnection(dbName),
    );
  }

  /**
   * Retrieves migration status (total, applied, pending) for all tenants or a specific tenant.
   */
  async getMigrationStatus(targetTenantSlug?: string): Promise<TenantMigrationStatus[]> {
    const tenants = targetTenantSlug
      ? await this.masterDataSource.query(
          `SELECT id, slug, database_name FROM tenants WHERE slug = $1`,
          [targetTenantSlug],
        )
      : await this.getAllTenants();

    const statuses: TenantMigrationStatus[] = [];
    for (const tenant of tenants) {
      try {
        const ds = await this.getTenantConnection(tenant.database_name);
        const status = await this.migrationService.getTenantMigrationStatus(ds, tenant.database_name);
        statuses.push(status);
      } catch (err) {
        this.logger.error(`Failed to get migration status for ${tenant.slug}: ${err.message}`);
        statuses.push({
          database: tenant.database_name,
          totalFiles: 0,
          appliedCount: 0,
          pendingCount: 0,
          applied: [],
          pending: [`ERROR: ${err.message}`],
        });
      }
    }
    return statuses;
  }

  async closeConnection(databaseName: string): Promise<void> {
    const ds = this.connections.get(databaseName);
    if (ds?.isInitialized) await ds.destroy();
    this.connections.delete(databaseName);
  }

  async onModuleDestroy(): Promise<void> {
    for (const [name, ds] of this.connections) {
      if (ds.isInitialized) {
        await ds.destroy();
        this.logger.log(`Closed connection for: ${name}`);
      }
    }
    this.connections.clear();
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────

  private buildConnectionOptions(databaseName: string): DataSourceOptions {
    const { host, port, username, password } = this.parseConnectionCredentials();
    return {
      type: 'postgres',
      host, port, username, password,
      database: databaseName,
      entities: TENANT_ENTITIES,
      synchronize: false,   // Migrations handle all schema changes
      ssl: this.buildSslConfig(),
      extra: {
        max: 20,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        keepAlive: true,
      },
    };
  }

  private parseConnectionCredentials() {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (dbUrl) {
      try {
        const parsed = new URL(dbUrl);
        return {
          host: parsed.hostname,
          port: parseInt(parsed.port || '5432', 10),
          username: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
        };
      } catch {
        this.logger.warn('Invalid DATABASE_URL — falling back to individual env vars');
      }
    }
    return {
      host: this.configService.get<string>('DATABASE_HOST', 'localhost'),
      port: this.configService.get<number>('DATABASE_PORT', 5432),
      username: this.configService.get<string>('DATABASE_USERNAME'),
      password: this.configService.get<string>('DATABASE_PASSWORD'),
    };
  }

  private buildSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
    const dbUrl = this.configService.get<string>('DATABASE_URL', '');
    const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    const sslEnabled = this.configService.get<string>('DATABASE_SSL') === 'true';

    if (isLocalhost || !sslEnabled) return false;

    const ca = this.configService.get<string>('DATABASE_SSL_CA');
    const explicitReject = this.configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED');
    // Default to true for secure TLS against MITM attacks, unless explicitly set to 'false'
    const rejectUnauthorized = explicitReject === 'false' ? false : true;

    return {
      rejectUnauthorized,
      ...(ca ? { ca } : {}),
    };
  }
}
