import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CalculationStatus {
    PENDING = 'PENDING',
    QUEUED = 'QUEUED',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export enum CalculationType {
    OVERTIME = 'OVERTIME',
    PAYROLL = 'PAYROLL',
    LEAVE_BALANCE = 'LEAVE_BALANCE'
}

@Entity('calculation_logs')
export class CalculationLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    tenant_id: string;

    @Column({ type: 'enum', enum: CalculationType })
    type: CalculationType;

    @Column({ type: 'enum', enum: CalculationStatus, default: CalculationStatus.PENDING })
    status: CalculationStatus;

    @Column('jsonb', { nullable: true })
    payload: any;

    @Column('jsonb', { nullable: true })
    result: any;

    @Column({ nullable: true })
    triggered_by: string; // User ID or 'SYSTEM'

    @CreateDateColumn()
    started_at: Date;

    @Column({ nullable: true })
    completed_at: Date;

    @Column({ nullable: true })
    error_message: string;
}
