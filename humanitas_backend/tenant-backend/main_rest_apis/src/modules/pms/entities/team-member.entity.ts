import {
    Entity,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    PrimaryColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { Team } from './team.entity';

export enum TeamRole {
    LEADER = 'Leader',
    MEMBER = 'Member',
}

@Entity('pms_team_members')
export class TeamMember {
    @PrimaryColumn('uuid')
    team_id: string;

    @PrimaryColumn('uuid')
    user_id: string;

    @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({
        type: 'enum',
        enum: TeamRole,
        default: TeamRole.MEMBER,
    })
    role: TeamRole;

    @CreateDateColumn()
    joined_at: Date;
}
