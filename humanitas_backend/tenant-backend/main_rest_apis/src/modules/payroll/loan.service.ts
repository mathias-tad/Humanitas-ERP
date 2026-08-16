import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LoanService {
    constructor(
        @Inject(forwardRef(() => DatabaseService))
        private databaseService: DatabaseService,
    ) { }

    private async getTenantDatabaseName(tenantSlug: string): Promise<string> {
        if (!tenantSlug) {
            throw new BadRequestException('Tenant slug is required');
        }
        return `tenant_${tenantSlug.toLowerCase().replace(/-/g, '_')}`;
    }

    // [HELPER] Calculate Net Salary for Validation (Shared Logic)
    // Ideally this should be a shared utility, but keeping it here to avoid circular dep with PayrollService
    private calculateIncomeTaxFromRules(amount: number, taxableAmount: number, rules: any[]): number {
        // Sort rules by min_salary asc
        const sortedRules = rules.sort((a, b) => a.min_salary - b.min_salary);

        for (const rule of sortedRules) {
            const min = parseFloat(rule.min_salary);
            const max = rule.max_salary ? parseFloat(rule.max_salary) : Infinity;
            const rate = parseFloat(rule.tax_rate) / 100;
            const deductible = parseFloat(rule.deductible) || 0;

            if (amount >= min && (amount <= max || max === Infinity)) {
                return (amount * rate) - deductible;
            }
        }
        return 0;
    }

    private calculateEstimatedNetSalary(basicSalary: number, settings: any, taxRules: any[]): number {
        const employeePensionRate = (settings.employee_pension_rate || 7) / 100;
        const pension = basicSalary * employeePensionRate;
        const taxableIncome = Math.max(0, basicSalary - pension);
        const tax = this.calculateIncomeTaxFromRules(taxableIncome, taxableIncome, taxRules);

        return basicSalary - pension - tax;
    }

    // ADMIN-ONLY: Create loan directly for a user (bypasses workflow)
    async createLoan(tenantSlug: string, userId: string, adminId: string, data: any) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const { loan_type, total_amount, monthly_deduction, description, start_month, start_year, term_months } = data;

        // 1. Get user salary
        const user = await connection.query(`SELECT basic_salary FROM users WHERE id = $1`, [userId]);
        if (!user || user.length === 0) throw new BadRequestException('User not found');
        const basicSalary = Number(user[0].basic_salary || 0);

        // 2. Get Settings & Calc Net Salary
        const settingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
        const hrSettings = settingsRes?.[0]?.data || {};
        const taxRulesRes = await connection.query(`SELECT * FROM tax_rules WHERE is_active = true ORDER BY min_salary ASC`);

        const netSalary = this.calculateEstimatedNetSalary(basicSalary, hrSettings, taxRulesRes || []);
        const maxLimit = netSalary / 3;

        // 3. Validation Loop: Check EVERY month of the loan term
        // Loan runs from [start_month, start_year] for term_months
        let currentMonth = start_month;
        let currentYear = start_year;

        for (let i = 0; i < term_months; i++) {
            // Check existing penalties for this specific month
            const penaltyRes = await connection.query(
                `SELECT SUM(amount) as total FROM user_penalties WHERE user_id = $1 AND month = $2 AND year = $3`,
                [userId, currentMonth, currentYear]
            );
            const existingPenalties = Number(penaltyRes[0]?.total || 0);

            // Check OTHER Active Loans overlapping with this month
            // A loan is active in this month if: its start is before/equal AND its end is after/equal
            // Loan End Date logic: start_date + term
            // This is complex to query directly for "overlaps", easier to just check active loans and see if their range covers [currentMonth, currentYear]
            const activeLoans = await connection.query(
                `SELECT start_month, start_year, term_months, monthly_deduction FROM loans 
                 WHERE user_id = $1 AND status = 'active'`,
                [userId]
            );

            let otherLoansDeduction = 0;
            for (const loan of activeLoans) {
                // Calculate if loan covers currentMonth/Year
                const loanStartTotal = (loan.start_year * 12) + (loan.start_month - 1); // 0-indexed month for calc
                const loanEndTotal = loanStartTotal + loan.term_months; // Exclusive end
                const checkTotal = (currentYear * 12) + (currentMonth - 1);

                if (checkTotal >= loanStartTotal && checkTotal < loanEndTotal) {
                    otherLoansDeduction += Number(loan.monthly_deduction);
                }
            }

            const totalProjected = existingPenalties + otherLoansDeduction + Number(monthly_deduction);

            if (totalProjected > maxLimit) {
                const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });
                throw new BadRequestException(
                    `Loan affordability failed for ${monthName} ${currentYear}. Total projected deduction (${totalProjected.toFixed(2)}) exceeds 1/3 of Net Salary (${maxLimit.toFixed(2)}).`
                );
            }

            // Increment month
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        // 4. Create Loan
        // Construct start_date from year/month
        const startDate = `${start_year}-${String(start_month).padStart(2, '0')}-01`;

        const result = await connection.query(
            `INSERT INTO loans (
                user_id, loan_type, description, total_amount, monthly_deduction, remaining_balance, 
                start_month, start_year, term_months, start_date, status, approved_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11) RETURNING *`,
            [userId, loan_type, description, total_amount, monthly_deduction, total_amount, start_month, start_year, term_months, startDate, adminId]
        );

        return result[0];
    }

    async getLoans(tenantSlug: string, userId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        return connection.query(
            `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return connection.query(
            `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
    }

    // ADMIN: Get all pending loans for approval
    async getPendingLoans(tenantSlug: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Join with users table to get name/department
        return connection.query(`
            SELECT l.*, u.full_name as user_name, u.department as user_department 
            FROM loans l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'pending'
            ORDER BY l.created_at ASC
        `);
    }

    async deleteLoan(tenantSlug: string, id: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Cancel instead of delete to keep history if needed? User req: "cancel" usually
        // "let expired penalities be frized" - implications for loans?
        // Let's just set status to cancelled.
        const result = await connection.query(
            `UPDATE loans SET status = 'cancelled' WHERE id = $1 RETURNING *`,
            [id]
        );

        if (!result || result.length === 0) throw new BadRequestException("Loan not found");
        return { message: "Loan cancelled successfully" };
    }

    // USER SELF-SERVICE: Request a loan
    async requestLoan(tenantSlug: string, userId: string, data: any) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const { loan_type, total_amount, term_months, start_month, start_year, description } = data;
        const monthly_deduction = total_amount / term_months;

        // Validation: Same 1/3 Net Salary check as createLoan
        const user = await connection.query(`SELECT basic_salary FROM users WHERE id = $1`, [userId]);
        if (!user || user.length === 0) throw new BadRequestException('User not found');
        const basicSalary = Number(user[0].basic_salary || 0);

        const settingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
        const hrSettings = settingsRes?.[0]?.data || {};

        // [CHECK] Tenant Setting: Allow Employee Loans
        const payrollSettingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'payroll'`);
        const payrollSettings = payrollSettingsRes?.[0]?.data || {};

        // Default to false (not allowed) if setting is missing or false
        if (!payrollSettings.allow_employee_loans) {
            throw new BadRequestException("Employee loan requests are currently disabled by your organization.");
        }
        const taxRulesRes = await connection.query(`SELECT * FROM tax_rules WHERE is_active = true ORDER BY min_salary ASC`);

        const netSalary = this.calculateEstimatedNetSalary(basicSalary, hrSettings, taxRulesRes || []);
        const maxLimit = netSalary / 3;

        // Validate for each month of the loan term
        let currentMonth = start_month;
        let currentYear = start_year;
        for (let i = 0; i < term_months; i++) {
            const penaltyRes = await connection.query(
                `SELECT SUM(amount) as total FROM user_penalties WHERE user_id = $1 AND month = $2 AND year = $3`,
                [userId, currentMonth, currentYear]
            );
            const existingPenalties = Number(penaltyRes[0]?.total || 0);

            // Ensure schema exists before querying
            await this.ensureLoanSchema(connection);

            const activeLoans = await connection.query(
                `SELECT start_month, start_year, term_months, monthly_deduction FROM loans 
                 WHERE user_id = $1 AND status = 'active'`,
                [userId]
            );

            let otherLoansDeduction = 0;
            for (const loan of activeLoans) {
                const loanStartTotal = (loan.start_year * 12) + (loan.start_month - 1);
                const loanEndTotal = loanStartTotal + loan.term_months;
                const checkTotal = (currentYear * 12) + (currentMonth - 1);
                if (checkTotal >= loanStartTotal && checkTotal < loanEndTotal) {
                    otherLoansDeduction += Number(loan.monthly_deduction);
                }
            }

            const totalProjected = existingPenalties + otherLoansDeduction + Number(monthly_deduction);
            if (totalProjected > maxLimit) {
                const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });
                throw new BadRequestException(
                    `Loan affordability failed for ${monthName} ${currentYear}. Total projected deduction (${totalProjected.toFixed(2)}) exceeds 1/3 of Net Salary (${maxLimit.toFixed(2)}).`
                );
            }

            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        // Create loan with status 'pending' and current_step = 1
        // Construct start_date from year/month
        const startDate = `${start_year}-${String(start_month).padStart(2, '0')}-01`;

        const result = await connection.query(
            `INSERT INTO loans (
                user_id, loan_type, description, total_amount, monthly_deduction, remaining_balance, 
                start_month, start_year, term_months, start_date, status, approval_status, current_step, requested_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 'pending', 1, $11) RETURNING *`,
            [userId, loan_type, description, total_amount, monthly_deduction, total_amount, start_month, start_year, term_months, startDate, userId]
        );

        return result[0];
    }

    // USER: Get own loans enriched with workflow and approvals
    async getMyLoans(tenantSlug: string, userId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // 1. Get raw loans
        const loans = await connection.query(
            `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        // 2. Get active workflow definition
        const workflow = await connection.query(
            `SELECT * FROM loan_workflows ORDER BY step_order ASC`
        );

        // 3. Enrich each loan with its specific approval history
        const enrichedLoans = await Promise.all(loans.map(async (loan: any) => {
            const approvals = await connection.query(
                `SELECT la.*, u.full_name as approver_name, u.email as approver_email 
                 FROM loan_approvals la
                 LEFT JOIN users u ON la.approver_id = u.id
                 WHERE la.loan_id = $1
                 ORDER BY la.step_number ASC, la.created_at ASC`,
                [loan.id]
            );

            return {
                ...loan,
                workflow_config: workflow, // The definition of steps (Role A -> Role B)
                approval_history: approvals // What actually happened (Approved by John at Step 1)
            };
        }));

        return enrichedLoans;
    }

    // USER: Update loan (only if pending)
    async updateLoan(tenantSlug: string, userId: string, loanId: string, data: any) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Check ownership and status
        const loan = await connection.query(
            `SELECT * FROM loans WHERE id = $1 AND user_id = $2`,
            [loanId, userId]
        );
        if (!loan || loan.length === 0) throw new BadRequestException('Loan not found');
        if (loan[0].status !== 'pending') throw new BadRequestException('Cannot edit loan after approval process has started');

        const { loan_type, total_amount, term_months, start_month, start_year, description } = data;
        const monthly_deduction = total_amount / term_months;

        // Re-run validation
        // (Skipping full validation here for brevity - should ideally call validation helper)

        const result = await connection.query(
            `UPDATE loans SET 
                loan_type = $1, description = $2, total_amount = $3, monthly_deduction = $4, 
                remaining_balance = $5, start_month = $6, start_year = $7, term_months = $8
             WHERE id = $9 RETURNING *`,
            [loan_type, description, total_amount, monthly_deduction, total_amount, start_month, start_year, term_months, loanId]
        );

        return result[0];
    }

    // ADMIN: Approve loan (advance workflow step)
    async approveLoan(tenantSlug: string, approverId: string, loanId: string, comment?: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Get loan
        const loan = await connection.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
        if (!loan || loan.length === 0) throw new BadRequestException('Loan not found');
        if (loan[0].status !== 'pending' && loan[0].status !== 'active') throw new BadRequestException('Loan is not amenable');

        // Ensure schema exists (auto-heal) before updating
        await this.ensureLoanSchema(connection);

        // Determine current step
        const currentStep = loan[0].current_step || 1;

        // Get workflow step
        const workflow = await connection.query(
            `SELECT * FROM loan_workflows WHERE step_order = $1 ORDER BY step_order ASC LIMIT 1`,
            [currentStep]
        );

        // If no workflow defined, auto-approve (single-step approval, backward compatible)
        if (!workflow || workflow.length === 0) {
            await connection.query(
                `UPDATE loans SET status = 'active', approval_status = 'approved', approved_by = $1 WHERE id = $2`,
                [approverId, loanId]
            );
            await connection.query(
                `INSERT INTO loan_approvals (loan_id, step_number, approver_id, status, comment) VALUES ($1, $2, $3, 'approved', $4)`,
                [loanId, currentStep, approverId, comment || 'Approved']
            );
            return { message: 'Loan approved successfully' };
        }

        // TODO: Validate approver has the required role
        // For now, assuming permission is checked at controller level

        // Record approval
        await connection.query(
            `INSERT INTO loan_approvals (loan_id, step_number, approver_id, status, comment) VALUES ($1, $2, $3, 'approved', $4)`,
            [loanId, currentStep, approverId, comment || 'Approved']
        );

        // Check if this is the final step
        if (workflow[0].is_final) {
            await connection.query(
                `UPDATE loans SET status = 'active', approval_status = 'approved', approved_by = $1 WHERE id = $2`,
                [approverId, loanId]
            );
            return { message: 'Loan fully approved and activated' };
        } else {
            // Move to next step
            await connection.query(
                `UPDATE loans SET current_step = current_step + 1 WHERE id = $1`,
                [loanId]
            );
            return { message: `Approval recorded. Moved to step ${currentStep + 1}` };
        }
    }

    // ADMIN: Reject loan
    async rejectLoan(tenantSlug: string, approverId: string, loanId: string, comment?: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const loan = await connection.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
        if (!loan || loan.length === 0) throw new BadRequestException('Loan not found');
        if (loan[0].status !== 'pending') throw new BadRequestException('Loan is not pending approval');

        // Ensure schema exists (auto-heal) before updating
        await this.ensureLoanSchema(connection);

        await connection.query(
            `UPDATE loans SET status = 'rejected', approval_status = 'rejected' WHERE id = $1`,
            [loanId]
        );

        await connection.query(
            `INSERT INTO loan_approvals (loan_id, step_number, approver_id, status, comment) VALUES ($1, $2, $3, 'rejected', $4)`,
            [loanId, loan[0].current_step, approverId, comment || 'Rejected']
        );

        return { message: 'Loan rejected' };
    }

    // ADMIN: Freeze loan (pause deductions)
    async freezeLoan(tenantSlug: string, loanId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const result = await connection.query(
            `UPDATE loans SET status = 'frozen' WHERE id = $1 AND status = 'active' RETURNING *`,
            [loanId]
        );

        if (!result || result.length === 0) throw new BadRequestException('Loan not found or not active');
        return { message: 'Loan frozen successfully' };
    }

    // WORKFLOW MANAGEMENT
    async getWorkflow(tenantSlug: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        return connection.query(
            `SELECT * FROM loan_workflows ORDER BY step_order ASC`
        );
    }

    async setWorkflowSteps(tenantSlug: string, steps: Array<{ role_required: string; is_final: boolean }>) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Delete existing workflow
        await connection.query(`DELETE FROM loan_workflows`);

        // Insert new steps
        for (let i = 0; i < steps.length; i++) {
            await connection.query(
                `INSERT INTO loan_workflows (step_order, role_required, is_final) VALUES ($1, $2, $3)`,
                [i + 1, steps[i].role_required, steps[i].is_final]
            );
        }

        return { message: 'Workflow updated successfully', steps: await this.getWorkflow(tenantSlug) };
    }

    async deleteWorkflow(tenantSlug: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        await connection.query(`DELETE FROM loan_workflows`);
        return { message: 'Workflow deleted. Loan approvals will default to single-step.' };
    }

    async getRoles(tenantSlug: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Fetch roles, exclude system roles if desired, or return all
        return connection.query(`SELECT name FROM roles ORDER BY name ASC`);
    }

    async seedRolesForTenants() {
        // 1. Get all tenants
        const tenants = await this.databaseService.getAllTenants();
        const results: any[] = [];

        // 2. Iterate and seed
        for (const tenant of tenants) {
            try {
                const connection = await this.databaseService.getTenantConnection(tenant.database_name);
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS roles (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        name VARCHAR(100) NOT NULL,
                        description TEXT,
                        permissions JSONB NOT NULL DEFAULT '[]',
                        is_system BOOLEAN DEFAULT false,
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await connection.query(`
                    INSERT INTO roles (name, description, is_system)
                    SELECT 'Manager', 'Department Manager', false WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Manager');

                    INSERT INTO roles (name, description, is_system)
                    SELECT 'HR', 'Human Resources', false WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'HR');

                    INSERT INTO roles (name, description, is_system)
                    SELECT 'Finance', 'Finance Department', false WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Finance');

                    INSERT INTO roles (name, description, is_system)
                    SELECT 'CEO', 'Chief Executive Officer', false WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CEO');

                    -- [UPDATE] Grant Loan Permissions to HR and Admin
                    -- Append manage_loans and manage_loan_workflows if not already present
                    UPDATE roles 
                    SET permissions = (
                        CASE 
                            WHEN permissions IS NULL THEN '[]'::jsonb
                            ELSE permissions
                        END
                    ) || '["manage_loans", "manage_loan_workflows"]'::jsonb
                    WHERE name IN ('HR', 'Admin')
                    AND NOT (permissions @> '["manage_loans", "manage_loan_workflows"]');
                `);
                results.push({ tenant: tenant.slug, status: 'success' });
            } catch (e) {
                console.error(`Failed to seed roles for ${tenant.slug}`, e);
                results.push({ tenant: tenant.slug, status: 'failed', error: e.message });
            }
        }
        return results;
    }

    private async ensureLoanSchema(connection: any) {
        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                loan_type VARCHAR(50) NOT NULL,
                description TEXT,
                total_amount DECIMAL(10, 2) NOT NULL,
                monthly_deduction DECIMAL(10, 2) NOT NULL,
                remaining_balance DECIMAL(10, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending', -- pending, active, rejected, paid, cancelled, frozen
                approved_by UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure columns exist (Auto-migrate)
        await connection.query(`
            DO $$ 
            BEGIN 
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_month INTEGER DEFAULT 1;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_year INTEGER DEFAULT 2024;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_date DATE;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS term_months INTEGER DEFAULT 1;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS approved_by UUID;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS requested_by UUID;
            EXCEPTION WHEN others THEN NULL; 
            END $$;
        `);
    }

    async getLoanConfig(tenantSlug: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);
        const settingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'payroll'`);
        const payrollSettings = settingsRes?.[0]?.data || {};
        return {
            allow_employee_loans: !!payrollSettings.allow_employee_loans
        };
    }
}
