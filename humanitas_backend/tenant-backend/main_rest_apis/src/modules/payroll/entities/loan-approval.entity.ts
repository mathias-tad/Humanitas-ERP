import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('loan_approvals')
export class LoanApproval {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    loan_id: string;

    @Column({ type: 'int' })
    step_number: number;

    @Column()
    approver_id: string;

    @Column({ type: 'varchar', length: 20 })
    status: 'approved' | 'rejected';

    @Column({ type: 'text', nullable: true })
    comment: string;

    @CreateDateColumn()
    created_at: Date;
}
