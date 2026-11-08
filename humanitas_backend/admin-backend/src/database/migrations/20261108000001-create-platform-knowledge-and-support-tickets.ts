import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlatformKnowledgeAndSupportTickets20261108000001 implements MigrationInterface {
    name = 'CreatePlatformKnowledgeAndSupportTickets20261108000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS platform_knowledge (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                category VARCHAR(50) NOT NULL DEFAULT 'general',
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                tags JSONB NOT NULL DEFAULT '[]'::jsonb,
                is_published BOOLEAN NOT NULL DEFAULT true,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_platform_knowledge_category ON platform_knowledge(category);
            CREATE INDEX IF NOT EXISTS idx_platform_knowledge_is_published ON platform_knowledge(is_published);

            CREATE TABLE IF NOT EXISTS support_tickets (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_number VARCHAR(50) NOT NULL UNIQUE,
                subject VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                contact_email VARCHAR(255) NOT NULL,
                contact_name VARCHAR(255),
                tenant_id UUID,
                category VARCHAR(50) NOT NULL DEFAULT 'general',
                priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                created_by_type VARCHAR(30) NOT NULL DEFAULT 'tenant',
                ai_conversation_summary TEXT,
                resolution_notes TEXT,
                resolved_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);
            CREATE INDEX IF NOT EXISTS idx_support_tickets_contact_email ON support_tickets(contact_email);
            CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
            CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_type ON support_tickets(created_by_type);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE IF EXISTS support_tickets;
            DROP TABLE IF EXISTS platform_knowledge;
        `);
    }
}
