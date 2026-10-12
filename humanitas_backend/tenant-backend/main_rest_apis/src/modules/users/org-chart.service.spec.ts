import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

describe('UsersService - Org Chart & Reporting Hierarchy', () => {
  let service: UsersService;
  let mockConnection: any;
  let mockTenantRepo: any;

  const mockUsers = [
    {
      id: 'ceo-1',
      full_name: 'Alice CEO',
      email: 'alice@example.com',
      phone: '1234567890',
      role: 'owner',
      department: 'Executive',
      position: 'Chief Executive Officer',
      avatar_url: null,
      manager_id: null,
      is_active: true,
      manager_name: null,
    },
    {
      id: 'vp-eng-2',
      full_name: 'Bob VP Eng',
      email: 'bob@example.com',
      phone: '1234567891',
      role: 'manager',
      department: 'Engineering',
      position: 'VP of Engineering',
      avatar_url: null,
      manager_id: 'ceo-1',
      is_active: true,
      manager_name: 'Alice CEO',
    },
    {
      id: 'dev-1-3',
      full_name: 'Charlie Dev',
      email: 'charlie@example.com',
      phone: '1234567892',
      role: 'employee',
      department: 'Engineering',
      position: 'Senior Engineer',
      avatar_url: null,
      manager_id: 'vp-eng-2',
      is_active: true,
      manager_name: 'Bob VP Eng',
    },
    {
      id: 'dev-2-4',
      full_name: 'David Dev',
      email: 'david@example.com',
      phone: '1234567893',
      role: 'employee',
      department: 'Engineering',
      position: 'Frontend Engineer',
      avatar_url: null,
      manager_id: 'vp-eng-2',
      is_active: true,
      manager_name: 'Bob VP Eng',
    },
  ];

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    const mockDatabaseService = {
      getTenantConnection: jest.fn().mockResolvedValue(mockConnection),
    };

    mockTenantRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        slug: 'test-tenant',
        database_name: 'tenant_db_test',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepo,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
        {
          provide: NotificationsGateway,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getOrgChartTree', () => {
    it('should build hierarchical tree with correct direct_reports_count and recursive team_count', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT DISTINCT department')) {
          return Promise.resolve([{ department: 'Engineering' }, { department: 'Executive' }]);
        }
        return Promise.resolve(mockUsers);
      });

      const result = await service.getOrgChartTree('test-tenant');

      expect(result.totalEmployees).toBe(4);
      expect(result.rootCount).toBe(1);
      expect(result.departments).toEqual(['Engineering', 'Executive']);

      const root = result.rootNodes[0];
      expect(root.id).toBe('ceo-1');
      expect(root.direct_reports_count).toBe(1);
      expect(root.team_count).toBe(3); // Bob, Charlie, David

      const vp = root.children[0];
      expect(vp.id).toBe('vp-eng-2');
      expect(vp.direct_reports_count).toBe(2);
      expect(vp.team_count).toBe(2); // Charlie, David
      expect(vp.children.length).toBe(2);
    });

    it('should filter by department when department parameter is provided', async () => {
      mockConnection.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT DISTINCT department')) {
          return Promise.resolve([{ department: 'Engineering' }]);
        }
        // Filter query
        if (params && params[0] === 'Engineering') {
          return Promise.resolve(mockUsers.filter((u) => u.department === 'Engineering'));
        }
        return Promise.resolve(mockUsers);
      });

      const result = await service.getOrgChartTree('test-tenant', 'Engineering');

      expect(result.totalEmployees).toBe(3);
      // Since VP has manager_id 'ceo-1' which is not in the engineering list, VP becomes root of the engineering slice
      expect(result.rootCount).toBe(1);
      expect(result.rootNodes[0].id).toBe('vp-eng-2');
      expect(result.rootNodes[0].children.length).toBe(2);
    });
  });

  describe('getReportingChain', () => {
    it('should retrieve target user, ancestors chain, direct reports, and peers', async () => {
      mockConnection.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('manager_id = $1 AND id != $2')) {
          // peers query
          return Promise.resolve([mockUsers[3]]);
        }
        if (sql.includes('manager_id = $1 AND is_active = true')) {
          // direct reports query
          return Promise.resolve([]);
        }
        if (params && params[0] === 'dev-1-3') {
          // target user query
          return Promise.resolve([mockUsers[2]]);
        }
        if (params && params[0] === 'vp-eng-2') {
          // manager query
          return Promise.resolve([mockUsers[1]]);
        }
        if (params && params[0] === 'ceo-1') {
          // CEO query
          return Promise.resolve([mockUsers[0]]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getReportingChain('dev-1-3', 'test-tenant');

      expect(result.user.id).toBe('dev-1-3');
      expect(result.ancestors.length).toBe(2);
      expect(result.ancestors[0].id).toBe('ceo-1');
      expect(result.ancestors[1].id).toBe('vp-eng-2');
      expect(result.peers.length).toBe(1);
      expect(result.peers[0].id).toBe('dev-2-4');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockConnection.query.mockResolvedValue([]);

      await expect(
        service.getReportingChain('non-existent-id', 'test-tenant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateManager', () => {
    it('should reject employee reporting to themselves with BadRequestException', async () => {
      await expect(
        service.updateManager('emp-1', 'emp-1', 'test-tenant'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject circular reporting hierarchy when manager is a subordinate', async () => {
      // Bob is manager of Charlie. Now try to set Bob's manager to Charlie.
      // Traverse Charlie's chain: Charlie -> Bob (cycle detected!)
      mockConnection.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id, full_name FROM users WHERE id = $1')) {
          return Promise.resolve([{ id: params[0], full_name: 'Test' }]);
        }
        if (sql.includes('SELECT manager_id FROM users WHERE id = $1')) {
          if (params[0] === 'dev-1-3') {
            return Promise.resolve([{ manager_id: 'vp-eng-2' }]); // Charlie reports to Bob
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await expect(
        service.updateManager('vp-eng-2', 'dev-1-3', 'test-tenant'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update reporting manager for valid non-cyclic assignment', async () => {
      mockConnection.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id, full_name FROM users WHERE id = $1')) {
          return Promise.resolve([{ id: params[0], full_name: 'Test' }]);
        }
        if (sql.includes('SELECT manager_id FROM users WHERE id = $1')) {
          return Promise.resolve([{ manager_id: null }]);
        }
        if (sql.includes('UPDATE users SET manager_id')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve([]);
      });

      const res = await service.updateManager('dev-1-3', 'ceo-1', 'test-tenant');

      expect(res.success).toBe(true);
      expect(res.employeeId).toBe('dev-1-3');
      expect(res.managerId).toBe('ceo-1');
    });

    it('should successfully unassign manager when managerId is null', async () => {
      mockConnection.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id, full_name FROM users WHERE id = $1')) {
          return Promise.resolve([{ id: params[0], full_name: 'Test' }]);
        }
        if (sql.includes('UPDATE users SET manager_id')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve([]);
      });

      const res = await service.updateManager('dev-1-3', null, 'test-tenant');

      expect(res.success).toBe(true);
      expect(res.managerId).toBeNull();
    });
  });
});
