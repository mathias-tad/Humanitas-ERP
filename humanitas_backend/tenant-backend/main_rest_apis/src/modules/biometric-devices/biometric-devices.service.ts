import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BiometricDevicesService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectDataSource() private readonly masterDataSource: DataSource
  ) { }

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
        port INTEGER DEFAULT 4370,
        protocol VARCHAR(50) NOT NULL,
        auth_method VARCHAR(50),
        auth_credentials JSONB,
        location VARCHAR(255),
        timezone VARCHAR(50) DEFAULT 'UTC',
        status VARCHAR(20) DEFAULT 'offline',
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

      -- Update attendance_records to track method used if not exists
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

      -- Update settings table to include attendance_method preference if not exists
      -- Note: settings table structure in this app is usually key-value or similar, check logic below
      -- Assuming standard settings table pattern from analysis:
      -- ALTER TABLE settings ADD COLUMN IF NOT EXISTS attendance_method JSONB DEFAULT '{"allowed_methods": ["qr", "biometric"], "default": "both"}'::jsonb;
      -- Based on known codebase, settings are often rows with keys. Let's ensure a default setting exists via query later if needed.
    `);

    // Seed Protocols if empty
    const protocolCount = await connection.query('SELECT count(*) as count FROM device_protocols');
    if (parseInt(protocolCount[0].count) === 0) {
      await connection.query(`
        INSERT INTO device_protocols (protocol_name, display_name, description, connection_params_schema, capabilities, default_port)
        VALUES 
        ('zkteco', 'ZKTeco Standalone SDK', 'Integration with ZKTeco devices via Pull SDK / TCP', '{"type":"object","properties":{"ip_address":{"type":"string"},"port":{"type":"integer"}}}', '{"fingerprint":true,"face":true,"card":true}', 4370),
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
    const existing = await this.masterDataSource.query('SELECT 1 FROM device_registry WHERE serial_number = $1', [data.serial_number]);
    if (existing.length > 0) {
      throw new BadRequestException(`Device Serial Number ${data.serial_number} is already registered by another tenant.`);
    }

    // Validate Protocol
    const protocolExists = await connection.query(`
      SELECT 1 FROM device_protocols WHERE protocol_name = $1
    `, [data.protocol]);

    // For now allow 'zkteco' as default if not in seed
    // if (protocolExists.length === 0) throw new BadRequestException('Invalid protocol');

    const result = await connection.query(`
      INSERT INTO biometric_devices (
        tenant_id, name, model, brand, serial_number, 
        ip_address, port, protocol, auth_method, auth_credentials,
        location, timezone, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      tenantId, data.name, data.model, data.brand, data.serial_number,
      data.ip_address, data.port || 4370, data.protocol, data.auth_method, data.auth_credentials,
      data.location, data.timezone || 'UTC', 'offline', data.created_by
    ]);

    const newDevice = result[0];

    // Register in Global Registry
    await this.masterDataSource.query(`
        INSERT INTO device_registry (serial_number, tenant_id, device_id)
        VALUES ($1, $2, $3)
    `, [newDevice.serial_number, tenantId, newDevice.id]);

    return newDevice;
  }

  async updateDevice(tenantId: string, deviceId: string, data: any) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields = ['name', 'model', 'brand', 'ip_address', 'port', 'protocol', 'location', 'timezone', 'auth_method', 'auth_credentials', 'is_active', 'sync_enabled', 'sync_interval_minutes'];

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

    return result[0];
  }

  async deleteDevice(tenantId: string, deviceId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);

    await connection.query(`
      DELETE FROM biometric_devices
      WHERE tenant_id = $1 AND id = $2
    `, [tenantId, deviceId]);

    return { success: true };
  }

  async updateDeviceStatus(tenantId: string, deviceId: string, statusUpdates: { status?: string, last_sync_at?: Date, current_users?: number }) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    // We skip ensureBiometricTables here for performance as it should exist if we are updating

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
    if (statusUpdates.current_users !== undefined) {
      updates.push(`current_users = $${idx++}`);
      values.push(statusUpdates.current_users);
    }

    if (updates.length === 0) return;

    values.push(tenantId);
    values.push(deviceId);

    await connection.query(`
            UPDATE biometric_devices
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = $${idx} AND id = $${idx + 1}
        `, values);
  }

  async getProtocols(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureBiometricTables(connection);
    return connection.query('SELECT * FROM device_protocols WHERE is_active = true');
  }

  /**
   * Finds a device by serial number across all tenants.
   * This is required for ADMS because devices only send their SN, not the tenant ID.
   */
  async getDeviceBySerial(serialNumber: string): Promise<{ device: any, tenantId: string } | null> {
    await this.ensureGlobalRegistry();

    // 1. Find which tenant owns this device from Global Registry
    const registry = await this.masterDataSource.query(
      'SELECT tenant_id, device_id FROM device_registry WHERE serial_number = $1',
      [serialNumber]
    );

    if (!registry || registry.length === 0) return null; // Unauthorized device

    const { tenant_id, device_id } = registry[0];

    // 2. Connect to that tenant and get device details
    // Note: getDeviceById internally handles connection logic
    const device = await this.getDeviceById(tenant_id, device_id);

    if (!device) return null; // Should not happen unless inconsistent state

    return { device, tenantId: tenant_id };
  }
}
