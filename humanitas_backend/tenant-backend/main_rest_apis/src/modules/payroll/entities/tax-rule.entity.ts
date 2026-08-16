import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tax_rules')
export class TaxRule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    min_salary: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    max_salary: number; // Null means infinity

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    tax_rate: number; // Percentage (e.g. 10, 15)

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    deductible: number;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
