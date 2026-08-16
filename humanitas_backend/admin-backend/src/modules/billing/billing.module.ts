import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingService } from './billing.service';
import { PackagesController } from './packages.controller';
import { AiUsageAdminController } from './ai-usage-admin.controller';
import { LemonSqueezyController } from './lemonsqueezy.controller';
import { SubscriptionPackage } from './entities/subscription-package.entity';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPackage, TenantSubscription, AiUsageLog]),
  ],
  controllers: [PackagesController, AiUsageAdminController, LemonSqueezyController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
