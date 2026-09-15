import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionPackage } from './entities/subscription-package.entity';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(SubscriptionPackage)
    private packageRepo: Repository<SubscriptionPackage>,
    @InjectRepository(TenantSubscription)
    private subscriptionRepo: Repository<TenantSubscription>,
    @InjectRepository(AiUsageLog)
    private usageLogRepo: Repository<AiUsageLog>,
  ) {}

  // ─── Package CRUD (Super Admin) ────────────────────────────────────────────

  async getAllPackages() {
    return this.packageRepo.find({ order: { sort_order: 'ASC', price_usd: 'ASC' } });
  }

  async getPackageById(id: string) {
    const pkg = await this.packageRepo.findOneBy({ id });
    if (!pkg) throw new NotFoundException('Subscription package not found');
    return pkg;
  }

  async createPackage(dto: Partial<SubscriptionPackage>) {
    const pkg = this.packageRepo.create(dto);
    return this.packageRepo.save(pkg);
  }

  async updatePackage(id: string, dto: Partial<SubscriptionPackage>) {
    await this.packageRepo.update(id, dto);
    return this.packageRepo.findOneBy({ id });
  }

  async deletePackage(id: string) {
    const pkg = await this.packageRepo.findOneBy({ id });
    if (!pkg) throw new NotFoundException('Subscription package not found');
    // Soft delete / deactivate
    pkg.is_active = false;
    return this.packageRepo.save(pkg);
  }

  async getTenantEntitlements(tenantId: string) {
    const sub = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['package'],
    });

    if (!sub || !sub.package || sub.status !== 'active') {
      // Default free entitlements
      return {
        tenant_id: tenantId,
        has_subscription: false,
        package_name: 'None',
        modules: {
          hrms: true,
          attendance: true,
          leave: true,
          payroll: false,
          recruitment: false,
          pms: false,
          products: false,
          inventory: false,
          purchasing: false,
          sales: false,
          pos: false,
          accounting: false,
          ai_help: false,
          ai_documents: false,
          ai_actions: false,
          ai_full: false,
          system: true,
        },
        limits: {
          max_employees: 10,
          max_warehouses: 1,
          max_pos_terminals: 1,
          storage_gb: 5,
          ai_token_limit: 50000,
          ai_tokens_used: sub?.ai_tokens_used_this_period || 0,
        },
      };
    }

    const pkg = sub.package;
    const f = pkg.features || {};

    return {
      tenant_id: tenantId,
      has_subscription: true,
      subscription_id: sub.id,
      package_id: pkg.id,
      package_name: pkg.name,
      status: sub.status,
      current_period_end: sub.current_period_end,
      modules: {
        hrms: f.has_hrms !== false,
        attendance: f.has_attendance !== false,
        leave: f.has_leave !== false,
        payroll: !!f.has_payroll,
        recruitment: !!f.has_recruitment,
        pms: !!f.has_pms,
        products: !!f.has_products,
        inventory: !!f.has_inventory,
        purchasing: !!f.has_purchasing,
        sales: !!f.has_sales,
        pos: !!f.has_pos,
        accounting: !!f.has_accounting,
        ai_help: !!(f.has_ai_help || f.has_ai_full),
        ai_documents: !!(f.has_ai_documents || f.has_ai_full),
        ai_actions: !!(f.has_ai_actions || f.has_ai_full),
        ai_full: !!f.has_ai_full,
        system: true,
      },
      limits: {
        max_employees: pkg.max_employees || 50,
        max_warehouses: pkg.max_warehouses || 1,
        max_pos_terminals: pkg.max_pos_terminals || 1,
        storage_gb: pkg.storage_gb || 10,
        ai_token_limit: pkg.ai_token_limit_per_period || 100000,
        ai_tokens_used: sub.ai_tokens_used_this_period || 0,
      },
    };
  }

  // ─── Tenant Subscription ───────────────────────────────────────────────────

  async getTenantSubscription(tenantId: string): Promise<TenantSubscription> {
    const sub = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['package'],
    });
    if (!sub) throw new NotFoundException('No subscription found for this tenant.');
    return sub;
  }

  async assignPackage(tenantId: string, packageId: string): Promise<TenantSubscription> {
    const pkg = await this.packageRepo.findOneBy({ id: packageId });
    if (!pkg) throw new NotFoundException('Package not found.');

    let sub = await this.subscriptionRepo.findOne({ where: { tenant_id: tenantId } });

    const now = new Date();
    const end = this.calculatePeriodEnd(now, pkg.billing_cycle);

    if (sub) {
      sub.package_id = packageId;
      sub.status = 'active';
      sub.ai_tokens_used_this_period = 0;
      sub.current_period_start = now;
      sub.current_period_end = end;
    } else {
      sub = this.subscriptionRepo.create({
        tenant_id: tenantId,
        package_id: packageId,
        status: 'active',
        ai_tokens_used_this_period: 0,
        current_period_start: now,
        current_period_end: end,
      });
    }

    return this.subscriptionRepo.save(sub);
  }

  // ─── Token Budget ──────────────────────────────────────────────────────────

  async checkTokenBudget(tenantId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const sub = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['package'],
    });

    if (!sub || !sub.package) {
      // No subscription → apply free tier default (50k tokens)
      return { allowed: true, remaining: 50000, limit: 50000 };
    }

    const limit = sub.package.ai_token_limit_per_period;
    const used = sub.ai_tokens_used_this_period;
    const remaining = Math.max(0, limit - used);
    return { allowed: remaining > 0, remaining, limit };
  }

  async incrementTokenUsage(tenantId: string, tokens: number): Promise<void> {
    await this.subscriptionRepo
      .createQueryBuilder()
      .update()
      .set({ ai_tokens_used_this_period: () => `ai_tokens_used_this_period + ${tokens}` })
      .where('tenant_id = :tenantId', { tenantId })
      .execute();
  }

  // ─── Usage Logging ──────────────────────────────────────────────────────────

  async logUsage(payload: Partial<AiUsageLog>): Promise<void> {
    const log = this.usageLogRepo.create(payload);
    await this.usageLogRepo.save(log);

    // Increment the tenant's token counter
    if (payload.tenant_id && payload.total_tokens) {
      await this.incrementTokenUsage(payload.tenant_id, payload.total_tokens);
    }
  }

  async getPlatformSummary() {
    // 1. Get total stats
    const totalStats = await this.usageLogRepo.query(`
      SELECT
        COUNT(DISTINCT tenant_id) as total_tenants,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(*) as total_requests
      FROM ai_usage_log
      WHERE created_at >= date_trunc('month', NOW())
    `);

    // 2. Get per-tenant stats joined with tenants table and subscriptions
    const tenantStats = await this.usageLogRepo.query(`
      SELECT
        u.tenant_id,
        t.company_name as tenant_name,
        SUM(u.total_tokens) as total_tokens,
        SUM(u.cost_usd) as cost_usd,
        COUNT(*) as total_requests,
        COALESCE(s.ai_tokens_used_this_period, 0) as used_this_period,
        COALESCE(p.ai_token_limit_per_period, 50000) as token_limit
      FROM ai_usage_log u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
      LEFT JOIN subscription_packages p ON s.package_id = p.id
      WHERE u.created_at >= date_trunc('month', NOW())
      GROUP BY u.tenant_id, t.company_name, s.ai_tokens_used_this_period, p.ai_token_limit_per_period
      ORDER BY total_tokens DESC
    `);

    // 3. Get feature breakdown per tenant
    const featureStats = await this.usageLogRepo.query(`
      SELECT tenant_id, feature, SUM(total_tokens) as tokens
      FROM ai_usage_log
      WHERE created_at >= date_trunc('month', NOW())
      GROUP BY tenant_id, feature
    `);

    // Group features by tenant
    const featureMap: Record<string, Record<string, number>> = {};
    for (const row of featureStats) {
      if (!featureMap[row.tenant_id]) featureMap[row.tenant_id] = {};
      featureMap[row.tenant_id][row.feature] = Number(row.tokens);
    }

    // Map into expected PlatformSummary interface
    const tenants = tenantStats.map((t: any) => ({
      tenant_id: t.tenant_id,
      tenant_name: t.tenant_name,
      total_tokens_used: Number(t.total_tokens),
      total_cost_usd: Number(t.cost_usd),
      total_requests: Number(t.total_requests),
      token_limit: Number(t.token_limit),
      usage_percent: (Number(t.used_this_period) / Number(t.token_limit)) * 100 || 0,
      feature_breakdown: featureMap[t.tenant_id] || {}
    }));

    const totals = totalStats[0] || {};
    return {
      total_tenants_with_usage: Number(totals.total_tenants || 0),
      total_tokens_used: Number(totals.total_tokens || 0),
      total_cost_usd: Number(totals.total_cost || 0),
      total_requests: Number(totals.total_requests || 0),
      tenants: tenants
    };
  }

  async getTenantUsageSummary(tenantId: string) {
    const result = await this.usageLogRepo.query(`
      SELECT
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as cost_usd,
        COUNT(*) as total_requests,
        feature,
        DATE_TRUNC('day', created_at) as day
      FROM ai_usage_log
      WHERE tenant_id = $1 AND created_at >= date_trunc('month', NOW())
      GROUP BY feature, day
      ORDER BY day DESC
    `, [tenantId]);
    return result;
  }

  async getTenantUserBreakdown(tenantId: string) {
    return this.usageLogRepo.query(`
      SELECT
        user_id, user_name, user_role,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as cost_usd,
        COUNT(*) as requests,
        MAX(created_at) as last_activity
      FROM ai_usage_log
      WHERE tenant_id = $1 AND created_at >= date_trunc('month', NOW())
      GROUP BY user_id, user_name, user_role
      ORDER BY total_tokens DESC
    `, [tenantId]);
  }

  async getUserUsage(tenantId: string, userId: string) {
    return this.usageLogRepo.query(`
      SELECT
        feature,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as cost_usd,
        COUNT(*) as requests,
        MAX(created_at) as last_activity
      FROM ai_usage_log
      WHERE tenant_id = $1 AND user_id = $2 AND created_at >= date_trunc('month', NOW())
      GROUP BY feature
      ORDER BY total_tokens DESC
    `, [tenantId, userId]);
  }

  // ─── Cron: Token Refill ────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTokenRefill(): Promise<void> {
    this.logger.log('Running daily token refill check...');

    const expiredSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: 'active',
        current_period_end: LessThanOrEqual(new Date()),
      },
      relations: ['package'],
    });

    for (const sub of expiredSubscriptions) {
      try {
        const now = new Date();
        const newEnd = this.calculatePeriodEnd(now, sub.package.billing_cycle);

        sub.ai_tokens_used_this_period = 0;
        sub.current_period_start = now;
        sub.current_period_end = newEnd;
        await this.subscriptionRepo.save(sub);

        this.logger.log(`✓ Refilled tokens for tenant ${sub.tenant_id} (cycle: ${sub.package.billing_cycle})`);
      } catch (err) {
        this.logger.error(`Failed to refill tokens for tenant ${sub.tenant_id}`, err.message);
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private calculatePeriodEnd(start: Date, billingCycle: string): Date {
    const end = new Date(start);
    switch (billingCycle) {
      case 'daily':   end.setDate(end.getDate() + 1); break;
      case 'weekly':  end.setDate(end.getDate() + 7); break;
      case 'monthly': end.setMonth(end.getMonth() + 1); break;
      case 'yearly':  end.setFullYear(end.getFullYear() + 1); break;
      default:        end.setMonth(end.getMonth() + 1); // Default monthly
    }
    return end;
  }
}
