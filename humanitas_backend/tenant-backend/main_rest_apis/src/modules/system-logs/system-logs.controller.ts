import { Controller, Get, Post, Param, Query, BadRequestException, UseGuards, Request, OnModuleInit } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemLogsService } from './system-logs.service';
import { DatabaseService } from '../database/database.service';
import { CalculationStatus, CalculationType } from './entities/calculation-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataSource } from 'typeorm';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('System Logs')
@Controller('system/logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
    async debugPermissions(@Param('userId') userId: string) {
        try {
            const tenants = await this.databaseService.getAllTenants();
            const results: any[] = [];
            for (const tenant of tenants) {
                try {
                    const conn = await this.databaseService.getTenantConnection(tenant.database_name);
                    const user = await conn.query(`
                        SELECT u.id, u.email, r.name as role_name, r.permissions 
                        FROM users u 
                        JOIN roles r ON u.role_id = r.id 
                        WHERE u.id = $1`, [userId]);

                    if (user && user.length > 0) {
                        results.push({
                            tenant: tenant.slug,
                            user: user[0]
                        });
                    }
                } catch (e) {
                    console.error(`Error checking tenant ${tenant.slug}`, e);
                }
            }
            return results;
        } catch (e) {
            return { error: e.message };
        }
    }

    @Post('repair-db')
    @ApiOperation({ summary: 'Repair database schema issues and apply missing migrations' })
    async repairDb(@Query('tenantId') tenantId: string) {
        // [ADMIN DB] Ensure calculation_logs table exists in ADMIN DB (default connection)
        try {
            console.log('[REPAIR] Checking/Creating calculation_logs table in Admin DB...');
            const adminRunner = this.dataSource.createQueryRunner();
            await adminRunner.connect();
            await adminRunner.query(`
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
            await adminRunner.release();
            console.log('[REPAIR] calculation_logs table check complete.');
        } catch (e) {
            console.error('[REPAIR] calculation_logs check failed:', e);
        }

        if (!tenantId) return { error: 'Provide tenantId query param' };
        const results: string[] = [];

        try {
            console.log(`[REPAIR] Repairing Tenant By ID: ${tenantId}`);
            results.push(`Starting repair for tenant: ${tenantId}`);

            const conn = await this.databaseService.getTenantConnectionById(tenantId);
            results.push(`Got connection`);

            // 0. Create core PMS tables if they don't exist
            try {
                console.log('[REPAIR] Creating pms_projects table...');
                await conn.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_projects_status_enum') THEN
                            CREATE TYPE pms_projects_status_enum AS ENUM ('Planning', 'Active', 'On Hold', 'Completed', 'Archived');
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_projects_priority_enum') THEN
                            CREATE TYPE pms_projects_priority_enum AS ENUM ('Low', 'Medium', 'High', 'Critical');
                        END IF;
                    END$$;

                    CREATE TABLE IF NOT EXISTS pms_projects (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        status pms_projects_status_enum DEFAULT 'Planning',
                        priority pms_projects_priority_enum DEFAULT 'Medium',
                        start_date DATE,
                        target_end_date DATE,
                        actual_end_date DATE,
                        budget DECIMAL(15,2),
                        currency VARCHAR(3) DEFAULT 'ETB',
                        manager_id UUID,
                        team_id UUID REFERENCES pms_teams(id),
                        created_by UUID NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                results.push('Created pms_projects table');
            } catch (e) {
                results.push(`pms_projects error: ${e.message}`);
            }

            // [MIGRATE] Add team_id to pms_projects if missing
            try {
                await conn.query(`ALTER TABLE pms_projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES pms_teams(id);`);
            } catch (e) {
                results.push(`pms_projects team_id migration error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Creating pms_sprints table...');
                await conn.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_sprints_status_enum') THEN
                            CREATE TYPE pms_sprints_status_enum AS ENUM ('Planned', 'Active', 'Completed', 'Cancelled');
                        END IF;
                    END$$;

                    CREATE TABLE IF NOT EXISTS pms_sprints (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL,
                        project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
                        name VARCHAR(255) NOT NULL,
                        goal TEXT,
                        status pms_sprints_status_enum DEFAULT 'Planned',
                        start_date DATE,
                        end_date DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    -- Add tenant_id if table exists but column is missing
                    ALTER TABLE pms_sprints ADD COLUMN IF NOT EXISTS tenant_id UUID;
                `);
                results.push('Created pms_sprints table');
            } catch (e) {
                results.push(`pms_sprints error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Creating pms_tasks table...');
                await conn.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_tasks_status_enum') THEN
                            CREATE TYPE pms_tasks_status_enum AS ENUM ('Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Done');
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_tasks_priority_enum') THEN
                            CREATE TYPE pms_tasks_priority_enum AS ENUM ('Low', 'Medium', 'High', 'Critical');
                        END IF;
                    END$$;

                    CREATE TABLE IF NOT EXISTS pms_tasks (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL,
                        project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
                        sprint_id UUID REFERENCES pms_sprints(id) ON DELETE SET NULL,
                        parent_task_id UUID REFERENCES pms_tasks(id) ON DELETE SET NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        status pms_tasks_status_enum DEFAULT 'Backlog',
                        priority pms_tasks_priority_enum DEFAULT 'Medium',
                        assignee_id UUID,
                        reporter_id UUID,
                        team_id UUID,
                        reviewer_id UUID,
                        status_changed_at TIMESTAMP,
                        status_changed_by UUID,
                        previous_status VARCHAR,
                        return_comment TEXT,
                        blocker_category VARCHAR(50),
                        estimated_hours DECIMAL(5,2),
                        actual_hours DECIMAL(5,2) DEFAULT 0,
                        due_date DATE,
                        start_date DATE,
                        completed_at TIMESTAMP,
                        estimated_cost DECIMAL(10,2),
                        actual_cost DECIMAL(10,2),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    -- Add missing columns for existing tables
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS tenant_id UUID;
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID;
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS team_id UUID;
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2);
                    ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10,2);
                `);
                results.push('Created pms_tasks table');
            } catch (e) {
                results.push(`pms_tasks error: ${e.message}`);
            }

            // Add missing enum values for existing databases
            try {
                console.log('[REPAIR] Adding missing enum values...');
                await conn.query(`
                    DO $$
                    BEGIN
                        -- Add missing status enum values
                        BEGIN ALTER TYPE pms_tasks_status_enum ADD VALUE IF NOT EXISTS 'Backlog'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_tasks_status_enum ADD VALUE IF NOT EXISTS 'To Do'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_tasks_status_enum ADD VALUE IF NOT EXISTS 'In Progress'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_tasks_status_enum ADD VALUE IF NOT EXISTS 'In Review'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_tasks_status_enum ADD VALUE IF NOT EXISTS 'Blocked'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_tasks_status_enum ADD VALUE IF NOT EXISTS 'Done'; EXCEPTION WHEN duplicate_object THEN NULL; END;

                        -- Add missing sprint status enum values  
                        BEGIN ALTER TYPE pms_sprints_status_enum ADD VALUE IF NOT EXISTS 'Planning'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_sprints_status_enum ADD VALUE IF NOT EXISTS 'Active'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_sprints_status_enum ADD VALUE IF NOT EXISTS 'Completed'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                        BEGIN ALTER TYPE pms_sprints_status_enum ADD VALUE IF NOT EXISTS 'Cancelled'; EXCEPTION WHEN duplicate_object THEN NULL; END;
                    END$$;

                    -- Add CREATE action to activity log enum if it exists
                    DO $$
                    BEGIN
                        ALTER TYPE pms_task_activity_logs_action_enum ADD VALUE IF NOT EXISTS 'CREATE';
                    EXCEPTION WHEN others THEN NULL;
                    END$$;
                `);
                results.push('Added missing enum values');
            } catch (e) {
                results.push(`enum values error: ${e.message}`);
            }

            // [NEW] Create pms_settings table
            try {
                console.log('[REPAIR] Creating pms_settings table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_settings (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL UNIQUE,
                        default_task_priority VARCHAR(20) DEFAULT 'Medium',
                        enable_time_tracking BOOLEAN DEFAULT true,
                        enable_story_points BOOLEAN DEFAULT true,
                        kpi_include_completion_rate BOOLEAN DEFAULT true,
                        kpi_include_on_time_rate BOOLEAN DEFAULT true,
                        kpi_include_avg_duration BOOLEAN DEFAULT true,
                        kpi_include_overdue_count BOOLEAN DEFAULT true,
                        kpi_weight_system INT DEFAULT 50,
                        kpi_weight_manual INT DEFAULT 50,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    -- Insert default settings for tenant if not exists
                    INSERT INTO pms_settings (tenant_id, kpi_weight_system, kpi_weight_manual)
                    VALUES ('${tenantId}', 50, 50)
                    ON CONFLICT (tenant_id) DO NOTHING;
                `);
                results.push('Created pms_settings table');
            } catch (e) {
                results.push(`pms_settings error: ${e.message}`);
            }

            // [NEW] Create Manual KPI tables
            try {
                console.log('[REPAIR] Creating pms_manual_kpi tables...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_manual_kpi_metrics (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        weight DECIMAL(5,2) DEFAULT 1.0,
                        max_score DECIMAL(5,2) DEFAULT 10.0,
                        is_active BOOLEAN DEFAULT true,
                        created_by UUID,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS pms_manual_kpi_scores (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL,
                        metric_id UUID REFERENCES pms_manual_kpi_metrics(id) ON DELETE CASCADE,
                        user_id UUID NOT NULL,
                        score DECIMAL(5,2) NOT NULL,
                        notes TEXT,
                        scored_by UUID,
                        scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        period_start DATE,
                        period_end DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                results.push('Created pms_manual_kpi tables');
            } catch (e) {
                results.push(`pms_manual_kpi tables error: ${e.message}`);
            }

            // Fix legacy column constraints
            try {
                console.log('[REPAIR] Dropping legacy NOT NULL constraints...');
                await conn.query(`
                    ALTER TABLE pms_tasks ALTER COLUMN created_by DROP NOT NULL;
                `);
                results.push('Dropped created_by NOT NULL constraint');
            } catch (e) {
                results.push(`created_by constraint error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Creating pms_project_members table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_project_members (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
                        user_id UUID NOT NULL,
                        role VARCHAR(50) DEFAULT 'member',
                        can_create_tasks BOOLEAN DEFAULT false,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(project_id, user_id)
                    );
                `);
                results.push('Created pms_project_members table');
            } catch (e) {
                results.push(`pms_project_members error: ${e.message}`);
            }

            // [MIGRATE] Add can_create_tasks to pms_project_members
            try {
                await conn.query(`ALTER TABLE pms_project_members ADD COLUMN IF NOT EXISTS can_create_tasks BOOLEAN DEFAULT false;`);
            } catch (e) {
                results.push(`pms_project_members can_create_tasks migration error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Creating pms_teams table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_teams (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        lead_id UUID,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                results.push('Created pms_teams table');
            } catch (e) {
                results.push(`pms_teams error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Creating pms_team_members table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_team_members (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        team_id UUID NOT NULL REFERENCES pms_teams(id) ON DELETE CASCADE,
                        user_id UUID NOT NULL,
                        role VARCHAR(50) DEFAULT 'member',
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(team_id, user_id)
                    );
                `);
                results.push('Created pms_team_members table');
            } catch (e) {
                results.push(`pms_team_members error: ${e.message}`);
            }

            // 1. Update PMS Tasks Schema (add columns if missing)
            try {
                console.log('[REPAIR] Adding reviewer_id...');
                await conn.query(`ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS reviewer_id UUID;`);
                results.push('Added reviewer_id');
            } catch (e) {
                results.push(`reviewer_id error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Adding status_changed_at...');
                await conn.query(`ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP;`);
                results.push('Added status_changed_at');
            } catch (e) {
                results.push(`status_changed_at error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Adding status_changed_by...');
                await conn.query(`ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS status_changed_by UUID;`);
                results.push('Added status_changed_by');
            } catch (e) {
                results.push(`status_changed_by error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Adding previous_status...');
                await conn.query(`ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS previous_status VARCHAR;`);
                results.push('Added previous_status');
            } catch (e) {
                results.push(`previous_status error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Adding return_comment...');
                await conn.query(`ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS return_comment TEXT;`);
                results.push('Added return_comment');
            } catch (e) {
                results.push(`return_comment error: ${e.message}`);
            }

            try {
                console.log('[REPAIR] Adding blocker_category...');
                await conn.query(`ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS blocker_category VARCHAR(50);`);
                results.push('Added blocker_category');
            } catch (e) {
                results.push(`blocker_category error: ${e.message}`);
            }

            // 2. Create Task Activity Logs Table
            try {
                console.log('[REPAIR] Creating pms_task_activity_logs table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_task_activity_logs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        task_id UUID NOT NULL,
                        user_id UUID NOT NULL,
                        action VARCHAR NOT NULL,
                        from_value VARCHAR,
                        to_value VARCHAR,
                        reason TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                results.push('Created pms_task_activity_logs table');
            } catch (e) {
                results.push(`pms_task_activity_logs error: ${e.message}`);
            }

            // 3. Create Task Comments Table
            try {
                console.log('[REPAIR] Creating pms_task_comments table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_task_comments (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        task_id UUID NOT NULL,
                        user_id UUID NOT NULL,
                        content TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                results.push('Created pms_task_comments table');
            } catch (e) {
                results.push(`pms_task_comments error: ${e.message}`);
            }

            // 5. Create Task Attachments Table
            try {
                console.log('[REPAIR] Creating pms_task_attachments table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_task_attachments (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        task_id UUID NOT NULL,
                        file_name VARCHAR(255) NOT NULL,
                        file_url TEXT NOT NULL,
                        file_type VARCHAR(100),
                        uploaded_by UUID NOT NULL,
                        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // Fix if exists with old schema
                await conn.query(`ALTER TABLE pms_task_attachments ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
                await conn.query(`ALTER TABLE pms_task_attachments ADD COLUMN IF NOT EXISTS uploaded_by UUID;`);

                results.push('Checked/Created pms_task_attachments table');
            } catch (e) {
                results.push(`pms_task_attachments error: ${e.message}`);
            }

            // 6. Create Task Time Logs Table
            try {
                console.log('[REPAIR] Creating pms_task_time_logs table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_task_time_logs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        task_id UUID NOT NULL,
                        user_id UUID NOT NULL,
                        started_at TIMESTAMP NOT NULL,
                        ended_at TIMESTAMP,
                        duration_minutes INT NOT NULL,
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // Fix if exists with old schema
                await conn.query(`ALTER TABLE pms_task_time_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;`);
                await conn.query(`ALTER TABLE pms_task_time_logs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;`);
                await conn.query(`ALTER TABLE pms_task_time_logs ADD COLUMN IF NOT EXISTS duration_minutes INT;`);

                results.push('Checked/Created pms_task_time_logs table');
            } catch (e) {
                results.push(`pms_task_time_logs error: ${e.message}`);
            }

            // 7. Create Task Dependencies Table
            try {
                console.log('[REPAIR] Creating pms_task_dependencies table...');
                await conn.query(`
                    CREATE TABLE IF NOT EXISTS pms_task_dependencies (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        task_id UUID NOT NULL,
                        depends_on_id UUID NOT NULL,
                        dependency_type VARCHAR(50) DEFAULT 'finish_to_start',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(task_id, depends_on_id)
                    );
                `);
                results.push('Created pms_task_dependencies table');
            } catch (e) {
                results.push(`pms_task_dependencies error: ${e.message}`);
            }

            // 8. Update Shifts Schema
            try {
                console.log('[REPAIR] Updating shifts schema...');
                await conn.query(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
                results.push('Updated shifts schema (is_active)');
            } catch (e) {
                results.push(`shifts schema error: ${e.message}`);
            }

            console.log('[REPAIR] Complete!');
            return { status: 'success', message: 'Schema updated for tenant ' + tenantId, details: results };
        } catch (error) {
            console.error('[REPAIR] Fatal Error:', error);
            return { status: 'error', message: error.message, stack: error.stack, details: results };
        }
    }

    @Post('cleanup')
    @ApiOperation({ summary: 'Cleanup stuck jobs' })
    @RequirePermissions('manage_logs')
    async cleanup() {
        await this.databaseService.getTenantConnectionById('a6e6e73f-d20a-4cae-a09b-285a2166e58b').then(async conn => {
        });
        return this.logsService.cleanupStuckJobs();
    }

    @Get('debug')
    @ApiOperation({ summary: 'Debug endpoint to check payroll_runs data' })
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
            return {
                error: error.message,
                stack: error.stack
            };
        }
    }

    @Get()
    @ApiOperation({ summary: 'Get all calculation logs' })
    async getLogs(
        @Request() req,
        @Query('type') type?: CalculationType,
        @Query('status') status?: string,
        @Query('limit') limit?: number
    ) {
        const statuses = status ? status.split(',').map(s => s.trim() as CalculationStatus) : undefined;
        const parsedLimit = limit ? Number(limit) : undefined;
        return this.logsService.findAll(req.user.tenantId, type, statuses, parsedLimit);
    }

    @Get('server')
    @ApiOperation({ summary: 'Get server logs' })
    async getServerLogs(@Query('lines') lines?: number) {
        return this.logsService.getServerLogs(lines);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get log by ID' })
    async getLog(@Param('id') id: string, @Request() req) {
        const log = await this.logsService.findOne(id, req.user.tenantId);
        if (!log) throw new BadRequestException('Log not found');
        return log;
    }

    @Post(':id/retry')
    @ApiOperation({ summary: 'Retry a failed calculation' })
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
                const response = await fetch('http://localhost:8000/api/payroll/run', {
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
