import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { DatabaseService } from '../database/database.service';

describe('CalendarService', () => {
  let service: CalendarService;
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
        CalendarService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSources', () => {
    it('should return all common sources and gate operational sources based on enabled features', async () => {
      const sourcesWithHrms = await service.getSources(['hrms', 'attendance']);
      const customSource = sourcesWithHrms.find((s) => s.id === 'custom');
      const holidaysSource = sourcesWithHrms.find((s) => s.id === 'holidays');
      const taskSource = sourcesWithHrms.find((s) => s.id === 'task');

      expect(customSource?.enabled).toBe(true);
      expect(holidaysSource?.enabled).toBe(true);
      expect(taskSource?.enabled).toBe(false);
    });

    it('should enable PMS sources when pms module is subscribed', async () => {
      const sourcesWithPms = await service.getSources(['pms']);
      const taskSource = sourcesWithPms.find((s) => s.id === 'task');
      const milestoneSource = sourcesWithPms.find((s) => s.id === 'milestone');
      const leaveSource = sourcesWithPms.find((s) => s.id === 'leave');

      expect(taskSource?.enabled).toBe(true);
      expect(milestoneSource?.enabled).toBe(true);
      expect(leaveSource?.enabled).toBe(false);
    });
  });

  describe('create', () => {
    it('should insert a new calendar event and return it', async () => {
      const mockResult = [{ id: 'evt-123', title: 'Strategy Meeting', start_date: '2026-11-05T10:00:00Z' }];
      mockConnection.query.mockResolvedValue(mockResult);

      const res = await service.create('tenant-1', 'user-1', {
        title: 'Strategy Meeting',
        start_date: '2026-11-05T10:00:00Z',
      });

      expect(res).toEqual(mockResult[0]);
      expect(mockDatabaseService.getTenantConnectionById).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('getAggregatedEvents', () => {
    it('should aggregate custom events gracefully when query runs', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('CREATE TABLE IF NOT EXISTS calendar_events')) {
          return Promise.resolve();
        }
        if (sql.includes('FROM calendar_events c')) {
          return Promise.resolve([
            {
              id: 'c-1',
              title: 'Townhall',
              description: 'Company-wide townhall',
              start_date: new Date('2026-11-10T14:00:00Z'),
              end_date: new Date('2026-11-10T15:00:00Z'),
              all_day: false,
              event_type: 'meeting',
              color: '#D4A017',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const events = await service.getAggregatedEvents('tenant-1', 'user-1', {
        start: '2026-11-01T00:00:00Z',
        end: '2026-11-30T23:59:59Z',
      });

      expect(Array.isArray(events)).toBe(true);
      const townhall = events.find((e) => e.title === 'Townhall');
      expect(townhall).toBeDefined();
      expect(townhall?.source).toBe('custom');
    });
  });
});
