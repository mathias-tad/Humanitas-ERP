import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { PayrollRun } from './payroll-run.entity';

@Entity('payroll_items')
@Index(['payrollRunId'])
@Index(['userId'])
export class PayrollItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payroll_run_id', type: 'uuid', nullable: true })
  payrollRunId: string;

  @ManyToOne(() => PayrollRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'basic_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  basicSalary: number;

  @Column({ name: 'total_allowances', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAllowances: number;

  @Column({ name: 'taxable_allowances', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxableAllowances: number;

  @Column({ name: 'non_taxable_allowances', type: 'decimal', precision: 15, scale: 2, default: 0 })
  nonTaxableAllowances: number;

  @Column({ name: 'pensionable_income', type: 'decimal', precision: 15, scale: 2, default: 0 })
  pensionableIncome: number;

  @Column({ name: 'taxable_income', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxableIncome: number;

  @Column({ name: 'gross_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossSalary: number;

  @Column({ name: 'income_tax', type: 'decimal', precision: 15, scale: 2, default: 0 })
  incomeTax: number;

  @Column({ name: 'pension_employee', type: 'decimal', precision: 15, scale: 2, default: 0 })
  pensionEmployee: number;

  @Column({ name: 'pension_employer', type: 'decimal', precision: 15, scale: 2, default: 0 })
  pensionEmployer: number;

  @Column({ name: 'loan_deduction', type: 'decimal', precision: 15, scale: 2, default: 0 })
  loanDeduction: number;

  @Column({ name: 'late_deduction', type: 'decimal', precision: 15, scale: 2, default: 0 })
  lateDeduction: number;

  @Column({ name: 'other_deductions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  otherDeductions: number;

  @Column({ name: 'total_deductions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ name: 'net_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  netSalary: number;

  @Column({ name: 'days_worked', type: 'int', default: 0 })
  daysWorked: number;

  @Column({ name: 'days_absent', type: 'int', default: 0 })
  daysAbsent: number;

  @Column({ name: 'late_minutes', type: 'int', default: 0 })
  lateMinutes: number;

  @Column({ name: 'allowances_breakdown', type: 'jsonb', default: [] })
  allowancesBreakdown: object[];

  @Column({ name: 'loans_breakdown', type: 'jsonb', default: [] })
  loansBreakdown: object[];

  @Column({ name: 'penalties_breakdown', type: 'jsonb', default: [] })
  penaltiesBreakdown: object[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
