import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { Task } from './task.entity';

@Entity('pms_task_time_logs')
export class TaskTimeLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    task_id: string;

    @ManyToOne(() => Task, (task) => task.timeLogs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ type: 'uuid' })
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'timestamp' })
    started_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    ended_at: Date;

    @Column({ type: 'int', comment: 'Duration in minutes' })
    duration_minutes: number;

    @Column({ length: 255, nullable: true })
    description: string;

    @CreateDateColumn()
    created_at: Date;
}
