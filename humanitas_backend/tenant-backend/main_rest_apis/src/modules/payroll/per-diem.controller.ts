import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PerDiemService } from './per-diem.service';
import { AssignPerDiemDto, SubmitPerDiemChoiceDto, ReviewPerDiemClaimDto, UpdatePerDiemClaimDto } from './dto/per-diem-claim.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest extends Request {
    user: {
        sub: string;
        email: string;
        tenantId: number;
        tenantSlug: string;
        role: string;
    };
}

@ApiTags('Per Diem')
@ApiBearerAuth()
@Controller('per-diem')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PerDiemController {
    constructor(private perDiemService: PerDiemService) { }

    @Post('assign')
    @RequirePermissions('manage_payroll')
    @ApiOperation({ summary: 'Admin assigns per diem to user (replaces create)' })
    async assignPerDiem(
        @Req() req: AuthenticatedRequest,
        @Body() dto: AssignPerDiemDto,
    ) {
        return this.perDiemService.assignPerDiem(
            req.user.tenantSlug,
            req.user.sub,
            dto,
        );
    }

    @Post('choice/:id')
    @ApiOperation({ summary: 'User submits choice (Receipt vs No Receipt)' })
    async submitChoice(
        @Req() req: AuthenticatedRequest,
        @Param('id') claimId: string,
        @Body() dto: SubmitPerDiemChoiceDto,
    ) {
        return this.perDiemService.submitChoice(
            req.user.tenantSlug,
            req.user.sub,
            claimId,
            dto,
        );
    }

    @Post('review/:id')
    @RequirePermissions('manage_payroll')
    @ApiOperation({ summary: 'Admin reviews claim (Approve/Reject)' })
    async reviewClaim(
        @Req() req: AuthenticatedRequest,
        @Param('id') claimId: string,
        @Body() dto: ReviewPerDiemClaimDto,
    ) {
        return this.perDiemService.reviewClaim(req.user.tenantSlug, claimId, dto);
    }

    @Get('my-claims')
    @ApiOperation({ summary: 'Get my per diem claims' })
    async getMyClaims(
        @Req() req: AuthenticatedRequest,
        @Query('year') year?: number,
    ) {
        return this.perDiemService.getUserClaims(
            req.user.tenantSlug,
            req.user.sub,
            year,
        );
    }

    @Get('claim/:id')
    @ApiOperation({ summary: 'Get a specific claim' })
    async getClaim(
        @Req() req: AuthenticatedRequest,
        @Param('id') claimId: string,
    ) {
        return this.perDiemService.getClaim(req.user.tenantSlug, claimId);
    }

    @Post('upload-receipt/:claimId')
    @ApiOperation({ summary: 'Upload receipt for a claim' })
    @ApiConsumes('multipart/form-data')
    async uploadReceipt(
        @Req() req: AuthenticatedRequest,
        @Param('claimId') claimId: string,
    ) {
        // Fastify handling of multipart
        const parts = (req as any).parts();
        let fileBuffer: Buffer | undefined;
        let filename: string | undefined;
        let mimetype: string | undefined;
        let receiptAmount: number | undefined;

        for await (const part of parts) {
            if (part.type === 'file') {
                filename = part.filename;
                mimetype = part.mimetype;
                fileBuffer = await part.toBuffer();
            } else {
                if (part.fieldname === 'receipt_amount') {
                    receiptAmount = part.value ? parseFloat(part.value as string) : undefined;
                }
            }
        }

        if (!fileBuffer) {
            throw new Error('No file uploaded');
        }

        const file = {
            buffer: fileBuffer,
            originalname: filename,
            mimetype: mimetype || 'application/octet-stream',
        };

        return this.perDiemService.uploadReceipt(
            req.user.tenantSlug,
            claimId,
            file,
            receiptAmount,
        );
    }

    @Delete('receipt/:claimId')
    @RequirePermissions('manage_payroll')
    @ApiOperation({ summary: 'Delete receipt (requires permission)' })
    async deleteReceipt(
        @Req() req: AuthenticatedRequest,
        @Param('claimId') claimId: string,
    ) {
        return this.perDiemService.deleteReceipt(req.user.tenantSlug, claimId);
    }

    @Get('calculate/:claimId')
    @ApiOperation({ summary: 'Calculate per diem amount for a claim' })
    async calculatePerDiem(
        @Req() req: AuthenticatedRequest,
        @Param('claimId') claimId: string,
    ) {
        return this.perDiemService.calculatePerDiem(req.user.tenantSlug, claimId);
    }

    @Get('all-claims')
    @RequirePermissions('view_payroll')
    @ApiOperation({ summary: 'Get all claims (admin)' })
    async getAllClaims(
        @Req() req: AuthenticatedRequest,
        @Query('month') month?: number,
        @Query('year') year?: number,
    ) {
        return this.perDiemService.getAllClaims(
            req.user.tenantSlug,
            month ? parseInt(month.toString()) : undefined,
            year ? parseInt(year.toString()) : undefined,
        );
    }

    @Post('process-payroll')
    @RequirePermissions('manage_payroll')
    @ApiOperation({ summary: 'Process monthly per diem for payroll' })
    async processPayroll(
        @Req() req: AuthenticatedRequest,
        @Query('month') month: number,
        @Query('year') year: number,
    ) {
        return this.perDiemService.processMonthlyPayroll(
            req.user.tenantSlug,
            parseInt(month.toString()),
            parseInt(year.toString()),
        );
    }
    @Patch('claim/:id')
    @RequirePermissions('manage_payroll')
    @ApiOperation({ summary: 'Update claim details (admin)' })
    async updateClaim(
        @Req() req: AuthenticatedRequest,
        @Param('id') claimId: string,
        @Body() updates: { receipt_amount?: number, status?: string },
    ) {
        return this.perDiemService.updateClaim(req.user.tenantSlug, claimId, updates);
    }
}
