import { Controller, Get, Post, Param, Query, BadRequestException, UseGuards, Request, OnModuleInit } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemLogsService } from './system-logs.service';
import { DatabaseService } from '../database/database.service';
import { CalculationStatus, CalculationType } from './entities/calculation-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { DataSource } from 'typeorm';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('System Logs')
@Controller('system/logs')
@RequireModule('system_logs')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
// Trigger rebuild timestamp: 19 - Granular Logging
export class SystemLogsController implements OnModuleInit {
    constructor(
        private readonly logsService: SystemLogsService,
        private readonly databaseService: DatabaseService,
        private readonly dataSource: DataSource
    ) { }

    async onModuleInit() {
        try {
            console.log('[SystemLogs] Checking/Creating calculation_logs table...');
            const runner = this.dataSource.createQueryRunner();
            await runner.connect();
            await runner.query(`
                CREATE TABLE IF NOT EXISTS calculation_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL,
                    type VARCHAR NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'PENDING',
                    payload JSONB,
                    result JSONB,
                    triggered_by VARCHAR,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await runner.release();
            console.log('[SystemLogs] Table check complete.');
        } catch (e) {
            console.error('[SystemLogs] Table creation failed:', e);
        }
    }

    @Get('debug-permissions/:userId')
    @ApiOperation({ summary: "Debug a user's role permissions (caller's tenant only)" })
    @RequirePermissions('manage_system')
    async debugPermissions(@Param('userId') userId: string, @Request() req) {
        // SECURITY: only ever look inside the caller's own tenant database.
        const conn = await this.databaseService.getTenantConnectionById(req.user.tenantId);
        const user = await conn.query(
            `SELECT u.id, u.email, r.name AS role_name, r.permissions
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [userId],
        );
        return user?.[0] ? [{ tenant: req.user.tenantSlug, user: user[0] }] : [];
    }

    @Post('repair-db')
    @ApiOperation({ summary: "Apply any pending schema migrations to the caller's tenant database" })
    @RequirePermissions('manage_system')
    async repairDb(@Request() req) {
        // The tenant schema is owned by src/migrations/tenant/*.sql (TenantMigrationService).
        // "Repair" now simply runs any pending migrations for the caller's own tenant —
        // there is no second, hand-maintained copy of the schema here any more.
        const tenantSlug: string = req.user.tenantSlug;
        if (!tenantSlug) throw new BadRequestException('No tenant in session');
        const result = await this.databaseService.runManualMigration(tenantSlug);
        return {
            status: result.errors.length ? 'error' : 'success',
            applied: result.migrated.flatMap((m) => m.applied),
            errors: result.errors,
        };
    }

    @Post('cleanup')
    @ApiOperation({ summary: 'Cleanup stuck jobs' })
    @RequirePermissions('manage_logs')
    async cleanup(@Request() req) {
        return this.logsService.cleanupStuckJobs(req.user.tenantId);
    }

    @Get('debug')
    @ApiOperation({ summary: 'Debug endpoint to check payroll_runs data' })
    @RequirePermissions('manage_system')
    async debugPayrollRuns(@Request() req) {
        try {
            const tenantId = req.user.tenantId;
            const connection = await this.databaseService.getTenantConnectionById(tenantId);

            // Check if table exists
            const tableCheck = await connection.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'payroll_runs'
                );
            `);

            // Count records
            const countResult = await connection.query(`SELECT COUNT(*) as count FROM payroll_runs`);

            // Get sample records
            const sampleRecords = await connection.query(`
                SELECT id, month, year, status, created_by, created_at 
                FROM payroll_runs 
                ORDER BY created_at DESC 
                LIMIT 5
            `);

            // Test findAll method
            const findAllResult = await this.logsService.findAll(tenantId, undefined, undefined, 50);

            return {
                tenantId,
                tableExists: tableCheck[0].exists,
                totalRecords: countResult[0].count,
                sampleRecords,
                findAllResult: {
                    count: findAllResult.length,
                    data: findAllResult
                }
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    @Get()
    @ApiOperation({ summary: 'Get all calculation logs' })
    @RequirePermissions('view_logs', 'manage_logs')
    async getLogs(
        @Request() req,
        @Query('type') type?: CalculationType,
        @Query('status') status?: string,
        @Query('limit') limit?: number
    ) {
        const allowedStatuses = Object.values(CalculationStatus) as string[];
        const statuses = status
            ? (status.split(',').map(s => s.trim()).filter(s => allowedStatuses.includes(s)) as CalculationStatus[])
            : undefined;
        const n = Number(limit);
        const parsedLimit = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 500) : undefined;
        return this.logsService.findAll(req.user.tenantId, type, statuses, parsedLimit);
    }

    @Get('server')
    @ApiOperation({ summary: 'Get server logs' })
    @RequirePermissions('manage_system')
    async getServerLogs(@Query('lines') lines?: number) {
        const n = Number(lines);
        return this.logsService.getServerLogs(Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 2000) : 100);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get log by ID' })
    @RequirePermissions('view_logs', 'manage_logs')
    async getLog(@Param('id') id: string, @Request() req) {
        const log = await this.logsService.findOne(id, req.user.tenantId);
        if (!log) throw new BadRequestException('Log not found');
        return log;
    }

    @Post(':id/retry')
    @ApiOperation({ summary: 'Retry a failed calculation' })
    @RequirePermissions('manage_logs')
    async retryLog(@Param('id') id: string, @Request() req) {
        const log = await this.logsService.findOne(id, req.user.tenantId);
        if (!log) throw new BadRequestException('Log not found');

        if (log.status !== CalculationStatus.FAILED && log.status !== CalculationStatus.COMPLETED) {
            // Allow retrying completed too? User asked for retry if failed.
            // But sometimes completed with errors (skipped users).
            // Let's strictly follow requirement: "retry button for automatic runs if they ... failed"
            // But manual run retry is also nice.
            // Let's allow FAILED only per existing code, or maybe also COMPLETED?
            // Existing code: if (log.status !== CalculationStatus.FAILED) throw...
            // Be consistent.
            throw new BadRequestException('Only failed calculations can be retried');
        }

        // Handle Payroll Retry
        if (log.type === CalculationType.PAYROLL) {
            try {
                // Call Python Service
                const response = await fetch(`${process.env.CALCULATION_SERVICE_URL || 'http://localhost:8000'}/api/payroll/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: req.user.tenantId,
                        month: log.payload.month,
                        year: log.payload.year,
                        user_id: req.user.userId
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new BadRequestException(`Failed to queue payroll retry: ${errText}`);
                }

                const data = await response.json();
                return {
                    message: 'Payroll retry initiated',
                    originalLogId: log.id,
                    job_id: data.job_id,
                    payload: log.payload
                };
            } catch (e) {
                console.error("Payroll retry error:", e);
                throw new BadRequestException(e.message || "Failed to retry payroll");
            }
        }

        const newLog = await this.logsService.createLog(
            log.tenant_id,
            log.type,
            log.payload,
            'retry'
        );

        return {
            message: 'Retry initiated',
            originalLogId: log.id,
            newLogId: newLog.id,
            payload: log.payload
        };
    }
}
