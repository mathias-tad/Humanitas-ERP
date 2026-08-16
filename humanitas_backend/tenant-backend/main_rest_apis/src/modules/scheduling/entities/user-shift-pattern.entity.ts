import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
} from 'typeorm';

@Entity('user_shift_patterns')
@Unique(['user_id'])
export class UserShiftPattern {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'uuid' })
    pattern_id: string;

    @Column({ type: 'date' })
    start_date: string; // Date when the pattern cycle starts (Day 1)

    @Column({ nullable: true, type: 'date' })
    end_date: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
