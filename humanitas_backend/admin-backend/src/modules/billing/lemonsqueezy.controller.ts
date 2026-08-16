import {
  Controller, Post, Body, Headers, HttpCode, HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: {
      tenant_id?: string;
      package_id?: string;
    };
  };
  data: {
    attributes: {
      status: string;
      variant_id?: string;
      ends_at?: string;
      renews_at?: string;
    };
    id: string;
  };
}

@Controller('webhooks/lemonsqueezy')
export class LemonSqueezyController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: LemonSqueezyWebhookPayload,
    @Headers('x-signature') signature: string,
  ) {
    const eventName = payload?.meta?.event_name;
    const tenantId = payload?.meta?.custom_data?.tenant_id;
    const packageId = payload?.meta?.custom_data?.package_id;
    const lsSubId = payload?.data?.id;

    if (!tenantId) {
      return { received: true, processed: false, reason: 'No tenant_id in custom_data' };
    }

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        if (packageId) {
          await this.billingService.assignPackage(tenantId, packageId);
        }
        break;

      case 'subscription_resumed':
        // Re-activate tenant subscription
        if (packageId) {
          await this.billingService.assignPackage(tenantId, packageId);
        }
        break;

      case 'subscription_expired':
      case 'subscription_cancelled':
      case 'subscription_payment_failed': {
        // Downgrade to free package
        const freePackages = await this.billingService.getAllPackages();
        const freePkg = freePackages.find(p => p.name.toLowerCase() === 'free');
        if (freePkg) {
          await this.billingService.assignPackage(tenantId, freePkg.id);
        }
        break;
      }

      default:
        // Event not handled — still return 200 to LemonSqueezy
        break;
    }

    return { received: true, event: eventName };
  }
}
