import { Test, TestingModule } from '@nestjs/testing';
import { DelegationsService } from './delegations.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('DelegationsService', () => {
  let service: DelegationsService;
  let mockConnection: any;
  let mockDatabaseService: any;
  let mockNotificationsService: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<DelegationsService>(DelegationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDelegation', () => {
    it('should throw BadRequestException if delegating to oneself', async () => {
      await expect(
        service.createDelegation('tenant-1', 'user-1', {
          delegatee_id: 'user-1',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if end_date is before start_date', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      await expect(
        service.createDelegation('tenant-1', 'user-1', {
          delegatee_id: 'user-2',
          start_date: now.toISOString(),
          end_date: past.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if delegatee does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // ensureDelegationTables
      mockConnection.query.mockResolvedValueOnce([]); // delegatee query empty

      await expect(
        service.createDelegation('tenant-1', 'user-1', {
          delegatee_id: 'user-2',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully create delegation and dispatch notification', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 86400000);

      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'user-2', email: 'colleague@example.com' }]) // delegatee
        .mockResolvedValueOnce([{ id: 'user-1', first_name: 'John', last_name: 'Doe' }]) // delegator
        .mockResolvedValueOnce([{ id: 'del-123', delegator_id: 'user-1', delegatee_id: 'user-2', status: 'active' }]); // insert

      const result = await service.createDelegation('tenant-1', 'user-1', {
        delegatee_id: 'user-2',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        scope: 'APPROVALS',
        reason: 'Annual Vacation',
      });

      expect(result.id).toBe('del-123');
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });

    it('should successfully create acting assignment delegation with allowance and sync to acting_assignments', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 86400000 * 30);

      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'user-2', email: 'colleague@example.com' }]) // delegatee
        .mockResolvedValueOnce([{ id: 'user-1', first_name: 'Jane', last_name: 'Smith', position: 'VP of Finance', basic_salary: 50000 }]) // delegator
        .mockResolvedValueOnce([{
          id: 'del-acting-1',
          delegator_id: 'user-1',
          delegatee_id: 'user-2',
          is_acting_assignment: true,
          acting_position_title: 'Acting VP of Finance',
          acting_allowance_percentage: 15.00,
          status: 'active',
        }]) // insert
        .mockResolvedValueOnce([{ tbl: 'acting_assignments' }]) // tableCheck
        .mockResolvedValueOnce([]); // acting_assignments insert

      const result = await service.createDelegation('tenant-1', 'user-1', {
        delegatee_id: 'user-2',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        is_acting_assignment: true,
        acting_position_title: 'Acting VP of Finance',
        acting_allowance_percentage: 15.00,
        acting_allowance_type: 'percentage',
      });

      expect(result.is_acting_assignment).toBe(true);
      expect(result.acting_position_title).toBe('Acting VP of Finance');
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        'tenant-1',
        'user-2',
        expect.objectContaining({
          type: 'delegation_assigned',
          title: 'Acting Assignment & Delegation Appointed',
        }),
      );
    });
  });

  describe('calculateActingAllowancePreview', () => {
    it('should calculate estimated monthly allowance based on percentage of delegator salary', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'user-1', first_name: 'John', last_name: 'Doe', position: 'Director', basic_salary: 40000 }]);

      const preview = await service.calculateActingAllowancePreview('tenant-1', 'user-1', 15, 0);

      expect(preview.delegator_basic_salary).toBe(40000);
      expect(preview.allowance_percentage).toBe(15);
      expect(preview.estimated_monthly_allowance).toBe(6000);
    });

    it('should calculate estimated monthly allowance based on fixed amount', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'user-1', first_name: 'John', last_name: 'Doe', position: 'Director', basic_salary: 40000 }]);

      const preview = await service.calculateActingAllowancePreview('tenant-1', 'user-1', 0, 3500);

      expect(preview.allowance_type).toBe('fixed_amount');
      expect(preview.estimated_monthly_allowance).toBe(3500);
    });
  });

  describe('getActiveDelegationsForUser', () => {
    it('should query active delegations currently in effect', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'del-1', delegator_permissions: ['approve_leave'] }]);

      const active = await service.getActiveDelegationsForUser('tenant-1', 'user-2');
      expect(active.length).toBe(1);
    });
  });

  describe('revokeDelegation', () => {
    it('should throw NotFoundException if delegation does not exist', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([]); // not found

      await expect(
        service.revokeDelegation('tenant-1', 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a party and not admin', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'del-1', delegator_id: 'user-1', delegatee_id: 'user-2' }]);

      await expect(
        service.revokeDelegation('tenant-1', 'del-1', 'user-unrelated', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow revoking if user is delegator and deactivate acting_assignments', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'del-1', delegator_id: 'user-1', delegatee_id: 'user-2', is_acting_assignment: true }])
        .mockResolvedValueOnce([{ id: 'del-1', status: 'revoked' }])
        .mockResolvedValueOnce([{ tbl: 'acting_assignments' }])
        .mockResolvedValueOnce([]);

      const result = await service.revokeDelegation('tenant-1', 'del-1', 'user-1', false);
      expect(result.status).toBe('revoked');
    });

    it('should allow revoking if user is admin', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'del-1', delegator_id: 'user-1', delegatee_id: 'user-2', is_acting_assignment: false }])
        .mockResolvedValueOnce([{ id: 'del-1', status: 'revoked' }]);

      const result = await service.revokeDelegation('tenant-1', 'del-1', 'admin-user', true);
      expect(result.status).toBe('revoked');
    });
  });

  describe('logDelegatedAction & getDelegationAudit', () => {
    it('should insert audit record and return it', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'audit-1', action: 'approve_leave' }]);

      const result = await service.logDelegatedAction('tenant-1', {
        performed_by: 'user-2',
        on_behalf_of: 'user-1',
        action: 'approve_leave',
        resource: 'leave_request_456',
        details: { status: 'approved' },
      });

      expect(result.id).toBe('audit-1');
    });

    it('should retrieve audit records', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // ensureDelegationTables
        .mockResolvedValueOnce([{ id: 'audit-1' }]);

      const result = await service.getDelegationAudit('tenant-1', 'del-123', 'user-1', true);
      expect(result.length).toBe(1);
    });
  });
});
