import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  private async getRepo(tenantId: string): Promise<Repository<CalendarEvent>> {
    const conn = await this.databaseService.getTenantConnectionById(tenantId);
    return conn.getRepository(CalendarEvent);
  }

  async findAll(
    tenantId: string,
    userId: string,
    query: QueryCalendarEventsDto,
    companyId?: string,
    branchId?: string,
  ): Promise<CalendarEvent[]> {
    const repo = await this.getRepo(tenantId);

    const qb = repo.createQueryBuilder('event')
      .where('event.tenantId = :tenantId', { tenantId });

    // Date range filter
    if (query.start) {
      qb.andWhere('event.startDate >= :start', { start: new Date(query.start) });
    }
    if (query.end) {
      qb.andWhere('event.startDate <= :end', { end: new Date(query.end) });
    }

    // Category filter
    if (query.category) {
      qb.andWhere('event.category = :category', { category: query.category });
    }

    // Source module filter (comma-separated)
    if (query.sources) {
      const sourceList = query.sources.split(',').map(s => s.trim()).filter(Boolean);
      if (sourceList.length > 0) {
        qb.andWhere('event.moduleKey IN (:...sources)', { sources: sourceList });
      }
    }

    // Company / Branch scope
    const effectiveCompanyId = query.company_id || companyId;
    const effectiveBranchId = query.branch_id || branchId;

    if (effectiveCompanyId) {
      qb.andWhere(
        '(event.companyId = :companyId OR event.companyId IS NULL)',
        { companyId: effectiveCompanyId },
      );
    }
    if (effectiveBranchId) {
      qb.andWhere(
        '(event.branchId = :branchId OR event.branchId IS NULL)',
        { branchId: effectiveBranchId },
      );
    }

    // My events only (attendee or creator)
    if (query.my_events) {
      qb.andWhere(
        '(event.createdBy = :userId OR JSON_CONTAINS(event.attendeeIds, JSON_QUOTE(:userId)))',
        { userId },
      );
    }

    qb.orderBy('event.startDate', 'ASC');

    return qb.getMany();
  }

  async findOne(tenantId: string, id: string): Promise<CalendarEvent> {
    const repo = await this.getRepo(tenantId);
    const event = await repo.findOne({ where: { id, tenantId } });
    if (!event) throw new NotFoundException(`Calendar event ${id} not found`);
    return event;
  }

  async create(
    tenantId: string,
    userId: string,
    userName: string,
    dto: CreateCalendarEventDto,
    companyId?: string,
    branchId?: string,
  ): Promise<CalendarEvent> {
    const repo = await this.getRepo(tenantId);

    const event = repo.create({
      tenantId,
      companyId: dto.company_id || companyId,
      branchId: dto.branch_id || branchId,
      departmentId: dto.department_id,
      title: dto.title,
      description: dto.description,
      startDate: new Date(dto.start_date),
      endDate: dto.end_date ? new Date(dto.end_date) : null,
      allDay: dto.all_day ?? false,
      category: dto.category ?? 'common',
      moduleKey: dto.module_key ?? null,
      sourceId: dto.source_id ?? null,
      eventType: dto.event_type ?? 'event',
      color: dto.color ?? '#3B82F6',
      location: dto.location,
      routeUrl: dto.route_url,
      recurrenceRule: dto.recurrence_rule,
      isPublic: dto.is_public ?? true,
      attendeeIds: dto.attendee_ids ?? [],
      status: dto.status,
      priority: dto.priority,
      createdBy: userId,
      createdByName: userName,
    });

    return repo.save(event);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEvent> {
    const repo = await this.getRepo(tenantId);
    const event = await this.findOne(tenantId, id);

    // Only creator or admin can edit
    if (event.createdBy !== userId) {
      throw new ForbiddenException('You can only edit events you created');
    }

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.start_date !== undefined) event.startDate = new Date(dto.start_date);
    if (dto.end_date !== undefined) event.endDate = dto.end_date ? new Date(dto.end_date) : null;
    if (dto.all_day !== undefined) event.allDay = dto.all_day;
    if (dto.category !== undefined) event.category = dto.category;
    if (dto.event_type !== undefined) event.eventType = dto.event_type;
    if (dto.color !== undefined) event.color = dto.color;
    if (dto.location !== undefined) event.location = dto.location;
    if (dto.route_url !== undefined) event.routeUrl = dto.route_url;
    if (dto.recurrence_rule !== undefined) event.recurrenceRule = dto.recurrence_rule;
    if (dto.is_public !== undefined) event.isPublic = dto.is_public;
    if (dto.attendee_ids !== undefined) event.attendeeIds = dto.attendee_ids;
    if (dto.status !== undefined) event.status = dto.status;
    if (dto.priority !== undefined) event.priority = dto.priority;

    return repo.save(event);
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    const repo = await this.getRepo(tenantId);
    const event = await this.findOne(tenantId, id);

    if (event.createdBy !== userId) {
      throw new ForbiddenException('You can only delete events you created');
    }

    await repo.remove(event);
  }

  /**
   * Called by other modules (Attendance, Leave, PMS, etc.) to sync their events
   * into the unified calendar. Upserts based on moduleKey + sourceId.
   */
  async upsertModuleEvent(
    tenantId: string,
    companyId: string,
    branchId: string,
    data: {
      moduleKey: string;
      sourceId: string;
      title: string;
      startDate: Date;
      endDate?: Date;
      allDay?: boolean;
      category: 'common' | 'workforce' | 'projects' | 'commercial' | 'financial';
      eventType: string;
      color: string;
      description?: string;
      location?: string;
      routeUrl?: string;
      status?: string;
      createdBy?: string;
      createdByName?: string;
      attendeeIds?: string[];
    },
  ): Promise<CalendarEvent> {
    const repo = await this.getRepo(tenantId);

    let event = await repo.findOne({
      where: { tenantId, moduleKey: data.moduleKey, sourceId: data.sourceId },
    });

    if (!event) {
      event = repo.create({ tenantId, companyId, branchId });
    }

    event.moduleKey = data.moduleKey;
    event.sourceId = data.sourceId;
    event.companyId = companyId;
    event.branchId = branchId;
    event.title = data.title;
    event.startDate = data.startDate;
    event.endDate = data.endDate ?? null;
    event.allDay = data.allDay ?? false;
    event.category = data.category;
    event.eventType = data.eventType;
    event.color = data.color;
    event.description = data.description ?? null;
    event.location = data.location ?? null;
    event.routeUrl = data.routeUrl ?? null;
    event.status = data.status ?? null;
    event.createdBy = data.createdBy ?? null;
    event.createdByName = data.createdByName ?? null;
    event.attendeeIds = data.attendeeIds ?? [];
    event.isPublic = true;

    return repo.save(event);
  }

  /**
   * Remove a module event when the source record is deleted
   */
  async removeModuleEvent(
    tenantId: string,
    moduleKey: string,
    sourceId: string,
  ): Promise<void> {
    const repo = await this.getRepo(tenantId);
    const event = await repo.findOne({ where: { tenantId, moduleKey, sourceId } });
    if (event) await repo.remove(event);
  }
}
