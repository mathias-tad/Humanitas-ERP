import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserPenaltyService } from './user-penalty.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest extends Request {
    user: {
        sub: string;
        tenantSlug: string;
    };
}

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('payroll/penalties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserPenaltyController {
    constructor(private userPenaltyService: UserPenaltyService) { }

    @Post(':userId')
    @RequirePermissions('edit_payroll_settings')
    @ApiOperation({ summary: 'Add a penalty to a user' })
    @ApiConsumes('multipart/form-data')
    async createPenalty(
        @Req() req: AuthenticatedRequest,
        @Param('userId') userId: string,
    ) {
        // Fastify multipart handling
        const parts = (req as any).parts();
        let fileBuffer: Buffer | undefined;
        let filename: string | undefined;
        let amount: number | undefined;
        let reason: string | undefined;
        let month: number | undefined;
        let year: number | undefined;

        for await (const part of parts) {
            if (part.type === 'file') {
                filename = part.filename;
                fileBuffer = await part.toBuffer();
            } else {
                if (part.fieldname === 'amount') {
                    amount = parseFloat(part.value as string);
                }
                if (part.fieldname === 'reason') {
                    reason = part.value as string;
                }
                if (part.fieldname === 'month') {
                    month = parseInt(part.value as string);
                }
                if (part.fieldname === 'year') {
                    year = parseInt(part.value as string);
                }
            }
        }

        if (amount === undefined || !reason) {
            throw new Error('Amount and reason are required');
        }

        const file = fileBuffer ? {
            buffer: fileBuffer,
            originalname: filename || 'attachment', // Fallback
        } : undefined;

        return this.userPenaltyService.createPenalty(
            req.user.tenantSlug,
            userId,
            req.user.sub,
            { amount, reason, month, year },
            file
        );
    }

    @Get(':userId')
    @RequirePermissions('view_payroll_settings')
    @ApiOperation({ summary: 'Get penalties for a user' })
    async getPenalties(
        @Req() req: AuthenticatedRequest,
        @Param('userId') userId: string,
    ) {
        return this.userPenaltyService.getPenalties(req.user.tenantSlug, userId);
    }

    @Delete(':id')
    @RequirePermissions('edit_payroll_settings')
    @ApiOperation({ summary: 'Delete a penalty' })
    async deletePenalty(
        @Req() req: AuthenticatedRequest,
        @Param('id') penaltyId: string,
    ) {
        return this.userPenaltyService.deletePenalty(req.user.tenantSlug, penaltyId);
    }
}
