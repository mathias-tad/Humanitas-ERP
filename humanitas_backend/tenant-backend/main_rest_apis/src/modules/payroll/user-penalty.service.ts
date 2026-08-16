import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UserPenaltyService {
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

    // [HELPER] Calculate Net Salary for Validation
    // Duplicated from PayrollService to avoid circular dependency/complexity for now
    private calculateIncomeTaxFromRules(amount: number, taxableAmount: number, rules: any[]): number {
        let tax = 0;
        let remainingTaxable = taxableAmount;

        // Sort rules by min_salary asc
        const sortedRules = rules.sort((a, b) => a.min_salary - b.min_salary);

        for (const rule of sortedRules) {
            const min = parseFloat(rule.min_salary);
            const max = rule.max_salary ? parseFloat(rule.max_salary) : Infinity;
            const rate = parseFloat(rule.tax_rate) / 100;
            const deductible = parseFloat(rule.deductible) || 0;

            // Simplified tax bracket logic for Ethiopia (usually it's: (Gross * Rate) - Deductible)
            // But if we stick to the rules structure:
            if (amount >= min && (amount <= max || max === Infinity)) {
                return (amount * rate) - deductible;
            }
        }
        return 0; // Fallback
    }

    private calculateEstimatedNetSalary(basicSalary: number, settings: any, taxRules: any[]): number {
        const employeePensionRate = (settings.employee_pension_rate || 7) / 100;
        const pension = basicSalary * employeePensionRate;
        const taxableIncome = Math.max(0, basicSalary - pension);
        const tax = this.calculateIncomeTaxFromRules(taxableIncome, taxableIncome, taxRules); // Usually tax is on taxable income

        // Correction: Typically tax rules apply to GROSS taxable income. 
        // If tax rules are "(Gross * Rate) - Deductible", then we pass 'taxableIncome' as the amount if pension is tax-exempt.
        // Let's assume the standard Ethiopian formula: (TaxableIncome * Rate) - Deductible.

        return basicSalary - pension - tax;
    }

    async createPenalty(tenantSlug: string, userId: string, adminId: string, data: { amount: number; reason: string; month?: number; year?: number }, file?: any) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const currentYear = new Date().getFullYear();
        const penaltyMonth = data.month || new Date().getMonth() + 1;
        const penaltyYear = data.year || currentYear;

        // 1. Get user salary
        const user = await connection.query(`SELECT basic_salary FROM users WHERE id = $1`, [userId]);
        if (!user || user.length === 0) {
            throw new BadRequestException('User not found');
        }
        const basicSalary = Number(user[0].basic_salary || 0);

        // 2. Get Settings & Tax Rules for Net Calc
        const settingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
        const hrSettings = settingsRes?.[0]?.data || {};
        const taxRulesRes = await connection.query(`SELECT * FROM tax_rules WHERE is_active = true ORDER BY min_salary ASC`);

        // 3. Calculate Net Salary & Limit
        const netSalary = this.calculateEstimatedNetSalary(basicSalary, hrSettings, taxRulesRes || []);
        const maxLimit = netSalary / 3;

        // 4. Check Existing Penalties for this Month
        const existingPenaltiesRes = await connection.query(
            `SELECT SUM(amount) as total FROM user_penalties WHERE user_id = $1 AND month = $2 AND year = $3`,
            [userId, penaltyMonth, penaltyYear]
        );
        const existingPenaltyTotal = Number(existingPenaltiesRes[0]?.total || 0);

        // 5. Check Active Loan Deductions for this Month
        // A loan is active in this month if: status='active' AND (start_year < year OR (start_year == year AND start_month <= month))
        // AND checks loan term... usually simpler to just check if it's active and check repayment schedule
        // For simplicity: If active, we count its monthly_deduction. 
        // Ideally we should check if loan ENDS before this month, but for "assigning penalty", we assume worst case overlap.
        const activeLoansRes = await connection.query(
            `SELECT SUM(monthly_deduction) as total FROM loans 
             WHERE user_id = $1 AND status = 'active' 
             AND (start_year < $3 OR (start_year = $3 AND start_month <= $2))`,
            [userId, penaltyMonth, penaltyYear]
        );
        const activeLoanTotal = Number(activeLoansRes[0]?.total || 0);

        // 6. Validate
        const totalDeduction = existingPenaltyTotal + activeLoanTotal + Number(data.amount);

        if (totalDeduction > maxLimit) {
            throw new BadRequestException(
                `Total deduction (${totalDeduction.toFixed(2)}) exceeds 1/3 of Net Salary (${maxLimit.toFixed(2)}). ` +
                `Net: ${netSalary.toFixed(2)}. Existing Penalties: ${existingPenaltyTotal}, Loans: ${activeLoanTotal}.`
            );
        }

        let attachmentUrl: string | null = null;

        // 7. Handle file upload
        if (file) {
            const uploadDir = path.join(process.cwd(), 'uploads', 'penalties', userId);
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const ext = path.extname(file.originalname);
            const filename = `penalty_${Date.now()}${ext}`;
            const filepath = path.join(uploadDir, filename);

            fs.writeFileSync(filepath, file.buffer);
            attachmentUrl = `/uploads/penalties/${userId}/${filename}`;
        }

        // 8. Save penalty
        const result = await connection.query(
            `INSERT INTO user_penalties (user_id, amount, reason, attachment_url, month, year, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, data.amount, data.reason, attachmentUrl, penaltyMonth, penaltyYear, adminId]
        );

        return result[0];
    }

    async getPenalties(tenantSlug: string, userId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        return connection.query(
            `SELECT p.*, u.full_name as created_by_name 
             FROM user_penalties p
             LEFT JOIN users u ON p.created_by = u.id
             WHERE p.user_id = $1 
             ORDER BY p.year DESC, p.month DESC, p.created_at DESC`,
            [userId]
        );
    }

    async deletePenalty(tenantSlug: string, penaltyId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // Get attachment URL to delete file
        const penalty = await connection.query(`SELECT attachment_url, month, year FROM user_penalties WHERE id = $1`, [penaltyId]);

        if (!penalty || penalty.length === 0) {
            throw new BadRequestException("Penalty not found");
        }

        // [VALIDATION] Freeze expired penalties (past months cannot be deleted)
        const currentDate = new Date();
        const pDate = new Date(penalty[0].year, penalty[0].month - 1);
        // Only allow deleting current month or future penalties? Or generic "Frozen" check?
        // User asked: "let expired penalities be frized and non editable"
        // Interpreted as: If month < current_month (and year <= current_year), reject delete.

        // Simple check: If (Year < CurYear) OR (Year == CurYear AND Month < CurMonth)
        if (penalty[0].year < currentDate.getFullYear() ||
            (penalty[0].year === currentDate.getFullYear() && penalty[0].month < (currentDate.getMonth() + 1))) {
            throw new BadRequestException("Cannot delete past/expired penalties.");
        }

        if (penalty[0].attachment_url) {
            const filepath = path.join(process.cwd(), penalty[0].attachment_url);
            if (fs.existsSync(filepath)) {
                try {
                    fs.unlinkSync(filepath);
                } catch (e) {
                    console.error('Failed to delete penalty file:', e);
                }
            }
        }

        await connection.query(`DELETE FROM user_penalties WHERE id = $1`, [penaltyId]);
        return { message: 'Penalty deleted successfully' };
    }
}
