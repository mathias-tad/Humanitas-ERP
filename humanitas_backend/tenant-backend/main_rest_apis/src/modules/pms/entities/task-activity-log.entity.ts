import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Task } from '../../pms/entities/task.entity';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';

export enum ActivityAction {
    CREATE = 'CREATE',
    STATUS_CHANGE = 'STATUS_CHANGE',
    ASSIGN = 'ASSIGN',
    CLAIM_REVIEW = 'CLAIM_REVIEW',
    COMMENT = 'COMMENT', // Generic comment or Rejection reason
    BLOCK = 'BLOCK',
    UNBLOCK = 'UNBLOCK',
    UNDO = 'UNDO',
}

@Entity('pms_task_activity_logs')
export class TaskActivityLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    task_id: string;

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ type: 'uuid' })
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({
        type: 'enum',
        enum: ActivityAction,
    })
    action: ActivityAction;

    @Column({ nullable: true })
    from_value: string;

    @Column({ nullable: true })
    to_value: string;

    @Column({ type: 'text', nullable: true })
    reason: string; // Mandatory for blocks/rejections

    @CreateDateColumn()
    created_at: Date;
}
