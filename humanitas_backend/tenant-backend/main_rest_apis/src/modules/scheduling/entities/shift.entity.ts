import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('shifts')
export class Shift {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'time' })
    start_time: string;

    @Column({ type: 'time' })
    end_time: string;

    @Column({ default: '#3B82F6' })
    color: string;

    @Column({ default: false })
    is_overnight: boolean;

    @Column({ nullable: true })
    description: string;

    @Column({ default: 15 })
    grace_minutes: number;

    @Column({ nullable: true })
    wait_for_absent_minutes: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
