import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';

@Entity('conversation_participants')
export class ConversationParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'conversation_id' })
    conversationId: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'joined_at', default: () => 'CURRENT_TIMESTAMP' })
    joinedAt: Date;

    @Column({ name: 'left_at', nullable: true, type: 'timestamp' })
    leftAt: Date;

    @Column({ name: 'last_read_at', nullable: true, type: 'timestamp' })
    lastReadAt: Date;

    @Column({ name: 'is_admin', default: false })
    isAdmin: boolean;

    @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'conversation_id' })
    conversation: Conversation;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
