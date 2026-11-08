import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  ticket_number: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  contact_email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_name: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 50, default: 'general' })
  category: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Index()
  @Column({ type: 'varchar', length: 30, default: 'tenant' })
  created_by_type: string; // 'tenant' | 'ai_on_behalf'

  @Column({ type: 'text', nullable: true })
  ai_conversation_summary: string;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolved_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
