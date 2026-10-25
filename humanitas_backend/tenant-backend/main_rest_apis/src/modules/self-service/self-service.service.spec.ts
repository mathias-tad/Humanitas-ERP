import { Test, TestingModule } from '@nestjs/testing';
import { SelfServiceService } from './self-service.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SelfServiceService', () => {
  let service: SelfServiceService;
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
        SelfServiceService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<SelfServiceService>(SelfServiceService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return employee dashboard metrics', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            id: 'u1',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            position: 'Engineer',
            department: 'Tech',
            hire_date: '2024-01-01',
          },
        ]) // user
        .mockResolvedValueOnce([
          { leave_type: 'annual', allocated_days: 20, used_days: 5, remaining_days: 15 },
        ]) // leave balances
        .mockResolvedValueOnce([{ count: '2' }]) // pending leave
        .mockResolvedValueOnce([{ count: '1' }]) // pending changes
        .mockResolvedValueOnce([
          { status: 'present', count: '18' },
          { status: 'late', count: '2' },
        ]) // attendance month
        .mockResolvedValueOnce([
          { status: 'present' },
          { status: 'present' },
          { status: 'late' },
        ]) // streak
        .mockResolvedValueOnce([
          {
            net_pay: '4500.00',
            gross_pay: '5200.00',
            total_deductions: '700.00',
            month: 10,
            year: 2026,
            status: 'completed',
          },
        ]); // latest payslip

      const res = await service.getDashboard('tenant-1', 'u1');

      expect(res.user.first_name).toBe('John');
      expect(res.leave_balances.length).toBe(1);
      expect(res.pending_requests.leave).toBe(2);
      expect(res.pending_requests.profile_changes).toBe(1);
      expect(res.attendance_summary.present).toBe(18);
      expect(res.attendance_summary.late).toBe(2);
      expect(res.attendance_summary.streak).toBe(3);
      expect(res.latest_payslip.net_pay).toBe('4500.00');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(service.getDashboard('tenant-1', 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAttendanceHeatmap', () => {
    it('should return heatmap records', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { date: '2026-10-01', status: 'present', actual_in: '09:00', actual_out: '18:00' },
        { date: '2026-10-02', status: 'late', actual_in: '09:25', actual_out: '18:00' },
      ]);

      const res = await service.getAttendanceHeatmap('tenant-1', 'u1', 30);
      expect(res.length).toBe(2);
      expect(res[0].status).toBe('present');
    });
  });

  describe('getPayslips', () => {
    it('should return payslips list with YTD calculation', async () => {
      const currentYear = new Date().getFullYear();
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'ps1',
          month: 10,
          year: currentYear,
          gross_pay: '5000.00',
          net_pay: '4200.00',
          total_deductions: '800.00',
          status: 'paid',
        },
        {
          id: 'ps2',
          month: 9,
          year: currentYear,
          gross_pay: '5000.00',
          net_pay: '4200.00',
          total_deductions: '800.00',
          status: 'paid',
        },
      ]);

      const res = await service.getPayslips('tenant-1', 'u1');
      expect(res.payslips.length).toBe(2);
      expect(res.ytd_summary.ytd_gross).toBe(10000);
      expect(res.ytd_summary.ytd_net).toBe(8400);
      expect(res.ytd_summary.ytd_deductions).toBe(1600);
    });
  });

  describe('getProfile and updateProfile', () => {
    it('should return profile and pending change requests', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            id: 'u1',
            first_name: 'John',
            phone: '1234567890',
            address: '123 Main St',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'req1',
            field_name: 'account_number',
            proposed_value: '987654321',
            status: 'pending',
          },
        ]);

      const res = await service.getProfile('tenant-1', 'u1');
      expect(res.profile.first_name).toBe('John');
      expect(res.pending_change_requests.length).toBe(1);
    });

    it('should update non-sensitive fields in users table', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      const res = await service.updateProfile('tenant-1', 'u1', {
        phone: '9876543210',
        city: 'New York',
      });

      expect(res.message).toBe('Profile updated successfully');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET phone = $1, city = $2 WHERE id = $3'),
        ['9876543210', 'New York', 'u1'],
      );
    });

    it('should throw BadRequestException if no fields provided to update', async () => {
      await expect(
        service.updateProfile('tenant-1', 'u1', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestSensitiveChange', () => {
    it('should insert a sensitive profile change request', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ val: 'OLD_BANK_123' }]) // get current value
        .mockResolvedValueOnce([
          {
            id: 'req-1',
            user_id: 'u1',
            field_name: 'account_number',
            current_value: 'OLD_BANK_123',
            proposed_value: 'NEW_BANK_456',
            status: 'pending',
          },
        ]); // insert

      const res = await service.requestSensitiveChange('tenant-1', 'u1', {
        field_name: 'account_number',
        proposed_value: 'NEW_BANK_456',
        reason: 'Bank account changed',
      });

      expect(res.id).toBe('req-1');
      expect(res.proposed_value).toBe('NEW_BANK_456');
    });
  });

  describe('reviewChangeRequest', () => {
    it('should approve change request and update users table', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            id: 'req-1',
            user_id: 'u1',
            field_name: 'account_number',
            proposed_value: 'NEW_BANK_456',
            status: 'pending',
          },
        ]) // select req
        .mockResolvedValueOnce([]) // update request record
        .mockResolvedValueOnce([]); // update users table

      const res = await service.reviewChangeRequest(
        'tenant-1',
        'req-1',
        'admin-1',
        { status: 'approved', reviewer_notes: 'Verified with bank statement' },
      );

      expect(res.status).toBe('approved');
      expect(mockConnection.query).toHaveBeenCalledWith(
        'UPDATE users SET account_number = $1 WHERE id = $2',
        ['NEW_BANK_456', 'u1'],
      );
    });

    it('should reject change request without modifying users table', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            id: 'req-1',
            user_id: 'u1',
            field_name: 'account_number',
            proposed_value: 'BAD_BANK',
            status: 'pending',
          },
        ]) // select req
        .mockResolvedValueOnce([]); // update request record

      const res = await service.reviewChangeRequest(
        'tenant-1',
        'req-1',
        'admin-1',
        { status: 'rejected', reviewer_notes: 'Invalid documentation' },
      );

      expect(res.status).toBe('rejected');
      expect(mockConnection.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET account_number'),
        expect.anything(),
      );
    });
  });

  describe('getAnalytics', () => {
    it('should return punctuality and pay trend', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ total: '20', on_time: '18', late: '2' }]) // attendance
        .mockResolvedValueOnce([
          { month: 9, year: 2026, net_pay: '4200.00', gross_pay: '5000.00' },
          { month: 10, year: 2026, net_pay: '4500.00', gross_pay: '5200.00' },
        ]); // pay trend

      const res = await service.getAnalytics('tenant-1', 'u1');

      expect(res.punctuality_score).toBe(90);
      expect(res.pay_trend.length).toBe(2);
    });
  });
});
