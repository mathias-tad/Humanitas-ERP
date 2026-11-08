import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('biometric_punch_logs')
export class BiometricPunchLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string;

  @Column({ name: 'device_serial_number', type: 'varchar', length: 100, nullable: true })
  deviceSerialNumber: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  pin: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @Index()
  @Column({ name: 'punch_time', type: 'timestamp with time zone' })
  punchTime: Date;

  /** 'auto' | 'in' | 'out' | 'break_in' | 'break_out' */
  @Column({ name: 'punch_type', type: 'varchar', length: 50, default: 'auto' })
  punchType: string;

  /** 'fingerprint' | 'face' | 'palm' | 'card' | 'qr' | 'manual' */
  @Column({ name: 'verify_method', type: 'varchar', length: 50, default: 'fingerprint' })
  verifyMethod: string;

  /** 'processed' | 'debounced_duplicate' | 'unmatched_user' | 'error' */
  @Index()
  @Column({ type: 'varchar', length: 50, default: 'processed' })
  status: string;

  @Column({ name: 'raw_payload', type: 'text', nullable: true })
  rawPayload: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
