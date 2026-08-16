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

@Entity('pms_task_attachments')
export class TaskAttachment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    task_id: string;

    @ManyToOne(() => Task, (task) => task.attachments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ length: 255 })
    file_name: string;

    @Column({ length: 1000 })
    file_url: string;

    @Column({ type: 'uuid' })
    uploaded_by: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'uploaded_by' })
    uploader: User;

    @CreateDateColumn()
    uploaded_at: Date;
}
