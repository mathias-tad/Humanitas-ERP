import { AdmsService, ResolvedTenantInfo } from './adms.service';
import { BiometricDevicesService } from './biometric-devices.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AttendanceGateway } from '../attendance/attendance.gateway';

describe('AdmsService', () => {
  let service: AdmsService;
  let devicesService: jest.Mocked<BiometricDevicesService>;
  let databaseService: jest.Mocked<DatabaseService>;
  let configService: jest.Mocked<ConfigService>;
  let masterDataSource: { query: jest.Mock };
  let attendanceGateway: jest.Mocked<AttendanceGateway>;
  let mockConnection: { query: jest.Mock };

  const tenantInfo: ResolvedTenantInfo = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantSlug: 'acme',
    databaseName: 'tenant_acme_db',
  };

  beforeEach(() => {
    mockConnection = {
      query: jest.fn().mockResolvedValue([]),
    };

    devicesService = {
      registerOrUpdateFromAdms: jest.fn(),
      updateDeviceStatus: jest.fn(),
      getPendingCommands: jest.fn().mockResolvedValue('OK'),
      markCommandResult: jest.fn().mockResolvedValue('OK'),
      saveBiometricTemplate: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<BiometricDevicesService>;

    databaseService = {
      getTenantConnection: jest.fn().mockResolvedValue(mockConnection),
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    } as unknown as jest.Mocked<DatabaseService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'TENANT_API_DOMAIN') return 'api.humanitas-erp.ziontech.tech';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    masterDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    attendanceGateway = {
      emitClockIn: jest.fn(),
      emitClockOut: jest.fn(),
    } as unknown as jest.Mocked<AttendanceGateway>;

    service = new AdmsService(
      devicesService,
      databaseService,
      configService,
      masterDataSource as unknown as DataSource,
      attendanceGateway,
    );
  });

  describe('resolveTenant', () => {
    it('should resolve tenant from Host subdomain', async () => {
      masterDataSource.query.mockResolvedValueOnce([
        { id: tenantInfo.tenantId, slug: 'acme', database_name: tenantInfo.databaseName },
      ]);

      const req = {
        headers: { host: 'acme.api.humanitas-erp.ziontech.tech' },
        query: {},
      };

      const resolved = await service.resolveTenant(req);
      expect(resolved).toEqual(tenantInfo);
    });

    it('should resolve tenant from x-tenant-slug header', async () => {
      masterDataSource.query.mockResolvedValueOnce([
        { id: tenantInfo.tenantId, slug: 'acme', database_name: tenantInfo.databaseName },
      ]);

      const req = {
        headers: { 'x-tenant-slug': 'acme' },
        query: {},
      };

      const resolved = await service.resolveTenant(req);
      expect(resolved).toEqual(tenantInfo);
    });

    it('should fallback to device serial number lookup from device_registry', async () => {
      masterDataSource.query.mockResolvedValueOnce([
        { id: tenantInfo.tenantId, slug: 'acme', database_name: tenantInfo.databaseName },
      ]);

      const req = {
        headers: { host: 'api.humanitas-erp.ziontech.tech' },
        query: {},
      };

      const resolved = await service.resolveTenant(req, 'SN-ZKT-100');
      expect(resolved).toEqual(tenantInfo);
    });
  });

  describe('handleHandshake', () => {
    it('should return simple OK and not authorize unapproved device', async () => {
      devicesService.registerOrUpdateFromAdms.mockResolvedValueOnce({
        device: { id: 'dev-1', is_authorized: false },
        isNew: true,
      });

      const response = await service.handleHandshake('SN123', '192.168.1.50', tenantInfo, 'all');

      expect(response).toBe('OK');
      expect(devicesService.registerOrUpdateFromAdms).toHaveBeenCalledWith(
        tenantInfo.tenantId,
        'SN123',
        '192.168.1.50',
      );
    });

    it('should return full ADMS configuration parameters for authorized device', async () => {
      devicesService.registerOrUpdateFromAdms.mockResolvedValueOnce({
        device: { id: 'dev-1', is_authorized: true },
        isNew: false,
      });

      const response = await service.handleHandshake('SN123', '192.168.1.50', tenantInfo, 'all');

      expect(response).toContain('GET OPTION FROM: SN123');
      expect(response).toContain('TransInterval=1');
      expect(response).toContain('Realtime=1');
    });
  });

  describe('receiveData & Attendance Ingestion', () => {
    it('should discard ATTLOG if device is not authorized', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { id: 'dev-1', serial_number: 'SN123', is_authorized: false },
      ]);

      const res = await service.receiveData(
        'SN123',
        'ATTLOG',
        '101\t2026-10-18 09:00:00\t0\t1',
        '192.168.1.50',
        tenantInfo,
      );

      expect(res).toBe('OK');
      expect(devicesService.updateDeviceStatus).not.toHaveBeenCalled();
    });

    it('should process attendance punch if device is authorized and biometric method is allowed', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'dev-1', serial_number: 'SN123', is_authorized: true }]) // SELECT device
        .mockResolvedValueOnce([{ data: { allowed_attendance_methods: ['biometric', 'qr'] } }]) // HR settings
        .mockResolvedValueOnce([{ user_id: 'user-1' }]) // device_users mapping
        .mockResolvedValueOnce([]) // existing attendance record
        .mockResolvedValueOnce([{ id: 'att-1', user_id: 'user-1', date: '2026-10-18' }]); // INSERT attendance

      const res = await service.receiveData(
        'SN123',
        'ATTLOG',
        '101\t2026-10-18 09:00:00\t0\t1',
        '192.168.1.50',
        tenantInfo,
      );

      expect(res).toBe('OK');
      expect(attendanceGateway.emitClockIn).toHaveBeenCalled();
    });

    it('should ignore punches if biometric attendance is disabled in HR settings', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'dev-1', serial_number: 'SN123', is_authorized: true }])
        .mockResolvedValueOnce([{ data: { allowed_attendance_methods: ['qr'] } }]); // only QR allowed

      await service.receiveData(
        'SN123',
        'ATTLOG',
        '101\t2026-10-18 09:00:00\t0\t1',
        '192.168.1.50',
        tenantInfo,
      );

      expect(attendanceGateway.emitClockIn).not.toHaveBeenCalled();
    });

    it('should route BIODATA push to saveBiometricTemplate', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { id: 'dev-1', serial_number: 'SN123', is_authorized: true },
      ]);

      const biodataPayload = 'PIN=101\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=1\tTmp=mocktemplate123';

      await service.receiveData('SN123', 'BIODATA', biodataPayload, '192.168.1.50', tenantInfo);

      expect(devicesService.saveBiometricTemplate).toHaveBeenCalledWith(
        tenantInfo.tenantId,
        'SN123',
        '101',
        '0',
        'fingerprint',
        'mocktemplate123',
      );
    });
  });

  describe('getCommands & receiveCmdResult', () => {
    it('should delegate getCommands to BiometricDevicesService', async () => {
      devicesService.getPendingCommands.mockResolvedValueOnce('C:101:DATA UPDATE user Pin=1');

      const result = await service.getCommands('SN123', tenantInfo);

      expect(result).toBe('C:101:DATA UPDATE user Pin=1');
      expect(devicesService.getPendingCommands).toHaveBeenCalledWith(tenantInfo.tenantId, 'SN123');
    });

    it('should delegate receiveCmdResult to BiometricDevicesService', async () => {
      const result = await service.receiveCmdResult('SN123', 'ID=101&Return=0', tenantInfo);

      expect(result).toBe('OK');
      expect(devicesService.markCommandResult).toHaveBeenCalledWith(
        tenantInfo.tenantId,
        'SN123',
        'ID=101&Return=0',
      );
    });
  });
});
