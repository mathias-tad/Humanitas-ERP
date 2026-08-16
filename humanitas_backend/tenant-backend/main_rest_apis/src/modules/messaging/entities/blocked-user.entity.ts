import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';

@Entity('blocked_users')
export class BlockedUser {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'blocker_id' })
    blockerId: string;

    @Column({ name: 'blocked_id' })
    blockedId: string;

    @CreateDateColumn({ name: 'blocked_at' })
    blockedAt: Date;

    @Column({ nullable: true })
    reason: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blocker_id' })
    blocker: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blocked_id' })
    blockedUser: User;
}
