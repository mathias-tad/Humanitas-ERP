import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { Sprint } from './sprint.entity';
import { Task } from './task.entity';
import { ProjectMember } from './project-member.entity';

export enum ProjectStatus {
    PLANNING = 'Planning',
    ACTIVE = 'Active',
    ON_HOLD = 'On Hold',
    COMPLETED = 'Completed',
    ARCHIVED = 'Archived',
}

export enum ProjectPriority {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High',
    CRITICAL = 'Critical',
}

@Entity('pms_projects')
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: ProjectStatus,
        default: ProjectStatus.PLANNING,
    })
    status: ProjectStatus;

    @Column({
        type: 'enum',
        enum: ProjectPriority,
        default: ProjectPriority.MEDIUM,
    })
    priority: ProjectPriority;

    @Column({ type: 'date', nullable: true })
    start_date: Date;

    @Column({ type: 'date', nullable: true })
    target_end_date: Date;

    @Column({ type: 'date', nullable: true })
    actual_end_date: Date;

    // Budget fields (optional, based on tenant settings)
    @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    budget: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    actual_cost: number;

    @Column({ length: 3, default: 'ETB' })
    currency: string;

    @Column({ type: 'uuid', nullable: true })
    manager_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'manager_id' })
    manager: User;

    @Column({ type: 'uuid' })
    created_by: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @Column({ type: 'uuid', nullable: true })
    team_id: string;

    @ManyToOne('Team', { nullable: true })
    @JoinColumn({ name: 'team_id' })
    team: any;

    @OneToMany(() => Sprint, (sprint) => sprint.project)
    sprints: Sprint[];

    @OneToMany(() => Task, (task) => task.project)
    tasks: Task[];

    @OneToMany(() => ProjectMember, (member) => member.project)
    members: ProjectMember[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
