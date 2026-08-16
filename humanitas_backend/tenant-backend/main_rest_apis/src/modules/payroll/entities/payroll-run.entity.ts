import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('payroll_runs')
@Index(['month', 'year'], { unique: true })
export class PayrollRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage: string;

  @Column({ name: 'total_employees', type: 'int', default: 0 })
  totalEmployees: number;

  @Column({ name: 'total_gross', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalGross: number;

  @Column({ name: 'total_deductions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ name: 'total_net', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalNet: number;

  @Column({ name: 'total_tax', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalTax: number;

  @Column({ name: 'total_pension_employee', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPensionEmployee: number;

  @Column({ name: 'total_pension_employer', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPensionEmployer: number;

  @Column({ name: 'run_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  runAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;
}
