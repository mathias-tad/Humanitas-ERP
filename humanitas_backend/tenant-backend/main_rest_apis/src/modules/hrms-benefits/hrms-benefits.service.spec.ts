import { Test, TestingModule } from '@nestjs/testing';
import { HrmsBenefitsService } from './hrms-benefits.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  BenefitPlanType,
  BenefitPlanTier,
  CoverageTier,
  EnrollmentType,
} from './dto/hrms-benefits.dto';

describe('HrmsBenefitsService', () => {
  let service: HrmsBenefitsService;
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
        HrmsBenefitsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsBenefitsService>(HrmsBenefitsService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlans', () => {
    it('should return list of active benefit plans', async () => {
      const mockPlans = [
        { id: 'plan-1', name: 'Comprehensive Health Plan', plan_type: 'medical', active_enrollments_count: '15' },
      ];
      mockConnection.query.mockResolvedValue(mockPlans);

      const result = await service.getPlans('tenant-1', 'medical');
      expect(result).toEqual(mockPlans);
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  describe('getPlanById', () => {
    it('should throw NotFoundException when plan does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(service.getPlanById('tenant-1', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return plan when found', async () => {
      const mockPlan = { id: 'plan-1', name: 'Comprehensive Health Plan' };
      mockConnection.query.mockResolvedValueOnce([mockPlan]);

      const result = await service.getPlanById('tenant-1', 'plan-1');
      expect(result).toEqual(mockPlan);
    });
  });

  describe('createPlan', () => {
    it('should insert and return new benefit plan', async () => {
      const mockCreated = { id: 'plan-new', name: 'Vision Premier', total_cost: 50 };
      mockConnection.query.mockResolvedValueOnce([mockCreated]);

      const result = await service.createPlan('tenant-1', {
        name: 'Vision Premier',
        code: 'VIS-PRM-01',
        plan_type: BenefitPlanType.VISION,
        tier: BenefitPlanTier.PREMIUM,
        total_cost: 50,
        employer_contribution: 40,
        employee_contribution: 10,
      });

      expect(result).toEqual(mockCreated);
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  describe('updatePlan', () => {
    it('should update plan fields', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'plan-1', name: 'Old Plan' }])
        .mockResolvedValueOnce([{ id: 'plan-1', name: 'New Plan', total_cost: 100 }]);

      const result = await service.updatePlan('tenant-1', 'plan-1', {
        name: 'New Plan',
        total_cost: 100,
      });

      expect(result.name).toBe('New Plan');
    });
  });

  describe('enrollEmployee', () => {
    it('should create enrollment record with calculated deductions', async () => {
      const mockPlan = {
        id: 'plan-1',
        employer_contribution: 200,
        employee_contribution: 50,
      };
      const mockEnrollment = {
        id: 'enr-1',
        plan_id: 'plan-1',
        user_id: 'user-1',
        employee_deduction_amount: 50,
        employer_cost_amount: 200,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockPlan]) // getPlanById
        .mockResolvedValueOnce([mockEnrollment]); // insert enrollment

      const result = await service.enrollEmployee('tenant-1', {
        plan_id: 'plan-1',
        user_id: 'user-1',
        coverage_tier: CoverageTier.INDIVIDUAL,
        enrollment_type: EnrollmentType.OPEN_ENROLLMENT,
        effective_start_date: '2026-01-01',
      });

      expect(result).toEqual(mockEnrollment);
    });
  });

  describe('getEnrollments', () => {
    it('should filter by currentUserId if hasManagePerm is false', async () => {
      const mockEnrollments = [{ id: 'enr-1', user_id: 'user-1', plan_name: 'Health' }];
      mockConnection.query.mockResolvedValue(mockEnrollments);

      const result = await service.getEnrollments('tenant-1', 'user-1', false);
      expect(result).toEqual(mockEnrollments);

      const queryArg = mockConnection.query.mock.calls[0][0];
      expect(queryArg).toContain('be.user_id = $1');
    });

    it('should return all enrollments for admin users', async () => {
      const mockEnrollments = [{ id: 'enr-1' }, { id: 'enr-2' }];
      mockConnection.query.mockResolvedValue(mockEnrollments);

      const result = await service.getEnrollments('tenant-1', 'admin-1', true);
      expect(result).toEqual(mockEnrollments);
      const queryArg = mockConnection.query.mock.calls[0][0];
      expect(queryArg).not.toContain('be.user_id = $1');
    });
  });

  describe('getEnrollmentById', () => {
    it('should throw ForbiddenException if regular employee accesses someone else enrollment', async () => {
      mockConnection.query.mockResolvedValueOnce([{ id: 'enr-1', user_id: 'other-user' }]);

      await expect(
        service.getEnrollmentById('tenant-1', 'enr-1', 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return enrollment with covered dependents', async () => {
      const mockEnrollment = { id: 'enr-1', user_id: 'user-1', plan_name: 'Dental' };
      const mockDependents = [{ id: 'dep-1', full_name: 'Baby Jane', relationship: 'child' }];

      mockConnection.query
        .mockResolvedValueOnce([mockEnrollment])
        .mockResolvedValueOnce(mockDependents);

      const result = await service.getEnrollmentById('tenant-1', 'enr-1', 'user-1', false);
      expect(result.id).toBe('enr-1');
      expect(result.dependents).toEqual(mockDependents);
    });
  });

  describe('addDependent', () => {
    it('should add covered dependent to enrollment', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'enr-1', user_id: 'user-1' }])
        .mockResolvedValueOnce([{ id: 'dep-1', full_name: 'John Doe', relationship: 'spouse' }]);

      const result = await service.addDependent('tenant-1', 'enr-1', 'user-1', false, {
        full_name: 'John Doe',
        relationship: 'spouse',
      });

      expect(result.full_name).toBe('John Doe');
    });
  });

  describe('removeDependent', () => {
    it('should remove dependent from enrollment', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'dep-1', user_id: 'user-1' }])
        .mockResolvedValueOnce([]);

      const result = await service.removeDependent('tenant-1', 'dep-1', 'user-1', false);
      expect(result.success).toBe(true);
    });
  });

  describe('getPayrollDeductions', () => {
    it('should return active enrollments deduction list for payroll', async () => {
      const mockDeductions = [
        {
          enrollment_id: 'enr-1',
          user_id: 'u-1',
          employee_deduction_amount: 50.0,
          employer_cost_amount: 150.0,
        },
      ];
      mockConnection.query.mockResolvedValue(mockDeductions);

      const result = await service.getPayrollDeductions('tenant-1');
      expect(result).toEqual(mockDeductions);
      const queryArg = mockConnection.query.mock.calls[0][0];
      expect(queryArg).toContain("be.status = 'enrolled'");
    });
  });

  describe('getStats', () => {
    it('should calculate enrolled employees, costs, and enrollment rate', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            enrolled_employees: '25',
            total_monthly_employer_cost: '5000',
            total_monthly_employee_deductions: '1250',
          },
        ])
        .mockResolvedValueOnce([{ active_plans: '6' }])
        .mockResolvedValueOnce([{ covered_dependents: '14' }])
        .mockResolvedValueOnce([{ total_users: '50' }])
        .mockResolvedValueOnce([{ plan_type: 'medical', enrollment_count: '25' }]);

      const result = await service.getStats('tenant-1');
      expect(result.total_enrolled_employees).toBe(25);
      expect(result.total_active_plans).toBe(6);
      expect(result.total_monthly_employer_cost).toBe(5000);
      expect(result.total_monthly_employee_deductions).toBe(1250);
      expect(result.total_covered_dependents).toBe(14);
      expect(result.enrollment_rate).toBe(50); // 25 / 50 * 100 = 50%
      expect(result.by_plan_type).toHaveLength(1);
    });
  });
});
