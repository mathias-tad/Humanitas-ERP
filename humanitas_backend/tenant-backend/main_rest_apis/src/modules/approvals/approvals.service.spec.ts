import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalsService } from './approvals.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalActionType, ApprovalRequestStatus, WorkflowRoutingMode } from './dto/approvals.dto';

describe('ApprovalsService Unit Tests', () => {
  let service: ApprovalsService;
  let mockConnection: any;

  const mockDatabaseService = {
    getTenantConnectionById: jest.fn(),
  };

  const mockNotificationsService = {
    createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };
    mockDatabaseService.getTenantConnectionById.mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
    (service as any).ensuredDatabases.add('tenant-1');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Schema & Table Initialization', () => {
    it('creates approval_workflows, steps, requests, and actions tables', async () => {
      mockConnection.query.mockResolvedValue([]);
      await service.ensureApprovalTables(mockConnection);
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  describe('Workflows Management', () => {
    it('returns list of workflows with their steps', async () => {
      const mockWfs = [
        { id: 'wf-1', name: 'PO Approval', workflow_type: 'purchase_order', steps_count: 2 },
      ];
      const mockSteps = [
        { id: 'step-1', workflow_id: 'wf-1', step_order: 1, step_name: 'Lead Review' },
        { id: 'step-2', workflow_id: 'wf-1', step_order: 2, step_name: 'CFO Signoff' },
      ];

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM approval_workflows')) return mockWfs;
        if (sql.includes('FROM approval_workflow_steps')) return mockSteps;
        return [];
      });

      const result = await service.getWorkflows('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].steps).toHaveLength(2);
    });

    it('creates a new multi-tier workflow with steps', async () => {
      const mockWf = { id: 'wf-new', name: 'Custom Workflow', workflow_type: 'expense_claim' };
      const dto = {
        name: 'Custom Workflow',
        workflow_type: 'expense_claim',
        routing_mode: WorkflowRoutingMode.SEQUENTIAL,
        steps: [
          { step_order: 1, step_name: 'Manager Review', approver_role: 'manager' },
        ],
      };

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO approval_workflows')) return [mockWf];
        if (sql.includes('INSERT INTO approval_workflow_steps')) return [];
        if (sql.includes('SELECT * FROM approval_workflows WHERE id = $1')) return [mockWf];
        if (sql.includes('SELECT * FROM approval_workflow_steps WHERE workflow_id = $1')) {
          return [{ id: 'step-1', ...dto.steps[0] }];
        }
        return [];
      });

      const result = await service.createWorkflow('tenant-1', dto);
      expect(result.id).toBe('wf-new');
      expect(result.steps).toHaveLength(1);
    });
  });

  describe('Requests Submission & Multi-Tier Decision', () => {
    it('submits a request and matches the appropriate workflow threshold', async () => {
      const submitter = { id: 'user-1', name: 'John Doe', email: 'john@example.com' };
      const dto = {
        workflow_type: 'purchase_order',
        entity_type: 'purchase_order',
        entity_id: 'po-100',
        title: 'New Laptops PO',
        amount: 6000.0,
      };

      const candidateWfs = [
        { id: 'wf-director', workflow_type: 'purchase_order', threshold_amount: '5000.00' },
        { id: 'wf-lead', workflow_type: 'purchase_order', threshold_amount: '1000.00' },
      ];

      const insertedReq = {
        id: 'req-1',
        title: dto.title,
        status: 'pending',
        current_step_order: 1,
        total_steps: 2,
      };

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM approval_workflows WHERE workflow_type')) return candidateWfs;
        if (sql.includes('COUNT(*) as cnt FROM approval_workflow_steps')) return [{ cnt: '2' }];
        if (sql.includes('INSERT INTO approval_requests')) return [insertedReq];
        if (sql.includes('WHERE r.id = $1')) return [insertedReq];
        return [];
      });

      const result = await service.submitRequest('tenant-1', submitter, dto);
      expect(result.id).toBe('req-1');
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });

    it('advances sequential step when an intermediate step is approved', async () => {
      const existingReq = {
        id: 'req-1',
        title: 'PO Equipment',
        status: ApprovalRequestStatus.PENDING,
        current_step_order: 1,
        total_steps: 2,
        submitter_id: 'user-1',
        reference_number: 'REQ-001',
      };

      let currentStep = 1;

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM approval_requests r') && sql.includes('WHERE r.id = $1')) {
          return [{ ...existingReq, current_step_order: currentStep }];
        }
        if (sql.includes('UPDATE approval_requests')) {
          currentStep = 2;
          return [];
        }
        return [];
      });

      const approver = { id: 'manager-1', name: 'Jane Manager', role: 'manager' };
      const result = await service.decideRequest('tenant-1', 'req-1', approver, {
        action: ApprovalActionType.APPROVED,
        comments: 'Looks good, moving to director',
      });

      expect(result.current_step_order).toBe(2);
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });

    it('marks request as approved when final step is reached', async () => {
      const existingReq = {
        id: 'req-1',
        title: 'PO Equipment',
        status: ApprovalRequestStatus.PENDING,
        current_step_order: 2,
        total_steps: 2,
        submitter_id: 'user-1',
        reference_number: 'REQ-001',
      };

      let currentStatus: string = ApprovalRequestStatus.PENDING;

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM approval_requests r') && sql.includes('WHERE r.id = $1')) {
          return [{ ...existingReq, status: currentStatus }];
        }
        if (sql.includes('UPDATE approval_requests')) {
          currentStatus = ApprovalRequestStatus.APPROVED;
          return [];
        }
        return [];
      });

      const approver = { id: 'cfo-1', name: 'Director', role: 'director' };
      const result = await service.decideRequest('tenant-1', 'req-1', approver, {
        action: ApprovalActionType.APPROVED,
        comments: 'Final approval granted',
      });

      expect(result.status).toBe(ApprovalRequestStatus.APPROVED);
    });

    it('immediately rejects request when rejected action is received', async () => {
      const existingReq = {
        id: 'req-1',
        title: 'PO Equipment',
        status: ApprovalRequestStatus.PENDING,
        current_step_order: 1,
        total_steps: 2,
        submitter_id: 'user-1',
        reference_number: 'REQ-001',
      };

      let currentStatus: string = ApprovalRequestStatus.PENDING;

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM approval_requests r') && sql.includes('WHERE r.id = $1')) {
          return [{ ...existingReq, status: currentStatus }];
        }
        if (sql.includes('UPDATE approval_requests')) {
          currentStatus = ApprovalRequestStatus.REJECTED;
          return [];
        }
        return [];
      });

      const approver = { id: 'manager-1', name: 'Jane Manager', role: 'manager' };
      const result = await service.decideRequest('tenant-1', 'req-1', approver, {
        action: ApprovalActionType.REJECTED,
        comments: 'Budget exceeded',
      });

      expect(result.status).toBe(ApprovalRequestStatus.REJECTED);
    });
  });

  describe('Approval Analytics & Metrics', () => {
    it('computes turnaround hours, totals, and approval rates', async () => {
      const mockStats = [{
        total_requests: '10',
        total_pending: '3',
        total_approved: '6',
        total_rejected: '1',
        total_value: '45000.00',
      }];
      const mockTypeBreakdown = [
        { workflow_type: 'purchase_order', count: '5', approved_count: '4' },
      ];

      mockConnection.query.mockImplementation(async (sql: string) => {
        if (sql.includes('COUNT(*) as total_requests')) return mockStats;
        if (sql.includes('GROUP BY workflow_type')) return mockTypeBreakdown;
        return [];
      });

      const analytics = await service.getApprovalAnalytics('tenant-1');
      expect(analytics.total_requests).toBe(10);
      expect(analytics.approval_rate).toBe(60);
      expect(analytics.avg_turnaround_hours).toBeDefined();
    });
  });
});
