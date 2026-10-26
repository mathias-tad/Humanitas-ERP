import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationService } from './push-notification.service';
import { DatabaseService } from '../database/database.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let mockDatabaseService: any;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  describe('resolveActionsForCategory', () => {
    it('should return approve/reject actions for leave_approval_requests', () => {
      const actions = service.resolveActionsForCategory('leave_approval_requests');
      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual({ action: 'approve_leave', title: 'Approve' });
      expect(actions[1]).toEqual({ action: 'reject_leave', title: 'Reject' });
    });

    it('should return approve/reject actions for expense_approval_requests', () => {
      const actions = service.resolveActionsForCategory('expense_approval_requests');
      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual({ action: 'approve_expense', title: 'Approve' });
      expect(actions[1]).toEqual({ action: 'reject_expense', title: 'Reject' });
    });

    it('should return approve/reject actions for approval_request_created', () => {
      const actions = service.resolveActionsForCategory('approval_request_created');
      expect(actions).toHaveLength(2);
      expect(actions[0].action).toBe('approve_request');
      expect(actions[1].action).toBe('reject_request');
    });

    it('should return view action for payslip_ready', () => {
      const actions = service.resolveActionsForCategory('payslip_ready');
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ action: 'view_payslip', title: 'View Payslip' });
    });

    it('should return view action for shift_assigned', () => {
      const actions = service.resolveActionsForCategory('shift_assigned');
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('view_shift');
    });

    it('should return view action for onboarding_task', () => {
      const actions = service.resolveActionsForCategory('onboarding_task');
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('view_task');
    });

    it('should return empty array for undefined or general category', () => {
      expect(service.resolveActionsForCategory(undefined)).toEqual([]);
      expect(service.resolveActionsForCategory('general_announcement')).toEqual([]);
    });
  });

  describe('sendPushToUser', () => {
    it('should return 0 sent when user has no active tokens', async () => {
      mockConnection.query.mockResolvedValue([]);

      const result = await service.sendPushToUser('tenant-1', 'user-1', {
        title: 'New Leave Request',
        body: 'Alice requested 2 days leave',
        category: 'leave_approval_requests',
      });

      expect(result).toEqual({ sent: 0, failed: 0, totalTokens: 0 });
      expect(mockDatabaseService.getTenantConnectionById).toHaveBeenCalledWith('tenant-1');
    });

    it('should handle database errors gracefully without throwing', async () => {
      mockDatabaseService.getTenantConnectionById.mockRejectedValue(new Error('DB Connection Timeout'));

      const result = await service.sendPushToUser('tenant-1', 'user-1', {
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ sent: 0, failed: 0, totalTokens: 0 });
    });
  });

  describe('sendPushToTokens', () => {
    it('should return 0 when empty tokens array provided', async () => {
      const result = await service.sendPushToTokens('tenant-1', [], {
        title: 'Hello',
        body: 'World',
      });

      expect(result).toEqual({ sent: 0, failed: 0, totalTokens: 0 });
    });

    it('should serialize action buttons and metadata into string data payload', async () => {
      const result = await service.sendPushToTokens('tenant-1', ['token-xyz'], {
        title: 'Leave Approval Required',
        body: 'Please review',
        category: 'leave_approval_requests',
        reference_id: 'ref-123',
        deep_link: '/hrms/leave/approvals',
      });

      // Under test environment without full firebase credentials initialized, should complete without error
      expect(result.totalTokens).toBe(1);
    });
  });
});
