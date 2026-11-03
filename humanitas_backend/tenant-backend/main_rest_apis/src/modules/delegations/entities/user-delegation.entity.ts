import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DelegationScope = 'ALL' | 'APPROVALS' | 'ATTENDANCE' | 'PMS' | string;
export type DelegationStatus = 'active' | 'revoked' | 'expired';

@Entity('user_delegations')
export class UserDelegation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string;

  @Column({ type: 'uuid' })
  delegator_id: string;

  @Column({ type: 'uuid' })
  delegatee_id: string;

  @Column({ type: 'timestamptz' })
  start_date: Date;

  @Column({ type: 'timestamptz' })
  end_date: Date;

  @Column({ type: 'varchar', length: 50, default: 'ALL' })
  scope: DelegationScope;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: DelegationStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  // HR Acting Assignment & Allowance Extension
  @Column({ type: 'boolean', default: false })
  is_acting_assignment: boolean;

  @Column({ type: 'varchar', length: 150, nullable: true })
  acting_position_title?: string;

  @Column({ type: 'varchar', length: 30, default: 'percentage' })
  acting_allowance_type: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0.00 })
  acting_allowance_percentage: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  acting_allowance_amount: number;

  @Column({ type: 'uuid', nullable: true })
  acting_approved_by?: string;

  @Column({ type: 'timestamptz', nullable: true })
  acting_approved_at?: Date;

  @Column({ type: 'text', nullable: true })
  acting_notes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
