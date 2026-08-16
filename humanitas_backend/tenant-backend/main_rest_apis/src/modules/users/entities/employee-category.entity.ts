import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('employee_categories')
export class EmployeeCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  slug: string; // management, field, general

  @Column()
  name: string; // Management, Field Worker, General Staff

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  default_transport_allowance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  default_per_diem_fixed: number; // e.g. 1000

  @Column({ default: true })
  use_transport_allowance: boolean;

  @Column({ default: true })
  use_per_diem: boolean; // Controls availability of Per Diem for this category

  // [NEW] Detailed Per Diem Configurations
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  per_diem_no_receipt_fixed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  per_diem_no_receipt_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  per_diem_receipt_fixed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  per_diem_receipt_percent: number;

  // [NEW] Desert Allowance Tiers
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  desert_min_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  desert_mid_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  desert_max_percent: number;

  // [NEW] Hardship Allowance Tiers
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hardship_min_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hardship_mid_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hardship_max_percent: number;

  // [NEW] Transport Allowance Tiers
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  transport_min_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  transport_mid_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  transport_max_percent: number;

  // [NEW] Per Diem Allowance Tiers
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  per_diem_min_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  per_diem_mid_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  per_diem_max_percent: number;

  // [NEW] Default Tier Selections (which tier auto-applies to users)
  @Column({ type: 'varchar', length: 10, default: 'none' })
  desert_default_tier: string; // 'none' | 'min' | 'mid' | 'max'

  @Column({ type: 'varchar', length: 10, default: 'none' })
  hardship_default_tier: string;

  @Column({ type: 'varchar', length: 10, default: 'none' })
  transport_default_tier: string;

  @Column({ type: 'varchar', length: 10, default: 'none' })
  per_diem_default_tier: string;

  @Column({ default: false })
  is_system: boolean; // Prevent deletion of default system categories

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
