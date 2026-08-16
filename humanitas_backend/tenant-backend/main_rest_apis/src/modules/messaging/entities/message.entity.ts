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
import { Conversation } from './conversation.entity';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';
import { MessageAttachment } from './message-attachment.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageReadReceipt } from './message-read-receipt.entity';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'conversation_id' })
    conversationId: string;

    @Column({ name: 'sender_id', nullable: true })
    senderId: string;

    @Column({ name: 'content_encrypted', nullable: true })
    contentEncrypted: string;

    @Column({ name: 'encryption_iv', nullable: true })
    encryptionIv: string;

    @Column({ name: 'message_type', default: 'text' })
    messageType: string;

    @CreateDateColumn({ name: 'sent_at' })
    sentAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'reply_to_id', nullable: true })
    replyToId: string;

    /** ID of the original message when this was forwarded */
    @Column({ name: 'forwarded_from_id', nullable: true })
    forwardedFromId: string;

    /** True if the sender has edited this message */
    @Column({ name: 'is_edited', default: false })
    isEdited: boolean;

    @Column({ name: 'is_deleted', default: false })
    isDeleted: boolean;

    @Column({ name: 'deleted_for_sender', default: false })
    deletedForSender: boolean;

    @Column({ name: 'deleted_for_everyone', default: false })
    deletedForEveryone: boolean;

    @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'conversation_id' })
    conversation: Conversation;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'sender_id' })
    sender: User;

    @ManyToOne(() => Message, { nullable: true })
    @JoinColumn({ name: 'reply_to_id' })
    replyTo: Message;

    @OneToMany(() => MessageAttachment, (attachment) => attachment.message)
    attachments: MessageAttachment[];

    @OneToMany(() => MessageReaction, (reaction) => reaction.message)
    reactions: MessageReaction[];

    @OneToMany(() => MessageReadReceipt, (receipt) => receipt.message)
    readReceipts: MessageReadReceipt[];
}
