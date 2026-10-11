import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';
import { TenantMigrationService } from './tenant-migration.service';
import { TenantMigrationsService } from './tenant-migrations.service';
import { TenantMigrationsController } from './tenant-migrations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [TenantController, TenantMigrationsController],
  providers: [TenantService, TenantMigrationService, TenantMigrationsService],
  exports: [TenantService, TenantMigrationService],
})
export class TenantModule {}
