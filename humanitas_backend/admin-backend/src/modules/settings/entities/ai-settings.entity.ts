import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_settings')
export class AiSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  tenant_id: string;

  @Column({ default: 'gemini' })
  provider: string; // 'gemini' | 'vertex' | 'openai' | 'anthropic' | 'ollama'

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  api_key_encrypted: string;

  @Column({ nullable: true })
  endpoint_url: string;

  @Column({ nullable: true })
  gcp_project_id: string;

  @Column({ nullable: true })
  gcp_location: string;

  @Column({ default: false })
  is_enabled: boolean;

  @Column({ default: 4096 })
  max_tokens: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.7 })
  temperature: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
