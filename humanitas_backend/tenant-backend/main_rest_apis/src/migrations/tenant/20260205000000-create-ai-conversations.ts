import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiConversationsAndMessages20260205000000 implements MigrationInterface {
  name = 'CreateAiConversationsAndMessages20260205000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "title" varchar(255) DEFAULT 'New Conversation',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_conversations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "role" varchar(50) NOT NULL, -- 'user', 'ai', 'system'
        "content" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_messages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_messages" ADD CONSTRAINT "FK_ai_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_conversations_user_id" ON "ai_conversations" ("tenant_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_messages" DROP CONSTRAINT "FK_ai_messages_conversation_id"`);
    await queryRunner.query(`DROP INDEX "IDX_ai_conversations_user_id"`);
    await queryRunner.query(`DROP TABLE "ai_messages"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
  }
}
