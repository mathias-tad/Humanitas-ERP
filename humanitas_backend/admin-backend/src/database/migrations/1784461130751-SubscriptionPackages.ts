import { MigrationInterface, QueryRunner } from "typeorm";

export class SubscriptionPackages1784461130751 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS subscription_packages (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(100) NOT NULL,
              price_usd DECIMAL(10, 2) NOT NULL,
              billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
              lemonsqueezy_variant_id VARCHAR(100),
              max_employees INTEGER NOT NULL,
              ai_token_limit_per_period INTEGER NOT NULL,
              features JSONB,
              is_active BOOLEAN DEFAULT true
            );

            CREATE TABLE IF NOT EXISTS tenant_subscriptions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
              package_id UUID REFERENCES subscription_packages(id),
              lemonsqueezy_subscription_id VARCHAR(100),
              status VARCHAR(50) DEFAULT 'active',
              ai_tokens_used_this_period INTEGER DEFAULT 0,
              current_period_start TIMESTAMP,
              current_period_end TIMESTAMP
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS tenant_subscriptions;`);
        await queryRunner.query(`DROP TABLE IF EXISTS subscription_packages;`);
    }
}
