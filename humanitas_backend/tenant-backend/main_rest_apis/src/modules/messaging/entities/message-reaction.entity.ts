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

@Entity('message_reactions')
export class MessageReaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'message_id' })
    messageId: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column()
    emoji: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => Message, (message) => message.reactions, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'message_id' })
    message: Message;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
