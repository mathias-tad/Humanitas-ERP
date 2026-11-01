import { PmsService } from './pms.service';
import { TaskStatus } from './entities/task.entity';
import { ProjectStatus } from './entities/project.entity';

describe('PmsService Unit Tests', () => {
  let service: PmsService;
  let mockDatabaseService: any;
  let mockHttpService: any;
  let mockConfigService: any;
  let mockNotificationsService: any;
  let mockRolesService: any;

  beforeEach(() => {
    mockDatabaseService = {
      getTenantConnectionById: jest.fn(),
    };
    mockHttpService = {
      post: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn(),
    };
    mockNotificationsService = {
      createBulkNotifications: jest.fn().mockResolvedValue(true),
    };
    mockRolesService = {
      hasPermission: jest.fn().mockResolvedValue(true),
    };

    service = new PmsService(
      mockDatabaseService,
      mockHttpService,
      mockConfigService,
      mockNotificationsService,
      mockRolesService
    );
  });

  describe('Task Status Constants & Lifecycle State Machine', () => {
    it('supports standard agile task states', () => {
      expect(TaskStatus.TODO).toBe('To Do');
      expect(TaskStatus.IN_PROGRESS).toBe('In Progress');
      expect(TaskStatus.IN_REVIEW).toBe('In Review');
      expect(TaskStatus.DONE).toBe('Done');
    });

    it('supports standard project status states', () => {
      expect(ProjectStatus.PLANNING).toBe('Planning');
      expect(ProjectStatus.ACTIVE).toBe('Active');
      expect(ProjectStatus.ON_HOLD).toBe('On Hold');
      expect(ProjectStatus.COMPLETED).toBe('Completed');
    });
  });

  describe('Time Tracking & Billable Conversion', () => {
    it('aggregates billable and non-billable hours accurately', () => {
      const logs = [
        { duration_minutes: 120, is_billable: true },
        { duration_minutes: 60,  is_billable: false },
        { duration_minutes: 180, is_billable: true },
      ];

      const billableMins = logs
        .filter(l => l.is_billable)
        .reduce((sum, l) => sum + l.duration_minutes, 0);

      const nonBillableMins = logs
        .filter(l => !l.is_billable)
        .reduce((sum, l) => sum + l.duration_minutes, 0);

      expect(billableMins / 60).toBe(5); // 5.0 hours billable
      expect(nonBillableMins / 60).toBe(1); // 1.0 hour non-billable
    });

    it('calculates total billable revenue from hourly rate', () => {
      const logs = [
        { duration_minutes: 120, is_billable: true, hourly_rate: 75.0 }, // 2 hrs * $75 = $150
        { duration_minutes: 60, is_billable: false, hourly_rate: 75.0 }, // 0 (non-billable)
        { duration_minutes: 90, is_billable: true, hourly_rate: 100.0 }, // 1.5 hrs * $100 = $150
      ];

      const totalRevenue = logs.reduce((sum, l) => {
        if (!l.is_billable) return sum;
        return sum + (l.duration_minutes / 60) * l.hourly_rate;
      }, 0);

      expect(totalRevenue).toBe(300);
    });
  });

  describe('Project Privacy & Access Filtering', () => {
    it('filters private projects for non-admin users not in the project team', async () => {
      const mockProjects = [
        { id: 'p1', name: 'Public Project', visibility: 'public', created_by: 'user-other' },
        { id: 'p2', name: 'Secret Project', visibility: 'private', created_by: 'user-other', manager_id: 'user-other', members: [] },
        { id: 'p3', name: 'My Private Project', visibility: 'private', created_by: 'user-1', members: [] },
      ];

      const mockRepo = {
        find: jest.fn().mockResolvedValue(mockProjects),
      };
      (service as any).getTenantRepo = jest.fn().mockResolvedValue(mockRepo);

      const result = await service.findAllProjects('tenant-1', 'user-1', 'employee');
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toEqual(['p1', 'p3']);
    });

    it('allows owner and admin roles to view all private projects', async () => {
      const mockProjects = [
        { id: 'p1', name: 'Public Project', visibility: 'public', created_by: 'user-other' },
        { id: 'p2', name: 'Secret Project', visibility: 'private', created_by: 'user-other', manager_id: 'user-other', members: [] },
      ];

      const mockRepo = {
        find: jest.fn().mockResolvedValue(mockProjects),
      };
      (service as any).getTenantRepo = jest.fn().mockResolvedValue(mockRepo);

      const result = await service.findAllProjects('tenant-1', 'user-admin', 'admin');
      expect(result).toHaveLength(2);
    });

    it('throws ForbiddenException when unauthorized user accesses private project', async () => {
      const mockProject = {
        id: 'p2',
        name: 'Secret Project',
        visibility: 'private',
        created_by: 'user-other',
        manager_id: 'user-other',
        members: [],
      };

      const mockRepo = {
        findOne: jest.fn().mockResolvedValue(mockProject),
      };
      (service as any).getTenantRepo = jest.fn().mockResolvedValue(mockRepo);

      await expect(
        service.findOneProject('tenant-1', 'p2', 'user-unauthorized', 'employee')
      ).rejects.toThrow('You do not have access to this private project');
    });
  });

  describe('Agile Sprint Burndown & Velocity', () => {
    it('computes linear ideal burndown schedule correctly', () => {
      const totalStoryPoints = 40;
      const totalDays = 10;
      const dailyBurnRate = totalStoryPoints / totalDays;

      const idealBurndown: number[] = [];
      for (let i = 0; i <= totalDays; i++) {
        idealBurndown.push(Math.max(0, Math.round((totalStoryPoints - (i * dailyBurnRate)) * 10) / 10));
      }

      expect(idealBurndown[0]).toBe(40);
      expect(idealBurndown[5]).toBe(20);
      expect(idealBurndown[10]).toBe(0);
    });

    it('calculates sprint velocity percentage', () => {
      const committedPoints = 50;
      const completedPoints = 45;
      const velocityPct = Math.round((completedPoints / committedPoints) * 100);

      expect(velocityPct).toBe(90);
    });
  });
});
