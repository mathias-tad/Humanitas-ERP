import {
    Entity,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    PrimaryColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { Project } from './project.entity';

export enum ProjectRole {
    MANAGER = 'Manager',
    LEAD = 'Lead',
    MEMBER = 'Member',
    VIEWER = 'Viewer',
}

@Entity('pms_project_members')
export class ProjectMember {
    @PrimaryColumn('uuid')
    project_id: string;

    @PrimaryColumn('uuid')
    user_id: string;

    @ManyToOne(() => Project, (project) => project.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({
        type: 'enum',
        enum: ProjectRole,
        default: ProjectRole.MEMBER,
    })
    role: ProjectRole;

    @Column({ type: 'boolean', default: false })
    can_create_tasks: boolean;

    @CreateDateColumn()
    joined_at: Date;
}
