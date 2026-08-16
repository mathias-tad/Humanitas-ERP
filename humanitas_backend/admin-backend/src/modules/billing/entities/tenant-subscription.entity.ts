import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SubscriptionPackage } from './subscription-package.entity';

@Entity('tenant_subscriptions')
export class TenantSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  tenant_id: string;

  @ManyToOne(() => SubscriptionPackage)
  @JoinColumn({ name: 'package_id' })
  package: SubscriptionPackage;

  @Column({ type: 'uuid', nullable: true })
  package_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lemonsqueezy_subscription_id: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string; // 'active' | 'past_due' | 'canceled' | 'trialing'

  @Column({ type: 'int', default: 0 })
  ai_tokens_used_this_period: number;

  @Column({ type: 'timestamp', nullable: true })
  current_period_start: Date;

  @Column({ type: 'timestamp', nullable: true })
  current_period_end: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
