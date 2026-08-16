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

@Entity('pms_teams')
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'uuid', nullable: true })
    leader_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'leader_id' })
    leader: User;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @OneToMany('TeamMember', 'team')
    members: any[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
