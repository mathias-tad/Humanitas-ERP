import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('holidays')
export class Holiday {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'date' })
    date: string; // YYYY-MM-DD

    @Column({ nullable: true })
    description: string;

    @Column({ default: true })
    is_recurring: boolean;

    @Column({ default: 'public' }) // 'public', 'company', 'religious'
    type: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
