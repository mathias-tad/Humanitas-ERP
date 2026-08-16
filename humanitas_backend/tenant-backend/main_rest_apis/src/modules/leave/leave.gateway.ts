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
    origin: '*',
    credentials: true,
  },
  namespace: '/leave',
})
export class LeaveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      // Extract token from cookie (HttpOnly) or fallback to auth/header
      const cookies = client.handshake.headers?.cookie;
      let token: string | undefined;

      if (cookies) {
        const match = cookies.match(/access_token=([^;]+)/);
        if (match) token = match[1];
      }

      if (!token) {
        token =
          client.handshake.auth?.token ||
          client.handshake.headers?.authorization?.replace('Bearer ', '');
      }

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      const tenantId = payload.tenantId;
      const tenantSlug = payload.tenantSlug;

      if (!userId || !tenantId) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      client.data.tenantId = tenantId;
      client.data.tenantSlug = tenantSlug;

      // Join tenant-specific room for leave updates
      client.join(`leave:${tenantId}`);

      console.log(
        `User ${userId} connected to leave updates (tenant: ${tenantId})`,
      );
    } catch (error) {
      console.error('Leave WebSocket connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      console.log(`User ${userId} disconnected from leave updates`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: new Date() } };
  }

  // Emit new leave request to all connected clients in the tenant
  emitNewLeaveRequest(tenantId: string, request: any) {
    this.server.to(`leave:${tenantId}`).emit('newLeaveRequest', request);
  }

  // Emit leave request update (approved/rejected)
  emitLeaveRequestUpdate(tenantId: string, request: any) {
    this.server.to(`leave:${tenantId}`).emit('leaveRequestUpdate', request);
  }

  // Emit leave request cancelled
  emitLeaveRequestCancelled(tenantId: string, requestId: string) {
    this.server
      .to(`leave:${tenantId}`)
      .emit('leaveRequestCancelled', { id: requestId });
  }
}
