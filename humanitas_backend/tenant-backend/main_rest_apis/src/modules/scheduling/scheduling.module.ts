import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { SettingsModule } from '../settings/settings.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant]), SettingsModule, HolidaysModule],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule { }
