import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), DatabaseModule],
  controllers: [SettingsController],
  providers: [SettingsService, PermissionsGuard],
  exports: [SettingsService],
})
export class SettingsModule { }
