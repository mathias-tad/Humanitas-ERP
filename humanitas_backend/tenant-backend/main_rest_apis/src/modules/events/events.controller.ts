import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    @Get()
    @RequirePermissions('view_events')
    async findAll(@Request() req: any) {
        return this.eventsService.findAll(req.user.tenantId);
    }

    @Get(':id')
    @RequirePermissions('view_events')
    async findOne(@Request() req: any, @Param('id') id: string) {
        return this.eventsService.findOne(req.user.tenantId, id);
    }

    @Post()
    @RequirePermissions('create_events')
    async create(@Request() req: any, @Body() dto: CreateEventDto) {
        return this.eventsService.create(req.user.tenantId, req.user.sub, dto);
    }

    @Patch(':id')
    @RequirePermissions('edit_events')
    async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateEventDto) {
        return this.eventsService.update(req.user.tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('delete_events')
    async delete(@Request() req: any, @Param('id') id: string) {
        return this.eventsService.delete(req.user.tenantId, id);
    }
}
