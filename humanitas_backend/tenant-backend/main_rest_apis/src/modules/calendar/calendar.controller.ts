import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
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
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('calendar')
@RequireModule('calendar')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  @Get('sources')
  @RequirePermissions('view_calendar')
  async getSources(@Request() req: AuthenticatedRequest) {
    // Features the tenant's package enables (empty = unrestricted, as before).
    const tenant = await this.tenantRepository.findOne({ where: { slug: req.user.tenantSlug } });
    const enabledFeatures = (tenant?.enabled_features ?? []).map((f: string) => f.toLowerCase().trim());
    return this.calendarService.getSources(enabledFeatures);
  }

  @Get('events')
  @RequirePermissions('view_calendar')
  async getEvents(
    @Request() req: AuthenticatedRequest,
    @Query() query: CalendarEventsQueryDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub;
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
  async getEventById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.calendarService.findOne(req.user.tenantId, id);
  }

  @Post('events')
  @RequirePermissions('create_calendar_events')
  async createEvent(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCalendarEventDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub;
    return this.calendarService.create(tenantId, userId, dto, headerCompanyId, headerBranchId);
  }

  @Patch('events/:id')
  @RequirePermissions('edit_calendar_events')
  async updateEvent(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub;
    return this.calendarService.update(tenantId, id, userId, dto);
  }

  @Delete('events/:id')
  @RequirePermissions('delete_calendar_events')
  async deleteEvent(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.calendarService.delete(req.user.tenantId, id);
  }
}
