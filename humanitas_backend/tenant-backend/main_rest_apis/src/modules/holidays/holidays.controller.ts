import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('leave')
@Controller('holidays')
export class HolidaysController {
    constructor(private readonly holidaysService: HolidaysService) { }

    @Get()
    @RequirePermissions('view_holidays')
    findAll(@Request() req: AuthenticatedRequest) {
        return this.holidaysService.findAll(req.user.tenantId);
    }

    @Post()
    @RequirePermissions('manage_holidays')
    create(@Request() req: AuthenticatedRequest, @Body() dto: CreateHolidayDto) {
        return this.holidaysService.create(req.user.tenantId, dto);
    }

    @Patch(':id')
    @RequirePermissions('manage_holidays')
    update(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateHolidayDto) {
        return this.holidaysService.update(req.user.tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('manage_holidays')
    remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.holidaysService.delete(req.user.tenantId, id);
    }
}
