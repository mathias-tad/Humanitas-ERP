import {
  Controller, Get, Post, Patch, Body, Param, UseGuards,
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

  @Post()
  createPackage(@Body() dto: Partial<SubscriptionPackage>) {
    return this.billingService.createPackage(dto);
  }

  @Patch(':id')
  updatePackage(@Param('id') id: string, @Body() dto: Partial<SubscriptionPackage>) {
    return this.billingService.updatePackage(id, dto);
  }

  @Post(':tenantId/assign/:packageId')
  assignPackageToTenant(
    @Param('tenantId') tenantId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.billingService.assignPackage(tenantId, packageId);
  }
}
