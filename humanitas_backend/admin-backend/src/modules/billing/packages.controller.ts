import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SubscriptionPackage } from './entities/subscription-package.entity';

@Controller('admin/packages')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PackagesController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  getAllPackages() {
    return this.billingService.getAllPackages();
  }

  @Get(':id')
  getPackageById(@Param('id') id: string) {
    return this.billingService.getPackageById(id);
  }

  @Post()
  createPackage(@Body() dto: Partial<SubscriptionPackage>) {
    return this.billingService.createPackage(dto);
  }

  @Patch(':id')
  updatePackage(@Param('id') id: string, @Body() dto: Partial<SubscriptionPackage>) {
    return this.billingService.updatePackage(id, dto);
  }

  @Delete(':id')
  deletePackage(@Param('id') id: string) {
    return this.billingService.deletePackage(id);
  }

  @Get('tenants/:tenantId/entitlements')
  getTenantEntitlements(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantEntitlements(tenantId);
  }

  @Post(':tenantId/assign/:packageId')
  assignPackageToTenant(
    @Param('tenantId') tenantId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.billingService.assignPackage(tenantId, packageId);
  }
}

