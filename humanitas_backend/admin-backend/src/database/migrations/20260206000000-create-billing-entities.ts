import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingEntities20260206000000 implements MigrationInterface {
  name = 'CreateBillingEntities20260206000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_packages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "monthly_price" decimal(10,2) NOT NULL,
        "monthly_token_budget" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_packages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tenant_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "package_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "lemonsqueezy_subscription_id" varchar,
        "current_period_start" TIMESTAMP NOT NULL DEFAULT now(),
        "current_period_end" TIMESTAMP NOT NULL DEFAULT (now() + interval '1 month'),
        "tokens_used_this_period" integer NOT NULL DEFAULT 0,
        "billing_cycle" varchar NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly, yearly
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tenant_subscriptions_tenant_id" UNIQUE ("tenant_id"),
        CONSTRAINT "PK_tenant_subscriptions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_usage_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "user_name" varchar NOT NULL,
        "user_role" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "model" varchar NOT NULL,
        "feature" varchar NOT NULL,
        "prompt_tokens" integer NOT NULL,
        "completion_tokens" integer NOT NULL,
        "total_tokens" integer NOT NULL,
        "cost_usd" decimal(10,4) NOT NULL,
        "duration_ms" integer NOT NULL,
        "status" varchar NOT NULL,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_usage_log_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "FK_tenant_subscriptions_package_id" FOREIGN KEY ("package_id") REFERENCES "subscription_packages"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_subscriptions" DROP CONSTRAINT "FK_tenant_subscriptions_package_id"`);
    await queryRunner.query(`DROP TABLE "ai_usage_log"`);
    await queryRunner.query(`DROP TABLE "tenant_subscriptions"`);
    await queryRunner.query(`DROP TABLE "subscription_packages"`);
  }
}
