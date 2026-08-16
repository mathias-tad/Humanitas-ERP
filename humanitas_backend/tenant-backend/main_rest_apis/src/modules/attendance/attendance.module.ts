import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceGateway } from './attendance.gateway';
import { AttendanceScheduler } from './attendance.scheduler';
import { KeepAliveService } from './keep-alive.service';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SettingsModule } from '../settings/settings.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { PayrollModule } from '../payroll/payroll.module';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Tenant]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    HttpModule,
    forwardRef(() => NotificationsModule),
    SchedulingModule,
    SettingsModule,
    HolidaysModule,
    forwardRef(() => PayrollModule),
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceGateway,
    AttendanceScheduler,
    KeepAliveService,
    PermissionsGuard,
  ],
  exports: [AttendanceService, AttendanceGateway],
})
export class AttendanceModule { }
