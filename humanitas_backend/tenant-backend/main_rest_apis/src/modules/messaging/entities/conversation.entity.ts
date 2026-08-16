import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { ConversationParticipant } from './conversation-participant.entity';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'tenant_id', nullable: true })
    tenantId: string;

    /** direct | group | channel | broadcast */
    @Column({ default: 'direct' })
    type: string;

    /** Display name (required for group / channel / broadcast) */
    @Column({ nullable: true })
    name: string;

    @Column({ nullable: true, type: 'text' })
    description: string;

    /** Avatar / icon URL */
    @Column({ name: 'avatar_url', nullable: true })
    avatarUrl: string;

    /** Only admins/owners can post – used for channels & broadcast */
    @Column({ name: 'only_admins_can_post', default: false })
    onlyAdminsCanPost: boolean;

    /** Invite link slug (channels) */
    @Column({ name: 'invite_link', nullable: true })
    inviteLink: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'last_message_at', nullable: true, type: 'timestamp' })
    lastMessageAt: Date;

    @Column({ name: 'is_archived', default: false })
    isArchived: boolean;

    @Column({ name: 'created_by_id', nullable: true })
    createdById: string;

    @OneToMany(
        () => ConversationParticipant,
        (participant) => participant.conversation,
    )
    participants: ConversationParticipant[];

    @OneToMany(() => Message, (message) => message.conversation)
    messages: Message[];
}
