import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('announcements')
@RequireModule('announcements')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) { }

    @Get()
    @RequirePermissions('view_announcements')
    async findAll(@Request() req: any) {
        return this.announcementsService.findAll(req.user.tenantId);
    }

    @Get(':id')
    @RequirePermissions('view_announcements')
    async findOne(@Request() req: any, @Param('id') id: string) {
        return this.announcementsService.findOne(req.user.tenantId, id);
    }

    @Post()
    @RequirePermissions('create_announcements')
    async create(@Request() req: any, @Body() dto: CreateAnnouncementDto) {
        return this.announcementsService.create(req.user.tenantId, req.user.sub, dto);
    }

    @Patch(':id')
    @RequirePermissions('edit_announcements')
    async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
        return this.announcementsService.update(req.user.tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('delete_announcements')
    async delete(@Request() req: any, @Param('id') id: string) {
        return this.announcementsService.delete(req.user.tenantId, id);
    }
}
