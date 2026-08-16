import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('shift_patterns')
export class ShiftPattern {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column({ type: 'integer' })
    cycle_length_days: number;

    @Column({ type: 'jsonb' })
    shifts: {
        day_number: number;
        shift_id: string | null;
        is_day_off: boolean;
    }[];

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
