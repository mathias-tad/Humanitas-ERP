import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvertimeController } from './overtime.controller';
import { OvertimeService } from './overtime.service';
import { DatabaseModule } from '../database/database.module';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { Tenant } from '../auth/entities/tenant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OvertimeScheduler } from './overtime.scheduler';

import { OvertimeWebhookController } from './overtime.webhook.controller';
import { SystemLogsModule } from '../system-logs/system-logs.module';

@Module({
    imports: [
        DatabaseModule,
        TypeOrmModule.forFeature([Tenant]),
        forwardRef(() => NotificationsModule),
        SystemLogsModule
    ],
    controllers: [OvertimeController, OvertimeWebhookController],
    providers: [
        OvertimeService,
        PermissionsGuard,
        Reflector,
        OvertimeScheduler
    ],
    exports: [OvertimeService],
})
export class OvertimeModule { }
