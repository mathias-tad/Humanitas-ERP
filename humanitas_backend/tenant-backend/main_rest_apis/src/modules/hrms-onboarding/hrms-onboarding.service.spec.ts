import { Test, TestingModule } from '@nestjs/testing';
import { HrmsOnboardingService } from './hrms-onboarding.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException } from '@nestjs/common';
import {
  TaskCategory,
  TaskStatus,
  ProbationOutcome,
} from './dto/hrms-onboarding.dto';

describe('HrmsOnboardingService', () => {
  let service: HrmsOnboardingService;
  let mockConnection: any;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrmsOnboardingService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsOnboardingService>(HrmsOnboardingService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTemplates', () => {
    it('should return templates list', async () => {
      const mockTemplates = [
        { id: 'tpl-1', name: 'Standard Onboarding', type: 'onboarding', item_count: 5 },
      ];
      mockConnection.query.mockResolvedValue(mockTemplates);

      const result = await service.getTemplates('tenant-1', 'onboarding');
      expect(result).toEqual(mockTemplates);
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  describe('getTemplateById', () => {
    it('should return template with items when found', async () => {
      const mockTemplate = { id: 'tpl-1', name: 'Standard Onboarding', type: 'onboarding' };
      const mockItems = [
        { id: 'item-1', template_id: 'tpl-1', title: 'Setup laptop', category: 'it' },
      ];

      mockConnection.query
        .mockResolvedValueOnce([mockTemplate])
        .mockResolvedValueOnce(mockItems);

      const result = await service.getTemplateById('tenant-1', 'tpl-1');
      expect(result).toEqual({ ...mockTemplate, items: mockItems });
    });

    it('should throw NotFoundException if template does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(service.getTemplateById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createTemplate', () => {
    it('should insert and return a new template', async () => {
      const newTemplate = { id: 'tpl-new', name: 'Sales Onboarding', type: 'onboarding' };
      mockConnection.query.mockResolvedValueOnce([newTemplate]);

      const result = await service.createTemplate('tenant-1', {
        name: 'Sales Onboarding',
        type: 'onboarding',
        department: 'Sales',
      });

      expect(result).toEqual(newTemplate);
    });
  });

  describe('createTemplateItem', () => {
    it('should verify template exists and insert item', async () => {
      const newItem = { id: 'item-new', title: 'Sign NDA', category: 'hr' };
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'tpl-1' }]) // template check
        .mockResolvedValueOnce([newItem]); // insert

      const result = await service.createTemplateItem('tenant-1', {
        template_id: 'tpl-1',
        title: 'Sign NDA',
        category: TaskCategory.HR,
      });

      expect(result).toEqual(newItem);
    });

    it('should throw NotFoundException if template does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // template not found

      await expect(
        service.createTemplateItem('tenant-1', {
          template_id: 'nonexistent',
          title: 'Sign NDA',
          category: TaskCategory.HR,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('startOnboarding', () => {
    it('should verify user, create onboarding instance and copy template items', async () => {
      const mockUser = { id: 'user-1', first_name: 'Jane', last_name: 'Doe' };
      const mockOnboarding = { id: 'onb-1', user_id: 'user-1', status: 'in_progress' };
      const mockTemplateItems = [
        { id: 'ti-1', title: 'Task 1', category: 'it', due_days_from_start: 1, is_required: true, sort_order: 1 },
      ];
      const mockFullOnboarding = {
        ...mockOnboarding,
        first_name: 'Jane',
        last_name: 'Doe',
        total_tasks: 1,
        completed_tasks: 0,
        completion_percentage: 0,
        tasks: [{ id: 'task-1', title: 'Task 1', status: 'pending' }],
      };

      mockConnection.query
        .mockResolvedValueOnce([mockUser]) // user check
        .mockResolvedValueOnce([mockOnboarding]) // insert employee_onboarding
        .mockResolvedValueOnce(mockTemplateItems) // fetch template items
        .mockResolvedValueOnce([]) // insert onboarding task
        .mockResolvedValueOnce([{ ...mockOnboarding, first_name: 'Jane', last_name: 'Doe' }]) // getOnboardingById -> onboarding
        .mockResolvedValueOnce([{ id: 'task-1', title: 'Task 1', status: 'pending' }]); // getOnboardingById -> tasks

      const result = await service.startOnboarding(
        'tenant-1',
        {
          user_id: 'user-1',
          template_id: 'tpl-1',
          start_date: '2026-01-01',
          probation_days: 90,
        },
        'creator-1',
      );

      expect(result.id).toBe('onb-1');
      expect(result.tasks).toHaveLength(1);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // user lookup empty

      await expect(
        service.startOnboarding('tenant-1', { user_id: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOnboardings', () => {
    it('should return list of onboarding instances', async () => {
      const mockList = [
        { id: 'onb-1', first_name: 'Alice', total_tasks: 5, completed_tasks: 3, completion_percentage: 60 },
      ];
      mockConnection.query.mockResolvedValueOnce(mockList);

      const result = await service.getOnboardings('tenant-1');
      expect(result).toEqual(mockList);
    });
  });

  describe('getOnboardingById', () => {
    it('should return onboarding record with tasks', async () => {
      const mockOnb = { id: 'onb-1', user_id: 'u-1', first_name: 'Alice' };
      const mockTasks = [
        { id: 'tsk-1', title: 'Setup PC', status: 'completed' },
        { id: 'tsk-2', title: 'Badge', status: 'pending' },
      ];

      mockConnection.query
        .mockResolvedValueOnce([mockOnb])
        .mockResolvedValueOnce(mockTasks);

      const result = await service.getOnboardingById('tenant-1', 'onb-1');
      expect(result.id).toBe('onb-1');
      expect(result.total_tasks).toBe(2);
      expect(result.completed_tasks).toBe(1);
      expect(result.completion_percentage).toBe(50);
    });

    it('should throw NotFoundException if onboarding not found', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(service.getOnboardingById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateOnboardingTask', () => {
    it('should update task status and auto-complete onboarding if all tasks finished', async () => {
      const mockTask = { id: 'tsk-1', onboarding_id: 'onb-1', status: 'pending' };
      const updatedTask = { id: 'tsk-1', onboarding_id: 'onb-1', status: 'completed' };

      mockConnection.query
        .mockResolvedValueOnce([mockTask]) // find task
        .mockResolvedValueOnce([updatedTask]) // update task
        .mockResolvedValueOnce([{ count: 0 }]) // remaining incomplete tasks count = 0
        .mockResolvedValueOnce([]); // update employee_onboarding to completed

      const result = await service.updateOnboardingTask('tenant-1', 'tsk-1', {
        status: TaskStatus.COMPLETED,
        notes: 'Done',
      });

      expect(result.status).toBe('completed');
    });

    it('should throw NotFoundException if task does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(
        service.updateOnboardingTask('tenant-1', 'nonexistent', { status: TaskStatus.COMPLETED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordProbationOutcome', () => {
    it('should update probation outcome on onboarding record', async () => {
      const mockUpdated = { id: 'onb-1', probation_outcome: 'confirmed' };
      mockConnection.query.mockResolvedValueOnce([mockUpdated]);

      const result = await service.recordProbationOutcome('tenant-1', {
        onboarding_id: 'onb-1',
        outcome: ProbationOutcome.CONFIRMED,
        notes: 'Passed probation successfully',
      });

      expect(result.probation_outcome).toBe('confirmed');
    });
  });

  describe('startOffboarding', () => {
    it('should insert offboarding instance and copy template items', async () => {
      const mockUser = { id: 'user-1' };
      const mockOffboarding = { id: 'off-1', user_id: 'user-1', status: 'in_progress' };
      const mockTemplateItems = [
        { id: 'ti-off-1', title: 'Return Laptop', category: 'it', due_days_from_start: -1, is_required: true, sort_order: 1 },
      ];

      mockConnection.query
        .mockResolvedValueOnce([mockUser]) // user check
        .mockResolvedValueOnce([mockOffboarding]) // insert employee_offboarding
        .mockResolvedValueOnce(mockTemplateItems) // fetch template items
        .mockResolvedValueOnce([]) // insert offboarding task
        .mockResolvedValueOnce([mockOffboarding]) // getOffboardingById -> offboarding
        .mockResolvedValueOnce([{ id: 'task-off-1', title: 'Return Laptop', status: 'pending' }]) // tasks
        .mockResolvedValueOnce([]); // exit interviews

      const result = await service.startOffboarding(
        'tenant-1',
        {
          user_id: 'user-1',
          template_id: 'tpl-2',
          last_working_day: '2026-03-31',
          reason: 'Relocation',
        },
        'admin-1',
      );

      expect(result.id).toBe('off-1');
      expect(result.tasks).toHaveLength(1);
    });
  });

  describe('getOffboardings', () => {
    it('should return list of offboardings', async () => {
      const mockList = [{ id: 'off-1', first_name: 'Bob', total_tasks: 3, completed_tasks: 2 }];
      mockConnection.query.mockResolvedValueOnce(mockList);

      const result = await service.getOffboardings('tenant-1');
      expect(result).toEqual(mockList);
    });
  });

  describe('getOffboardingById', () => {
    it('should return offboarding with tasks and exit interview', async () => {
      const mockOffboarding = { id: 'off-1', user_id: 'u-1' };
      const mockTasks = [{ id: 'tsk-1', title: 'Clear Desk', status: 'completed' }];
      const mockExit = [{ id: 'exit-1', satisfaction_score: 4 }];

      mockConnection.query
        .mockResolvedValueOnce([mockOffboarding])
        .mockResolvedValueOnce(mockTasks)
        .mockResolvedValueOnce(mockExit);

      const result = await service.getOffboardingById('tenant-1', 'off-1');
      expect(result.id).toBe('off-1');
      expect(result.tasks).toHaveLength(1);
      expect(result.exit_interview).toEqual(mockExit[0]);
    });
  });

  describe('updateOffboardingTask', () => {
    it('should update offboarding task status', async () => {
      const mockTask = { id: 'ot-1', offboarding_id: 'off-1', status: 'pending' };
      const updatedTask = { id: 'ot-1', offboarding_id: 'off-1', status: 'completed' };

      mockConnection.query
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([updatedTask])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]);

      const result = await service.updateOffboardingTask('tenant-1', 'ot-1', {
        status: TaskStatus.COMPLETED,
        notes: 'Assets returned',
      });

      expect(result.status).toBe('completed');
    });
  });

  describe('submitExitInterview', () => {
    it('should insert and return exit interview record', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'off-1', user_id: 'u-1' }]) // offboarding check
        .mockResolvedValueOnce([{ id: 'exit-1', satisfaction_score: 5, feedback: 'Great culture' }]);

      const result = await service.submitExitInterview(
        'tenant-1',
        {
          offboarding_id: 'off-1',
          satisfaction_score: 5,
          feedback: 'Great culture',
          reason_for_leaving: 'Career change',
        },
        'u-1',
      );

      expect(result.satisfaction_score).toBe(5);
    });

    it('should throw NotFoundException if offboarding does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(
        service.submitExitInterview('tenant-1', { offboarding_id: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOnboardingStats', () => {
    it('should calculate and return aggregate onboarding stats', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            total_onboarding: 10,
            completed_onboarding: 6,
            in_progress_onboarding: 4,
            upcoming_probation_reviews: 2,
            avg_completion_days: 14.5,
          },
        ])
        .mockResolvedValueOnce([{ overdue_tasks: 3 }]);

      const stats = await service.getOnboardingStats('tenant-1');
      expect(stats).toEqual({
        total_onboarding: 10,
        completed_onboarding: 6,
        in_progress_onboarding: 4,
        overdue_tasks: 3,
        avg_completion_days: 14.5,
        upcoming_probation_reviews: 2,
      });
    });
  });

  // ── C1/C2: Welcome Portal & Reports ──────────────────────────────────────

  describe('getWelcomePortalStatus', () => {
    it('should return existing welcome portal row', async () => {
      const mockStatus = {
        user_id: 'u-1',
        documents_uploaded: true,
        policy_accepted: false,
        personal_info_completed: true,
        contract_signed: false,
        orientation_viewed: false,
        completed_at: null,
      };
      mockConnection.query.mockResolvedValue([mockStatus]);

      const result = await service.getWelcomePortalStatus('tenant-1', 'u-1');
      expect(result.user_id).toBe('u-1');
      expect(result.documents_uploaded).toBe(true);
    });

    it('should return default status object when no row exists', async () => {
      mockConnection.query.mockResolvedValue([]);

      const result = await service.getWelcomePortalStatus('tenant-1', 'u-new');
      expect(result.user_id).toBe('u-new');
      expect(result.documents_uploaded).toBe(false);
      expect(result.contract_signed).toBe(false);
    });
  });

  describe('updateWelcomePortalStep', () => {
    it('should upsert a step and return updated status', async () => {
      // upsert INSERT/ON CONFLICT, then auto-complete UPDATE, then SELECT
      mockConnection.query
        .mockResolvedValueOnce([]) // INSERT ON CONFLICT (upsert)
        .mockResolvedValueOnce([]) // completed_at UPDATE
        .mockResolvedValueOnce([{ user_id: 'u-1', documents_uploaded: true }]); // SELECT

      const result = await service.updateWelcomePortalStep(
        'tenant-1', 'u-1', 'documents_uploaded', true
      );
      expect(result.documents_uploaded).toBe(true);
    });

    it('should throw BadRequestException for an invalid step name', async () => {
      await expect(
        service.updateWelcomePortalStep('tenant-1', 'u-1', 'unknown_step', true),
      ).rejects.toThrow('Invalid step: unknown_step');
    });
  });

  describe('getOffboardingComplianceReport', () => {
    it('should return compliance metrics per offboarding record', async () => {
      const mockReport = [
        {
          id: 'ob-1',
          employee_name: 'Abebe Kebede',
          last_working_day: '2026-10-31',
          status: 'in_progress',
          total_tasks: 5,
          completed_tasks: 3,
          compliance_pct: 60,
        },
      ];
      mockConnection.query.mockResolvedValue(mockReport);

      const result = await service.getOffboardingComplianceReport('tenant-1');
      expect(result).toEqual(mockReport);
      expect(result[0].compliance_pct).toBe(60);
    });
  });

  describe('getNewHireRetentionReport', () => {
    it('should return retention rates for 4 milestones', async () => {
      // 4 milestones × 1 query each
      mockConnection.query
        .mockResolvedValueOnce([{ hired: 10, still_active: 9 }]) // day30
        .mockResolvedValueOnce([{ hired: 10, still_active: 8 }]) // day60
        .mockResolvedValueOnce([{ hired: 10, still_active: 8 }]) // day90
        .mockResolvedValueOnce([{ hired: 10, still_active: 7 }]); // day180

      const result = await service.getNewHireRetentionReport('tenant-1');
      expect(result.day30.retentionRate).toBe(90);
      expect(result.day60.retentionRate).toBe(80);
      expect(result.day180.retentionRate).toBe(70);
    });
  });

  // ── PART 3A: NEW ONBOARDING & OFFBOARDING TESTS ───────────────────────────

  describe('getWelcomeChecklist', () => {
    it('should return default when no record exists', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      const result = await service.getWelcomeChecklist('tenant-1', 'u-new');
      expect(result).toEqual({
        user_id: 'u-new',
        onboarding_id: null,
        document_uploaded: false,
        policy_accepted: false,
        profile_completed: false,
        orientation_viewed: false,
        welcome_packet_viewed: false,
      });
    });

    it('should return existing welcome checklist record', async () => {
      const mockRecord = {
        id: 'chk-1',
        user_id: 'u-1',
        onboarding_id: 'onb-1',
        document_uploaded: true,
        policy_accepted: true,
        profile_completed: false,
        orientation_viewed: false,
        welcome_packet_viewed: false,
      };
      mockConnection.query.mockResolvedValueOnce([mockRecord]);

      const result = await service.getWelcomeChecklist('tenant-1', 'u-1');
      expect(result).toEqual(mockRecord);
    });
  });

  describe('updateWelcomeChecklist', () => {
    it('should insert record if not exists', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // SELECT
        .mockResolvedValueOnce([]); // INSERT

      await service.updateWelcomeChecklist('tenant-1', 'u-1', 'onb-1', {
        document_uploaded: true,
      });
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should update record if exists', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'chk-1', user_id: 'u-1' }]) // SELECT
        .mockResolvedValueOnce([]); // UPDATE

      await service.updateWelcomeChecklist('tenant-1', 'u-1', 'onb-1', {
        policy_accepted: true,
      });
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRetentionMetrics', () => {
    it('should return an object with 30d/60d/90d/180d fields', async () => {
      mockConnection.query.mockResolvedValueOnce([
        {
          retained_30d: 12,
          retained_60d: 10,
          retained_90d: 8,
          retained_180d: 6,
          total: 15,
        },
      ]);

      const result = await service.getRetentionMetrics('tenant-1');
      expect(result).toBeDefined();
      expect(result.retained_30d).toBe(12);
      expect(result.retained_60d).toBe(10);
      expect(result.retained_90d).toBe(8);
      expect(result.retained_180d).toBe(6);
      expect(result['30d']).toBe(12);
      expect(result['60d']).toBe(10);
      expect(result['90d']).toBe(8);
      expect(result['180d']).toBe(6);
      expect(result.total).toBe(15);
    });
  });

  describe('get1ClickSeparationPreview', () => {
    it('should return an object with total_final_settlement field', async () => {
      const mockUser = {
        id: 'u-1',
        first_name: 'John',
        last_name: 'Doe',
        salary: 3000,
      };
      mockConnection.query
        .mockResolvedValueOnce([mockUser]) // user salary
        .mockResolvedValueOnce([{ balance: 10 }]) // leave balance = 10 days
        .mockResolvedValueOnce([{ total: 500 }]); // active loan = 500

      const result = await service.get1ClickSeparationPreview('tenant-1', 'u-1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('total_final_settlement');
      expect(typeof result.total_final_settlement).toBe('number');
      expect(result.remaining_leave_days).toBe(10);
      expect(result.leave_encashment).toBe(1000);
      expect(result.pending_loans).toBe(500);
    });
  });

  describe('execute1ClickSeparation', () => {
    it('should call startOffboarding internally', async () => {
      const startOffboardingSpy = jest.spyOn(service, 'startOffboarding').mockResolvedValueOnce({
        id: 'off-new-1',
        user_id: 'u-1',
        status: 'in_progress',
      } as any);

      const result = await service.execute1ClickSeparation('tenant-1', 'u-1', 'admin-1');

      expect(startOffboardingSpy).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          user_id: 'u-1',
          reason: 'Resigned',
        }),
        'admin-1',
      );
      expect(result.offboarding_id).toBe('off-new-1');
      expect(result.message).toContain('Offboarding initiated');

      startOffboardingSpy.mockRestore();
    });
  });
});

