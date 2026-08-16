import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
} from 'typeorm';

@Entity('schedules')
@Unique(['user_id', 'date']) // One schedule per user per day
export class Schedule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'uuid', nullable: true })
    shift_id: string; // Null if day off

    @Column({ type: 'date' })
    date: string; // YYYY-MM-DD

    @Column({ default: false })
    is_day_off: boolean;

    @Column({ default: false })
    is_override: boolean; // True if this was manually changed from a pattern

    @Column({ nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
