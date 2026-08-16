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
  namespace: '/attendance',
})
export class AttendanceGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
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

      // Join tenant-specific room for attendance updates
      client.join(`attendance:${tenantId}`);

      console.log(
        `User ${userId} connected to attendance updates (tenant: ${tenantId})`,
      );
    } catch (error) {
      console.error('Attendance WebSocket connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      console.log(`User ${userId} disconnected from attendance updates`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: new Date() } };
  }

  // Emit clock in event
  emitClockIn(tenantId: string, record: any) {
    this.server.to(`attendance:${tenantId}`).emit('clockIn', record);
  }

  // Emit clock out event
  emitClockOut(tenantId: string, record: any) {
    this.server.to(`attendance:${tenantId}`).emit('clockOut', record);
  }

  // Emit attendance record update
  emitAttendanceUpdate(tenantId: string, record: any) {
    this.server.to(`attendance:${tenantId}`).emit('attendanceUpdate', record);
  }
}
