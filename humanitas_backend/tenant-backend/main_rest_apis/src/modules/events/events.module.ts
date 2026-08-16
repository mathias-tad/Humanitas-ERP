import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
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
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }
