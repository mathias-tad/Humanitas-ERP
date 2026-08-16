import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../auth/entities/tenant.entity';

@Module({
    imports: [
        DatabaseModule,
        NotificationsModule,
        TypeOrmModule.forFeature([Tenant]),
    ],
    controllers: [AnnouncementsController],
    providers: [AnnouncementsService],
    exports: [AnnouncementsService],
})
export class AnnouncementsModule { }
