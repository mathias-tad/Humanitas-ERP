import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEmailService } from './notification-email.service';
import { NotificationReportsService } from './notification-reports.service';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTrackingController } from './email-tracking.controller';
import { DatabaseModule } from '../database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RolesModule } from '../roles/roles.module';
import { PushNotificationService } from './push-notification.service';
import { Tenant } from '../auth/entities/tenant.entity';

@Module({
    imports: [
        DatabaseModule,
        RolesModule,
        TypeOrmModule.forFeature([Tenant]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [NotificationsController, EmailTemplatesController, EmailTrackingController],
    providers: [
        NotificationsService,
        NotificationsGateway,
        NotificationEmailService,
        NotificationReportsService,
        EmailTemplatesService,
        PushNotificationService,
    ],
    exports: [
        NotificationsService,
        NotificationsGateway,
        NotificationEmailService,
        NotificationReportsService,
        EmailTemplatesService,
        PushNotificationService,
    ],
})
export class NotificationsModule { }
