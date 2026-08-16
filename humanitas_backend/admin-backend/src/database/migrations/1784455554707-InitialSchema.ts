import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1784455554707 implements MigrationInterface {
    name = 'InitialSchema1784455554707'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenants" ADD "logo_url" character varying`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "subscription_ends_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "stripe_customer_id" character varying`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "stripe_subscription_id" character varying`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "monthly_fee" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "per_user_fee" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD CONSTRAINT "UQ_09f63ed17b2898580d3a379d70a" UNIQUE ("database_name")`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "max_users" SET DEFAULT '50'`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "max_devices" SET DEFAULT '10'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "max_devices" SET DEFAULT '5'`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "max_users" SET DEFAULT '10'`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT "UQ_09f63ed17b2898580d3a379d70a"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "per_user_fee"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "monthly_fee"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "stripe_subscription_id"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "stripe_customer_id"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "subscription_ends_at"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "logo_url"`);
    }

}
