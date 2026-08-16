import {
    Entity,
    ManyToOne,
    JoinColumn,
    PrimaryColumn,
    CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Team } from './team.entity';

@Entity('pms_project_teams')
export class ProjectTeam {
    @PrimaryColumn('uuid')
    project_id: string;

    @PrimaryColumn('uuid')
    team_id: string;

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    @CreateDateColumn()
    assigned_at: Date;
}
