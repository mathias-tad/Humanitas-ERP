import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { Task } from './task.entity';

@Entity('pms_task_comments')
export class TaskComment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    task_id: string;

    @ManyToOne(() => Task, (task) => task.comments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ type: 'uuid' })
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'text' })
    content: string;

    @CreateDateColumn()
    created_at: Date;
}
