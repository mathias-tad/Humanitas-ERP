import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscription_packages')
export class SubscriptionPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // 'Free', 'Starter', 'Pro', 'Enterprise'

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_usd: number;

  @Column({ type: 'varchar', length: 20, default: 'monthly' })
  billing_cycle: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'

  @Column({ type: 'varchar', length: 100, nullable: true })
  lemonsqueezy_variant_id: string;

  @Column({ type: 'int' })
  max_employees: number;

  @Column({ type: 'int' })
  ai_token_limit_per_period: number;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, boolean>; // { "has_payroll": true, "has_recruitment": false }

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
