import { MigrationInterface, QueryRunner } from "typeorm";

export class AIUsageLog1784461127275 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS ai_usage_log (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
              user_id VARCHAR(255),
              user_name VARCHAR(255),
              user_role VARCHAR(100),
              provider VARCHAR(50) NOT NULL,
              model VARCHAR(100) NOT NULL,
              feature VARCHAR(100) NOT NULL,
              prompt_tokens INTEGER NOT NULL DEFAULT 0,
              completion_tokens INTEGER NOT NULL DEFAULT 0,
              total_tokens INTEGER NOT NULL DEFAULT 0,
              cost_usd DECIMAL(12, 8) NOT NULL DEFAULT 0,
              duration_ms INTEGER,
              status VARCHAR(20) DEFAULT 'success',
              error_message TEXT,
              created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_log(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_log(tenant_id, user_id);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS ai_usage_log;`);
    }
}
