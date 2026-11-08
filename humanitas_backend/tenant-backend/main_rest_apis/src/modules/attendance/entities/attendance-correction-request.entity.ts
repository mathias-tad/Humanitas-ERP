import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('attendance_correction_requests')
export class AttendanceCorrectionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string;

  @Index()
  @Column({ name: 'attendance_record_id', type: 'uuid', nullable: true })
  attendanceRecordId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId: string;

  @Column({ name: 'requested_in', type: 'time', nullable: true })
  requestedIn: string;

  @Column({ name: 'requested_out', type: 'time', nullable: true })
  requestedOut: string;

  @Column({ type: 'text' })
  reason: string;

  /** 'pending' | 'approved' | 'rejected' */
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes: string;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
