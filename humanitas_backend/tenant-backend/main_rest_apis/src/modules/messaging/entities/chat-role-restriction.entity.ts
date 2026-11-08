import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chat_role_restrictions', { synchronize: false })
export class ChatRoleRestriction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id?: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id?: string;

  @Column({ type: 'varchar', length: 100 })
  role: string;

  @Column({ type: 'boolean', default: true })
  is_restricted: boolean;

  @Column({ type: 'text', nullable: true })
  triage_prompt?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
