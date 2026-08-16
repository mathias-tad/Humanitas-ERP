import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('loan_workflows')
export class LoanWorkflow {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    tenant_id: string;

    @Column({ type: 'int' })
    step_order: number;

    @Column()
    role_required: string;

    @Column({ type: 'boolean', default: false })
    is_final: boolean;

    @CreateDateColumn()
    created_at: Date;
}
