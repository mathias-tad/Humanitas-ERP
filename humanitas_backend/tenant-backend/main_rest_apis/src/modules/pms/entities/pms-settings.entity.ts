import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('pms_settings')
export class PMSSettings {
    @PrimaryColumn('uuid')
    tenant_id: string;

    @Column({ default: false })
    enable_budget_tracking: boolean;

    @Column({ default: true })
    enable_hr_integration: boolean;

    @Column({ default: false })
    enable_payroll_integration: boolean;

    @Column({ default: true })
    enable_time_tracking: boolean;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 8.0 })
    default_task_time_estimate: number;

    // KPI Configuration
    @Column({ default: true })
    kpi_include_completion_rate: boolean;

    @Column({ default: true })
    kpi_include_on_time_rate: boolean;

    @Column({ default: true })
    kpi_include_avg_duration: boolean;

    @Column({ default: true })
    kpi_include_overdue_count: boolean;

    @Column({ type: 'int', default: 50 })
    kpi_weight_system: number;

    @Column({ type: 'int', default: 50 })
    kpi_weight_manual: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
