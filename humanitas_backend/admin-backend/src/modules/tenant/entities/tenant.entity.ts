import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserTenantMap } from '../../user/entities/user-tenant-map.entity';

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELED = 'canceled',
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  company_name: string;

  @Column({ unique: true })
  database_name: string;

  @Column()
  contact_email: string;

  @Column({ nullable: true })
  contact_phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postal_code: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  subscription_status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.BASIC,
  })
  subscription_plan: SubscriptionPlan;

  @Column({ type: 'timestamp', nullable: true })
  subscription_started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  subscription_ends_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  trial_ends_at: Date;

  @Column({ nullable: true })
  stripe_customer_id: string;

  @Column({ nullable: true })
  stripe_subscription_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthly_fee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  per_user_fee: number;

  @Column({ default: 50 })
  max_users: number;

  @Column({ default: 0 })
  current_users: number;

  @Column({ default: 10 })
  max_devices: number;

  @Column({ default: 0 })
  current_devices: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10 })
  storage_limit_gb: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  storage_used_gb: number;

  @Column('simple-array', { nullable: true })
  enabled_features: string[];

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'YYYY-MM-DD' })
  date_format: string;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_setup_complete: boolean;

  @Column({ nullable: true })
  setup_token: string;

  @Column({ type: 'timestamp', nullable: true })
  setup_token_expires_at: Date;

  @OneToMany(() => UserTenantMap, (userTenant) => userTenant.tenant)
  user_mappings: UserTenantMap[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
