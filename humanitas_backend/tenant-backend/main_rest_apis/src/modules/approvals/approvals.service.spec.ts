import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalsService } from './approvals.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

describe('ApprovalsService Unit Tests', () => {
  let service: ApprovalsService;
  let mockDatabaseService: any;
  let mockNotificationsService: any;

  // In-memory mock DB state
  let workflowsTable: any[] = [];
  let stepsTable: any[] = [];
  let requestsTable: any[] = [];
  let actionsTable: any[] = [];

  const mockConnection = {
    options: { database: 'tenant_test_db' },
    query: jest.fn().mockImplementation(async (sql: string, params: any[] = []) => {
      // DDL & Table creation
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
        return [];
      }

      // 1. approval_workflows count (seeding check)
      if (sql.includes('SELECT COUNT(*) as count FROM approval_workflows')) {
        return [{ count: String(workflowsTable.length) }];
      }

      // 2. INSERT INTO approval_workflows
      if (sql.includes('INSERT INTO approval_workflows')) {
        const id = randomUUID();
        const now = new Date().toISOString();
        let company_id = null;
        let branch_id = null;
        let workflow_type = '';
        let name = '';
        let description = null;
        let routing_mode = 'sequential';
        let threshold_amount: number | null = null;
        let threshold_currency = 'USD';
        let department = null;
        let is_active = true;

        if (params.length >= 10) {
          [
            company_id,
            branch_id,
            workflow_type,
            name,
            description,
            routing_mode,
            threshold_amount,
            threshold_currency,
            department,
            is_active,
          ] = params;
        } else if (sql.includes("'purchase_order'")) {
          workflow_type = 'purchase_order';
          name = 'Purchase Orders Approval';
          routing_mode = 'sequential';
          threshold_amount = 1000.0;
        } else if (sql.includes("'leave_request'")) {
          workflow_type = 'leave_request';
          name = 'Leave & Overtime Claims';
        } else if (sql.includes("'overtime_claim'")) {
          workflow_type = 'overtime_claim';
          name = 'Overtime Claims Approval';
        } else if (sql.includes("'expense_claim'")) {
          workflow_type = 'expense_claim';
          name = 'Expense Claims Approval';
        } else if (sql.includes("'journal_entry'")) {
          workflow_type = 'journal_entry';
          name = 'General Journal Postings';
        }

        const newWf = {
          id,
          company_id,
          branch_id,
          workflow_type,
          name,
          description,
          routing_mode,
          threshold_amount,
          threshold_currency,
          department,
          is_active: is_active ?? true,
          created_at: now,
          updated_at: now,
        };
        workflowsTable.push(newWf);
        return [newWf];
      }

      // 3. INSERT INTO approval_workflow_steps
      if (sql.includes('INSERT INTO approval_workflow_steps')) {
        if (params.length >= 7) {
          const [
            workflow_id,
            step_order,
            step_name,
            approver_role,
            approver_user_id,
            require_all_in_step,
            escalation_hours,
          ] = params;
          const step = {
            id: randomUUID(),
            workflow_id,
            step_order,
            step_name,
            approver_role,
            approver_user_id,
            require_all_in_step,
            escalation_hours,
          };
          stepsTable.push(step);
          return [step];
        }

        // Seeded multi-row steps
        const wfId = params[0];
        if (sql.includes('Team Lead Approval')) {
          stepsTable.push(
            { id: randomUUID(), workflow_id: wfId, step_order: 1, step_name: 'Team Lead Approval', approver_role: 'Manager' },
            { id: randomUUID(), workflow_id: wfId, step_order: 2, step_name: 'Director Approval', approver_role: 'Director' },
            { id: randomUUID(), workflow_id: wfId, step_order: 3, step_name: 'CFO Approval', approver_role: 'Administrator' },
          );
        } else if (sql.includes('Line Manager Review')) {
          stepsTable.push(
            { id: randomUUID(), workflow_id: wfId, step_order: 1, step_name: 'Line Manager Review', approver_role: 'Manager' },
          );
        } else if (sql.includes('Department Manager Review')) {
          stepsTable.push(
            { id: randomUUID(), workflow_id: wfId, step_order: 1, step_name: 'Department Manager Review', approver_role: 'Manager' },
            { id: randomUUID(), workflow_id: wfId, step_order: 2, step_name: 'Finance Approval', approver_role: 'Administrator' },
          );
        } else if (sql.includes('Senior Accountant Review')) {
          stepsTable.push(
            { id: randomUUID(), workflow_id: wfId, step_order: 1, step_name: 'Senior Accountant Review', approver_role: 'Manager' },
            { id: randomUUID(), workflow_id: wfId, step_order: 2, step_name: 'Finance Director Sign-off', approver_role: 'Administrator' },
          );
        }
        return [];
      }

      // 4. SELECT * FROM approval_workflows WHERE id = $1
      if (sql.includes('SELECT * FROM approval_workflows WHERE id = $1')) {
        const id = params[0];
        const wf = workflowsTable.find((w) => w.id === id);
        return wf ? [wf] : [];
      }

      // 5. SELECT * FROM approval_workflow_steps WHERE workflow_id = $1
      if (sql.includes('SELECT * FROM approval_workflow_steps WHERE workflow_id = $1')) {
        const wfId = params[0];
        if (params.length === 2 && sql.includes('step_order = $2')) {
          const stepOrder = params[1];
          return stepsTable.filter((s) => s.workflow_id === wfId && s.step_order === stepOrder);
        }
        return stepsTable
          .filter((s) => s.workflow_id === wfId)
          .sort((a, b) => a.step_order - b.step_order);
      }

      // 6. SELECT * FROM approval_workflow_steps WHERE workflow_id = ANY($1::uuid[])
      if (sql.includes('WHERE workflow_id = ANY')) {
        const ids = params[0] || [];
        return stepsTable
          .filter((s) => ids.includes(s.workflow_id))
          .sort((a, b) => a.step_order - b.step_order);
      }

      // 7. Auto-match workflow query
      if (sql.includes('SELECT * FROM approval_workflows') && sql.includes('workflow_type = $1')) {
        const wfType = params[0];
        const amount = params[4] || 0;
        const matches = workflowsTable
          .filter(
            (w) =>
              w.workflow_type === wfType &&
              w.is_active &&
              (w.threshold_amount === null || amount >= w.threshold_amount),
          )
          .sort((a, b) => {
            const diffAmount = (b.threshold_amount || 0) - (a.threshold_amount || 0);
            if (diffAmount !== 0) return diffAmount;
            return workflowsTable.indexOf(b) - workflowsTable.indexOf(a);
          });
        return matches.length ? [matches[0]] : [];
      }

      // 8. General SELECT * FROM approval_workflows
      if (sql.includes('SELECT * FROM approval_workflows')) {
        return [...workflowsTable];
      }

      // 9. INSERT INTO approval_requests
      if (sql.includes('INSERT INTO approval_requests')) {
        const id = randomUUID();
        const now = new Date().toISOString();
        const [
          company_id,
          branch_id,
          workflow_id,
          workflow_type,
          entity_type,
          entity_id,
          reference_number,
          title,
          amount,
          currency,
          submitter_id,
          submitter_name,
          submitter_email,
          department,
          total_steps,
        ] = params;

        const req = {
          id,
          tenant_id: null,
          company_id,
          branch_id,
          workflow_id,
          workflow_type,
          entity_type,
          entity_id,
          reference_number,
          title,
          amount,
          currency: currency || 'USD',
          submitter_id,
          submitter_name,
          submitter_email,
          department,
          current_step_order: 1,
          total_steps: total_steps || 1,
          status: 'pending',
          created_at: now,
          updated_at: now,
        };
        requestsTable.push(req);
        return [req];
      }

      // 10. SELECT * FROM approval_requests WHERE id = $1
      if (sql.includes('FROM approval_requests') && sql.includes('WHERE r.id = $1')) {
        const id = params[0];
        const req = requestsTable.find((r) => r.id === id);
        if (!req) return [];
        const wf = workflowsTable.find((w) => w.id === req.workflow_id);
        return [{ ...req, workflow_name: wf?.name, workflow_routing_mode: wf?.routing_mode }];
      }
      if (sql.includes('SELECT * FROM approval_requests WHERE id = $1')) {
        const id = params[0];
        const req = requestsTable.find((r) => r.id === id);
        return req ? [req] : [];
      }

      // 11. INSERT INTO approval_request_actions
      if (sql.includes('INSERT INTO approval_request_actions')) {
        const id = randomUUID();
        const [request_id, step_order, approver_id, approver_name, approver_role, action, comments] =
          params;
        const actionRow = {
          id,
          request_id,
          step_order,
          approver_id,
          approver_name,
          approver_role,
          action,
          comments,
          created_at: new Date().toISOString(),
        };
        actionsTable.push(actionRow);
        return [actionRow];
      }

      // 12. SELECT * FROM approval_request_actions WHERE request_id = $1
      if (sql.includes('SELECT * FROM approval_request_actions WHERE request_id = $1')) {
        const reqId = params[0];
        return actionsTable
          .filter((a) => a.request_id === reqId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }

      // 13. UPDATE approval_workflows
      if (sql.includes('UPDATE approval_workflows')) {
        const id = params[0];
        const wf = workflowsTable.find((w) => w.id === id);
        if (wf) {
          if (params.length > 1 && params[1] !== undefined) wf.name = params[1];
          if (params.length > 2 && params[2] !== undefined) wf.description = params[2];
          wf.updated_at = new Date().toISOString();
          return [wf];
        }
        return [];
      }

      // 14. DELETE FROM approval_workflow_steps
      if (sql.includes('DELETE FROM approval_workflow_steps WHERE workflow_id = $1')) {
        const wfId = params[0];
        stepsTable = stepsTable.filter((s) => s.workflow_id !== wfId);
        return [];
      }

      // 15. DELETE FROM approval_workflows
      if (sql.includes('DELETE FROM approval_workflows WHERE id = $1')) {
        const id = params[0];
        workflowsTable = workflowsTable.filter((w) => w.id !== id);
        return [];
      }

      // 16. UPDATE approval_requests (current_step_order or status)
      if (sql.includes('UPDATE approval_requests')) {
        if (sql.includes('SET current_step_order = $1')) {
          const nextStep = params[0];
          const reqId = params[1];
          const req = requestsTable.find((r) => r.id === reqId);
          if (req) {
            req.current_step_order = nextStep;
            req.updated_at = new Date().toISOString();
            return [req];
          }
        }
        if (sql.includes('SET status = $1') || sql.includes("SET status = 'rejected'") || sql.includes("SET status = 'approved'")) {
          const status = sql.includes("'rejected'") ? 'rejected' : 'approved';
          const reqId = params[0];
          const req = requestsTable.find((r) => r.id === reqId);
          if (req) {
            req.status = status;
            req.updated_at = new Date().toISOString();
            return [req];
          }
        }
        return [];
      }

      // 17. SELECT COUNT(*) as count FROM approval_requests
      if (sql.includes('SELECT COUNT(*) as count FROM approval_requests')) {
        if (sql.includes("status = 'pending'")) {
          const c = requestsTable.filter((r) => r.status === 'pending').length;
          return [{ count: String(c) }];
        }
        return [{ count: String(requestsTable.length) }];
      }

      // 18. SELECT COUNT(DISTINCT r.id) as count FROM approval_requests
      if (sql.includes('SELECT COUNT(DISTINCT r.id) as count')) {
        const c = requestsTable.filter((r) => r.status === 'pending').length;
        return [{ count: String(c) }];
      }

      // 19. SELECT status, COUNT(*) as count FROM approval_requests
      if (sql.includes('GROUP BY status')) {
        const counts: Record<string, number> = {};
        for (const r of requestsTable) {
          counts[r.status] = (counts[r.status] || 0) + 1;
        }
        return Object.entries(counts).map(([status, count]) => ({ status, count: String(count) }));
      }

      // 20. AVG cycle time
      if (sql.includes('AVG(EXTRACT(EPOCH')) {
        return [{ avg_hours: '3.5' }];
      }

      // 21. GROUP BY workflow_type
      if (sql.includes('GROUP BY workflow_type')) {
        return [
          {
            workflow_type: 'purchase_order',
            total: '5',
            approved: '3',
            rejected: '1',
            pending: '1',
          },
        ];
      }

      // 22. Monthly trend
      if (sql.includes("to_char(created_at, 'YYYY-MM')")) {
        return [
          {
            month: '2026-10',
            total: '5',
            approved: '3',
            rejected: '1',
            pending: '1',
          },
        ];
      }

      // 23. Users lookup for notifications
      if (sql.includes('FROM users')) {
        return [{ id: 'user-manager-1' }];
      }

      return [];
    }),
  };

  beforeEach(async () => {
    workflowsTable = [];
    stepsTable = [];
    requestsTable = [];
    actionsTable = [];
    jest.clearAllMocks();

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    mockNotificationsService = {
      getEffectiveChannel: jest.fn().mockResolvedValue('both'),
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  describe('ensureApprovalTables & seeding', () => {
    it('should initialize approval tables and skip if already cached', async () => {
      await service.ensureApprovalTables(mockConnection);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS approval_workflows'),
      );
    });
  });

  describe('Workflow Management (CRUD)', () => {
    it('should create a multi-tier sequential workflow with ordered steps', async () => {
      const created = await service.createWorkflow('tenant-1', {
        name: 'Executive Purchase Approval',
        workflow_type: 'purchase_order',
        routing_mode: 'sequential',
        threshold_amount: 5000,
        threshold_currency: 'USD',
        steps: [
          { step_order: 1, step_name: 'Team Lead Approval', approver_role: 'Manager', escalation_hours: 24 },
          { step_order: 2, step_name: 'Director Approval', approver_role: 'Director', escalation_hours: 48 },
          { step_order: 3, step_name: 'CFO Final Sign-off', approver_role: 'Administrator', escalation_hours: 72 },
        ],
      });

      expect(created).toBeDefined();
      expect(created.name).toBe('Executive Purchase Approval');
      expect(created.workflow_type).toBe('purchase_order');
      expect(created.routing_mode).toBe('sequential');
      expect(created.steps.length).toBe(3);
      expect(created.steps[0].step_name).toBe('Team Lead Approval');
      expect(created.steps[2].step_name).toBe('CFO Final Sign-off');
    });

    it('should create a parallel approval workflow', async () => {
      const created = await service.createWorkflow('tenant-1', {
        name: 'Safety & Environmental Sign-off',
        workflow_type: 'asset_disposal',
        routing_mode: 'parallel',
        steps: [
          { step_order: 1, step_name: 'Safety Officer Review', approver_role: 'Manager', require_all_in_step: true },
          { step_order: 1, step_name: 'Compliance Officer Review', approver_role: 'Director', require_all_in_step: true },
        ],
      });

      expect(created).toBeDefined();
      expect(created.routing_mode).toBe('parallel');
      expect(created.steps.length).toBe(2);
      expect(created.steps[0].require_all_in_step).toBe(true);
    });

    it('should retrieve workflows with their associated steps', async () => {
      await service.createWorkflow('tenant-1', {
        name: 'Expense Flow',
        workflow_type: 'expense_claim',
        steps: [{ step_order: 1, step_name: 'Finance Review', approver_role: 'Manager' }],
      });

      const list = await service.getWorkflows('tenant-1', { workflow_type: 'expense_claim' });
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].steps).toBeDefined();
    });

    it('should retrieve single workflow by ID', async () => {
      const created = await service.createWorkflow('tenant-1', {
        name: 'Single Flow',
        workflow_type: 'journal_entry',
        steps: [{ step_order: 1, step_name: 'Accountant', approver_role: 'Manager' }],
      });

      const found = await service.getWorkflowById('tenant-1', created.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.steps.length).toBe(1);
    });

    it('should throw NotFoundException when getting non-existent workflow', async () => {
      await expect(service.getWorkflowById('tenant-1', 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update workflow details and steps', async () => {
      const created = await service.createWorkflow('tenant-1', {
        name: 'Initial Name',
        workflow_type: 'leave_request',
        steps: [{ step_order: 1, step_name: 'Step 1', approver_role: 'Manager' }],
      });

      const updated = await service.updateWorkflow('tenant-1', created.id, {
        name: 'Updated Name',
        description: 'New Description',
        steps: [
          { step_order: 1, step_name: 'New Step 1', approver_role: 'Manager' },
          { step_order: 2, step_name: 'New Step 2', approver_role: 'Director' },
        ],
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New Description');
    });

    it('should delete a workflow by ID', async () => {
      const created = await service.createWorkflow('tenant-1', {
        name: 'To Delete',
        workflow_type: 'leave_request',
        steps: [],
      });

      const res = await service.deleteWorkflow('tenant-1', created.id);
      expect(res.success).toBe(true);
    });
  });

  describe('Approval Requests & Auto-matching', () => {
    let testWorkflow: any;

    beforeEach(async () => {
      testWorkflow = await service.createWorkflow('tenant-1', {
        name: 'Tiered PO Approval',
        workflow_type: 'purchase_order',
        threshold_amount: 1000,
        steps: [
          { step_order: 1, step_name: 'Lead Review', approver_role: 'Manager' },
          { step_order: 2, step_name: 'Finance Approval', approver_role: 'Administrator' },
        ],
      });
    });

    it('should auto-match workflow based on workflow_type and amount threshold', async () => {
      const req = await service.submitRequest('tenant-1', {
        workflow_type: 'purchase_order',
        entity_type: 'purchase_order',
        entity_id: 'po-101',
        reference_number: 'PO-2026-001',
        title: 'New Hardware Server Purchase',
        amount: 2500,
        submitter_id: 'sub-user-1',
        submitter_name: 'John Doe',
        submitter_email: 'john@example.com',
      });

      expect(req).toBeDefined();
      expect(req.status).toBe('pending');
      expect(req.current_step_order).toBe(1);
      expect(req.total_steps).toBe(2);
      expect(req.workflow_id).toBe(testWorkflow.id);
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });

    it('should reject request submission if submitter_id is missing', async () => {
      await expect(
        service.submitRequest('tenant-1', {
          workflow_type: 'purchase_order',
          entity_type: 'purchase_order',
          entity_id: 'po-102',
          title: 'Missing Submitter',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Multi-Tier Step Decision & Advancement', () => {
    let activeReq: any;

    beforeEach(async () => {
      const wf = await service.createWorkflow('tenant-1', {
        name: 'Two Step Approval',
        workflow_type: 'expense_claim',
        steps: [
          { step_order: 1, step_name: 'Manager Review', approver_role: 'Manager' },
          { step_order: 2, step_name: 'Finance Sign-off', approver_role: 'Administrator' },
        ],
      });

      activeReq = await service.submitRequest('tenant-1', {
        workflow_id: wf.id,
        workflow_type: 'expense_claim',
        entity_type: 'expense_report',
        entity_id: 'exp-99',
        reference_number: 'EXP-99',
        title: 'Conference Trip Travel Expense',
        amount: 450,
        submitter_id: 'employee-1',
        submitter_name: 'Alice Smith',
      });
    });

    it('should advance to next step when Step 1 is approved', async () => {
      const step1Result = await service.decideRequest(
        'tenant-1',
        activeReq.id,
        'manager-user-id',
        'Manager Bob',
        'Manager',
        { action: 'approved', comments: 'Looks good to proceed' },
      );

      expect(step1Result.current_step_order).toBe(2);
      expect(step1Result.status).toBe('pending');
      expect(step1Result.actions.length).toBe(1);
      expect(step1Result.actions[0].action).toBe('approved');
      expect(step1Result.actions[0].approver_name).toBe('Manager Bob');
    });

    it('should mark request fully approved when final step is approved', async () => {
      // Step 1
      await service.decideRequest(
        'tenant-1',
        activeReq.id,
        'manager-user-id',
        'Manager Bob',
        'Manager',
        { action: 'approved', comments: 'Approved step 1' },
      );

      // Step 2
      const step2Result = await service.decideRequest(
        'tenant-1',
        activeReq.id,
        'finance-user-id',
        'Finance Director',
        'Administrator',
        { action: 'approved', comments: 'Final budget approved' },
      );

      expect(step2Result.status).toBe('approved');
      expect(step2Result.actions.length).toBe(2);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        'tenant-1',
        'employee-1',
        expect.objectContaining({
          type: 'approval_request_decided',
          title: expect.stringContaining('Approved'),
        }),
      );
    });

    it('should mark request rejected when any step rejects and log audit trail', async () => {
      const rejectedResult = await service.decideRequest(
        'tenant-1',
        activeReq.id,
        'manager-user-id',
        'Manager Bob',
        'Manager',
        { action: 'rejected', comments: 'Exceeds department travel budget limit' },
      );

      expect(rejectedResult.status).toBe('rejected');
      expect(rejectedResult.actions.length).toBe(1);
      expect(rejectedResult.actions[0].action).toBe('rejected');
      expect(rejectedResult.actions[0].comments).toBe('Exceeds department travel budget limit');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        'tenant-1',
        'employee-1',
        expect.objectContaining({
          type: 'approval_request_decided',
          title: expect.stringContaining('Rejected'),
        }),
      );
    });

    it('should throw BadRequestException when trying to decide an already resolved request', async () => {
      await service.decideRequest(
        'tenant-1',
        activeReq.id,
        'manager-user-id',
        'Manager Bob',
        'Manager',
        { action: 'rejected' },
      );

      await expect(
        service.decideRequest(
          'tenant-1',
          activeReq.id,
          'manager-user-id',
          'Manager Bob',
          'Manager',
          { action: 'approved' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Pending Counts & Analytics', () => {
    it('should calculate pending approvals count for an admin user', async () => {
      const result = await service.getMyPendingCount('tenant-1', 'admin-id', 'Administrator');
      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');
    });

    it('should calculate pending approvals count for a manager role', async () => {
      const result = await service.getMyPendingCount('tenant-1', 'manager-id', 'Manager');
      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');
    });

    it('should return aggregated approval analytics', async () => {
      const analytics = await service.getApprovalAnalytics('tenant-1');
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('total_requests');
      expect(analytics).toHaveProperty('pending_requests');
      expect(analytics).toHaveProperty('approved_requests');
      expect(analytics).toHaveProperty('rejected_requests');
      expect(analytics).toHaveProperty('avg_cycle_time_hours');
      expect(analytics).toHaveProperty('by_workflow_type');
      expect(analytics).toHaveProperty('monthly_trend');
    });
  });
});
