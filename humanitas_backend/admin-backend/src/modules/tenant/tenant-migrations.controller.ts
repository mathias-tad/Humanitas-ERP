import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TenantMigrationsService } from './tenant-migrations.service';

@ApiTags('Tenant Migrations')
@Controller('tenants/migrations')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class TenantMigrationsController {
  constructor(private readonly tenantMigrationsService: TenantMigrationsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get migration status across all tenants or a specific tenant (admin only)' })
  @ApiQuery({ name: 'tenantSlug', required: false })
  async getMigrationStatus(@Query('tenantSlug') tenantSlug?: string) {
    return this.tenantMigrationsService.getMigrationStatus(tenantSlug);
  }

  @Post('run')
  @ApiOperation({ summary: 'Run pending migrations across all tenants or for a specific tenant (admin only)' })
  @ApiQuery({ name: 'tenantSlug', required: false })
  async runMigrations(@Query('tenantSlug') tenantSlug?: string) {
    return this.tenantMigrationsService.runMigrations(tenantSlug);
  }

  @Post('sync-permissions')
  @ApiOperation({ summary: 'Sync new permissions to existing roles across tenants (admin only)' })
  @ApiQuery({ name: 'tenantSlug', required: false })
  async syncPermissions(@Query('tenantSlug') tenantSlug?: string) {
    return this.tenantMigrationsService.syncPermissions(tenantSlug);
  }
}
