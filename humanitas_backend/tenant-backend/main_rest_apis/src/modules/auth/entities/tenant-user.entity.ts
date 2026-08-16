import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

// This entity is used in each TENANT database
// Each tenant has their own users table

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

@Entity('users', { synchronize: false })
export class TenantUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password_hash: string;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 50, default: 'employee' })
  role: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  position: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_password_set: boolean;

  @Column({ nullable: true })
  password_reset_token: string;

  @Column({ type: 'timestamp', nullable: true })
  password_reset_expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ nullable: true })
  refresh_token: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  employee_category_id: string;

  @Column({ nullable: true })
  role_id: string; // Foreign key to roles table

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  desert_allowance_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hardship_allowance_percent: number;

  @ManyToOne('EmployeeCategory', { nullable: true })
  @JoinColumn({ name: 'employee_category_id' })
  category: any; // Using any to avoid circular import issues temporarily

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
