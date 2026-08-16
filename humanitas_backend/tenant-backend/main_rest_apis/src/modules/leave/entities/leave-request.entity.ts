import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('leave_requests')
@Index(['userId'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'leave_type_id', type: 'varchar', length: 100, nullable: true })
  leaveTypeId: string;

  @Column({ name: 'leave_type_name', type: 'varchar', length: 100 })
  leaveTypeName: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'int' })
  days: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  /** Overall status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' */
  @Column({ type: 'varchar', length: 20, default: 'Pending' })
  status: string;

  /** Multi-step workflow status */
  @Column({ name: 'approval_status', type: 'varchar', length: 20, default: 'Pending' })
  approvalStatus: string;

  @Column({ name: 'current_step', type: 'int', default: 0 })
  currentStep: number;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
