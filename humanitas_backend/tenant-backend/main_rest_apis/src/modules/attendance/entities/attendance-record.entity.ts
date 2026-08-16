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

  /** 'Present' | 'Absent' | 'Late' | 'Leave' | 'Holiday' */
  @Column({ type: 'varchar', length: 20, default: 'Present' })
  status: string;

  @Column({ name: 'check_in', type: 'timestamp', nullable: true })
  checkIn: Date;

  @Column({ name: 'check_out', type: 'timestamp', nullable: true })
  checkOut: Date;

  /** Actual clock-in time (time only, stored for late calculation) */
  @Column({ name: 'actual_in', type: 'time', nullable: true })
  actualIn: string;

  /** Expected start time from the employee's shift */
  @Column({ name: 'scheduled_in', type: 'time', nullable: true })
  scheduledIn: string;

  @Column({ name: 'work_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  workHours: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  /** 'manual' | 'biometric' | 'system' */
  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
