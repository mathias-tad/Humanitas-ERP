import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('loans')
@Index(['userId'])
@Index(['status'])
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'loan_type', type: 'varchar', length: 100, default: 'personal' })
  loanType: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'monthly_deduction', type: 'decimal', precision: 10, scale: 2 })
  monthlyDeduction: number;

  @Column({ name: 'remaining_balance', type: 'decimal', precision: 10, scale: 2 })
  remainingBalance: number;

  @Column({ name: 'start_month', type: 'int', nullable: true })
  startMonth: number;

  @Column({ name: 'start_year', type: 'int', nullable: true })
  startYear: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string;

  @Column({ name: 'term_months', type: 'int', default: 1 })
  termMonths: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 20, default: 'pending' })
  approvalStatus: string;

  @Column({ name: 'current_step', type: 'int', default: 1 })
  currentStep: number;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
