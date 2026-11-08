import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Tenant } from './modules/auth/entities/tenant.entity';
import { CalculationLog } from './modules/system-logs/entities/calculation-log.entity';
import { PlatformKnowledge } from './modules/public-support/entities/platform-knowledge.entity';
import { SupportTicket } from './modules/public-support/entities/support-ticket.entity';
import { PublicSupportModule } from './modules/public-support/public-support.module';
import { RolesService } from './modules/roles/roles.service';
import { DatabaseService } from './modules/database/database.service';
import { AuthModule } from './modules/auth/auth.module';
import { SetupModule } from './modules/setup/setup.module';
import { HealthModule } from './modules/health/health.module';
import { DatabaseModule } from './modules/database/database.module';
import { UsersModule } from './modules/users/users.module';
import { EmployeeCategoriesModule } from './modules/users/employee-categories.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RolesModule } from './modules/roles/roles.module';
import { PresenceModule } from './modules/presence/presence.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { AuditModule } from './modules/audit/audit.module';
import { LoggerModule } from './modules/logger/logger.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { OvertimeModule } from './modules/overtime/overtime.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { EventsModule } from './modules/events/events.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { DelegationsModule } from './modules/delegations/delegations.module';
import { SystemLogsModule } from './modules/system-logs/system-logs.module';
import { PmsModule } from './modules/pms/pms.module';
import { BiometricDevicesModule } from './modules/biometric-devices/biometric-devices.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { AiModule } from './modules/ai/ai.module';
import { HrmsReportsModule } from './modules/hrms-reports/hrms-reports.module';
import { HrmsDocumentsModule } from './modules/hrms-documents/hrms-documents.module';
import { HrmsOnboardingModule } from './modules/hrms-onboarding/hrms-onboarding.module';
import { SelfServiceModule } from './modules/self-service/self-service.module';
import { HrmsGrievancesModule } from './modules/hrms-grievances/hrms-grievances.module';
import { HrmsBenefitsModule } from './modules/hrms-benefits/hrms-benefits.module';
import { HrmsTrainingModule } from './modules/hrms-training/hrms-training.module';
import { PmsReviewsModule } from './modules/pms-reviews/pms-reviews.module';
import { HrmsExpensesModule } from './modules/hrms-expenses/hrms-expenses.module';
import { HrmsAssetsModule } from './modules/hrms-assets/hrms-assets.module';
import { HrmsSurveysModule } from './modules/hrms-surveys/hrms-surveys.module';
import { HrmsImportExportModule } from './modules/hrms-import-export/hrms-import-export.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { DeveloperApiModule } from './modules/developer-api/developer-api.module';
import { WfmOpportunitiesModule } from './modules/wfm-opportunities/wfm-opportunities.module';
import { ModuleSubscriptionGuard } from './modules/auth/guards/module-subscription.guard';
import * as dns from 'dns';

// Force IPv4 for DNS resolution
dns.setDefaultResultOrder('ipv4first');

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduler (Always enabled for Keep-Alive, specific jobs have their own guards)
    ScheduleModule.forRoot(),

    // Rate limiting — applied globally to all routes.
    // Limits: 100 requests per 60s per IP by default.
    // Auth routes (login, refresh) override this with stricter @Throttle() decorators.
    // RATE_LIMIT_TTL and RATE_LIMIT_MAX can be set in .env for easy tuning.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{
          ttl: configService.get<number>('RATE_LIMIT_TTL', 60) * 1000, // convert s → ms
          limit: configService.get<number>('RATE_LIMIT_MAX', 100),
        }],
      }),
      inject: [ConfigService],
    }),

    // Master Database (to read tenant info)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        const sslEnabled = configService.get<string>('DATABASE_SSL') === 'true';

        const baseConfig = {
          type: 'postgres' as const,
          entities: [Tenant, CalculationLog, PlatformKnowledge, SupportTicket], // Master DB entities
          synchronize: false, // [FIX] Disable sync on Master DB to prevent schema corruption
          logging: configService.get<string>('NODE_ENV') === 'development',
          extra: {
            max: 20,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            keepAlive: true,
          },
        };

        const sslRejectUnauthorized = configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED') !== 'false';
        const sslCa = configService.get<string>('DATABASE_SSL_CA');
        const sslConfig = sslEnabled
          ? { rejectUnauthorized: sslRejectUnauthorized, ...(sslCa ? { ca: sslCa } : {}) }
          : false;

        if (dbUrl) {
          return {
            ...baseConfig,
            url: dbUrl,
            ssl: (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) ? false : sslConfig,
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DATABASE_HOST'),
          port: configService.get<number>('DATABASE_PORT', 5432),
          username: configService.get<string>('DATABASE_USERNAME'),
          password: configService.get<string>('DATABASE_PASSWORD'),
          database: configService.get<string>('DATABASE_NAME'),
          ssl: sslConfig,
        };
      },
      inject: [ConfigService],
    }),

    // Core modules
    HealthModule,
    DatabaseModule,
    AuthModule,
    SetupModule,
    UsersModule,
    EmployeeCategoriesModule,
    SettingsModule,
    RolesModule,
    PresenceModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    SchedulingModule,
    AuditModule,
    LoggerModule,
    HolidaysModule,
    OvertimeModule,
    NotificationsModule,
    MessagingModule,
    AnnouncementsModule,
    EventsModule,
    CalendarModule,
    DelegationsModule,
    SystemLogsModule,
    PmsModule,
    BiometricDevicesModule,
    RecruitmentModule,
    AiModule,
    HrmsReportsModule,
    HrmsDocumentsModule,
    HrmsOnboardingModule,
    SelfServiceModule,
    HrmsGrievancesModule,
    HrmsBenefitsModule,
    HrmsTrainingModule,
    PmsReviewsModule,
    HrmsExpensesModule,
    HrmsAssetsModule,
    HrmsSurveysModule,
    HrmsImportExportModule,
    ApprovalsModule,
    DeveloperApiModule,
    WfmOpportunitiesModule,
    PublicSupportModule,
  ],
  providers: [
    // Activate ThrottlerGuard globally — every route gets rate limiting automatically.
    // Individual controllers/routes can override with @Throttle({ default: { limit, ttl } })
    // or opt out with @SkipThrottle() for internal/health endpoints.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global Module Subscription gating — enforces tenant package entitlements
    { provide: APP_GUARD, useClass: ModuleSubscriptionGuard },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private dataSource: DataSource,
    private rolesService: RolesService,
    private databaseService: DatabaseService,
  ) {}

  async onModuleInit() {
    this.logger.log('='.repeat(60));
    this.logger.log('TENANT-BACKEND STARTUP CHECK');
    this.logger.log('='.repeat(60));

    try {
      // Check database connection
      const dbInfo = await this.dataSource.query(
        `SELECT current_database(), current_user`,
      );
      this.logger.log(`Connected to database: ${dbInfo[0].current_database}`);
      this.logger.log(`Database user: ${dbInfo[0].current_user}`);

      // Check if tenants table exists
      const tenantsTable = await this.dataSource.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tenants'
      `);

      if (tenantsTable.length > 0) {
        this.logger.log('tenants table: EXISTS');
        const count = await this.dataSource.query(`SELECT COUNT(*) FROM tenants`);
        this.logger.log(`Total tenants: ${count[0].count}`);

        // ── Run permission migrations for ALL existing tenants ──────────────
        // This ensures every tenant's default roles (Administrator, Manager,
        // Employee) always have the latest permissions without requiring them
        // to visit the Roles page first.
        try {
          const tenants = await this.dataSource.query(
            `SELECT id, slug, database_name FROM tenants WHERE is_active = true`,
          );
          this.logger.log(`Running permission migrations for ${tenants.length} tenant(s)...`);
          for (const tenant of tenants) {
            try {
              const connection = await this.databaseService.getTenantConnection(tenant.database_name);
              await this.rolesService.migrateNewPermissions(connection);
            } catch (tenantErr) {
              this.logger.warn(`Permission migration skipped for tenant "${tenant.slug}": ${tenantErr.message}`);
            }
          }
          this.logger.log('Permission migrations complete.');
        } catch (migErr) {
          this.logger.warn(`Startup permission migration failed: ${migErr.message}`);
        }
      } else {
        this.logger.warn('tenants table: NOT FOUND — ensure admin-backend is deployed and has created the tables');
      }

      // List all schemas
      const schemas = await this.dataSource.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name
      `);
      this.logger.log(`Schemas: ${schemas.map((s: { schema_name: string }) => s.schema_name).join(', ')}`);
    } catch (error) {
      this.logger.error('Database check failed', error.message);
    }

    this.logger.log('='.repeat(60));
  }
}
