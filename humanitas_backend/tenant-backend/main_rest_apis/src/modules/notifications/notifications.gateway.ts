import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
    cors: {
        origin: true,
        credentials: true,
    },
    namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private userSockets: Map<string, Set<string>> = new Map(); // tenantId:userId -> Set<socketId>

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            // Extract token from cookie or auth header
            const cookies = client.handshake.headers?.cookie;
            let token: string | undefined;

            if (cookies) {
                const match = cookies.match(/access_token=([^;]+)/);
                if (match) token = match[1];
            }

            if (!token) {
                token = client.handshake.auth?.token;
            }

            if (!token) {
                console.log('[Notifications WS] No token, disconnecting');
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });

            const userId = payload.sub;
            const tenantId = payload.tenantId;
            const userKey = `${tenantId}:${userId}`;

            // Join user-specific room
            client.join(`user:${userKey}`);
            // Join tenant-wide room
            client.join(`tenant:${tenantId}`);
            client.data.userId = userId;
            client.data.tenantId = tenantId;
            client.data.userKey = userKey;

            // Track socket
            if (!this.userSockets.has(userKey)) {
                this.userSockets.set(userKey, new Set());
            }
            this.userSockets.get(userKey)?.add(client.id);

            console.log(`[Notifications WS] User ${userId} connected (${client.id})`);
        } catch (error: any) {
            console.error('[Notifications WS] Auth error:', error.message);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userKey = client.data.userKey;
        if (userKey) {
            this.userSockets.get(userKey)?.delete(client.id);
            if (this.userSockets.get(userKey)?.size === 0) {
                this.userSockets.delete(userKey);
            }
        }
        console.log(`[Notifications WS] Client disconnected (${client.id})`);
    }

    @SubscribeMessage('ping')
    handlePing() {
        return { event: 'pong', data: { timestamp: new Date() } };
    }

    // Push notification to specific user
    pushToUser(tenantId: string, userId: string, notification: any) {
        const userKey = `${tenantId}:${userId}`;
        this.server.to(`user:${userKey}`).emit('newNotification', notification);
        console.log(`[Notifications WS] Pushed to user ${userId}`);
    }

    // Push notification to multiple users
    pushToUsers(tenantId: string, userIds: string[], notification: any) {
        for (const userId of userIds) {
            this.pushToUser(tenantId, userId, notification);
        }
    }

    // Broadcast to entire tenant
    broadcastToTenant(tenantId: string, event: string, payload: any) {
        this.server.to(`tenant:${tenantId}`).emit(event, payload);
        console.log(`[Notifications WS] Broadcast to tenant ${tenantId}: ${event}`);
    }
}
