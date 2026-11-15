import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { isActiveParticipant } from './conversation-membership';

@WebSocketGateway({
    cors: { origin: true, credentials: true },
    namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    /** Short-lived cache of conversation participants (typing events are frequent). */
    private readonly participantCache = new Map<string, { ids: string[]; expires: number }>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly databaseService: DatabaseService,
    ) { }

    private async getParticipantIds(tenantId: string, conversationId: string): Promise<string[]> {
        const key = `${tenantId}:${conversationId}`;
        const hit = this.participantCache.get(key);
        if (hit && hit.expires > Date.now()) return hit.ids;
        const ds = await this.databaseService.getTenantConnectionById(tenantId);
        const rows = await ds.query(
            `SELECT user_id FROM conversation_participants
             WHERE conversation_id::text = $1 AND left_at IS NULL`,
            [String(conversationId)],
        );
        const ids = rows.map((r: any) => String(r.user_id));
        this.participantCache.set(key, { ids, expires: Date.now() + 30_000 });
        if (this.participantCache.size > 5000) this.participantCache.clear();
        return ids;
    }

    async handleConnection(client: Socket) {
        try {
            const token = this.extractToken(client);
            if (!token) { client.disconnect(); return; }

            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });

            const userId = payload.sub;
            const tenantId = payload.tenantId;
            const userKey = `${tenantId}:${userId}`;

            client.join(`user:${userKey}`);
            client.join(`tenant:${tenantId}`);
            client.data.userId = userId;
            client.data.tenantId = tenantId;

            this.server.to(`tenant:${tenantId}`).emit('userStatus', { userId, isOnline: true });

            const sockets = await this.server.in(`tenant:${tenantId}`).fetchSockets();
            const onlineUserIds = Array.from(new Set(sockets.map(s => s.data.userId).filter(Boolean)));
            client.emit('initialPresence', onlineUserIds);
        } catch (err) {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        if (client.data?.userId && client.data?.tenantId) {
            const { userId, tenantId } = client.data;
            this.server.to(`tenant:${tenantId}`).emit('userStatus', { userId, isOnline: false });
        }
    }

    private extractToken(client: Socket): string | undefined {
        const cookies = client.handshake.headers?.cookie;
        if (cookies) {
            const match = cookies.match(/access_token=([^;]+)/);
            if (match) return match[1];
        }
        return client.handshake.auth?.token;
    }

    // ── WS Events (client → server) ──────────────────────────────

    @SubscribeMessage('typing')
    async handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string; isTyping: boolean },
    ) {
        const { userId, tenantId } = client.data || {};
        if (!userId || !tenantId || !data?.conversationId) return;
        try {
            // Only notify members of this conversation — and only if the sender is one of them.
            const participantIds = await this.getParticipantIds(tenantId, data.conversationId);
            if (!participantIds.includes(String(userId))) return;
            const payload = { conversationId: data.conversationId, userId, isTyping: !!data.isTyping };
            for (const pid of participantIds) {
                if (pid !== String(userId)) this.server.to(`user:${tenantId}:${pid}`).emit('typing', payload);
            }
        } catch {
            // ignore transient DB errors for typing indicators
        }
    }

    @SubscribeMessage('joinConversation')
    async handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const { userId, tenantId } = client.data || {};
        if (!userId || !tenantId || !data?.conversationId) {
            return { ok: false, error: 'unauthorized' };
        }
        try {
            const ds = await this.databaseService.getTenantConnectionById(tenantId);
            // SECURITY: only current participants may subscribe to a conversation's room.
            if (!(await isActiveParticipant(ds, data.conversationId, userId))) {
                return { ok: false, error: 'forbidden' };
            }
            client.join(`conv:${data.conversationId}`);
            return { ok: true };
        } catch {
            return { ok: false, error: 'unavailable' };
        }
    }

    @SubscribeMessage('leaveConversation')
    handleLeaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        client.leave(`conv:${data.conversationId}`);
    }

    // ── Emitters (server → client) ────────────────────────────────

    private emitToParticipants(tenantId: string, participantIds: string[], event: string, data: any) {
        for (const userId of participantIds) {
            this.server.to(`user:${tenantId}:${userId}`).emit(event, data);
        }
    }

    notifyNewMessage(tenantId: string, conversationId: string, message: any, participantIds: string[]) {
        for (const userId of participantIds) {
            this.server.to(`user:${tenantId}:${userId}`).emit('newMessage', message);
        }
        // Also emit to conversation room (for clients that joined the room)
        this.server.to(`conv:${conversationId}`).emit('newMessage', message);
    }

    notifyMessageEdited(tenantId: string, conversationId: string, message: any, participantIds: string[]) {
        for (const userId of participantIds) {
            this.server.to(`user:${tenantId}:${userId}`).emit('messageEdited', message);
        }
    }

    notifyMessageDeleted(tenantId: string, conversationId: string, messageId: string, forEveryone: boolean, participantIds: string[]) {
        for (const userId of participantIds) {
            this.server.to(`user:${tenantId}:${userId}`).emit('messageDeleted', { conversationId, messageId, forEveryone });
        }
    }

    notifyReactionUpdate(tenantId: string, conversationId: string, messageId: string, reactions: any[], participantIds: string[]) {
        for (const userId of participantIds) {
            this.server.to(`user:${tenantId}:${userId}`).emit('reactionUpdated', { conversationId, messageId, reactions });
        }
    }

    notifyConversationUpdated(tenantId: string, conversationId: string, conversation: any, participantIds: string[]) {
        for (const userId of participantIds) {
            this.server.to(`user:${tenantId}:${userId}`).emit('conversationUpdated', conversation);
        }
    }

    notifyMessagesRead(tenantId: string, conversationId: string, readByUserId: string, participantIds: string[]) {
        for (const pId of participantIds) {
            if (pId !== readByUserId) {
                this.server.to(`user:${tenantId}:${pId}`).emit('messagesRead', {
                    conversationId,
                    readByUserId,
                    readAt: new Date(),
                });
            }
        }
    }
}
