import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TenantUser } from '../../auth/entities/tenant-user.entity';

export type ChatAccessGrantStatus = 'pending' | 'approved' | 'rejected' | 'expired';

@Entity('chat_direct_access_grants', { synchronize: false })
export class ChatDirectAccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id?: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id?: string;

  @Column({ type: 'uuid' })
  requester_id: string;

  @Column({ type: 'uuid' })
  target_user_id: string;

  @ManyToOne(() => TenantUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester: TenantUser;

  @ManyToOne(() => TenantUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_user_id' })
  target_user: TenantUser;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ChatAccessGrantStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at?: Date | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  response_note?: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
