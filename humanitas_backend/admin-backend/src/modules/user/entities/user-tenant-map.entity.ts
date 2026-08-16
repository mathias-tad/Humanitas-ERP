import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

@Entity('user_tenant_map')
@Unique(['email', 'tenant_id'])
export class UserTenantMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  email: string;

  @Column()
  password_hash: string;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.user_mappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ nullable: true })
  tenant_user_id: string; // User's ID in the tenant's database

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ default: false })
  email_verified: boolean;

  @Column({ default: false })
  two_factor_enabled: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ nullable: true })
  refresh_token: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
