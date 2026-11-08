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
import { ChatRoleRestriction } from './entities/chat-role-restriction.entity';
import { ChatDirectAccessGrant } from './entities/chat-direct-access-grant.entity';
import { RequestChatAccessDto, RespondChatAccessDto, SetRoleRestrictionsDto, GrantDirectAccessDto } from './dto/chat-access-grant.dto';
import { In, Not, ObjectLiteral } from 'typeorm';

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
            const access = await this.checkDirectChatAccess(tenantId, userId, targetId);
            if (!access.canChat) {
                throw new ForbiddenException({
                    code: 'DIRECT_CHAT_RESTRICTED',
                    message: 'Direct messaging to this role is restricted.',
                    details: access,
                });
            }
            const existing = await connection.query(`
                SELECT c.id FROM conversations c
                JOIN conversation_participants p1 ON p1.conversation_id = c.id
                JOIN conversation_participants p2 ON p2.conversation_id = c.id
                WHERE c.type = 'direct' AND p1.user_id = $1 AND p2.user_id = $2
                LIMIT 1
            `, [userId, targetId]);

            
            // If creator has a restricted role, auto-permit the other user to reply
            try {
                const restrictionRepo = connection.getRepository(ChatRoleRestriction);
                const userRepo = connection.getRepository(TenantUser);
                const creator = await userRepo.findOne({ where: { id: userId } });
                if (creator) {
                    const restriction = await restrictionRepo.findOne({
                        where: { role: creator.role, is_restricted: true }
                    });
                    if (restriction && !creator.allow_direct_chat_override) {
                        const grantRepo = connection.getRepository(ChatDirectAccessGrant);
                        let existingGrant = await grantRepo.findOne({
                            where: { requester_id: targetId, target_user_id: userId }
                        });
                        if (existingGrant) {
                            existingGrant.status = 'approved';
                            existingGrant.expires_at = null;
                            existingGrant.updated_at = new Date();
                            await grantRepo.save(existingGrant);
                        } else {
                            const newGrant = grantRepo.create({
                                requester_id: targetId,
                                target_user_id: userId,
                                status: 'approved',
                                expires_at: null,
                                reason: `Direct conversation initiated by ${creator.full_name}`,
                                created_at: new Date(),
                                updated_at: new Date(),
                            });
                            await grantRepo.save(newGrant);
                        }
                    }
                }
            } catch (e) {
                // Non-blocking auto grant
            }

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

        if (conv?.type === 'direct') {
            const otherParticipant = await participantRepo.findOne({
                where: { conversationId: dto.conversationId, userId: Not(userId) },
            });
            if (otherParticipant) {
                const access = await this.checkDirectChatAccess(tenantId, userId, otherParticipant.userId);
                if (!access.canChat) {
                    throw new ForbiddenException({
                        code: 'DIRECT_CHAT_RESTRICTED',
                        message: 'Direct chat access is restricted or expired.',
                        details: access,
                    });
                }
            }
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


    // ──────────────────────── ROLE RESTRICTIONS & DIRECT ACCESS ─────────────────

    async checkDirectChatAccess(tenantId: string, requesterId: string, targetUserId: string) {
        if (requesterId === targetUserId) {
            return { canChat: true };
        }

        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const userRepo = connection.getRepository(TenantUser);
        const targetUser = await userRepo.findOne({ where: { id: targetUserId } });
        if (!targetUser) {
            throw new NotFoundException('Target user not found');
        }

        // 1. If target user self-overrode restrictions and exposed themselves to everyone
        if (targetUser.allow_direct_chat_override) {
            return {
                canChat: true,
                targetHasOverride: true,
                targetRole: targetUser.role,
                targetName: targetUser.full_name,
            };
        }

        // 2. If requester is admin or owner, bypass restriction
        const requester = await userRepo.findOne({ where: { id: requesterId } });
        if (requester?.role === 'admin' || requester?.role === 'owner') {
            return {
                canChat: true,
                isRequesterAdmin: true,
                targetRole: targetUser.role,
                targetName: targetUser.full_name,
            };
        }

        // 3. Check if target user's role is restricted
        const restrictionRepo = connection.getRepository(ChatRoleRestriction);
        const restriction = await restrictionRepo.findOne({
            where: { role: targetUser.role, is_restricted: true },
        });

        if (!restriction) {
            // Target user's role is not restricted
            return {
                canChat: true,
                targetRole: targetUser.role,
                targetName: targetUser.full_name,
            };
        }

        // 4. Restricted peers can communicate with each other freely without restriction
        if (requester?.role) {
            const requesterRestriction = await restrictionRepo.findOne({
                where: { role: requester.role, is_restricted: true },
            });
            if (requesterRestriction) {
                return {
                    canChat: true,
                    isPeerRestricted: true,
                    targetRole: targetUser.role,
                    targetName: targetUser.full_name,
                };
            }
        }

        // 5. Role is restricted — check if requester has an active, approved, non-expired grant
        const grantRepo = connection.getRepository(ChatDirectAccessGrant);
        const now = new Date();
        const activeGrant = await grantRepo.createQueryBuilder('g')
            .where('g.requester_id = :requesterId', { requesterId })
            .andWhere('g.target_user_id = :targetUserId', { targetUserId })
            .andWhere('g.status = :status', { status: 'approved' })
            .andWhere('(g.expires_at IS NULL OR g.expires_at > :now)', { now })
            .getOne();

        if (activeGrant) {
            return {
                canChat: true,
                targetRole: targetUser.role,
                targetName: targetUser.full_name,
                activeGrant: {
                    id: activeGrant.id,
                    expiresAt: activeGrant.expires_at,
                    reason: activeGrant.reason,
                    approvedAt: activeGrant.updated_at,
                },
            };
        }

        // 5. Look for pending request
        const pendingRequest = await grantRepo.findOne({
            where: { requester_id: requesterId, target_user_id: targetUserId, status: 'pending' },
            order: { created_at: 'DESC' },
        });

        return {
            canChat: false,
            isTargetRestricted: true,
            targetRole: targetUser.role,
            targetName: targetUser.full_name,
            triagePrompt: restriction.triage_prompt || 'Direct messaging to this role is restricted. Please consult the AI Assistant for guidance or submit a direct access request.',
            pendingRequest: pendingRequest ? {
                id: pendingRequest.id,
                status: pendingRequest.status,
                reason: pendingRequest.reason,
                createdAt: pendingRequest.created_at,
            } : null,
        };
    }

    async requestDirectChatAccess(tenantId: string, requesterId: string, dto: RequestChatAccessDto) {
        if (requesterId === dto.targetUserId) {
            throw new BadRequestException('You cannot request chat access to yourself');
        }

        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const userRepo = connection.getRepository(TenantUser);
        const targetUser = await userRepo.findOne({ where: { id: dto.targetUserId } });
        if (!targetUser) throw new NotFoundException('Target user not found');

        const grantRepo = connection.getRepository(ChatDirectAccessGrant);
        const now = new Date();

        // Check if active grant already exists
        const activeGrant = await grantRepo.createQueryBuilder('g')
            .where('g.requester_id = :requesterId', { requesterId })
            .andWhere('g.target_user_id = :targetUserId', { targetUserId: dto.targetUserId })
            .andWhere('g.status = :status', { status: 'approved' })
            .andWhere('(g.expires_at IS NULL OR g.expires_at > :now)', { now })
            .getOne();

        if (activeGrant) {
            return {
                message: 'You already have active direct chat access with this user',
                grant: activeGrant,
            };
        }

        // Check if there is an existing pending request
        let pending = await grantRepo.findOne({
            where: { requester_id: requesterId, target_user_id: dto.targetUserId, status: 'pending' },
        });

        if (pending) {
            pending.reason = dto.reason;
            pending.updated_at = new Date();
            const saved = await grantRepo.save(pending);
            return {
                message: 'Access request updated and pending review',
                grant: saved,
            };
        }

        const newGrant = grantRepo.create({
            requester_id: requesterId,
            target_user_id: dto.targetUserId,
            reason: dto.reason,
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date(),
        });

        const saved = await grantRepo.save(newGrant);

        // Notify target user via WebSocket
        try {
            this.messagingGateway.server?.to(`user_${dto.targetUserId}`).emit('chat_access_request_received', {
                grantId: saved.id,
                requesterId,
                reason: dto.reason,
                createdAt: saved.created_at,
            });
        } catch (e) {
            // Silently ignore gateway error
        }

        return {
            message: 'Access request submitted successfully',
            grant: saved,
        };
    }

    async respondDirectChatAccess(tenantId: string, targetUserId: string, grantId: string, dto: RespondChatAccessDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const grantRepo = connection.getRepository(ChatDirectAccessGrant);

        const grant = await grantRepo.findOne({
            where: { id: grantId, target_user_id: targetUserId },
            relations: ['requester'],
        });

        if (!grant) {
            throw new NotFoundException('Access request not found or not addressed to you');
        }

        const now = new Date();
        if (dto.action === 'approve') {
            grant.status = 'approved';
            let expiresAt: Date | null = null;
            if (dto.duration === '1h') {
                expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            } else if (dto.duration === '24h') {
                expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            } else if (dto.duration === '3d') {
                expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            } else if (dto.duration === '7d') {
                expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else if (dto.duration === '30d') {
                expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            } else {
                expiresAt = null; // forever / indefinite
            }
            grant.expires_at = expiresAt;
            grant.response_note = dto.note || null;
        } else {
            grant.status = 'rejected';
            grant.response_note = dto.note || null;
        }

        grant.updated_at = new Date();
        const saved = await grantRepo.save(grant);

        // Notify requester via WebSocket
        try {
            this.messagingGateway.server?.to(`user_${grant.requester_id}`).emit('chat_access_request_resolved', {
                grantId: saved.id,
                targetUserId,
                status: saved.status,
                expiresAt: saved.expires_at,
                responseNote: saved.response_note,
            });
        } catch (e) {
            // Silently ignore gateway error
        }

        return {
            success: true,
            status: saved.status,
            expiresAt: saved.expires_at,
            grant: saved,
        };
    }

    async getIncomingAccessRequests(tenantId: string, targetUserId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const grantRepo = connection.getRepository(ChatDirectAccessGrant);

        const requests = await grantRepo.find({
            where: { target_user_id: targetUserId },
            relations: ['requester'],
            order: { created_at: 'DESC' },
            take: 100,
        });

        return requests.map(r => ({
            id: r.id,
            status: r.status,
            reason: r.reason,
            responseNote: r.response_note,
            expiresAt: r.expires_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            requester: {
                id: r.requester?.id,
                fullName: r.requester?.full_name,
                email: r.requester?.email,
                role: r.requester?.role,
                department: r.requester?.department,
                position: r.requester?.position,
                avatarUrl: r.requester?.avatar_url,
            },
        }));
    }

    async getMySentAccessRequests(tenantId: string, requesterId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const grantRepo = connection.getRepository(ChatDirectAccessGrant);

        const requests = await grantRepo.find({
            where: { requester_id: requesterId },
            relations: ['target_user'],
            order: { created_at: 'DESC' },
            take: 50,
        });

        return requests.map(r => ({
            id: r.id,
            status: r.status,
            reason: r.reason,
            responseNote: r.response_note,
            expiresAt: r.expires_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            targetUser: {
                id: r.target_user?.id,
                fullName: r.target_user?.full_name,
                email: r.target_user?.email,
                role: r.target_user?.role,
                department: r.target_user?.department,
                position: r.target_user?.position,
                avatarUrl: r.target_user?.avatar_url,
            },
        }));
    }

    async toggleDirectChatOverride(tenantId: string, userId: string, allowOverride: boolean) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const userRepo = connection.getRepository(TenantUser);

        await userRepo.update(userId, {
            allow_direct_chat_override: allowOverride,
        });

        return {
            success: true,
            allow_direct_chat_override: allowOverride,
        };
    }

    async getRoleRestrictions(tenantId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const restrictionRepo = connection.getRepository(ChatRoleRestriction);
        return restrictionRepo.find({ order: { role: 'ASC' } });
    }

    async setRoleRestrictions(tenantId: string, userId: string, dto: SetRoleRestrictionsDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const userRepo = connection.getRepository(TenantUser);
        const user = await userRepo.findOne({ where: { id: userId } });
        if (user?.role !== 'admin' && user?.role !== 'owner') {
            throw new ForbiddenException('Only administrators can configure chat role restrictions');
        }

        const restrictionRepo = connection.getRepository(ChatRoleRestriction);

        for (const item of dto.restrictions) {
            let existing = await restrictionRepo.findOne({ where: { role: item.role } });
            if (existing) {
                existing.is_restricted = item.isRestricted;
                if (item.triagePrompt !== undefined) existing.triage_prompt = item.triagePrompt;
                existing.updated_at = new Date();
                await restrictionRepo.save(existing);
            } else {
                const created = restrictionRepo.create({
                    role: item.role,
                    is_restricted: item.isRestricted,
                    triage_prompt: item.triagePrompt,
                });
                await restrictionRepo.save(created);
            }
        }

        return { success: true };
    }



    async grantDirectAccessToEmployee(tenantId: string, currentUserId: string, dto: GrantDirectAccessDto) {
        if (currentUserId === dto.employeeId) {
            throw new BadRequestException('Cannot grant chat access to yourself');
        }

        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const userRepo = connection.getRepository(TenantUser);
        const [currentUser, employee] = await Promise.all([
            userRepo.findOne({ where: { id: currentUserId } }),
            userRepo.findOne({ where: { id: dto.employeeId } }),
        ]);

        if (!employee) throw new NotFoundException('Employee not found');

        const grantRepo = connection.getRepository(ChatDirectAccessGrant);
        const now = new Date();
        let expiresAt: Date | null = null;
        if (dto.duration === '1h') {
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
        } else if (dto.duration === '24h') {
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (dto.duration === '3d') {
            expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        } else if (dto.duration === '7d') {
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (dto.duration === '30d') {
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            expiresAt = null; // forever
        }

        let grant = await grantRepo.findOne({
            where: { requester_id: dto.employeeId, target_user_id: currentUserId },
        });

        if (grant) {
            grant.status = 'approved';
            grant.expires_at = expiresAt;
            grant.response_note = dto.note || `Direct chat access proactively granted by ${currentUser?.full_name || 'Restricted Role'}`;
            grant.updated_at = new Date();
            await grantRepo.save(grant);
        } else {
            grant = grantRepo.create({
                requester_id: dto.employeeId,
                target_user_id: currentUserId,
                status: 'approved',
                expires_at: expiresAt,
                reason: `Proactively permitted by ${currentUser?.full_name || 'Restricted Role'}`,
                response_note: dto.note || null,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await grantRepo.save(grant);
        }

        // Notify employee via WebSocket
        try {
            this.messagingGateway.server?.to(`user_${dto.employeeId}`).emit('chat_access_granted_proactively', {
                grantId: grant.id,
                targetUserId: currentUserId,
                targetUserName: currentUser?.full_name,
                expiresAt: grant.expires_at,
                note: dto.note,
            });
        } catch (e) {
            // Ignore gateway error
        }

        return {
            success: true,
            grant,
        };
    }

    async revokeDirectAccess(tenantId: string, currentUserId: string, grantId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const grantRepo = connection.getRepository(ChatDirectAccessGrant);

        const grant = await grantRepo.findOne({
            where: { id: grantId, target_user_id: currentUserId },
        });

        if (!grant) throw new NotFoundException('Grant not found');

        grant.status = 'expired';
        grant.expires_at = new Date();
        grant.updated_at = new Date();
        await grantRepo.save(grant);

        return { success: true };
    }

    async getActiveGrantsForMe(tenantId: string, currentUserId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const grantRepo = connection.getRepository(ChatDirectAccessGrant);
        const now = new Date();

        const grants = await grantRepo.createQueryBuilder('g')
            .leftJoinAndSelect('g.requester', 'requester')
            .where('g.target_user_id = :currentUserId', { currentUserId })
            .andWhere('g.status = :status', { status: 'approved' })
            .andWhere('(g.expires_at IS NULL OR g.expires_at > :now)', { now })
            .orderBy('g.updated_at', 'DESC')
            .getMany();

        return grants.map(g => ({
            id: g.id,
            status: g.status,
            reason: g.reason,
            responseNote: g.response_note,
            expiresAt: g.expires_at,
            createdAt: g.created_at,
            updatedAt: g.updated_at,
            employee: {
                id: g.requester?.id,
                fullName: g.requester?.full_name,
                email: g.requester?.email,
                role: g.requester?.role,
                department: g.requester?.department,
                avatarUrl: g.requester?.avatar_url,
            },
        }));
    }

}
