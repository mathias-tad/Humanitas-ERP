import {
  Controller, Post, Body, Headers, HttpCode, HttpStatus, Req, Logger,
  UnauthorizedException, ServiceUnavailableException, RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
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

/**
 * Verifies a LemonSqueezy webhook signature.
 * LemonSqueezy sends `X-Signature` = hex(HMAC-SHA256(signingSecret, rawBody)).
 */
export function verifyLemonSqueezySignature(
  rawBody: Buffer | string | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature.trim(), 'hex');
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

@Controller('webhooks/lemonsqueezy')
export class LemonSqueezyController {
  private readonly logger = new Logger(LemonSqueezyController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Body() payload: LemonSqueezyWebhookPayload,
    @Headers('x-signature') signature: string,
  ) {
    // ── SECURITY: reject anything not signed by LemonSqueezy (fail closed) ──
    const secret = this.configService.get<string>('LEMONSQUEEZY_WEBHOOK_SECRET') || '';
    if (!secret) {
      this.logger.error('LEMONSQUEEZY_WEBHOOK_SECRET is not set — rejecting webhook.');
      throw new ServiceUnavailableException('Webhook not configured');
    }
    if (!verifyLemonSqueezySignature(req.rawBody, signature, secret)) {
      this.logger.warn('Rejected LemonSqueezy webhook with invalid signature');
      throw new UnauthorizedException('Invalid signature');
    }

    const eventName = payload?.meta?.event_name;
    const tenantId = payload?.meta?.custom_data?.tenant_id;
    const packageId = payload?.meta?.custom_data?.package_id;

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
