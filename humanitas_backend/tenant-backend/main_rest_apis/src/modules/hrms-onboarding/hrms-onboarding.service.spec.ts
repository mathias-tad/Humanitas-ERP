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
});
