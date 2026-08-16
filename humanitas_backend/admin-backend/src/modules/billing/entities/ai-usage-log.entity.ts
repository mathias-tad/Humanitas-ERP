import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_usage_log')
@Index('idx_ai_usage_tenant', ['tenant_id'])
@Index('idx_ai_usage_created', ['created_at'])
@Index('idx_ai_usage_user', ['tenant_id', 'user_id'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  user_role: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'varchar', length: 100 })
  feature: string; // 'chat' | 'data_query' | 'document' | 'attrition' | 'onboarding'

  @Column({ type: 'int', default: 0 })
  prompt_tokens: number;

  @Column({ type: 'int', default: 0 })
  completion_tokens: number;

  @Column({ type: 'int', default: 0 })
  total_tokens: number;

  @Column({ type: 'decimal', precision: 12, scale: 8, default: 0 })
  cost_usd: number;

  @Column({ type: 'int', nullable: true })
  duration_ms: number;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string; // 'success' | 'error' | 'refused'

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;
}
