
import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AbsencePenaltyService } from './absence-penalty.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { DatabaseService } from '../database/database.service';

@Controller('absence-penalty')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AbsencePenaltyController {
    constructor(
        private readonly absencePenaltyService: AbsencePenaltyService,
        private readonly databaseService: DatabaseService
    ) { }

    @Get('pending')
    @RequirePermissions('absence_penalty_approve')
    async getPendingPenalties(@Request() req) {
        const tenantSlug = req.user.tenantSlug;
        const connection = await this.databaseService.getTenantConnection(tenantSlug);

        // Fetch pending penalties
        // Join with user details
        const result = await connection.query(`
      SELECT p.*, u.full_name, u.department, u.position
      FROM user_penalties p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'Pending' AND p.penalty_type IN ('Automatic', 'Absence')
      ORDER BY p.created_at DESC
    `);

        return result;
    }

    @Post(':id/approve')
    @RequirePermissions('absence_penalty_approve')
    async approvePenalty(@Request() req, @Param('id') id: string) {
        const tenantSlug = req.user.tenantSlug;
        const approverId = req.user.userId;
        const connection = await this.databaseService.getTenantConnection(tenantSlug);

        // Update status
        const result = await connection.query(`
      UPDATE user_penalties 
      SET status = 'Approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, approverId]);

        if (result.length === 0) {
            throw new BadRequestException('Penalty not found');
        }

        return { message: 'Penalty approved successfully', penalty: result[0] };
    }

    @Post(':id/reject')
    @RequirePermissions('absence_penalty_approve')
    async rejectPenalty(@Request() req, @Param('id') id: string, @Body('reason') reason: string) {
        const tenantSlug = req.user.tenantSlug;
        const connection = await this.databaseService.getTenantConnection(tenantSlug);

        if (!reason) {
            throw new BadRequestException('Rejection reason is required');
        }

        // Update status
        const result = await connection.query(`
      UPDATE user_penalties 
      SET status = 'Rejected', rejection_reason = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, reason]);

        if (result.length === 0) {
            throw new BadRequestException('Penalty not found');
        }

        // NOTE: Does rejecting an absence penalty revert the 'Absence' status in attendance?
        // Probably not automatically. It just means the *penalty* is waived.
        // The attendance record usually stays 'Absent' unless manually corrected.

        return { message: 'Penalty rejected successfully', penalty: result[0] };
    }
}
