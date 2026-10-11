import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LoanService } from './loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto, ApproveLoanDto, RejectLoanDto, SetLoanWorkflowDto } from './dto/loan.dto';

@Controller('payroll/loans')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('payroll')
export class LoanController {
    constructor(private loanService: LoanService) { }

    // ADMIN: Create loan directly for a user (bypasses workflow)
    @Post(':userId')
    @RequirePermissions('manage_payroll')
    async createLoan(
        @Request() req,
        @Param('userId') userId: string,
        @Body() body: CreateLoanDto,
    ) {
        const { total_amount, term_months, start_month, start_year } = body;
        if (!total_amount || !term_months || !start_month || !start_year) {
            throw new BadRequestException("Missing required loan fields (amount, term, start date)");
        }

        return this.loanService.createLoan(
            req.user.tenantSlug,
            userId,
            req.user.sub,
            body
        );
    }

    // ADMIN: Get all pending loans (MUST BE BEFORE :userId route)
    @Get('pending')
    @RequirePermissions('view_payroll')
    async getPendingLoans(@Request() req) {
        return this.loanService.getPendingLoans(req.user.tenantSlug);
    }

    // ADMIN: Get loans for a specific user
    @Get(':userId')
    @RequirePermissions('view_payroll')
    async getLoans(@Request() req, @Param('userId') userId: string) {
        return this.loanService.getLoans(req.user.tenantSlug, userId);
    }

    // ADMIN: Cancel loan
    @Delete(':id')
    @RequirePermissions('manage_payroll')
    async deleteLoan(@Request() req, @Param('id') id: string) {
        return this.loanService.deleteLoan(req.user.tenantSlug, id);
    }

    // USER: Request a loan (self-service)
    @Post('my-requests')
    async requestMyLoan(@Request() req, @Body() body: CreateLoanDto) {
        const { total_amount, term_months, start_month, start_year } = body;
        if (!total_amount || !term_months || !start_month || !start_year) {
            throw new BadRequestException("Missing required loan fields");
        }

        return this.loanService.requestLoan(
            req.user.tenantSlug,
            req.user.sub,
            body
        );
    }

    // USER: Get my loans
    @Get('my-requests')
    async getMyLoans(@Request() req) {
        return this.loanService.getMyLoans(req.user.tenantSlug, req.user.sub);
    }

    // USER: Get loan configuration (allow_employee_loans, etc.)
    @Get('config')
    async getLoanConfig(@Request() req) {
        return this.loanService.getLoanConfig(req.user.tenantSlug);
    }

    // USER: Update my pending loan
    @Put('my-requests/:id')
    async updateMyLoan(@Request() req, @Param('id') id: string, @Body() body: UpdateLoanDto) {
        return this.loanService.updateLoan(
            req.user.tenantSlug,
            req.user.sub,
            id,
            body
        );
    }

    // ADMIN: Approve loan
    @Post(':id/approve')
    @RequirePermissions('approve_loans')
    async approveLoan(@Request() req, @Param('id') id: string, @Body() body: ApproveLoanDto) {
        return this.loanService.approveLoan(
            req.user.tenantSlug,
            req.user.sub,
            id,
            body.comment
        );
    }

    // ADMIN: Reject loan
    @Post(':id/reject')
    @RequirePermissions('approve_loans')
    async rejectLoan(@Request() req, @Param('id') id: string, @Body() body: RejectLoanDto) {
        return this.loanService.rejectLoan(
            req.user.tenantSlug,
            req.user.sub,
            id,
            body.comment
        );
    }

    // ADMIN: Freeze loan
    @Post(':id/freeze')
    @RequirePermissions('manage_payroll')
    async freezeLoan(@Request() req, @Param('id') id: string) {
        return this.loanService.freezeLoan(req.user.tenantSlug, id);
    }

    // WORKFLOW MANAGEMENT
    @Get('workflow/config')
    @RequirePermissions('manage_payroll')
    async getWorkflow(@Request() req) {
        return this.loanService.getWorkflow(req.user.tenantSlug);
    }

    @Post('workflow/config')
    @RequirePermissions('manage_payroll')
    async setWorkflow(@Request() req, @Body() body: SetLoanWorkflowDto) {
        const steps = (body.steps || []).map((s) => ({
            role_required: s.role_required,
            is_final: Boolean(s.is_final),
        }));
        return this.loanService.setWorkflowSteps(req.user.tenantSlug, steps);
    }

    @Delete('workflow/config')
    @RequirePermissions('manage_payroll')
    async deleteWorkflow(@Request() req) {
        return this.loanService.deleteWorkflow(req.user.tenantSlug);
    }

    @Get('workflow/roles')
    @RequirePermissions('manage_payroll')
    async getRoles(@Request() req) {
        return this.loanService.getRoles(req.user.tenantSlug);
    }

    // SYSTEM: Backfill roles for all tenants
    @Post('workflow/seed-roles')
    @RequirePermissions('manage_payroll')
    async seedRoles() {
        return this.loanService.seedRolesForTenants();
    }
}
