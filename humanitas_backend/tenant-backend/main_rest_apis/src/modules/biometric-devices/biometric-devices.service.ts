import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { BiometricDevicesGateway } from './biometric-devices.gateway';

@Injectable()
export class BiometricDevicesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly masterDataSource: DataSource,
    @Inject(forwardRef(() => BiometricDevicesGateway))
    private readonly devicesGateway: BiometricDevicesGateway,
  ) {}

  private async ensureGlobalRegistry() {
    await this.masterDataSource.query(`
        CREATE TABLE IF NOT EXISTS device_registry (
            serial_number VARCHAR(255) PRIMARY KEY,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            device_id UUID NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
  }

  private async ensureBiometricTables(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS biometric_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        model VARCHAR(100) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        serial_number VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        registered_ip VARCHAR(45),
        last_seen_ip VARCHAR(45),
        port INTEGER DEFAULT 4370,
        protocol VARCHAR(50) NOT NULL,
        auth_method VARCHAR(50),
        auth_credentials JSONB,
        location VARCHAR(255),
        timezone VARCHAR(50) DEFAULT 'UTC',
        status VARCHAR(30) DEFAULT 'offline',
        is_authorized BOOLEAN DEFAULT false,
        pending_since TIMESTAMP,
        authorized_at TIMESTAMP,
        authorized_by UUID,
        last_sync_at TIMESTAMP,
        last_heartbeat_at TIMESTAMP,
        max_users INTEGER DEFAULT 3000,
        max_fingerprints INTEGER DEFAULT 9000,
        max_faces INTEGER DEFAULT 3000,
        current_users INTEGER DEFAULT 0,
        firmware_version VARCHAR(50),
        device_time TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        sync_enabled BOOLEAN DEFAULT true,
        sync_interval_minutes INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        UNIQUE(tenant_id, serial_number)
      );

      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT false;
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS registered_ip VARCHAR(45);
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS last_seen_ip VARCHAR(45);
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP;
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMP;
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS authorized_by UUID;

      CREATE TABLE IF NOT EXISTS device_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        device_id UUID REFERENCES biometric_devices(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        device_user_id VARCHAR(50),
        enrollment_number VARCHAR(50),
        fingerprint_templates JSONB,
        face_templates JSONB,
        card_number VARCHAR(50),
        sync_status VARCHAR(20) DEFAULT 'pending',
        last_synced_at TIMESTAMP,
        sync_error TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS device_protocols (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        protocol_name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        connection_params_schema JSONB NOT NULL,
        auth_params_schema JSONB,
        capabilities JSONB,
        sdk_version VARCHAR(50),
        api_endpoint_pattern VARCHAR(255),
        default_port INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS device_sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID REFERENCES biometric_devices(id) ON DELETE CASCADE,
        sync_type VARCHAR(50) NOT NULL,
        sync_direction VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        records_processed INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS device_commands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        device_id UUID REFERENCES biometric_devices(id) ON DELETE CASCADE,
        device_sn VARCHAR(255) NOT NULL,
        cmd_id INTEGER NOT NULL,
        command_type VARCHAR(50) NOT NULL,
        command_content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        return_code INTEGER,
        response_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS biometric_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        pin VARCHAR(50) NOT NULL,
        finger_id INTEGER DEFAULT 0,
        template_type VARCHAR(20) NOT NULL,
        template_data TEXT NOT NULL,
        template_size INTEGER DEFAULT 0,
        source_device_sn VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, pin, finger_id, template_type)
      );

      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS palm_templates JSONB;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_fingerprint BOOLEAN DEFAULT false;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_face BOOLEAN DEFAULT false;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_palm BOOLEAN DEFAULT false;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_card BOOLEAN DEFAULT false;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_fingerprint BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_face BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_palm BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS card_number VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS biometric_pin VARCHAR(50);

      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'clock_method') THEN
              ALTER TABLE attendance_records ADD COLUMN clock_method VARCHAR(20) DEFAULT 'manual';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'device_id') THEN
              ALTER TABLE attendance_records ADD COLUMN device_id UUID REFERENCES biometric_devices(id);
          END IF;
      END
      $$;
    `);

    // Seed Protocols if empty
    const protocolCount = await connection.query('SELECT count(*) as count FROM device_protocols');
    if (parseInt(protocolCount[0].count) === 0) {
      await connection.query(`
        INSERT INTO device_protocols (protocol_name, display_name, description, connection_params_schema, capabilities, default_port)
        VALUES 
        ('zkteco', 'ZKTeco ADMS & Standalone', 'Integration with ZKTeco devices via Push ADMS / TCP', '{"type":"object","properties":{"ip_address":{"type":"string"},"port":{"type":"integer"}}}', '{"fingerprint":true,"face":true,"card":true}', 4370),
        ('anviz', 'Anviz C3 Protocol', 'Anviz biometric devices via TCP/IP', '{"type":"object","properties":{"ip_address":{"type":"string"},"port":{"type":"integer"},"device_id":{"type":"integer"}}}', '{"fingerprint":true,"face":true,"card":true}', 5010);
      `);
    }
  }

  async getAllDevices(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    return connection.query(`
      SELECT * FROM biometric_devices
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [tenantId]);
  }

  async getPendingDevices(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    return connection.query(`
      SELECT * FROM biometric_devices
      WHERE tenant_id = $1 AND is_authorized = false
      ORDER BY created_at DESC
    `, [tenantId]);
  }

  async getDeviceById(tenantId: string, deviceId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const result = await connection.query(`
      SELECT * FROM biometric_devices
      WHERE tenant_id = $1 AND id = $2
    `, [tenantId, deviceId]);

    return result[0];
  }

  async createDevice(tenantId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);
    await this.ensureGlobalRegistry();

    // Validate if serial already registered globally
    const existing = await this.masterDataSource.query(
      'SELECT 1 FROM device_registry WHERE serial_number = $1',
      [data.serial_number],
    );
    if (existing.length > 0) {
      throw new BadRequestException(
        `Device Serial Number ${data.serial_number} is already registered by another tenant.`,
      );
    }

    const result = await connection.query(`
      INSERT INTO biometric_devices (
        tenant_id, name, model, brand, serial_number, 
        ip_address, registered_ip, last_seen_ip, port, protocol, auth_method, auth_credentials,
        location, timezone, status, is_authorized, authorized_at, authorized_by, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $7, $8, $9, $10, $11, $12, 'offline', true, CURRENT_TIMESTAMP, $13, $13)
      RETURNING *
    `, [
      tenantId,
      data.name,
      data.model || 'ADMS Terminal',
      data.brand || 'ZKTeco',
      data.serial_number,
      data.ip_address || null,
      data.port || 4370,
      data.protocol || 'zkteco',
      data.auth_method || null,
      data.auth_credentials || null,
      data.location || 'Main Office',
      data.timezone || 'UTC',
      data.created_by,
    ]);

    const newDevice = result[0];

    // Register in Global Registry
    await this.masterDataSource.query(`
        INSERT INTO device_registry (serial_number, tenant_id, device_id)
        VALUES ($1, $2, $3)
    `, [newDevice.serial_number, tenantId, newDevice.id]);

    // Emit live WebSocket notification
    this.devicesGateway.emitDeviceRegistered(tenantId, newDevice);

    return newDevice;
  }

  async authorizeDevice(tenantId: string, deviceId: string, authorizedByUserId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const result = await connection.query(`
      UPDATE biometric_devices
      SET is_authorized = true,
          status = 'Online',
          authorized_at = CURRENT_TIMESTAMP,
          authorized_by = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
    `, [tenantId, deviceId, authorizedByUserId || null]);

    if (!result || result.length === 0) {
      throw new NotFoundException('Device not found or does not belong to this tenant');
    }

    const device = result[0];
    this.devicesGateway.emitDeviceAuthorized(tenantId, device);
    return device;
  }

  async revokeDevice(tenantId: string, deviceId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const result = await connection.query(`
      UPDATE biometric_devices
      SET is_authorized = false,
          status = 'unauthorized',
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
    `, [tenantId, deviceId]);

    if (!result || result.length === 0) {
      throw new NotFoundException('Device not found or does not belong to this tenant');
    }

    const device = result[0];
    this.devicesGateway.emitDeviceRevoked(tenantId, device);
    return device;
  }

  async updateDevice(tenantId: string, deviceId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields = [
      'name', 'model', 'brand', 'ip_address', 'port', 'protocol',
      'location', 'timezone', 'auth_method', 'auth_credentials',
      'is_active', 'sync_enabled', 'sync_interval_minutes',
    ];

    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${idx}`);
        values.push(data[key]);
        idx++;
      }
    }

    if (updates.length === 0) return this.getDeviceById(tenantId, deviceId);

    values.push(tenantId);
    values.push(deviceId);

    const result = await connection.query(`
      UPDATE biometric_devices
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $${idx} AND id = $${idx + 1}
      RETURNING *
    `, values);

    const updated = result[0];
    if (updated) {
      this.devicesGateway.emitDeviceStatusChanged(tenantId, updated);
    }
    return updated;
  }

  async deleteDevice(tenantId: string, deviceId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const device = await this.getDeviceById(tenantId, deviceId);
    if (device) {
      await connection.query(`
        DELETE FROM biometric_devices
        WHERE tenant_id = $1 AND id = $2
      `, [tenantId, deviceId]);

      // Remove from global registry
      await this.masterDataSource.query(
        'DELETE FROM device_registry WHERE serial_number = $1',
        [device.serial_number],
      );

      this.devicesGateway.emitDeviceDeleted(tenantId, deviceId);
    }

    return { success: true };
  }

  async updateDeviceStatus(
    tenantId: string,
    deviceId: string,
    statusUpdates: { status?: string; last_sync_at?: Date; current_users?: number; last_heartbeat_at?: Date; last_seen_ip?: string },
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (statusUpdates.status) {
      updates.push(`status = $${idx++}`);
      values.push(statusUpdates.status);
    }
    if (statusUpdates.last_sync_at) {
      updates.push(`last_sync_at = $${idx++}`);
      values.push(statusUpdates.last_sync_at);
    }
    if (statusUpdates.last_heartbeat_at) {
      updates.push(`last_heartbeat_at = $${idx++}`);
      values.push(statusUpdates.last_heartbeat_at);
    }
    if (statusUpdates.last_seen_ip) {
      updates.push(`last_seen_ip = $${idx++}`);
      values.push(statusUpdates.last_seen_ip);
    }
    if (statusUpdates.current_users !== undefined) {
      updates.push(`current_users = $${idx++}`);
      values.push(statusUpdates.current_users);
    }

    if (updates.length === 0) return;

    values.push(tenantId);
    values.push(deviceId);

    const result = await connection.query(`
      UPDATE biometric_devices
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $${idx} AND id = $${idx + 1}
      RETURNING *
    `, values);

    const updated = result[0];
    if (updated) {
      this.devicesGateway.emitDeviceStatusChanged(tenantId, updated);
    }
    return updated;
  }

  async getProtocols(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);
    return connection.query('SELECT * FROM device_protocols WHERE is_active = true');
  }

  /**
   * Returns ADMS server URL configuration for this tenant.
   * e.g. { server_url: "acme.api.humanitas.ziontech.tech", port: 443 }
   */
  async getServerInfo(tenantId: string) {
    const tenantRows = await this.masterDataSource.query(
      `SELECT slug FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const tenantSlug = tenantRows.length > 0 ? tenantRows[0].slug : 'tenant';

    const baseDomain =
      this.configService.get<string>('TENANT_API_DOMAIN') ||
      'api.humanitas-erp.ziontech.tech';

    return {
      server_url: `${tenantSlug}.${baseDomain}`,
      base_domain: baseDomain,
      tenant_slug: tenantSlug,
      port: 80,
      ssl_port: 443,
      protocol: 'ADMS',
      note: 'Enter this server address in the Cloud/ADMS server setting of your biometric terminal.',
    };
  }

  /**
   * Called during ADMS handshake.
   * If device is unknown for this tenant: auto-registers with is_authorized = false.
   * If device exists: updates heartbeat and last seen IP.
   */
  async registerOrUpdateFromAdms(
    tenantId: string,
    sn: string,
    clientIp: string,
    brand = 'ZKTeco',
    model = 'ADMS Terminal',
  ): Promise<{ device: any; isNew: boolean }> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);
    await this.ensureGlobalRegistry();

    // Check if device already exists in this tenant DB
    const existing = await connection.query(
      `SELECT * FROM biometric_devices WHERE tenant_id = $1 AND serial_number = $2`,
      [tenantId, sn],
    );

    if (existing && existing.length > 0) {
      const dev = existing[0];
      const newStatus = dev.is_authorized ? 'Online' : 'pending_authorization';

      const updated = await connection.query(`
        UPDATE biometric_devices
        SET last_heartbeat_at = CURRENT_TIMESTAMP,
            last_seen_ip = $3,
            status = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `, [dev.id, tenantId, clientIp, newStatus]);

      const updatedDev = updated[0];
      this.devicesGateway.emitDeviceStatusChanged(tenantId, updatedDev);
      return { device: updatedDev, isNew: false };
    }

    // Auto-register new device
    const result = await connection.query(`
      INSERT INTO biometric_devices (
        tenant_id, name, model, brand, serial_number,
        ip_address, registered_ip, last_seen_ip, port, protocol,
        status, is_authorized, pending_since, last_heartbeat_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $6, 4370, 'zkteco', 'pending_authorization', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      tenantId,
      `ZKTeco Terminal (${sn})`,
      model,
      brand,
      sn,
      clientIp,
    ]);

    const newDevice = result[0];

    // Global Registry entry
    await this.masterDataSource.query(`
      INSERT INTO device_registry (serial_number, tenant_id, device_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (serial_number) DO UPDATE SET tenant_id = $2, device_id = $3, updated_at = CURRENT_TIMESTAMP
    `, [sn, tenantId, newDevice.id]);

    // Live socket notification to /devices dashboard
    this.devicesGateway.emitDeviceRegistered(tenantId, newDevice);

    return { device: newDevice, isNew: true };
  }

  /**
   * Finds a device by serial number across all tenants from Global Registry.
   */
  async getDeviceBySerial(serialNumber: string): Promise<{ device: any; tenantId: string } | null> {
    await this.ensureGlobalRegistry();

    const registry = await this.masterDataSource.query(
      'SELECT tenant_id, device_id FROM device_registry WHERE serial_number = $1',
      [serialNumber],
    );

    if (!registry || registry.length === 0) return null;

    const { tenant_id, device_id } = registry[0];
    const device = await this.getDeviceById(tenant_id, device_id);

    if (!device) return null;

    return { device, tenantId: tenant_id };
  }

  /**
   * Sync all active employees from the web system to a physical biometric terminal.
   * Employees are created on the system first; the device gets them via this sync so
   * employees can enroll their fingerprints, face, or palm directly on the device.
   */
  async syncUsersToDevice(tenantId: string, deviceId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const device = await this.getDeviceById(tenantId, deviceId);
    if (!device) throw new NotFoundException('Device not found');

    const users = await connection.query(
      `SELECT id, full_name, email, phone, biometric_pin FROM users WHERE is_active = true ORDER BY created_at ASC`,
    );

    if (!users || users.length === 0) {
      return { success: true, count: 0, message: 'No active users found to sync' };
    }

    let queuedCount = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      let pin = user.biometric_pin;

      // Auto-assign numeric biometric PIN if not set
      if (!pin) {
        pin = String(i + 1);
        await connection.query(`UPDATE users SET biometric_pin = $1 WHERE id = $2`, [pin, user.id]);
      }

      // Upsert device_users mapping
      await connection.query(`
        INSERT INTO device_users (tenant_id, device_id, user_id, device_user_id, enrollment_number, sync_status)
        VALUES ($1, $2, $3, $4, $4, 'pending')
        ON CONFLICT (device_id, user_id) DO UPDATE SET
          enrollment_number = $4,
          device_user_id = $4,
          sync_status = 'pending',
          updated_at = CURRENT_TIMESTAMP
      `, [tenantId, deviceId, user.id, pin]);

      const cleanName = (user.full_name || 'Employee').replace(/[\t\r\n]/g, ' ').slice(0, 24);
      const cmdId = Math.floor(Math.random() * 900000) + 100000;

      // ZKTeco Push ADMS Protocol command: create user on device
      const userCmdContent = `DATA UPDATE user Pin=${pin}\tName=${cleanName}\tPri=0\tPasswd=\tGrp=1\tTZ=0001000100000000`;
      await this.queueCommand(tenantId, deviceId, device.serial_number, 'SYNC_USER', userCmdContent, cmdId);

      const authCmdId = Math.floor(Math.random() * 900000) + 100000;
      const authCmdContent = `DATA UPDATE userauthorize Pin=${pin}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`;
      await this.queueCommand(tenantId, deviceId, device.serial_number, 'AUTHORIZE_USER', authCmdContent, authCmdId);

      queuedCount++;
    }

    this.devicesGateway.emitDeviceSync(tenantId, {
      deviceId,
      device_name: device.name,
      synced_users: queuedCount,
      timestamp: new Date(),
    });

    return {
      success: true,
      count: queuedCount,
      message: `Queued ${queuedCount} employee(s) for hardware synchronization to ${device.name}`,
    };
  }

  /**
   * Returns an employee's comprehensive biometric status across all modalities:
   * Fingerprint, Face, Palm, and Card.
   */
  async getUserBiometricStatus(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const userRows = await connection.query(
      `SELECT id, full_name, email, has_fingerprint, has_face, has_palm, card_number, biometric_pin FROM users WHERE id = $1`,
      [userId],
    );

    if (!userRows || userRows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userRows[0];

    const deviceRegistrations = await connection.query(`
      SELECT du.*, bd.name as device_name, bd.brand as device_brand, bd.model as device_model, bd.serial_number
      FROM device_users du
      JOIN biometric_devices bd ON du.device_id = bd.id
      WHERE du.tenant_id = $1 AND du.user_id = $2
    `, [tenantId, userId]);

    const templates = await connection.query(`
      SELECT id, pin, finger_id, template_type, template_size, source_device_sn, updated_at
      FROM biometric_templates
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
    `, [tenantId, userId]);

    return {
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      biometricPin: user.biometric_pin,
      hasFingerprint: user.has_fingerprint || templates.some((t: any) => t.template_type === 'fingerprint'),
      hasFace: user.has_face || templates.some((t: any) => t.template_type === 'face'),
      hasPalm: user.has_palm || templates.some((t: any) => t.template_type === 'palm'),
      hasCard: Boolean(user.card_number),
      cardNumber: user.card_number || null,
      deviceRegistrations: deviceRegistrations || [],
      templatesCount: templates.length,
      templatesSummary: {
        fingerprints: templates.filter((t: any) => t.template_type === 'fingerprint').length,
        faces: templates.filter((t: any) => t.template_type === 'face').length,
        palms: templates.filter((t: any) => t.template_type === 'palm').length,
      },
    };
  }

  /**
   * Queue command for device execution on next getrequest poll
   */
  async queueCommand(
    tenantId: string,
    deviceId: string,
    deviceSn: string,
    commandType: string,
    commandContent: string,
    cmdId?: number,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const id = cmdId || Math.floor(Math.random() * 900000) + 100000;

    await connection.query(`
      INSERT INTO device_commands (tenant_id, device_id, device_sn, cmd_id, command_type, command_content, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `, [tenantId, deviceId, deviceSn, id, commandType, commandContent]);

    return id;
  }

  /**
   * Gets pending commands for device polling /iclock/getrequest
   */
  async getPendingCommands(tenantId: string, deviceSn: string): Promise<string> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const commands = await connection.query(`
      SELECT id, cmd_id, command_content FROM device_commands
      WHERE tenant_id = $1 AND device_sn = $2 AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `, [tenantId, deviceSn]);

    if (!commands || commands.length === 0) return 'OK';

    const commandLines: string[] = [];
    const commandIds: string[] = [];

    for (const cmd of commands) {
      commandLines.push(`C:${cmd.cmd_id}:${cmd.command_content}`);
      commandIds.push(cmd.id);
    }

    // Mark commands as sent
    await connection.query(
      `UPDATE device_commands SET status = 'sent' WHERE id = ANY($1::uuid[])`,
      [commandIds],
    );

    return commandLines.join('\n');
  }

  /**
   * Handles device response from /iclock/devicecmd
   */
  async markCommandResult(tenantId: string, deviceSn: string, rawBody: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    const lines = rawBody.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const params: Record<string, string> = {};
      line.split('&').forEach((part) => {
        const [k, v] = part.split('=');
        if (k && v !== undefined) params[k.toUpperCase()] = v;
      });

      const cmdId = params['ID'];
      const returnCode = parseInt(params['RETURN'] || '-1', 10);

      if (cmdId) {
        await connection.query(`
          UPDATE device_commands
          SET status = $1, return_code = $2, response_text = $3, executed_at = CURRENT_TIMESTAMP
          WHERE tenant_id = $4 AND device_sn = $5 AND cmd_id = $6
        `, [
          returnCode === 0 ? 'completed' : 'failed',
          returnCode,
          line,
          tenantId,
          deviceSn,
          parseInt(cmdId, 10),
        ]);
      }
    }

    return 'OK';
  }

  /**
   * Saves biometric template pushed by physical terminal and updates employee flags.
   */
  async saveBiometricTemplate(
    tenantId: string,
    deviceSn: string,
    pin: string,
    fid: string,
    templateType: 'fingerprint' | 'face' | 'palm',
    templateData: string,
    metadata?: any,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    // Find user by biometric PIN or enrollment number
    let userRow = await connection.query(
      `SELECT id, full_name FROM users WHERE biometric_pin = $1 LIMIT 1`,
      [pin],
    );

    if (!userRow || userRow.length === 0) {
      // Fallback check device_users
      const du = await connection.query(
        `SELECT user_id FROM device_users WHERE enrollment_number = $1 LIMIT 1`,
        [pin],
      );
      if (du && du.length > 0) {
        userRow = await connection.query(`SELECT id, full_name FROM users WHERE id = $1`, [du[0].user_id]);
      }
    }

    const userId = userRow && userRow.length > 0 ? userRow[0].id : null;

    // Save in biometric_templates
    await connection.query(`
      INSERT INTO biometric_templates (
        tenant_id, user_id, pin, finger_id, template_type, template_data, template_size, source_device_sn
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, pin, finger_id, template_type) DO UPDATE SET
        template_data = $6,
        template_size = $7,
        source_device_sn = $8,
        updated_at = CURRENT_TIMESTAMP
    `, [
      tenantId,
      userId,
      pin,
      parseInt(fid || '0', 10),
      templateType,
      templateData,
      templateData.length,
      deviceSn,
    ]);

    if (userId) {
      // Update flags on users table
      const flagCol = templateType === 'fingerprint'
        ? 'has_fingerprint'
        : templateType === 'face'
        ? 'has_face'
        : 'has_palm';

      await connection.query(`UPDATE users SET ${flagCol} = true WHERE id = $1`, [userId]);

      // Update flags on device_users
      await connection.query(`
        UPDATE device_users
        SET ${flagCol} = true,
            sync_status = 'synced',
            last_synced_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);

      // Emit live WebSocket notification for employee detail view & /devices
      this.devicesGateway.emitBiometricEnrolled(tenantId, {
        userId,
        fullName: userRow[0].full_name,
        pin,
        templateType,
        deviceSn,
        timestamp: new Date(),
      });
    }

    return true;
  }
}
