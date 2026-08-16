import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';

@Entity('per_diem_claims')
export class PerDiemClaim {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'int' })
    month: number; // 1-12

    @Column({ type: 'int' })
    year: number;

    @Column({ type: 'boolean', default: false })
    has_receipt: boolean;

    @Column({ type: 'varchar', length: 500, nullable: true })
    receipt_file_url: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    receipt_amount: number | null;

    @Column({ type: 'timestamp', nullable: true })
    receipt_uploaded_at: Date | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    calculated_amount: number | null;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string; // 'pending', 'approved', 'processed'

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
