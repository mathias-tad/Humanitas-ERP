import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('message_attachments')
export class MessageAttachment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'message_id' })
    messageId: string;

    @Column({ name: 'file_url' })
    fileUrl: string;

    @Column({ name: 'file_type', nullable: true })
    fileType: string;

    @Column({ name: 'file_name', nullable: true })
    fileName: string;

    @Column({ name: 'file_size', nullable: true })
    fileSize: number;

    @CreateDateColumn({ name: 'uploaded_at' })
    uploadedAt: Date;

    @ManyToOne(() => Message, (message) => message.attachments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'message_id' })
    message: Message;
}
