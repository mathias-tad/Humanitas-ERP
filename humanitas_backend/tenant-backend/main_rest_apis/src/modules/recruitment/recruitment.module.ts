import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { SettingsModule } from '../settings/settings.module';
import { DatabaseModule } from '../database/database.module';
import { HttpModule } from '@nestjs/axios';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    SettingsModule, 
    DatabaseModule, 
    HttpModule
  ],
  controllers: [RecruitmentController],
  providers: [RecruitmentService, PermissionsGuard],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
