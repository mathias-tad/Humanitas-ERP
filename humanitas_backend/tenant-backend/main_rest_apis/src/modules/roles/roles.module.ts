import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), DatabaseModule, HolidaysModule],
  controllers: [RolesController],
  providers: [RolesService, PermissionsGuard],
  exports: [RolesService],
})
export class RolesModule { }
