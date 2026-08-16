import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pms_manual_kpi_scores')
export class ManualKPIScore {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid' })
    metric_id: string; // Foreign key to ManualKPIMetric

    @Column({ type: 'uuid' })
    user_id: string; // Employee being evaluated

    @Column({ type: 'uuid' })
    evaluator_id: string; // Manager performing evaluation

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    score: number;

    @Column()
    period: string; // e.g., "2024-Q1", "2024-01"

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
