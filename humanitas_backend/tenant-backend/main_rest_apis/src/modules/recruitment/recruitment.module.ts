import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { SettingsModule } from '../settings/settings.module';
import { DatabaseModule } from '../database/database.module';
import { HttpModule } from '@nestjs/axios';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { HrmsOnboardingModule } from '../hrms-onboarding/hrms-onboarding.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    SettingsModule, 
    DatabaseModule, 
    HttpModule,
    forwardRef(() => HrmsOnboardingModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [RecruitmentController],
  providers: [RecruitmentService, PermissionsGuard],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}

