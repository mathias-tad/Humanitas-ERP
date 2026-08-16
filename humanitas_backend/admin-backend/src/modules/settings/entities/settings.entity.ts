import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // General Settings
  @Column({ default: 'HRM SaaS' })
  platform_name: string;

  @Column({ default: 'yoursaas.com' })
  domain: string;

  @Column({ default: 'support@yoursaas.com' })
  support_email: string;

  @Column({ default: 14 })
  default_trial_days: number;

  @Column({ default: 1000 })
  max_tenants: number;

  // Email Settings
  @Column({ nullable: true })
  smtp_host: string;

  @Column({ nullable: true })
  smtp_port: number;

  @Column({ nullable: true })
  smtp_username: string;

  @Column({ nullable: true })
  smtp_password: string;

  @Column({ nullable: true })
  from_email: string;

  // Database Settings
  @Column({ default: 'localhost' })
  db_host: string;

  @Column({ default: 5432 })
  db_port: number;

  @Column({ default: 'master_db' })
  master_db_name: string;

  @Column({ default: 'tenant_' })
  tenant_db_prefix: string;

  // Security Settings
  @Column({ default: 60 })
  session_timeout_minutes: number;

  @Column({ default: 5 })
  max_login_attempts: number;

  @Column({ default: 8 })
  password_min_length: number;

  @Column({ default: 15 })
  lockout_duration_minutes: number;

  @Column({ default: false })
  require_2fa_for_admins: boolean;

  // Services Settings (Redis, Calculation Service)
  @Column({ nullable: true })
  redis_url: string;

  @Column({ default: false })
  redis_enabled: boolean;

  @Column({ default: 'http://localhost:8000' })
  calculation_service_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
