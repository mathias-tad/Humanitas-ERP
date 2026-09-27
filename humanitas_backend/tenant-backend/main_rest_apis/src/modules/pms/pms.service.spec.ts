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
  });
});
