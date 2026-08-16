import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('holidays')
export class HolidaysController {
    constructor(private readonly holidaysService: HolidaysService) { }

    @Get()
    @RequirePermissions('view_holidays')
    findAll(@Request() req: any) {
        return this.holidaysService.findAll(req.user.tenantId);
    }

    @Post()
    @RequirePermissions('manage_holidays')
    create(@Request() req: any, @Body() dto: CreateHolidayDto) {
        return this.holidaysService.create(req.user.tenantId, dto);
    }

    @Patch(':id')
    @RequirePermissions('manage_holidays')
    update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateHolidayDto) {
        return this.holidaysService.update(req.user.tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('manage_holidays')
    remove(@Request() req: any, @Param('id') id: string) {
        return this.holidaysService.delete(req.user.tenantId, id);
    }
}
