import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MessageEncryptionService } from './encryption/message-encryption.service';
import { MessagingGateway } from './messaging.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
    SendMessageDto, EditMessageDto, ReactMessageDto,
    UpdateGroupDto, AddMembersDto, UpdateMemberRoleDto,
} from './dto/send-message.dto';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { MessageReadReceipt } from './entities/message-read-receipt.entity';
import { MessageSettings } from './entities/message-settings.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { In, ObjectLiteral } from 'typeorm';

@Injectable()
export class MessagingService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly encryptionService: MessageEncryptionService,
        private readonly messagingGateway: MessagingGateway,
    ) { }

    private async getRepo<T extends ObjectLiteral>(tenantId: string, entity: any) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        return connection.getRepository<T>(entity);
    }

    // ─────────────────────────────── CONVERSATIONS ──────────────────────────────

    async createConversation(tenantId: string, userId: string, dto: CreateConversationDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // De-dup direct conversations
        const participantIds = dto.participantIds ?? [];
        if (dto.type === 'direct' && participantIds.length === 1) {
            const targetId = participantIds[0];
            const existing = await connection.query(`
                SELECT c.id FROM conversations c
                JOIN conversation_participants p1 ON p1.conversation_id = c.id
                JOIN conversation_participants p2 ON p2.conversation_id = c.id
                WHERE c.type = 'direct' AND p1.user_id = $1 AND p2.user_id = $2
                LIMIT 1
            `, [userId, targetId]);

            if (existing?.length > 0) {
                const repo = connection.getRepository(Conversation);
                const fullConv = await repo.findOne({
                    where: { id: existing[0].id },
                    relations: ['participants', 'participants.user'],
                });
                if (!fullConv) throw new NotFoundException('Conversation not retrievable');
                return this.formatConversation(fullConv, userId);
            }
        }

        const savedConvId = await connection.transaction(async (manager) => {
            const conv = manager.create(Conversation, {
                type: dto.type,
                tenantId,
                name: dto.name,
                description: dto.description,
                avatarUrl: dto.avatarUrl,
                onlyAdminsCanPost: dto.onlyAdminsCanPost ?? (dto.type === 'channel' || dto.type === 'broadcast'),
                createdById: userId,
                lastMessageAt: new Date(),
            });
            const savedConv = await manager.save(conv);

            // Creator as admin
            await manager.save(ConversationParticipant, {
                conversationId: savedConv.id,
                userId,
                isAdmin: true,
            });

            // Add others
            for (const pId of participantIds.filter(id => id !== userId)) {
                await manager.save(ConversationParticipant, {
                    conversationId: savedConv.id,
                    userId: pId,
                    isAdmin: false,
                });
            }

            return savedConv.id;
        });

        const repo = connection.getRepository(Conversation);
        const fullConv = await repo.findOne({
            where: { id: savedConvId },
            relations: ['participants', 'participants.user'],
        });
        if (!fullConv) throw new NotFoundException('Failed to retrieve created conversation');
        return this.formatConversation(fullConv, userId);
    }

    async getConversations(tenantId: string, userId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const repo = connection.getRepository(Conversation);
        const messageRepo = connection.getRepository(Message);

        const conversations = await repo.createQueryBuilder('conversation')
            .innerJoin('conversation.participants', 'p', 'p.userId = :userId', { userId })
            .leftJoinAndSelect('conversation.participants', 'all_participants')
            .leftJoinAndSelect('all_participants.user', 'user')
            .orderBy('conversation.lastMessageAt', 'DESC')
            .addOrderBy('conversation.updatedAt', 'DESC')
            .getMany();

        return Promise.all(conversations.map(async (c) => {
            const formatted = this.formatConversation(c, userId);

            const lastMessage = await messageRepo.findOne({
                where: { conversationId: c.id, deletedForEveryone: false },
                order: { sentAt: 'DESC' },
                relations: ['sender'],
            });

            if (lastMessage) {
                try {
                    const rawContent = this.encryptionService.decrypt(lastMessage.contentEncrypted, lastMessage.encryptionIv);
                    let displayContent = rawContent;
                    if (lastMessage.messageType === 'voice' || rawContent.includes('::dur:') || rawContent.startsWith('/uploads/')) {
                        displayContent = '🎤 Voice message';
                    } else if (lastMessage.messageType === 'image') {
                        displayContent = '📷 Photo';
                    } else if (lastMessage.messageType === 'file') {
                        displayContent = '📁 Document';
                    } else if (lastMessage.messageType === 'video') {
                        displayContent = '🎥 Video';
                    }

                    formatted['lastMessage'] = {
                        id: lastMessage.id,
                        content: displayContent,
                        senderId: lastMessage.senderId,
                        senderName: lastMessage.sender?.full_name,
                        sentAt: lastMessage.sentAt,
                        messageType: lastMessage.messageType,
                    };
                } catch {
                    formatted['lastMessage'] = { id: lastMessage.id, content: '[Encrypted message]', senderId: lastMessage.senderId, sentAt: lastMessage.sentAt };
                }
            }

            // Unread count
            const unreadResult = await connection.query(`
                SELECT COUNT(*) as count FROM messages m
                WHERE m.conversation_id = $1
                  AND m.sender_id != $2
                  AND m.deleted_for_everyone = false
                  AND NOT EXISTS (
                    SELECT 1 FROM message_read_receipts r
                    WHERE r.message_id = m.id AND r.user_id = $2
                  )
            `, [c.id, userId]);
            formatted['unreadCount'] = parseInt(unreadResult[0]?.count ?? '0');

            return formatted;
        }));
    }

    private formatConversation(conv: Conversation, currentUserId: string) {
        const formatted: any = {
            id: conv.id,
            type: conv.type,
            name: conv.name,
            description: conv.description,
            avatarUrl: conv.avatarUrl,
            onlyAdminsCanPost: conv.onlyAdminsCanPost,
            inviteLink: conv.inviteLink,
            createdById: conv.createdById,
            isArchived: conv.isArchived,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            lastMessageAt: conv.lastMessageAt,
            participants: conv.participants?.map(p => ({
                id: p.id,
                userId: p.userId,
                isAdmin: p.isAdmin,
                joinedAt: p.joinedAt,
                user: p.user ? {
                    id: p.user.id,
                    full_name: p.user.full_name,
                    avatar_url: p.user.avatar_url,
                    email: p.user.email,
                } : null,
            })),
            memberCount: conv.participants?.length ?? 0,
        };

        if (conv.type === 'direct') {
            const other = conv.participants?.find(p => p.userId !== currentUserId);
            formatted.name = other?.user?.full_name ?? 'Unknown User';
            formatted.avatarUrl = other?.user?.avatar_url ?? null;
            formatted.otherUserId = other?.userId;
        }

        // Check if current user is admin in this conversation
        const myParticipant = conv.participants?.find(p => p.userId === currentUserId);
        formatted.isAdmin = myParticipant?.isAdmin ?? false;

        // Can this user send messages?
        formatted.canSendMessages = !conv.onlyAdminsCanPost || (myParticipant?.isAdmin ?? false);

        return formatted;
    }

    async getConversation(tenantId: string, userId: string, conversationId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const repo = connection.getRepository(Conversation);

        const participantRepo = connection.getRepository(ConversationParticipant);
        const membership = await participantRepo.findOne({ where: { conversationId, userId } });
        if (!membership) throw new ForbiddenException('Not a member of this conversation');

        const conv = await repo.findOne({
            where: { id: conversationId },
            relations: ['participants', 'participants.user'],
        });
        if (!conv) throw new NotFoundException('Conversation not found');
        return this.formatConversation(conv, userId);
    }

    async updateConversation(tenantId: string, userId: string, conversationId: string, dto: UpdateGroupDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const participantRepo = connection.getRepository(ConversationParticipant);
        const membership = await participantRepo.findOne({ where: { conversationId, userId } });
        if (!membership?.isAdmin) throw new ForbiddenException('Only admins can update conversation info');

        const convRepo = connection.getRepository(Conversation);
        const updates: Partial<Conversation> = {};
        if (dto.name !== undefined) updates.name = dto.name;
        if (dto.description !== undefined) updates.description = dto.description;
        if (dto.avatarUrl !== undefined) updates.avatarUrl = dto.avatarUrl;
        if (dto.onlyAdminsCanPost !== undefined) updates.onlyAdminsCanPost = dto.onlyAdminsCanPost;

        await convRepo.update(conversationId, updates);
        const updated = await convRepo.findOne({
            where: { id: conversationId },
            relations: ['participants', 'participants.user'],
        });

        const formatted = this.formatConversation(updated!, userId);
        // Notify all participants
        const participants = await participantRepo.find({ where: { conversationId } });
        this.messagingGateway.notifyConversationUpdated(tenantId, conversationId, formatted, participants.map(p => p.userId));

        return formatted;
    }

    async addMembers(tenantId: string, userId: string, conversationId: string, dto: AddMembersDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const participantRepo = connection.getRepository(ConversationParticipant);

        const membership = await participantRepo.findOne({ where: { conversationId, userId } });
        if (!membership?.isAdmin) throw new ForbiddenException('Only admins can add members');

        for (const uid of dto.userIds) {
            const exists = await participantRepo.findOne({ where: { conversationId, userId: uid } });
            if (!exists) {
                await participantRepo.save({ conversationId, userId: uid, isAdmin: false });
            }
        }
        return { success: true };
    }

    async removeMember(tenantId: string, requesterId: string, conversationId: string, targetUserId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const participantRepo = connection.getRepository(ConversationParticipant);

        // Can remove self, or admin can remove others
        const requesterMembership = await participantRepo.findOne({ where: { conversationId, userId: requesterId } });
        if (!requesterMembership) throw new ForbiddenException('Not a member');
        if (requesterId !== targetUserId && !requesterMembership.isAdmin) {
            throw new ForbiddenException('Only admins can remove other members');
        }

        await participantRepo.delete({ conversationId, userId: targetUserId });
        return { success: true };
    }

    async updateMemberRole(tenantId: string, requesterId: string, conversationId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const participantRepo = connection.getRepository(ConversationParticipant);

        const requesterMembership = await participantRepo.findOne({ where: { conversationId, userId: requesterId } });
        if (!requesterMembership?.isAdmin) throw new ForbiddenException('Only admins can change roles');

        await participantRepo.update(
            { conversationId, userId: targetUserId },
            { isAdmin: dto.role === 'admin' },
        );
        return { success: true };
    }

    async searchUsers(tenantId: string, query: string, currentUserId?: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const userRepo = connection.getRepository(TenantUser);

        let qb = userRepo.createQueryBuilder('u')
            .select(['u.id', 'u.full_name', 'u.email', 'u.avatar_url', 'u.role', 'u.department', 'u.position'])
            .where('u.is_active = true');

        if (currentUserId) {
            qb = qb.andWhere('u.id != :currentUserId', { currentUserId });
        }

        if (query && query.trim().length > 0) {
            qb = qb.andWhere(
                '(LOWER(u.full_name) LIKE LOWER(:q) OR LOWER(u.email) LIKE LOWER(:q))',
                { q: `%${query.trim()}%` },
            );
        }

        return qb.orderBy('u.full_name', 'ASC').limit(50).getMany();
    }

    // ─────────────────────────────────── MESSAGES ───────────────────────────────

    async getMessages(tenantId: string, userId: string, conversationId: string) {
        const participantRepo = await this.getRepo<ConversationParticipant>(tenantId, ConversationParticipant);
        const membership = await participantRepo.findOne({ where: { conversationId, userId } });
        if (!membership) throw new ForbiddenException('Not a member of this conversation');

        const messageRepo = await this.getRepo<Message>(tenantId, Message);
        const messages = await messageRepo.find({
            where: { conversationId, deletedForEveryone: false },
            order: { sentAt: 'ASC' },
            relations: ['sender', 'attachments', 'reactions', 'reactions.user', 'readReceipts', 'replyTo', 'replyTo.sender'],
        });

        // Mark conversation as read
        await this.markConversationAsRead(tenantId, userId, conversationId);

        // Filter out messages deleted for this specific user (delete for me)
        // deletedForSender currently means "hidden for everyone" (limitation: single flag)
        // So hide any message with deletedForSender=true from all users' views
        const visibleMessages = messages.filter(msg => !msg.deletedForSender);

        return visibleMessages.map(msg => this.decryptAndFormatMessage(msg, userId));
    }

    async sendMessage(tenantId: string, userId: string, dto: SendMessageDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Check membership
        const participantRepo = connection.getRepository(ConversationParticipant);
        const membership = await participantRepo.findOne({ where: { conversationId: dto.conversationId, userId } });
        if (!membership) throw new ForbiddenException('Not a member of this conversation');

        // Check channel posting restrictions
        const convRepo = connection.getRepository(Conversation);
        const conv = await convRepo.findOne({ where: { id: dto.conversationId } });
        if (conv?.onlyAdminsCanPost && !membership.isAdmin) {
            throw new ForbiddenException('Only admins can post in this conversation');
        }

        const { content, iv } = this.encryptionService.encrypt(dto.content || '');

        const message = await connection.transaction(async (manager) => {
            const msg = manager.create(Message, {
                conversationId: dto.conversationId,
                senderId: userId,
                contentEncrypted: content,
                encryptionIv: iv,
                messageType: dto.messageType || 'text',
                replyToId: dto.replyToId,
                forwardedFromId: dto.forwardedFromId,
            });
            const savedMsg = await manager.save(msg);

            if (dto.attachmentUrl) {
                const attachRepo = manager.getRepository(MessageAttachment);
                const attach = attachRepo.create({
                    messageId: savedMsg.id,
                    fileUrl: dto.attachmentUrl,
                    fileName: dto.attachmentUrl.split('/').pop() || 'file',
                    fileType: dto.messageType || 'file',
                });
                await attachRepo.save(attach);
            }

            await manager.update(Conversation, dto.conversationId, { lastMessageAt: new Date() });
            return savedMsg;
        });

        const messageRepo = connection.getRepository(Message);
        const fullMessage = await messageRepo.findOne({
            where: { id: message.id },
            relations: ['sender', 'attachments', 'readReceipts', 'replyTo', 'replyTo.sender'],
        });

        const formatted = this.decryptAndFormatMessage(fullMessage!);

        // Notify participants
        const participants = await participantRepo.find({ where: { conversationId: dto.conversationId } });
        this.messagingGateway.notifyNewMessage(tenantId, dto.conversationId, formatted, participants.map(p => p.userId));

        return formatted;
    }

    async editMessage(tenantId: string, userId: string, messageId: string, dto: EditMessageDto) {
        const messageRepo = await this.getRepo<Message>(tenantId, Message);
        const msg = await messageRepo.findOne({ where: { id: messageId }, relations: ['sender'] });
        if (!msg) throw new NotFoundException('Message not found');
        if (msg.senderId !== userId) throw new ForbiddenException('Cannot edit other users\' messages');
        if (msg.deletedForEveryone) throw new BadRequestException('Cannot edit deleted message');

        const { content, iv } = this.encryptionService.encrypt(dto.content);
        await messageRepo.update(messageId, {
            contentEncrypted: content,
            encryptionIv: iv,
            isEdited: true,
        } as any);

        const updated = await messageRepo.findOne({
            where: { id: messageId },
            relations: ['sender', 'reactions', 'readReceipts'],
        });
        const formatted = this.decryptAndFormatMessage(updated!);

        // Notify participants
        const participantRepo = await this.getRepo<ConversationParticipant>(tenantId, ConversationParticipant);
        const participants = await participantRepo.find({ where: { conversationId: msg.conversationId } });
        this.messagingGateway.notifyMessageEdited(tenantId, msg.conversationId, formatted, participants.map(p => p.userId));

        return formatted;
    }

    async deleteMessage(tenantId: string, userId: string, messageId: string, forEveryone: boolean) {
        const messageRepo = await this.getRepo<Message>(tenantId, Message);
        const msg = await messageRepo.findOne({ where: { id: messageId } });
        if (!msg) throw new NotFoundException('Message not found');

        const participantRepo = await this.getRepo<ConversationParticipant>(tenantId, ConversationParticipant);
        const membership = await participantRepo.findOne({ where: { conversationId: msg.conversationId, userId } });
        if (!membership) throw new ForbiddenException('Not a member of this conversation');

        const convRepo = await this.getRepo<Conversation>(tenantId, Conversation);
        const conv = await convRepo.findOne({ where: { id: msg.conversationId } });

        if (forEveryone) {
            const isDirectChat = conv?.type === 'direct';
            const isSender = msg.senderId === userId;
            const isAdmin = membership.isAdmin === true;

            // In personal chats, either participant can delete for everyone.
            // In groups/channels, only sender or admin can delete for everyone.
            if (!isDirectChat && !isSender && !isAdmin) {
                throw new ForbiddenException('Only admins can delete others\' messages for everyone');
            }

            await messageRepo.update(messageId, {
                deletedForEveryone: true,
                contentEncrypted: '',
                encryptionIv: '',
            } as any);

            const participants = await participantRepo.find({ where: { conversationId: msg.conversationId } });
            this.messagingGateway.notifyMessageDeleted(
                tenantId,
                msg.conversationId,
                messageId,
                true,
                participants.map(p => p.userId),
            );
        } else {
            await messageRepo.update(messageId, { deletedForSender: true } as any);
            // Notify user's socket so Web client removes it live
            this.messagingGateway.notifyMessageDeleted(
                tenantId,
                msg.conversationId,
                messageId,
                false,
                [userId],
            );
        }

        return { success: true };
    }

    async forwardMessage(tenantId: string, userId: string, messageId: string, targetConversationIds: string[]) {
        const messageRepo = await this.getRepo<Message>(tenantId, Message);
        const original = await messageRepo.findOne({ where: { id: messageId } });
        if (!original || original.deletedForEveryone) throw new NotFoundException('Message not found');

        const decrypted = this.encryptionService.decrypt(original.contentEncrypted, original.encryptionIv);
        const results: any[] = [];

        for (const convId of targetConversationIds) {
            const sent = await this.sendMessage(tenantId, userId, {
                conversationId: convId,
                content: decrypted,
                messageType: original.messageType,
                forwardedFromId: messageId,
            });
            results.push(sent);
        }
        return results;
    }

    async reactToMessage(tenantId: string, userId: string, messageId: string, dto: ReactMessageDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const reactionRepo = connection.getRepository(MessageReaction);
        const messageRepo = connection.getRepository(Message);

        const msg = await messageRepo.findOne({ where: { id: messageId } });
        if (!msg) throw new NotFoundException('Message not found');

        const existing = await reactionRepo.findOne({ where: { messageId, userId } });
        if (existing) {
            if (existing.emoji === dto.emoji) {
                // Toggle off
                await reactionRepo.delete({ messageId, userId });
            } else {
                // Change reaction
                await reactionRepo.update({ messageId, userId }, { emoji: dto.emoji } as any);
            }
        } else {
            await reactionRepo.save({ messageId, userId, emoji: dto.emoji });
        }

        const participantRepo = connection.getRepository(ConversationParticipant);
        const participants = await participantRepo.find({ where: { conversationId: msg.conversationId } });
        const reactions = await reactionRepo.find({ where: { messageId }, relations: ['user'] });
        this.messagingGateway.notifyReactionUpdate(tenantId, msg.conversationId, messageId, reactions, participants.map(p => p.userId));

        return reactions;
    }

    // ────────────────────────────────── SETTINGS ────────────────────────────────

    async getSettings(tenantId: string, userId: string) {
        const settingsRepo = await this.getRepo<MessageSettings>(tenantId, MessageSettings);
        let settings = await settingsRepo.findOne({ where: { userId } });
        if (!settings) {
            settings = await settingsRepo.save(settingsRepo.create({ userId }));
        }
        return settings;
    }

    async updateSettings(tenantId: string, userId: string, dto: Partial<MessageSettings>) {
        const settingsRepo = await this.getRepo<MessageSettings>(tenantId, MessageSettings);
        let settings = await settingsRepo.findOne({ where: { userId } });
        if (!settings) {
            settings = await settingsRepo.save(settingsRepo.create({ userId }));
        }
        await settingsRepo.update({ userId }, dto);
        return settingsRepo.findOne({ where: { userId } });
    }


    // ─────────────────────────────────── READ ───────────────────────────────────

    async markConversationAsRead(tenantId: string, userId: string, conversationId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const messageRepo = connection.getRepository(Message);
        const receiptRepo = connection.getRepository(MessageReadReceipt);

        const messages = await messageRepo.find({
            where: { conversationId },
            select: ['id', 'senderId'],
        });

        const toMark = messages.filter(m => m.senderId !== userId);
        let marked = 0;

        for (const msg of toMark) {
            const exists = await receiptRepo.findOne({ where: { messageId: msg.id, userId } });
            if (!exists) {
                await receiptRepo.save({ messageId: msg.id, userId });
                marked++;
            }
        }

        if (marked > 0) {
            const participantRepo = connection.getRepository(ConversationParticipant);
            const participants = await participantRepo.find({ where: { conversationId } });
            this.messagingGateway.notifyMessagesRead(tenantId, conversationId, userId, participants.map(p => p.userId));
        }

        return { success: true, marked };
    }

    // ─────────────────────────────────── HELPERS ────────────────────────────────

    private decryptAndFormatMessage(msg: Message, requestingUserId?: string): any {
        let content = '';
        if (!msg.deletedForEveryone) {
            try {
                content = this.encryptionService.decrypt(msg.contentEncrypted, msg.encryptionIv);
            } catch {
                content = '[Message could not be decrypted]';
            }
        } else {
            content = '[This message was deleted]';
        }

        let replyTo: any = null;
        if (msg.replyTo) {
            try {
                replyTo = {
                    id: msg.replyTo.id,
                    content: this.encryptionService.decrypt(msg.replyTo.contentEncrypted, msg.replyTo.encryptionIv),
                    senderId: msg.replyTo.senderId,
                    senderName: (msg.replyTo as any).sender?.full_name,
                };
            } catch {
                replyTo = { id: msg.replyTo.id, content: '[Encrypted]', senderId: msg.replyTo.senderId };
            }
        }

        return {
            id: msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            senderName: (msg as any).sender?.full_name,
            senderAvatar: (msg as any).sender?.avatar_url,
            content,
            messageType: msg.messageType,
            sentAt: msg.sentAt,
            updatedAt: msg.updatedAt,
            isDeleted: msg.deletedForEveryone,
            isEdited: (msg as any).isEdited ?? false,
            replyToId: msg.replyToId,
            replyTo,
            forwardedFromId: (msg as any).forwardedFromId,
            attachmentUrl: (msg.attachments && msg.attachments.length > 0) ? msg.attachments[0].fileUrl : undefined,
            attachments: msg.attachments ?? [],
            reactions: (msg.reactions ?? []).map(r => ({
                id: r.id,
                emoji: r.emoji,
                userId: r.userId,
                userName: (r as any).user?.full_name,
            })),
            readReceipts: (msg.readReceipts ?? []).map(r => r.userId),
        };
    }
}
