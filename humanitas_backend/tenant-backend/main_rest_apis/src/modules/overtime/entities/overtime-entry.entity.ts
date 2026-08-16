import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

@Entity('overtime_entries')
@Unique(['userId', 'date'])
@Index(['userId'])
export class OvertimeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'attendance_id', type: 'uuid', nullable: true })
  attendanceId: string;

  @Column({ type: 'date' })
  date: string;

  /** Overtime hours on a regular weekday (1.25× rate) */
  @Column({ name: 'normal_ot_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  normalOtHours: number;

  /** Overtime hours between 22:00–06:00 (1.5× rate) */
  @Column({ name: 'night_ot_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  nightOtHours: number;

  /** Overtime hours on an official public holiday (2.5× rate) */
  @Column({ name: 'holiday_ot_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  holidayOtHours: number;

  /** Overtime hours on a scheduled day-off (2× rate) */
  @Column({ name: 'dayoff_ot_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  dayoffOtHours: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  /** 'Pending' | 'Approved' | 'Rejected' */
  @Column({ type: 'varchar', length: 20, default: 'Pending' })
  status: string;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: string;

  @Column({ name: 'period_label', type: 'varchar', length: 20, nullable: true })
  periodLabel: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
