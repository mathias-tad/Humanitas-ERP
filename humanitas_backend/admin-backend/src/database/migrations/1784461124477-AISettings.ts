import { MigrationInterface, QueryRunner } from "typeorm";

export class AISettings1784461124477 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS ai_settings (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
              provider VARCHAR(50) NOT NULL DEFAULT 'gemini',
              model VARCHAR(100),
              api_key_encrypted TEXT,
              endpoint_url TEXT,
              is_enabled BOOLEAN DEFAULT false,
              max_tokens INTEGER DEFAULT 4096,
              temperature DECIMAL(3,2) DEFAULT 0.7,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(tenant_id)
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS ai_settings;`);
    }
}
