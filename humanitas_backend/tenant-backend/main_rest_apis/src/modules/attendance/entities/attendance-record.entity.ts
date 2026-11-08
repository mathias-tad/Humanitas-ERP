import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

@Entity('attendance_records')
@Unique(['userId', 'date'])
@Index(['userId', 'date'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  date: string;

  /** 'Present' | 'Absent' | 'Late' | 'Leave' | 'Holiday' | 'Incomplete' */
  @Column({ type: 'varchar', length: 20, default: 'Present' })
  status: string;

  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId: string;

  @Column({ name: 'check_in', type: 'timestamp', nullable: true })
  checkIn: Date;

  @Column({ name: 'check_out', type: 'timestamp', nullable: true })
  checkOut: Date;

  /** Actual clock-in time */
  @Column({ name: 'actual_in', type: 'timestamp', nullable: true })
  actualIn: Date;

  /** Actual clock-out time */
  @Column({ name: 'actual_out', type: 'timestamp', nullable: true })
  actualOut: Date;

  /** Expected start time from the employee's shift */
  @Column({ name: 'scheduled_in', type: 'time', nullable: true })
  scheduledIn: string;

  /** Expected end time from the employee's shift */
  @Column({ name: 'scheduled_out', type: 'time', nullable: true })
  scheduledOut: string;

  @Column({ name: 'work_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  workHours: number;

  @Column({ name: 'missed_punch_type', type: 'varchar', length: 20, default: 'none' })
  missedPunchType: string; // 'none' | 'missed_in' | 'missed_out'

  @Column({ name: 'is_overnight', type: 'boolean', default: false })
  isOvernight: boolean;

  @Column({ name: 'overtime_hours', type: 'decimal', precision: 5, scale: 2, default: 0 })
  overtimeHours: number;

  @Column({ name: 'ot_approved', type: 'boolean', default: false })
  otApproved: boolean;

  @Column({ name: 'correction_status', type: 'varchar', length: 20, default: 'none' })
  correctionStatus: string; // 'none' | 'pending' | 'approved' | 'rejected'

  @Column({ name: 'forced_clock_out_by', type: 'uuid', nullable: true })
  forcedClockOutBy: string;

  @Column({ name: 'forced_at', type: 'timestamp with time zone', nullable: true })
  forcedAt: Date;

  @Column({ name: 'in_punch_log_id', type: 'uuid', nullable: true })
  inPunchLogId: string;

  @Column({ name: 'out_punch_log_id', type: 'uuid', nullable: true })
  outPunchLogId: string;

  @Column({ name: 'auto_closed_at', type: 'timestamp with time zone', nullable: true })
  autoClosedAt: Date;

  @Column({ name: 'auto_close_reason', type: 'varchar', length: 100, nullable: true })
  autoCloseReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  /** 'manual' | 'biometric' | 'system' */
  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
