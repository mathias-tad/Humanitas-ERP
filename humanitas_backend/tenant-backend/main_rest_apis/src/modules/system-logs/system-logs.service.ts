import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalculationLog, CalculationStatus, CalculationType } from './entities/calculation-log.entity';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SystemLogsService {
    constructor(
        @InjectRepository(CalculationLog)
        private logsRepository: Repository<CalculationLog>,
        private readonly databaseService: DatabaseService,
    ) { }

    async createLog(
        tenantId: string,
        type: CalculationType,
        payload: any,
        triggeredBy: string
    ): Promise<CalculationLog> {
        const log = this.logsRepository.create({
            tenant_id: tenantId,
            type,
            status: CalculationStatus.QUEUED,
            payload,
            triggered_by: triggeredBy,
            started_at: new Date()
        });
        return this.logsRepository.save(log);
    }

    async updateLogStatus(id: string, status: CalculationStatus, result: any | null = null, error: string | null = null): Promise<CalculationLog | null> {
        const log = await this.logsRepository.findOne({ where: { id } });
        if (!log) return null;

        log.status = status;
        if (result) log.result = result;
        if (error) log.error_message = error;

        if (status === CalculationStatus.COMPLETED || status === CalculationStatus.FAILED) {
            log.completed_at = new Date();
        }

        return this.logsRepository.save(log);
    }

    async cleanupStuckJobs(): Promise<void> {
        // Update all QUEUED/PROCESSING/PENDING to FAILED
        await this.logsRepository.createQueryBuilder()
            .update(CalculationLog)
            .set({
                status: CalculationStatus.FAILED,
                error_message: 'Force cleaned by admin',
                completed_at: new Date()
            })
            .where("status IN (:...statuses)", { statuses: [CalculationStatus.QUEUED, CalculationStatus.PROCESSING, CalculationStatus.PENDING] })
            .execute();
    }

    async findAll(tenantId: string, type?: CalculationType, statuses?: CalculationStatus[], limit: number = 50): Promise<any[]> {
        // 1. Get standard calculation logs
        const query = this.logsRepository.createQueryBuilder('log')
            .where('log.tenant_id = :tenantId', { tenantId })
            .orderBy('log.started_at', 'DESC');

        if (type && type !== CalculationType.PAYROLL) {
            query.andWhere('log.type = :type', { type });
        }

        if (statuses && statuses.length > 0) {
            query.andWhere('log.status IN (:...statuses)', { statuses });
        }

        query.take(limit);
        const standardLogs = await query.getMany();

        // 2. Get Payroll Runs (if type is 'PAYROLL' or undefined)
        let payrollLogs: any[] = [];
        if (!type || type === CalculationType.PAYROLL) {
            try {
                const connection = await this.databaseService.getTenantConnectionById(tenantId);

                // Build status filter for SQL
                let statusClause = '';
                if (statuses && statuses.length > 0) {
                    const statusStrings = statuses.map(s => `'${s.toLowerCase()}'`).join(',');
                    statusClause = `AND status IN (${statusStrings})`;
                }

                console.log(`[SystemLogs] Fetching payroll logs for tenant: ${tenantId}`);
                const payrollRuns = await connection.query(`
                    SELECT * FROM payroll_runs 
                    ORDER BY created_at DESC 
                    LIMIT ${limit}
                `);
                console.log(`[SystemLogs] Found ${payrollRuns.length} payroll runs`);

                payrollLogs = payrollRuns.map(run => {
                    // Determine trigger type
                    const isAuto = run.created_by === 'system-auto' || !run.created_by;
                    const trigger = isAuto ? 'Automatic' : 'Manual';

                    // Map status to Enum
                    let status = CalculationStatus.PENDING;
                    if (run.status === 'processing') status = CalculationStatus.PROCESSING;
                    if (run.status === 'completed') status = CalculationStatus.COMPLETED;
                    if (run.status === 'failed') status = CalculationStatus.FAILED;

                    return {
                        id: run.id,
                        tenant_id: tenantId,
                        type: CalculationType.PAYROLL,
                        status: status,
                        payload: { month: run.month, year: run.year },
                        result: {
                            total_employees: run.total_employees,
                            total_gross: run.total_gross,
                            total_net: run.total_net,
                            message: run.status_message // Message often contains skipped info
                        },
                        triggered_by: trigger,
                        started_at: run.created_at,
                        completed_at: run.completed_at || (status === CalculationStatus.COMPLETED ? run.updated_at : null),
                        error_message: status === CalculationStatus.FAILED ? run.status_message : null
                    };
                });

                // Apply status filter in memory since we fetched simplified
                if (statuses && statuses.length > 0) {
                    payrollLogs = payrollLogs.filter(log => statuses.includes(log.status));
                }

            } catch (e) {
                console.error("Error fetching payroll logs:", e);
            }
        }

        // 3. Merge and Sort
        const allLogs = [...standardLogs, ...payrollLogs];
        allLogs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

        return allLogs.slice(0, limit);
    }

    async findOne(id: string, tenantId?: string): Promise<any | null> {
        let log: any = await this.logsRepository.findOne({ where: { id } });
        if (log) return log;

        // Try Payroll Runs if tenantId provided
        if (tenantId) {
            try {
                const connection = await this.databaseService.getTenantConnectionById(tenantId);
                const runs = await connection.query(`SELECT * FROM payroll_runs WHERE id = $1`, [id]);

                if (runs && runs.length > 0) {
                    const run = runs[0];
                    const isAuto = run.created_by === 'system-auto' || !run.created_by;

                    let status = CalculationStatus.PENDING;
                    if (run.status === 'processing') status = CalculationStatus.PROCESSING;
                    if (run.status === 'completed') status = CalculationStatus.COMPLETED;
                    if (run.status === 'failed') status = CalculationStatus.FAILED;

                    return {
                        id: run.id,
                        tenant_id: tenantId,
                        type: CalculationType.PAYROLL,
                        status: status,
                        payload: { month: run.month, year: run.year },
                        result: {
                            total_employees: run.total_employees,
                            total_gross: run.total_gross,
                            total_net: run.total_net,
                            message: run.status_message
                        },
                        triggered_by: isAuto ? 'Automatic' : 'Manual',
                        started_at: run.created_at,
                        completed_at: run.completed_at || (status === CalculationStatus.COMPLETED ? run.updated_at : null),
                        error_message: status === CalculationStatus.FAILED ? run.status_message : null
                    };
                }
            } catch (e) {
                console.error("Error finding payroll run:", e);
            }
        }

        return null;
    }

    // Server Logs Proxy
    async getServerLogs(lines: number = 100): Promise<string> {
        try {
            // Call Python service
            // Assuming hardcoded URL for now as per previous steps
            const pythonUrl = 'http://localhost:8000';
            const response = await fetch(`${pythonUrl}/api/system/logs?lines=${lines}`);

            if (!response.ok) {
                return `Error fetching logs: ${response.statusText}`;
            }

            return await response.text();
        } catch (error) {
            return `Failed to connect to log server: ${error.message}`;
        }
    }
}
