import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CalendarEventsQueryDto,
} from './dto/calendar-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('calendar')
@RequireModule('calendar')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('sources')
  @RequirePermissions('view_calendar')
  async getSources(@Request() req: any) {
    const enabledFeatures = req.user?.enabledFeatures || [];
    return this.calendarService.getSources(enabledFeatures);
  }

  @Get('events')
  @RequirePermissions('view_calendar')
  async getEvents(
    @Request() req: any,
    @Query() query: CalendarEventsQueryDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    const companyId = query.company_id || headerCompanyId;
    const branchId = query.branch_id || headerBranchId;

    return this.calendarService.getAggregatedEvents(
      tenantId,
      userId,
      query,
      companyId,
      branchId,
    );
  }

  @Get('events/:id')
  @RequirePermissions('view_calendar')
  async getEventById(@Request() req: any, @Param('id') id: string) {
    return this.calendarService.findOne(req.user.tenantId, id);
  }

  @Post('events')
  @RequirePermissions('create_calendar_events')
  async createEvent(
    @Request() req: any,
    @Body() dto: CreateCalendarEventDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.calendarService.create(tenantId, userId, dto, headerCompanyId, headerBranchId);
  }

  @Patch('events/:id')
  @RequirePermissions('edit_calendar_events')
  async updateEvent(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.calendarService.update(tenantId, id, userId, dto);
  }

  @Delete('events/:id')
  @RequirePermissions('delete_calendar_events')
  async deleteEvent(@Request() req: any, @Param('id') id: string) {
    return this.calendarService.delete(req.user.tenantId, id);
  }
}
