import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { TenantUser as User } from '../../auth/entities/tenant-user.entity';

@Entity('message_read_receipts')
export class MessageReadReceipt {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'message_id' })
    messageId: string;

    @Column({ name: 'user_id' })
    userId: string;

    @CreateDateColumn({ name: 'read_at' })
    readAt: Date;

    @ManyToOne(() => Message, (message) => message.readReceipts, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'message_id' })
    message: Message;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
