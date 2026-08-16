import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { Project } from './project.entity';
import { Sprint } from './sprint.entity';
import { TaskComment } from './task-comment.entity';
import { TaskAttachment } from './task-attachment.entity';
import { TaskTimeLog } from './task-time-log.entity';

export enum TaskStatus {
    BACKLOG = 'Backlog',
    TODO = 'To Do',
    IN_PROGRESS = 'In Progress',
    IN_REVIEW = 'In Review',
    BLOCKED = 'Blocked',
    DONE = 'Done',
}

export enum TaskPriority {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High',
    CRITICAL = 'Critical',
}

@Entity('pms_tasks')
export class Task {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid' })
    project_id: string;

    @ManyToOne(() => Project, (project) => project.tasks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column({ type: 'uuid', nullable: true })
    sprint_id: string;

    @ManyToOne(() => Sprint, (sprint) => sprint.tasks, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'sprint_id' })
    sprint: Sprint;

    @Column({ type: 'uuid', nullable: true })
    parent_task_id: string;

    @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'parent_task_id' })
    parentTask: Task;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: TaskStatus,
        default: TaskStatus.BACKLOG,
    })
    status: TaskStatus;

    @Column({
        type: 'enum',
        enum: TaskPriority,
        default: TaskPriority.MEDIUM,
    })
    priority: TaskPriority;

    @Column({ type: 'uuid', nullable: true })
    assignee_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'assignee_id' })
    assignee: User;

    @Column({ type: 'uuid', nullable: true })
    reporter_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'reporter_id' })
    reporter: User;

    @Column({ type: 'uuid', nullable: true })
    team_id: string;

    @ManyToOne('Team', { nullable: true })
    @JoinColumn({ name: 'team_id' })
    team: any;

    // --- WORKFLOW & ACCOUNTABILITY FIELDS ---
    @Column({ type: 'uuid', nullable: true })
    reviewer_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'reviewer_id' })
    reviewer: User;

    @Column({ type: 'timestamp', nullable: true })
    status_changed_at: Date;

    @Column({ type: 'uuid', nullable: true })
    status_changed_by: string; // User ID who changed status

    @Column({ nullable: true })
    previous_status: TaskStatus;

    @Column({ type: 'text', nullable: true })
    return_comment: string; // Reason for rejection or blocking

    @Column({ type: 'varchar', length: 50, nullable: true })
    blocker_category: string; // e.g., 'DEPENDENCY', 'EXTERNAL'
    // ----------------------------------------

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    estimated_hours: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    actual_hours: number;

    @Column({ type: 'date', nullable: true })
    due_date: Date;

    @Column({ type: 'date', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    completed_at: Date;

    // Budget fields (optional, based on tenant settings)
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    estimated_cost: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    actual_cost: number;

    @OneToMany(() => TaskComment, (comment) => comment.task)
    comments: TaskComment[];

    @OneToMany(() => TaskAttachment, (attachment) => attachment.task)
    attachments: TaskAttachment[];

    @OneToMany(() => TaskTimeLog, (log) => log.task)
    timeLogs: TaskTimeLog[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
