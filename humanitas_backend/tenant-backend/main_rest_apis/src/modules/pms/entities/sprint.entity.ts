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
import { Project } from './project.entity';
import { Task } from './task.entity';

export enum SprintStatus {
    PLANNING = 'Planning',
    ACTIVE = 'Active',
    COMPLETED = 'Completed',
    CANCELLED = 'Cancelled',
}

@Entity('pms_sprints')
export class Sprint {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid' })
    project_id: string;

    @ManyToOne(() => Project, (project) => project.sprints, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    goal: string;

    @Column({ type: 'date' })
    start_date: Date;

    @Column({ type: 'date' })
    end_date: Date;

    @Column({
        type: 'enum',
        enum: SprintStatus,
        default: SprintStatus.PLANNING,
    })
    status: SprintStatus;

    @OneToMany(() => Task, (task) => task.sprint)
    tasks: Task[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
