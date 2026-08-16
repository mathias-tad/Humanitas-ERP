import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';

@Entity('message_settings')
export class MessageSettings {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'enable_browser_notifications', default: true })
    enableBrowserNotifications: boolean;

    @Column({ name: 'enable_sound', default: true })
    enableSound: boolean;

    @Column({ name: 'notify_on_direct_messages', default: true })
    notifyOnDirectMessages: boolean;

    @Column({ name: 'notify_on_group_messages', default: true })
    notifyOnGroupMessages: boolean;

    @Column({ name: 'notify_on_mentions', default: true })
    notifyOnMentions: boolean;

    @Column({ name: 'notify_on_calls', default: true })
    notifyOnCalls: boolean;

    @Column({ name: 'privacy_mode_enabled', default: false })
    privacyModeEnabled: boolean;

    @Column({ name: 'allow_messages_from', default: 'everyone' })
    allowMessagesFrom: string;

    @Column({ name: 'message_retention_days', nullable: true })
    messageRetentionDays: number;

    @Column({ name: 'show_read_receipts', default: true })
    showReadReceipts: boolean;

    @Column({ name: 'show_typing_indicators', default: true })
    showTypingIndicators: boolean;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @OneToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;
}
