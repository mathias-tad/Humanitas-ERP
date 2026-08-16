import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../auth/entities/tenant.entity';

export interface AiMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  created_at: Date;
}

export interface AiConversation {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  messages?: AiMessage[];
}

@Injectable()
export class AiConversationService {
  constructor(
    private databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async getConversations(tenantSlug: string, userId: string): Promise<AiConversation[]> {
    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) return [];
    
    const connection = await this.databaseService.getTenantConnection(tenant.database_name);
    
    const convos = await connection.query(
      `SELECT id, title, created_at, updated_at 
       FROM ai_conversations 
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY updated_at DESC`,
      [tenant.id, userId]
    );
    
    return convos;
  }

  async getConversation(tenantSlug: string, userId: string, conversationId: string): Promise<AiConversation | null> {
    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) return null;
    
    const connection = await this.databaseService.getTenantConnection(tenant.database_name);
    
    const convoQuery = await connection.query(
      `SELECT id, title, created_at, updated_at 
       FROM ai_conversations 
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [conversationId, tenant.id, userId]
    );

    if (!convoQuery.length) return null;

    const messagesQuery = await connection.query(
      `SELECT id, role, content, created_at 
       FROM ai_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      ...convoQuery[0],
      messages: messagesQuery,
    };
  }

  async createConversation(tenantSlug: string, userId: string, title?: string): Promise<AiConversation> {
    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
    const connection = await this.databaseService.getTenantConnection(tenant.database_name);
    
    const result = await connection.query(
      `INSERT INTO ai_conversations (tenant_id, user_id, title) 
       VALUES ($1, $2, $3) RETURNING id, title, created_at, updated_at`,
      [tenant.id, userId, title || 'New Conversation']
    );

    return result[0];
  }

  async saveMessage(tenantSlug: string, conversationId: string, role: string, content: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
    const connection = await this.databaseService.getTenantConnection(tenant.database_name);

    await connection.query(
      `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
      [conversationId, role, content]
    );

    // Update conversation timestamp
    await connection.query(
      `UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );
  }
}
