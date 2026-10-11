import {
    Controller, Get, Patch, Post, Put, Body, Param, Query, UseGuards, Request
} from '@nestjs/common';
import { OvertimeService } from './overtime.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateOvertimeDto } from './dto/update-overtime.dto';

@Controller('overtime')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('attendance')
export class OvertimeController {
    constructor(private readonly overtimeService: OvertimeService) { }

    @Get()
    @RequirePermissions('overtime_view')
    async findAll(@Request() req, @Query() query) {
        return this.overtimeService.findAll(req.user.tenantId, query);
    }

    @Get('periods')
    @RequirePermissions('overtime_view')
    async getPeriods(@Request() req) {
        return this.overtimeService.getAvailablePeriods(req.user.tenantId);
    }

    @Get('period-status')
    @RequirePermissions('overtime_view')
    async getPeriodStatus(@Request() req) {
        return this.overtimeService.getPeriodPhase(req.user.tenantId);
    }

    @Patch(':id')
    @RequirePermissions('overtime_management')
    async update(
        @Request() req,
        @Param('id') id: string,
        @Body() updateDto: UpdateOvertimeDto
    ) {
        return this.overtimeService.update(req.user.tenantId, id, req.user.userId, updateDto);
    }

    @Put('entries/:id')
    @RequirePermissions('overtime_management')
    async updateEntry(
        @Request() req,
        @Param('id') id: string,
        @Body() updateDto: { normal_ot_hours?: number; night_ot_hours?: number; holiday_ot_hours?: number; dayoff_ot_hours?: number }
    ) {
        return this.overtimeService.updateEntryWithRecalc(req.user.tenantId, id, req.user.userId, updateDto);
    }

    @Post('approve')
    @RequirePermissions('overtime_management')
    async approve(@Request() req, @Body() body: { ids: string[] }) {
        return this.overtimeService.bulkApprove(req.user.tenantId, req.user.userId, body.ids);
    }

    @Post('reject')
    @RequirePermissions('overtime_management')
    async reject(@Request() req, @Body() body: { ids: string[] }) {
        return this.overtimeService.bulkReject(req.user.tenantId, req.user.userId, body.ids);
    }

    @Post('calculate-period')
    @RequirePermissions('overtime_management')
    async calculatePeriod(@Request() req, @Body() body: { year?: number; month?: number }) {
        return this.overtimeService.triggerPeriodCalculation(req.user.tenantId, body.year, body.month);
    }
}
