import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface PackageFeaturesConfig {
  // HRMS Suite
  has_hrms?: boolean;
  has_payroll?: boolean;
  has_recruitment?: boolean;
  has_attendance?: boolean;
  has_leave?: boolean;
  has_pms?: boolean;
  // ERP Core Operations
  has_products?: boolean;
  has_inventory?: boolean;
  has_purchasing?: boolean;
  has_sales?: boolean;
  has_pos?: boolean;
  has_accounting?: boolean;
  // AI Intelligence Suite
  has_ai_help?: boolean;
  has_ai_documents?: boolean;
  has_ai_actions?: boolean;
  has_ai_full?: boolean;
  // System & Extra
  has_system_logs?: boolean;
  has_api_access?: boolean;
  has_custom_reports?: boolean;
  [key: string]: any;
}

@Entity('subscription_packages')
export class SubscriptionPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // 'Free', 'Starter', 'Pro', 'Enterprise'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_usd: number;

  @Column({ type: 'varchar', length: 20, default: 'monthly' })
  billing_cycle: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'

  @Column({ type: 'varchar', length: 100, nullable: true })
  lemonsqueezy_variant_id: string;

  @Column({ type: 'int', default: 50 })
  max_employees: number;

  @Column({ type: 'int', default: 1 })
  max_warehouses: number;

  @Column({ type: 'int', default: 1 })
  max_pos_terminals: number;

  @Column({ type: 'int', default: 10 })
  storage_gb: number;

  @Column({ type: 'int', default: 100000 })
  ai_token_limit_per_period: number;

  @Column({ type: 'jsonb', nullable: true })
  features: PackageFeaturesConfig;

  @Column({ type: 'boolean', default: false })
  is_popular: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
