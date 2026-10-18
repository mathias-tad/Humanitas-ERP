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
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/devices',
})
@Injectable()
export class BiometricDevicesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BiometricDevicesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
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

      // Join tenant-specific room for live device updates
      client.join(`devices:${tenantId}`);
      this.logger.log(`User ${userId} subscribed to device updates (tenant: ${tenantId})`);
    } catch (error: any) {
      this.logger.error(`Devices WebSocket connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.logger.log(`User ${userId} disconnected from devices socket`);
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: { timestamp: new Date() } };
  }

  /**
   * Emitted when a physical device connects for the first time and auto-registers
   */
  emitDeviceRegistered(tenantId: string, device: any) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('device_registered', device);
    }
  }

  /**
   * Emitted on status changes or heartbeats (Online, Offline, last_sync_at)
   */
  emitDeviceStatusChanged(tenantId: string, device: any) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('device_status_changed', device);
    }
  }

  /**
   * Emitted when admin authorizes device
   */
  emitDeviceAuthorized(tenantId: string, device: any) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('device_authorized', device);
    }
  }

  /**
   * Emitted when admin revokes device authorization
   */
  emitDeviceRevoked(tenantId: string, device: any) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('device_revoked', device);
    }
  }

  /**
   * Emitted when device is removed
   */
  emitDeviceDeleted(tenantId: string, deviceId: string) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('device_deleted', { id: deviceId });
    }
  }

  /**
   * Emitted when sync logs or attendance logs arrive
   */
  emitDeviceSync(tenantId: string, data: any) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('device_sync', data);
    }
  }

  /**
   * Emitted when employee fingerprint, face, or palm is enrolled on a device
   */
  emitBiometricEnrolled(tenantId: string, data: any) {
    if (this.server) {
      this.server.to(`devices:${tenantId}`).emit('biometric_enrolled', data);
    }
  }
}
