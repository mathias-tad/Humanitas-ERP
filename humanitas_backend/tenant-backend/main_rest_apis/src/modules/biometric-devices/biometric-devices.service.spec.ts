import { BiometricDevicesService } from './biometric-devices.service';
import { DatabaseService } from '../database/database.service';
import { BiometricDevicesGateway } from './biometric-devices.gateway';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('BiometricDevicesService', () => {
  let service: BiometricDevicesService;
  let databaseService: jest.Mocked<DatabaseService>;
  let gateway: jest.Mocked<BiometricDevicesGateway>;
  let configService: jest.Mocked<ConfigService>;
  let masterDataSource: { query: jest.Mock };
  let mockConnection: { query: jest.Mock };

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const deviceId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    mockConnection = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('device_protocols')) {
          return [{ count: '2' }];
        }
        return [];
      }),
    };

    databaseService = {
      getTenantConnection: jest.fn().mockResolvedValue(mockConnection),
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    } as unknown as jest.Mocked<DatabaseService>;

    gateway = {
      emitDeviceRegistered: jest.fn(),
      emitDeviceStatusChanged: jest.fn(),
      emitDeviceAuthorized: jest.fn(),
      emitDeviceRevoked: jest.fn(),
      emitDeviceDeleted: jest.fn(),
      emitDeviceSync: jest.fn(),
      emitBiometricEnrolled: jest.fn(),
    } as unknown as jest.Mocked<BiometricDevicesGateway>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'TENANT_API_DOMAIN') return 'api.humanitas-erp.ziontech.tech';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    masterDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    // Constructor parameter order: databaseService, configService, masterDataSource, devicesGateway
    service = new BiometricDevicesService(
      databaseService,
      configService,
      masterDataSource as unknown as DataSource,
      gateway,
    );
  });

  describe('getServerInfo', () => {
    it('should return server URL formatted with tenant subdomain', async () => {
      masterDataSource.query.mockResolvedValueOnce([{ slug: 'acme-corp' }]);

      const result = await service.getServerInfo(tenantId);

      expect(result.server_url).toBe('acme-corp.api.humanitas-erp.ziontech.tech');
      expect(result.tenant_slug).toBe('acme-corp');
      expect(result.protocol).toBe('ADMS');
    });

    it('should fallback to default tenant slug if not found', async () => {
      masterDataSource.query.mockResolvedValueOnce([]);

      const result = await service.getServerInfo(tenantId);

      expect(result.server_url).toBe('tenant.api.humanitas-erp.ziontech.tech');
      expect(result.tenant_slug).toBe('tenant');
    });
  });

  describe('authorizeDevice', () => {
    it('should mark device authorized and emit socket event', async () => {
      const authorizedDevice = {
        id: deviceId,
        serial_number: 'SN123456',
        name: 'Main Gate Terminal',
        is_authorized: true,
        status: 'Online',
      };

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('UPDATE biometric_devices')) return [authorizedDevice];
        return [];
      });

      const result = await service.authorizeDevice(tenantId, deviceId, 'admin-user-id');

      expect(result.is_authorized).toBe(true);
      expect(gateway.emitDeviceAuthorized).toHaveBeenCalledWith(tenantId, authorizedDevice);
    });

    it('should throw NotFoundException if device does not exist', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('UPDATE biometric_devices')) return [];
        return [];
      });

      await expect(
        service.authorizeDevice(tenantId, 'non-existent-id', 'admin-user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeDevice', () => {
    it('should mark device revoked and emit socket event', async () => {
      const revokedDevice = {
        id: deviceId,
        serial_number: 'SN123456',
        name: 'Main Gate Terminal',
        is_authorized: false,
        status: 'offline',
      };

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('UPDATE biometric_devices')) return [revokedDevice];
        return [];
      });

      const result = await service.revokeDevice(tenantId, deviceId);

      expect(result.is_authorized).toBe(false);
      expect(gateway.emitDeviceRevoked).toHaveBeenCalledWith(tenantId, revokedDevice);
    });
  });

  describe('registerOrUpdateFromAdms', () => {
    it('should auto-register unknown terminal with is_authorized = false', async () => {
      const newDev = {
        id: deviceId,
        serial_number: 'ZKT998877',
        name: 'ZKTeco Terminal (ZKT998877)',
        is_authorized: false,
        status: 'pending_authorization',
      };

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('SELECT * FROM biometric_devices')) return [];
        if (sql.includes('INSERT INTO biometric_devices')) return [newDev];
        return [];
      });

      const result = await service.registerOrUpdateFromAdms(tenantId, 'ZKT998877', '192.168.1.100');

      expect(result.isNew).toBe(true);
      expect(result.device.is_authorized).toBe(false);
      expect(gateway.emitDeviceRegistered).toHaveBeenCalledWith(tenantId, newDev);
    });

    it('should update heartbeat if device already registered', async () => {
      const existingDev = {
        id: deviceId,
        serial_number: 'ZKT998877',
        is_authorized: true,
      };
      const updatedDev = {
        ...existingDev,
        status: 'Online',
      };

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('SELECT * FROM biometric_devices')) return [existingDev];
        if (sql.includes('UPDATE biometric_devices')) return [updatedDev];
        return [];
      });

      const result = await service.registerOrUpdateFromAdms(tenantId, 'ZKT998877', '192.168.1.100');

      expect(result.isNew).toBe(false);
      expect(result.device.status).toBe('Online');
      expect(gateway.emitDeviceStatusChanged).toHaveBeenCalledWith(tenantId, updatedDev);
    });
  });

  describe('queueCommand & getPendingCommands', () => {
    it('should queue and format pending ADMS commands', async () => {
      const pendingCmds = [
        { id: 'cmd-uuid-1', cmd_id: 101, command_content: 'DATA UPDATE user Pin=1\tName=Alice' },
        { id: 'cmd-uuid-2', cmd_id: 102, command_content: 'DATA UPDATE userauthorize Pin=1\tAuthorizeTimezoneId=1' },
      ];

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('SELECT id, cmd_id, command_content FROM device_commands')) return pendingCmds;
        return [];
      });

      await service.queueCommand(tenantId, deviceId, 'SN123', 'SYNC_USER', 'DATA UPDATE user Pin=1\tName=Alice', 101);
      const commandsOutput = await service.getPendingCommands(tenantId, 'SN123');

      expect(commandsOutput).toContain('C:101:DATA UPDATE user Pin=1\tName=Alice');
      expect(commandsOutput).toContain('C:102:DATA UPDATE userauthorize Pin=1\tAuthorizeTimezoneId=1');
    });

    it('should return OK when no pending commands exist', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        return [];
      });

      const output = await service.getPendingCommands(tenantId, 'SN123');
      expect(output).toBe('OK');
    });
  });

  describe('saveBiometricTemplate', () => {
    it('should save template and update employee biometric flags', async () => {
      const userId = 'user-uuid-123';
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('device_protocols')) return [{ count: '2' }];
        if (sql.includes('SELECT id, full_name FROM users')) return [{ id: userId, full_name: 'John Doe' }];
        return [];
      });

      const res = await service.saveBiometricTemplate(
        tenantId,
        'SN123',
        '101',
        '0',
        'fingerprint',
        'sample-template-binary-data',
      );

      expect(res).toBe(true);
      expect(gateway.emitBiometricEnrolled).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          userId,
          fullName: 'John Doe',
          templateType: 'fingerprint',
        }),
      );
    });
  });
});
