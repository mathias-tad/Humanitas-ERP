import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** QR codes, registered attendance devices and allowed networks. */
@Injectable()
export class AttendanceDevicesService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) { }


  // ============ QR CODE & DEVICE BINDING ============

  // Generate a new rotating QR code (valid for 30 seconds)
  async generateQRCode(
    tenantId: string,
    type: 'clock_in' | 'clock_out' = 'clock_in',
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Clean up expired codes
    await connection.query(
      `DELETE FROM attendance_qr_codes WHERE expires_at < NOW()`,
    );

    // Generate unique code
    const code = `${tenantId} -${type} -${Date.now()} -${Math.random().toString(36).substring(2, 15)} `;
    const expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds

    const result = await connection.query(
      `
      INSERT INTO attendance_qr_codes(code, type, expires_at)
    VALUES($1, $2, $3)
    RETURNING *
      `,
      [code, type, expiresAt],
    );

    return result[0];
  }


  // Get current valid QR code or generate new one
  async getCurrentQRCode(
    tenantId: string,
    type: 'clock_in' | 'clock_out' = 'clock_in',
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get valid code
    const existing = await connection.query(
      `
    SELECT * FROM attendance_qr_codes 
      WHERE type = $1 AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
      `,
      [type],
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Generate new one
    return this.generateQRCode(tenantId, type);
  }


  // Validate QR code
  async validateQRCode(tenantId: string, code: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
    SELECT * FROM attendance_qr_codes 
      WHERE code = $1 AND expires_at > NOW()
      `,
      [code],
    );

    return result && result.length > 0;
  }


  // Register user device (only one device per user allowed)
  async registerDevice(
    tenantId: string,
    userId: string,
    deviceInfo: {
      device_id: string;
      device_name?: string;
      device_type?: string;
    },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Check if user already has a registered device
    const userDevices = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE user_id = $1 AND is_active = true
      `,
      [userId],
    );

    if (userDevices && userDevices.length > 0) {
      const existingDevice = userDevices[0];
      // If it's the same device, just return it
      if (existingDevice.device_id === deviceInfo.device_id) {
        return existingDevice;
      }
      // Otherwise, user already has a different device registered
      throw new BadRequestException(
        'You already have a registered device. Please contact your administrator to remove it before registering a new one.',
      );
    }

    // Check if device is already registered to another user
    const existing = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE device_id = $1 AND user_id != $2 AND is_active = true
      `,
      [deviceInfo.device_id, userId],
    );

    if (existing && existing.length > 0) {
      throw new BadRequestException(
        'This device is already registered to another user',
      );
    }

    const result = await connection.query(
      `
      INSERT INTO user_devices(user_id, device_id, device_name, device_type)
    VALUES($1, $2, $3, $4)
      ON CONFLICT(user_id, device_id) DO UPDATE SET
    device_name = COALESCE($3, user_devices.device_name),
      device_type = COALESCE($4, user_devices.device_type),
      is_active = true,
      last_used_at = NOW()
    RETURNING *
      `,
      [
        userId,
        deviceInfo.device_id,
        deviceInfo.device_name,
        deviceInfo.device_type,
      ],
    );

    return result[0];
  }


  // Get user's registered devices
  async getUserDevices(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE user_id = $1 AND is_active = true
      ORDER BY registered_at DESC
      `,
      [userId],
    );

    return result || [];
  }


  // Check if device is registered for user
  async isDeviceRegistered(tenantId: string, userId: string, deviceId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE user_id = $1 AND device_id = $2 AND is_active = true
      `,
      [userId, deviceId],
    );

    return result && result.length > 0;
  }


  // Remove device
  async removeDevice(tenantId: string, userId: string, deviceId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE user_devices SET is_active = false 
      WHERE user_id = $1 AND device_id = $2
      `,
      [userId, deviceId],
    );

    return { message: 'Device removed successfully' };
  }


  // Admin: Get all registered devices
  async getAllDevices(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(`
      SELECT ud.*, u.full_name, u.email, u.department
      FROM user_devices ud
      JOIN users u ON ud.user_id = u.id
      WHERE ud.is_active = true
      ORDER BY ud.registered_at DESC
    `);
    return result || [];
  }


  // Hack: passing userId via dateStr due to controller signature limitation or update controller
  // Better: Update controller signature. But staying minimal changes:
  // Actually, let's update the signature properly.





  // Admin: Get all pending device registrations
  async getPendingDevices(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(`
      SELECT ud.*, u.full_name, u.email, u.department
      FROM user_devices ud
      JOIN users u ON ud.user_id = u.id
      WHERE ud.is_active = true AND ud.approved_at IS NULL
      ORDER BY ud.registered_at DESC
    `);

    return result || [];
  }


  // Admin: Approve device
  async approveDevice(
    tenantId: string,
    deviceRecordId: string,
    approverId: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
      UPDATE user_devices SET 
        approved_by = $1, 
        approved_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [approverId, deviceRecordId],
    );

    return result[0];
  }


  // Admin: Reject/remove device
  async rejectDevice(tenantId: string, deviceRecordId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE user_devices SET is_active = false 
      WHERE id = $1
    `,
      [deviceRecordId],
    );

    return { message: 'Device rejected' };
  }


  // ============ NETWORK MANAGEMENT ============

  // Get all allowed networks
  async getAllowedNetworks(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(`
      SELECT * FROM allowed_networks WHERE is_active = true ORDER BY name
    `);
    return result || [];
  }


  // Add allowed network
  async addAllowedNetwork(
    tenantId: string,
    data: {
      name: string;
      ip_address: string;
      subnet_mask?: string;
      description?: string;
    },
    createdBy: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
      INSERT INTO allowed_networks (name, ip_address, subnet_mask, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [
        data.name,
        data.ip_address,
        data.subnet_mask || '255.255.255.0',
        data.description,
        createdBy,
      ],
    );

    return result[0];
  }


  // Remove allowed network
  async removeAllowedNetwork(tenantId: string, networkId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE allowed_networks SET is_active = false WHERE id = $1
    `,
      [networkId],
    );

    return { message: 'Network removed' };
  }


  // Validate if IP is in allowed networks
  async isNetworkAllowed(
    tenantId: string,
    clientIp: string,
  ): Promise<{ allowed: boolean; message: string; clientIp: string }> {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get all allowed networks
    const networks = await connection.query(`
      SELECT * FROM allowed_networks WHERE is_active = true
    `);

    // If no networks configured, allow all (for initial setup)
    if (!networks || networks.length === 0) {
      return {
        allowed: true,
        message: 'No network restrictions configured',
        clientIp,
      };
    }

    // Clean up client IP (remove IPv6 prefix if present)
    let cleanIp = clientIp;
    if (cleanIp.startsWith('::ffff:')) {
      cleanIp = cleanIp.substring(7);
    }

    // Check if client IP matches any allowed network
    for (const network of networks) {
      if (
        this.isIpInNetwork(cleanIp, network.ip_address, network.subnet_mask)
      ) {
        return {
          allowed: true,
          message: `Connected from allowed network: ${network.name}`,
          clientIp: cleanIp,
        };
      }
    }

    return {
      allowed: false,
      message: `You must be connected to the office network to clock in/out. Your current IP (${cleanIp}) is not in the allowed list.`,
      clientIp: cleanIp,
    };
  }


  // Helper: Check if IP is in network range
  private isIpInNetwork(
    clientIp: string,
    networkIp: string,
    subnetMask: string,
  ): boolean {
    try {
      // For exact IP match (common case)
      if (clientIp === networkIp) {
        return true;
      }

      // For subnet matching
      const clientParts = clientIp.split('.').map(Number);
      const networkParts = networkIp.split('.').map(Number);
      const maskParts = subnetMask.split('.').map(Number);

      if (
        clientParts.length !== 4 ||
        networkParts.length !== 4 ||
        maskParts.length !== 4
      ) {
        return false;
      }

      for (let i = 0; i < 4; i++) {
        if (
          (clientParts[i] & maskParts[i]) !==
          (networkParts[i] & maskParts[i])
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
