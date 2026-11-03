import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard } from '../common/guards/module-subscription.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireModule } from '../common/decorators/module.decorator';

@Controller('calendar')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @RequirePermissions('view_calendar')
  async findAll(
    @Request() req,
    @Query() query: QueryCalendarEventsDto,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    const tenantId = req.user.tenantId || req.headers['x-tenant-id'];
    const userId = req.user.id;

    const events = await this.calendarService.findAll(
      tenantId,
      userId,
      query,
      companyId,
      branchId,
    );

    return { success: true, data: events };
  }

  @Get('events/:id')
  @RequirePermissions('view_calendar')
  async findOne(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.headers['x-tenant-id'];
    const event = await this.calendarService.findOne(tenantId, id);
    return { success: true, data: event };
  }

  @Post('events')
  @RequirePermissions('create_calendar_events')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req,
    @Body() dto: CreateCalendarEventDto,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    const tenantId = req.user.tenantId || req.headers['x-tenant-id'];
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

    const event = await this.calendarService.create(
      tenantId,
      userId,
      userName,
      dto,
      companyId,
      branchId,
    );

    return { success: true, data: event };
  }

  @Put('events/:id')
  @RequirePermissions('edit_calendar_events')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    const tenantId = req.user.tenantId || req.headers['x-tenant-id'];
    const userId = req.user.id;
    const event = await this.calendarService.update(tenantId, userId, id, dto);
    return { success: true, data: event };
  }

  @Delete('events/:id')
  @RequirePermissions('delete_calendar_events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.headers['x-tenant-id'];
    const userId = req.user.id;
    await this.calendarService.remove(tenantId, userId, id);
  }
}
