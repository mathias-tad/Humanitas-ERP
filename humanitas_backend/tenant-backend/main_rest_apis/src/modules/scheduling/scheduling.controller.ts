import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateShiftPatternDto } from './dto/create-pattern.dto';
import { AssignScheduleDto } from './dto/assign-schedule.dto';
import { AssignPatternDto } from './dto/assign-pattern.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('scheduling')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('scheduling')
export class SchedulingController {
    constructor(private readonly schedulingService: SchedulingService) { }

    @Post('shifts')
    @RequirePermissions('manage_shifts')
    createShift(@Req() req: any, @Body() dto: CreateShiftDto) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        const userId = req.user.sub; // Extract User ID from JWT
        return this.schedulingService.createShift(tenantId, dto, userId);
    }

    @Get('shifts')
    @RequirePermissions('view_shifts')
    getShifts(@Req() req: any) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        return this.schedulingService.getShifts(tenantId);
    }

    @Delete('shifts/:id')
    @RequirePermissions('manage_shifts')
    deleteShift(@Req() req: any, @Param('id') id: string) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        const userId = req.user.sub;
        return this.schedulingService.deleteShift(tenantId, id, userId);
    }

    @Post('patterns')
    @RequirePermissions('manage_shifts')
    createPattern(@Req() req: any, @Body() dto: CreateShiftPatternDto) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        const userId = req.user.sub;
        return this.schedulingService.createPattern(tenantId, dto, userId);
    }

    @Get('patterns')
    @RequirePermissions('view_shifts')
    getPatterns(@Req() req: any) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        return this.schedulingService.getPatterns(tenantId);
    }

    @Post('assign-shift') // Manual Override / Single Day Assignment
    @RequirePermissions('manage_roster')
    assignSchedule(@Req() req: any, @Body() dto: AssignScheduleDto) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        const userId = req.user.sub;
        return this.schedulingService.assignSchedule(tenantId, dto, userId);
    }

    @Post('assign-pattern')
    @RequirePermissions('manage_roster')
    assignPattern(@Req() req: any, @Body() dto: AssignPatternDto) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        const userId = req.user.sub;
        return this.schedulingService.assignPattern(tenantId, dto, userId);
    }

    @Get('audit-logs')
    @RequirePermissions('manage_schedules')
    getAuditLogs(@Req() req: any) {
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        return this.schedulingService.getAuditLogs(tenantId);
    }

    @Get('user-schedule/:userId')
    @RequirePermissions('view_roster')
    getUserSchedule(
        @Req() req: any,
        @Param('userId') userId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        console.log(`[SchedulingController] GET user-schedule/${userId}`);
        const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
        return this.schedulingService.getUserSchedule(
            tenantId,
            userId,
            startDate,
            endDate,
        );
    }
}
