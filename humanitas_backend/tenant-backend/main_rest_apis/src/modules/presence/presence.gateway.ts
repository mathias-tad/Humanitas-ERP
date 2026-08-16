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

interface OnlineUser {
  userId: string;
  tenantSlug: string;
  socketId: string;
  connectedAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/presence',
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers: Map<string, OnlineUser> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      console.log(
        '[Presence] New connection attempt from:',
        client.handshake.address,
      );

      // Extract token from cookie (HttpOnly) or fallback to auth/header
      const cookies = client.handshake.headers?.cookie;
      let token: string | undefined;

      if (cookies) {
        const match = cookies.match(/access_token=([^;]+)/);
        if (match) {
          token = match[1];
          console.log('[Presence] Token found in cookie');
        }
      }

      if (!token) {
        token =
          client.handshake.auth?.token ||
          client.handshake.headers?.authorization?.replace('Bearer ', '');
        if (token) {
          console.log('[Presence] Token found in auth/header');
        }
      }

      if (!token) {
        console.log('[Presence] ❌ No token found, disconnecting client');
        console.log(
          '[Presence] Headers:',
          JSON.stringify(client.handshake.headers, null, 2),
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      const tenantSlug = payload.tenantSlug;

      if (!userId || !tenantSlug) {
        console.log(
          '[Presence] ❌ Invalid token payload, disconnecting client',
        );
        client.disconnect();
        return;
      }

      console.log(`[Presence] ✅ User ${userId} authenticated successfully`);

      // Store user connection info
      client.data.userId = userId;
      client.data.tenantSlug = tenantSlug;

      // Join tenant-specific room
      client.join(`tenant:${tenantSlug}`);

      // Add to online users
      this.onlineUsers.set(userId, {
        userId,
        tenantSlug,
        socketId: client.id,
        connectedAt: new Date(),
      });

      // Broadcast to all users in the same tenant that this user is online
      this.server.to(`tenant:${tenantSlug}`).emit('userOnline', {
        userId,
        online: true,
        connectedAt: new Date(),
      });

      // Send current online users list to the newly connected client
      const tenantOnlineUsers = this.getOnlineUsersByTenant(tenantSlug);
      client.emit('onlineUsers', tenantOnlineUsers);

      console.log(
        `User ${userId} connected to presence (tenant: ${tenantSlug})`,
      );
    } catch (error) {
      console.error('WebSocket connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const tenantSlug = client.data.tenantSlug;

    if (userId) {
      this.onlineUsers.delete(userId);

      // Broadcast to all users in the same tenant that this user is offline
      if (tenantSlug) {
        this.server.to(`tenant:${tenantSlug}`).emit('userOffline', {
          userId,
          online: false,
          disconnectedAt: new Date(),
        });
      }

      console.log(`User ${userId} disconnected from presence`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: new Date() } };
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(client: Socket) {
    const tenantSlug = client.data.tenantSlug;
    if (tenantSlug) {
      const onlineUsers = this.getOnlineUsersByTenant(tenantSlug);
      return { event: 'onlineUsers', data: onlineUsers };
    }
    return { event: 'onlineUsers', data: [] };
  }

  private getOnlineUsersByTenant(tenantSlug: string): string[] {
    const onlineUserIds: string[] = [];
    this.onlineUsers.forEach((user) => {
      if (user.tenantSlug === tenantSlug) {
        onlineUserIds.push(user.userId);
      }
    });
    return onlineUserIds;
  }

  // Method to check if a user is online (can be called from other services)
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  // Get all online users for a tenant
  getOnlineUsersForTenant(tenantSlug: string): string[] {
    return this.getOnlineUsersByTenant(tenantSlug);
  }
}
