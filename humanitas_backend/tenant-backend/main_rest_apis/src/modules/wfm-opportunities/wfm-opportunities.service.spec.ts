import { Test, TestingModule } from '@nestjs/testing';
import { WfmOpportunitiesService } from './wfm-opportunities.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('WfmOpportunitiesService', () => {
  let service: WfmOpportunitiesService;
  let mockConnection: any;
  let mockDatabaseService: any;
  let mockNotificationsService: any;
  let mockNotificationsGateway: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      createBulkNotifications: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
    };

    mockNotificationsGateway = {
      server: {
        emit: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WfmOpportunitiesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
      ],
    }).compile();

    service = module.get<WfmOpportunitiesService>(WfmOpportunitiesService);
  });

  describe('Settings Management', () => {
    it('should return default settings if none exist', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [];
        }
        if (sql.includes('INSERT INTO wfm_settings')) {
          return [{
            id: 'settings-1',
            vet_enabled: true,
            vto_enabled: true,
            vet_auto_approval: true,
            vto_auto_approval: true,
            max_weekly_ot_hours: '20.00',
            min_rest_hours_between_shifts: '11.00',
          }];
        }
        return [];
      });

      const res = await service.getSettings('t1');
      expect(res.vet_enabled).toBe(true);
      expect(res.max_weekly_ot_hours).toBe('20.00');
    });

    it('should update WFM settings with new fatigue limits and strategies', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vet_enabled: true, max_weekly_ot_hours: 20 }];
        }
        if (sql.includes('UPDATE wfm_settings')) {
          return [{
            id: 'settings-1',
            vet_enabled: true,
            max_weekly_ot_hours: 24,
            vet_claim_strategy: 'seniority',
          }];
        }
        return [];
      });

      const res = await service.updateSettings('t1', {
        max_weekly_ot_hours: 24,
        vet_claim_strategy: 'seniority',
      }, 'u1');

      expect(res.message).toBe('WFM settings updated successfully');
      expect(res.settings.max_weekly_ot_hours).toBe(24);
      expect(res.settings.vet_claim_strategy).toBe('seniority');
    });
  });

  describe('Broadcast Opportunities', () => {
    it('should block VET broadcast when disabled by tenant policy', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vet_enabled: false, vto_enabled: true }];
        }
        return [];
      });

      await expect(service.broadcastOpportunity('t1', {
        type: 'VET',
        title: 'Emergency Shift',
        date: '2026-11-05',
        hours: 8,
        slots_available: 2,
      }, 'manager-1')).rejects.toThrow(BadRequestException);
    });

    it('should broadcast VET opportunity, notify department users, and emit websocket event', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vet_enabled: true, vto_enabled: true }];
        }
        if (sql.includes('INSERT INTO wfm_opportunities')) {
          return [{
            id: 'opp-1',
            type: 'VET',
            title: 'Weekend Surge Support',
            date: '2026-11-07',
            hours: 6,
            slots_available: 3,
            slots_claimed: 0,
            ot_rate_multiplier: 1.5,
            ot_category: 'night',
            status: 'open',
            created_by: 'manager-1',
          }];
        }
        if (sql.includes('SELECT id, full_name, email FROM users')) {
          return [{ id: 'emp-1' }, { id: 'emp-2' }, { id: 'manager-1' }];
        }
        return [];
      });

      const opp = await service.broadcastOpportunity('t1', {
        type: 'VET',
        title: 'Weekend Surge Support',
        date: '2026-11-07',
        hours: 6,
        slots_available: 3,
        ot_category: 'night',
      }, 'manager-1');

      expect(opp.id).toBe('opp-1');
      expect(mockNotificationsService.createBulkNotifications).toHaveBeenCalledWith(
        't1',
        ['emp-1', 'emp-2'], // manager-1 filtered out as creator
        expect.objectContaining({
          type: 'vet_opportunity_broadcast',
          title: expect.stringContaining('Extra Overtime Shift Available'),
        }),
      );
      expect(mockNotificationsGateway.server.emit).toHaveBeenCalledWith(
        'wfm:opportunity_broadcast',
        expect.any(Object),
      );
    });
  });

  describe('Claim Opportunity Validations & Integration', () => {
    it('should reject VET claim if weekly fatigue limit exceeded', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_opportunities WHERE id = $1')) {
          return [{
            id: 'opp-1',
            type: 'VET',
            date: '2026-11-04',
            hours: 8,
            status: 'open',
            slots_available: 2,
            slots_claimed: 0,
          }];
        }
        if (sql.includes('SELECT id, status FROM wfm_opportunity_claims')) {
          return [];
        }
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{
            id: 'settings-1',
            vet_enabled: true,
            max_weekly_ot_hours: 10,
          }];
        }
        if (sql.includes('FROM overtime_entries')) {
          return [{ total_weekly_ot: '6.00' }]; // 6h + 8h = 14h > 10h cap
        }
        return [];
      });

      await expect(service.claimOpportunity('t1', 'opp-1', 'emp-1', {})).rejects.toThrow(
        /Exceeds weekly overtime limit of 10h/,
      );
    });

    it('should reject VTO claim if employee is not scheduled to work on that date', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_opportunities WHERE id = $1')) {
          return [{
            id: 'opp-vto',
            type: 'VTO',
            date: '2026-11-05',
            hours: 8,
            status: 'open',
            slots_available: 2,
            slots_claimed: 0,
          }];
        }
        if (sql.includes('SELECT id, status FROM wfm_opportunity_claims')) {
          return [];
        }
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vto_enabled: true }];
        }
        if (sql.includes('SELECT * FROM schedules WHERE user_id = $1')) {
          return []; // No schedule found for that day!
        }
        return [];
      });

      await expect(service.claimOpportunity('t1', 'opp-vto', 'emp-1', {})).rejects.toThrow(
        /You do not have a scheduled working shift on this date/,
      );
    });

    it('should auto-approve VET claim, update schedules & calculate overtime amount', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM wfm_opportunities WHERE id = $1')) {
          return [{
            id: 'opp-vet',
            type: 'VET',
            title: 'Inventory Audit OT',
            date: '2026-11-06',
            hours: 4,
            status: 'open',
            slots_available: 2,
            slots_claimed: 0,
            shift_id: 'shift-1',
            ot_rate_multiplier: 1.5,
            ot_category: 'normal',
          }];
        }
        if (sql.includes('SELECT id, status FROM wfm_opportunity_claims')) {
          return [];
        }
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{
            id: 'settings-1',
            vet_enabled: true,
            vet_auto_approval: true,
            vet_claim_strategy: 'fcfs',
            max_weekly_ot_hours: 20,
            min_rest_hours_between_shifts: 11,
          }];
        }
        if (sql.includes('FROM overtime_entries WHERE user_id = $1')) {
          return [{ total_weekly_ot: '0' }];
        }
        if (sql.includes('FROM schedules s')) {
          return []; // No conflicting rest period
        }
        if (sql.includes('INSERT INTO wfm_opportunity_claims')) {
          return [{ id: 'claim-1', user_id: 'emp-1', status: 'approved' }];
        }
        if (sql.includes('INSERT INTO schedules')) {
          return [{ id: 'sched-new-1' }];
        }
        if (sql.includes('SELECT basic_salary FROM users')) {
          return [{ basic_salary: 16000 }];
        }
        if (sql.includes("SELECT data FROM settings WHERE category = 'payroll'")) {
          return [{ data: { monthly_working_hours: 160 } }];
        }
        if (sql.includes('INSERT INTO overtime_entries')) {
          return [{ id: 'ot-new-1' }];
        }
        if (sql.includes('UPDATE wfm_opportunities')) {
          return [{ id: 'opp-vet', slots_claimed: 1, status: 'open' }];
        }
        return [];
      });

      const res = await service.claimOpportunity('t1', 'opp-vet', 'emp-1', {});

      expect(res.auto_approved).toBe(true);
      expect(res.claim.status).toBe('approved');
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        't1',
        'emp-1',
        expect.objectContaining({
          type: 'wfm_claim_decision',
          title: expect.stringContaining('Claim Auto-Approved'),
        }),
      );
    });
  });

  describe('Manager Review of Claims', () => {
    it('should approve pending claim and notify employee', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT c.*, o.title, o.type, o.date')) {
          return [{
            id: 'claim-2',
            opportunity_id: 'opp-2',
            user_id: 'emp-2',
            type: 'VET',
            title: 'Weekend Extra',
            date: '2026-11-08',
            hours: 5,
            ot_rate_multiplier: 1.5,
            ot_category: 'normal',
            slots_available: 2,
            slots_claimed: 0,
            status: 'pending',
          }];
        }
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vet_enabled: true }];
        }
        if (sql.includes('INSERT INTO schedules')) {
          return [{ id: 'sched-2' }];
        }
        if (sql.includes('SELECT basic_salary FROM users')) {
          return [{ basic_salary: 16000 }];
        }
        if (sql.includes('INSERT INTO overtime_entries')) {
          return [{ id: 'ot-2' }];
        }
        return [];
      });

      const reviewRes = await service.reviewClaim('t1', 'claim-2', 'manager-1', {
        status: 'approved',
        review_notes: 'Approved for critical coverage',
      });

      expect(reviewRes.status).toBe('approved');
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        't1',
        'emp-2',
        expect.objectContaining({
          type: 'wfm_claim_decision',
          title: expect.stringContaining('Claim Approved'),
        }),
      );
    });

    it('should reject pending claim with note and notify employee', async () => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT c.*, o.title, o.type, o.date')) {
          return [{
            id: 'claim-3',
            opportunity_id: 'opp-3',
            user_id: 'emp-3',
            type: 'VTO',
            title: 'Slow Day VTO',
            date: '2026-11-09',
            status: 'pending',
          }];
        }
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vto_enabled: true }];
        }
        return [];
      });

      const reviewRes = await service.reviewClaim('t1', 'claim-3', 'manager-1', {
        status: 'rejected',
        review_notes: 'Coverage needed in customer support',
      });

      expect(reviewRes.status).toBe('rejected');
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        't1',
        'emp-3',
        expect.objectContaining({
          type: 'wfm_claim_decision',
          title: expect.stringContaining('Claim Not Approved'),
        }),
      );
    });
  });

  describe('Claim Cancellation & Slot Re-Opening', () => {
    it('should cancel approved claim, revert schedule & OT, and notify department that slot reopened', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT c.*, o.title, o.date')) {
          return [{
            id: 'claim-4',
            opportunity_id: 'opp-4',
            user_id: 'emp-4',
            type: 'VET',
            title: 'Coverage Shift',
            date: dateStr,
            status: 'approved',
            schedule_id: 'sched-4',
            overtime_entry_id: 'ot-4',
            slots_claimed: 1,
            slots_available: 1,
            hours: 4,
            ot_rate_multiplier: 1.5,
          }];
        }
        if (sql.includes('SELECT * FROM wfm_settings')) {
          return [{ id: 'settings-1', vet_cancellation_cutoff_hours: 4, vto_cancellation_cutoff_hours: 2 }];
        }
        if (sql.includes('SELECT * FROM wfm_opportunities WHERE id = $1')) {
          return [{
            id: 'opp-4',
            type: 'VET',
            title: 'Coverage Shift',
            date: dateStr,
            slots_claimed: 0,
            slots_available: 1,
            hours: 4,
            ot_rate_multiplier: 1.5,
          }];
        }
        if (sql.includes('SELECT id, full_name, email FROM users')) {
          return [{ id: 'emp-1' }, { id: 'emp-2' }];
        }
        return [];
      });

      const cancelRes = await service.cancelClaim('t1', 'claim-4', 'emp-4');

      expect(cancelRes.message).toBe('Claim successfully cancelled.');
      expect(mockNotificationsService.createBulkNotifications).toHaveBeenCalledWith(
        't1',
        ['emp-1', 'emp-2'],
        expect.objectContaining({
          type: 'wfm_slot_reopened',
          title: expect.stringContaining('VET Shift Re-Opened'),
        }),
      );
    });
  });
});
