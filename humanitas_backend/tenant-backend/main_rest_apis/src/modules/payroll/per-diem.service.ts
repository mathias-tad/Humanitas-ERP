import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssignPerDiemDto, SubmitPerDiemChoiceDto, ReviewPerDiemClaimDto } from './dto/per-diem-claim.dto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PerDiemService {
    constructor(
        @Inject(forwardRef(() => DatabaseService))
        private databaseService: DatabaseService,
        private notificationsService: NotificationsService,
    ) { }

    private async getTenantDatabaseName(tenantSlug: string): Promise<string> {
        if (!tenantSlug) {
            throw new BadRequestException('Tenant slug is required');
        }
        return `tenant_${tenantSlug.toLowerCase().replace(/-/g, '_')}`;
    }

    private async ensurePerDiemTable(connection: any) {
        // Ensure status column exists
        await connection.query(`
            DO $$ BEGIN
                ALTER TABLE per_diem_claims ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING_USER_ACTION';
                ALTER TABLE per_diem_claims ADD COLUMN IF NOT EXISTS assigned_by UUID DEFAULT NULL;
                ALTER TABLE per_diem_claims ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
            EXCEPTION WHEN others THEN NULL;
            END $$;
        `);
    }

    /**
     * Admin assigns a per diem claim to a user
     */
    async assignPerDiem(tenantSlug: string, adminId: string, dto: AssignPerDiemDto) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);
        await this.ensurePerDiemTable(connection);

        // Check if claim already exists for this month/year
        const existing = await connection.query(
            `SELECT * FROM per_diem_claims WHERE user_id = $1 AND month = $2 AND year = $3`,
            [dto.user_id, dto.month, dto.year]
        );

        if (existing && existing.length > 0) {
            throw new BadRequestException(`User already has a per diem claim for ${dto.month}/${dto.year}`);
        }

        const result = await connection.query(
            `INSERT INTO per_diem_claims (user_id, month, year, has_receipt, status, assigned_by) 
             VALUES ($1, $2, $3, false, 'PENDING_USER_ACTION', $4) 
             RETURNING *`,
            [dto.user_id, dto.month, dto.year, adminId]
        );

        // Get tenantId from connection metadata
        const tenantResult = await connection.query(`SELECT current_database()`);
        const tenantId = tenantResult[0]?.current_database;

        // Notify the user about the assignment
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        await this.notificationsService.createNotification(
            tenantId,
            dto.user_id,
            {
                type: 'PER_DIEM_ASSIGNED',
                referenceId: result[0].id,
                title: 'Per Diem Assigned',
                message: `You have been assigned a per diem allowance for ${monthNames[dto.month - 1]} ${dto.year}. Please respond with your choice.`,
                priority: 'high'
            }
        );

        return result[0];
    }

    /**
     * Get all claims for a user
     */
    async getUserClaims(tenantSlug: string, userId: string, year?: number) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        let query = `SELECT * FROM per_diem_claims WHERE user_id = $1`;
        const params: any[] = [userId];

        if (year) {
            query += ` AND year = $2`;
            params.push(year);
        }

        query += ` ORDER BY year DESC, month DESC`;

        return connection.query(query, params);
    }

    /**
     * Get a specific claim
     */
    async getClaim(tenantSlug: string, claimId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const result = await connection.query(
            `SELECT * FROM per_diem_claims WHERE id = $1`,
            [claimId]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException('Per diem claim not found');
        }

        return result[0];
    }

    async submitChoice(tenantSlug: string, userId: string, claimId: string, dto: SubmitPerDiemChoiceDto) {
        const claim = await this.getClaim(tenantSlug, claimId);
        if (claim.user_id !== userId) throw new BadRequestException('Not your claim');
        if (claim.status !== 'PENDING_USER_ACTION') throw new BadRequestException('Claim is not pending user action');

        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        let newStatus = 'APPROVED'; // Default if no receipt
        if (dto.choice === 'WITH_RECEIPT') newStatus = 'PENDING_RECEIPT';

        const result = await connection.query(
            `UPDATE per_diem_claims 
             SET has_receipt = $1, status = $2, updated_at = NOW() 
             WHERE id = $3 RETURNING *`,
            [dto.choice === 'WITH_RECEIPT', newStatus, claimId]
        );
        return result[0];
    }

    /**
     * Admin reviews claim
     */
    async reviewClaim(tenantSlug: string, claimId: string, dto: ReviewPerDiemClaimDto) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const claim = await this.getClaim(tenantSlug, claimId);

        // If Approved, we might update the receipt amount if provided
        if (dto.status === 'APPROVED') {
            if (dto.approved_amount !== undefined) {
                await connection.query(
                    `UPDATE per_diem_claims SET receipt_amount = $1 WHERE id = $2`,
                    [dto.approved_amount, claimId]
                );
            }
        }

        const result = await connection.query(
            `UPDATE per_diem_claims 
              SET status = $1, rejection_reason = $2, updated_at = NOW() 
              WHERE id = $3 RETURNING *`,
            [dto.status, dto.rejection_reason || null, claimId]
        );

        if (dto.status === 'APPROVED') await this.calculatePerDiem(tenantSlug, claimId);

        return result[0];
    }

    /**
     * Upload receipt file
     */
    async uploadReceipt(tenantSlug: string, claimId: string, file: any, receiptAmount?: number) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const claim = await this.getClaim(tenantSlug, claimId);

        // Create upload directory structure: /uploads/per-diem-receipts/{year}/{month}/
        const uploadDir = path.join(process.cwd(), 'uploads', 'per-diem-receipts',
            claim.year.toString(), claim.month.toString().padStart(2, '0'));

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate filename: {userId}_{timestamp}.{ext}
        const ext = path.extname(file.originalname);
        const filename = `${claim.user_id}_${Date.now()}${ext}`;
        const filepath = path.join(uploadDir, filename);

        // Write file
        fs.writeFileSync(filepath, file.buffer);

        // Update claim with file URL and receipt amount, AND status
        const fileUrl = `/uploads/per-diem-receipts/${claim.year}/${claim.month.toString().padStart(2, '0')}/${filename}`;

        await connection.query(
            `UPDATE per_diem_claims 
       SET receipt_file_url = $1, receipt_amount = $2, receipt_uploaded_at = NOW(), 
           updated_at = NOW(), status = 'PENDING_REVIEW'
       WHERE id = $3`,
            [fileUrl, receiptAmount || null, claimId]
        );

        // Get tenantId
        const tenantResult = await connection.query(`SELECT current_database()`);
        const tenantId = tenantResult[0]?.current_database;

        // Notify all users with manage_payroll permission
        const reviewers = await connection.query(`
            SELECT DISTINCT u.id 
            FROM users u
            JOIN user_permissions up ON u.id = up.user_id
            JOIN permissions p ON up.permission_id = p.id
            WHERE p.code = 'manage_payroll' AND u.is_active = true
        `);

        const reviewerIds = reviewers.map((r: any) => r.id);
        if (reviewerIds.length > 0) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            await this.notificationsService.createBulkNotifications(
                tenantId,
                reviewerIds,
                {
                    type: 'PER_DIEM_REVIEW_NEEDED',
                    referenceId: claimId,
                    title: 'Per Diem Receipt Uploaded',
                    message: `A per diem receipt for ${monthNames[claim.month - 1]} ${claim.year} has been uploaded and requires your review.`,
                    priority: 'high'
                }
            );
        }

        return { message: 'Receipt uploaded successfully', fileUrl, status: 'PENDING_REVIEW' };
    }

    /**
     * Delete receipt file (requires permission)
     */
    async deleteReceipt(tenantSlug: string, claimId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const claim = await this.getClaim(tenantSlug, claimId);

        if (claim.receipt_file_url) {
            // Delete physical file
            const filepath = path.join(process.cwd(), claim.receipt_file_url);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }

        // Update claim: remove receipt and switch to "without receipt" logic (PENDING_RECEIPT)
        // Or revert back to PENDING_RECEIPT status
        await connection.query(
            `UPDATE per_diem_claims 
       SET receipt_file_url = NULL, receipt_uploaded_at = NULL, 
           has_receipt = true, updated_at = NOW(), status = 'PENDING_RECEIPT'
       WHERE id = $1`,
            [claimId]
        );

        return { message: 'Receipt deleted successfully' };
    }

    /**
     * Calculate per diem amount for a claim
     * Formula (without receipt): max(fixed_amount, basic_salary × percentage / 100)
     * Formula (with receipt): receipt_amount + max(fixed_amount, basic_salary × percentage / 100)
     */
    async calculatePerDiem(tenantSlug: string, claimId: string) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const claim = await this.getClaim(tenantSlug, claimId);

        // Get user's basic salary and category
        const userResult = await connection.query(
            `SELECT basic_salary, employee_category_id FROM users WHERE id = $1`,
            [claim.user_id]
        );

        if (!userResult || userResult.length === 0) {
            throw new NotFoundException('User not found');
        }

        const user = userResult[0];
        const basicSalary = user.basic_salary || 0;
        let perDiemAllowance = 0;
        let totalAmount = 0;

        if (user.employee_category_id) {
            // Get category per diem configuration
            const categoryResult = await connection.query(
                `SELECT per_diem_no_receipt_fixed, per_diem_no_receipt_percent,
                per_diem_receipt_fixed, per_diem_receipt_percent
         FROM employee_categories WHERE id = $1`,
                [user.employee_category_id]
            );

            if (categoryResult && categoryResult.length > 0) {
                const category = categoryResult[0];

                // Determine receipt status: has_receipt AND receipt_file_url exists
                const hasValidReceipt = claim.has_receipt && claim.receipt_file_url;

                if (hasValidReceipt) {
                    // With receipt calculation: receipt_amount + per diem allowance
                    const fixed = category.per_diem_receipt_fixed || 0;
                    const percent = category.per_diem_receipt_percent || 0;
                    const percentAmount = (basicSalary * percent) / 100;
                    perDiemAllowance = Math.max(fixed, percentAmount);

                    // Add receipt amount (accommodation reimbursement)
                    const receiptAmount = claim.receipt_amount || 0;
                    totalAmount = receiptAmount + perDiemAllowance;
                } else {
                    // Without receipt calculation
                    const fixed = category.per_diem_no_receipt_fixed || 0;
                    const percent = category.per_diem_no_receipt_percent || 0;
                    const percentAmount = (basicSalary * percent) / 100;
                    totalAmount = Math.max(fixed, percentAmount);
                }
            }
        }

        // Update claim with calculated amount
        await connection.query(
            `UPDATE per_diem_claims 
       SET calculated_amount = $1, updated_at = NOW() 
       WHERE id = $2`,
            [totalAmount, claimId]
        );

        return {
            claim_id: claimId,
            calculated_amount: totalAmount,
            per_diem_allowance: perDiemAllowance,
            receipt_amount: claim.receipt_amount || 0,
            basic_salary: basicSalary
        };
    }

    /**
     * Process all claims for a specific month/year
     * - Auto-set has_receipt=false if no receipt uploaded
     * - Calculate amounts for all claims
     */
    async processMonthlyPayroll(tenantSlug: string, month: number, year: number) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        // 1. Auto-Default: Pending User Action OR Pending Receipt (No Upload) -> Approved (No Receipt)
        // This covers users who never responded OR users who said "Yes" but didn't upload in time
        await connection.query(
            `UPDATE per_diem_claims 
             SET has_receipt = false, status = 'APPROVED', updated_at = NOW() 
             WHERE month = $1 AND year = $2 
             AND (status = 'PENDING_USER_ACTION' OR status = 'PENDING_RECEIPT')`,
            [month, year]
        );

        // 2. Auto-Approve: Pending Review (Upload exists but Admin didn't review) -> Approved (With Receipt)
        await connection.query(
            `UPDATE per_diem_claims 
             SET status = 'APPROVED', updated_at = NOW() 
             WHERE month = $1 AND year = $2 
             AND status = 'PENDING_REVIEW'`,
            [month, year]
        );

        // 3. Process All Approved Claims (Calculate)
        const claims = await connection.query(
            `SELECT id FROM per_diem_claims WHERE month = $1 AND year = $2 AND status = 'APPROVED'`,
            [month, year]
        );

        const results: any[] = [];
        for (const claim of claims) {
            const result = await this.calculatePerDiem(tenantSlug, claim.id);
            results.push(result);
        }

        return {
            processed_count: results.length,
            claims: results
        };
    }

    /**
     * Get all claims for admin view
     */
    async getAllClaims(tenantSlug: string, month?: number, year?: number) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        let query = `
      SELECT 
        c.*, 
        u.full_name as user_name,
        u.basic_salary
      FROM per_diem_claims c
      JOIN users u ON c.user_id = u.id
    `;

        const params: any[] = [];
        const conditions: string[] = [];

        if (month) {
            conditions.push(`c.month = $${params.length + 1}`);
            params.push(month);
        }

        if (year) {
            conditions.push(`c.year = $${params.length + 1}`);
            params.push(year);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        query += ` ORDER BY c.year DESC, c.month DESC, u.full_name`;

        return connection.query(query, params);
    }

    /**
     * Update claim (Admin) - modify receipt amount or status
     */
    async updateClaim(tenantSlug: string, claimId: string, updates: { receipt_amount?: number, status?: string }) {
        const databaseName = await this.getTenantDatabaseName(tenantSlug);
        const connection = await this.databaseService.getTenantConnection(databaseName);

        const claim = await this.getClaim(tenantSlug, claimId);
        const setClauses: string[] = [];
        const params: any[] = [claimId];

        if (updates.receipt_amount !== undefined) {
            setClauses.push(`receipt_amount = $${params.length + 1}`);
            params.push(updates.receipt_amount);
        }

        if (updates.status) {
            setClauses.push(`status = $${params.length + 1}`);
            params.push(updates.status);
        }

        if (setClauses.length === 0) {
            return claim;
        }

        setClauses.push(`updated_at = NOW()`);

        const query = `UPDATE per_diem_claims SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
        await connection.query(query, params);

        // If receipt amount changed, recalculate
        if (updates.receipt_amount !== undefined) {
            await this.calculatePerDiem(tenantSlug, claimId);
        }

        return this.getClaim(tenantSlug, claimId);
    }
}
