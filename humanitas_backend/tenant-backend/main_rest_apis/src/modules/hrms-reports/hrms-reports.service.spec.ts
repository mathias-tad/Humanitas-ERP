import { Test, TestingModule } from '@nestjs/testing';
import { HrmsReportsService } from './hrms-reports.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException } from '@nestjs/common';

describe('HrmsReportsService', () => {
  let service: HrmsReportsService;
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
        HrmsReportsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsReportsService>(HrmsReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return executive HR summary metrics', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            total_employees: '150',
            active_employees: '142',
            new_hires_month: '8',
            avg_tenure_years: '2.5',
            total_basic_payroll: '750000',
          },
        ]) // headcount query
        .mockResolvedValueOnce([
          {
            total_records: '1000',
            absent_records: '20',
          },
        ]) // attendance query
        .mockResolvedValueOnce([
          {
            terminated_count: '2',
          },
        ]) // turnover query
        .mockResolvedValueOnce([
          {
            total_gross: '820000',
          },
        ]); // payroll spend query

      const result = await service.getSummary('tenant-1', { company_id: 'comp-1' });

      expect(result).toBeDefined();
      expect(result.totalHeadcount).toBe(150);
      expect(result.activeEmployees).toBe(142);
      expect(result.newHiresThisMonth).toBe(8);
      expect(result.averageTenureYears).toBe(2.5);
      expect(result.absenteeismRatePercentage).toBe(2.0);
      expect(result.monthlyWorkforceSpend).toBe(820000);
    });

    it('should handle empty headcount gracefully with default values', async () => {
      mockConnection.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getSummary('tenant-1', {});
      expect(result.totalHeadcount).toBe(0);
      expect(result.activeEmployees).toBe(0);
      expect(result.newHiresThisMonth).toBe(0);
    });
  });

  describe('getHeadcountDemographics', () => {
    it('should return department, gender, tenure, and employment type breakdowns', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          { department: 'Engineering', count: '45' },
          { department: 'Sales', count: '30' },
        ])
        .mockResolvedValueOnce([
          { gender: 'Male', count: '42' },
          { gender: 'Female', count: '33' },
        ])
        .mockResolvedValueOnce([
          { tenure_band: '< 1 Year', count: '25' },
          { tenure_band: '1-3 Years', count: '50' },
        ])
        .mockResolvedValueOnce([
          { employment_type: 'Full-Time', count: '70' },
          { employment_type: 'Contract', count: '5' },
        ])
        .mockResolvedValueOnce([
          { company_name: 'HQ Subsidiary', count: '75' },
        ]);

      const result = await service.getHeadcountDemographics('tenant-1', {
        company_id: 'comp-1,comp-2',
      });

      expect(result.byDepartment).toHaveLength(2);
      expect(result.byDepartment[0].name).toBe('Engineering');
      expect(result.byDepartment[0].count).toBe(45);
      expect(result.byGender).toHaveLength(2);
      expect(result.byTenure).toHaveLength(2);
      expect(result.byEmploymentType).toHaveLength(2);
    });
  });

  describe('getTurnoverAnalytics', () => {
    it('should calculate 6-month turnover trends and milestone retention', async () => {
      // 6 months of hire/term queries (12 query calls) + 1 dept query
      for (let i = 0; i < 6; i++) {
        mockConnection.query.mockResolvedValueOnce([{ count: '3' }]); // hired
        mockConnection.query.mockResolvedValueOnce([{ count: '1' }]); // terminated
      }
      mockConnection.query.mockResolvedValueOnce([
        { department: 'Customer Support', terminations: '4' },
      ]);

      const result = await service.getTurnoverAnalytics('tenant-1', {});

      expect(result.monthlyTrend).toHaveLength(6);
      expect(result.monthlyTrend[0].hired).toBe(3);
      expect(result.monthlyTrend[0].exited).toBe(1);
      expect(result.monthlyTrend[0].netGrowth).toBe(2);
      expect(result.milestoneRetention).toBeDefined();
      expect(result.milestoneRetention.length).toBeGreaterThan(0);
    });
  });

  describe('generateBankTransferFile', () => {
    const mockPayrollRows = [
      {
        net_salary: '25000.50',
        user_id: 'user-1',
        full_name: 'Abebe Kebede',
        email: 'abebe@example.com',
        account_number: '100012345678',
        tin: '0012345678',
        department: 'Finance',
      },
      {
        net_salary: '18500.00',
        user_id: 'user-2',
        full_name: 'Fatima Ahmed',
        email: 'fatima@example.com',
        account_number: '100098765432',
        tin: '0098765432',
        department: 'Operations',
      },
    ];

    it('should generate a valid CSV bank transfer file', async () => {
      mockConnection.query.mockResolvedValueOnce(mockPayrollRows);

      const result = await service.generateBankTransferFile('tenant-1', {
        month: 10,
        year: 2026,
        format: 'csv',
      });

      expect(result.filename).toBe('Bank_Transfer_2026_10.csv');
      expect(result.contentType).toContain('text/csv');
      expect(result.totalRecords).toBe(2);
      expect(result.totalDisbursement).toBe(43500.50);
      expect(result.content).toContain('Beneficiary Account Number');
      expect(result.content).toContain('100012345678');
      expect(result.content).toContain('"Abebe Kebede"');
      expect(result.content).toContain('25000.50');
    });

    it('should generate NACHA ACH formatted transfer file', async () => {
      mockConnection.query.mockResolvedValueOnce(mockPayrollRows);

      const result = await service.generateBankTransferFile('tenant-1', {
        month: 10,
        year: 2026,
        format: 'nacha',
      });

      expect(result.filename).toBe('Bank_Transfer_2026_10.txt');
      expect(result.totalRecords).toBe(2);
      expect(result.content).toContain('101 123456789');
      expect(result.content).toContain('8200'); // batch control
      expect(result.content).toContain('9000001'); // file control
    });

    it('should generate ABA formatted transfer file', async () => {
      mockConnection.query.mockResolvedValueOnce(mockPayrollRows);

      const result = await service.generateBankTransferFile('tenant-1', {
        month: 10,
        year: 2026,
        format: 'aba',
      });

      expect(result.filename).toBe('Bank_Transfer_2026_10.txt');
      expect(result.totalRecords).toBe(2);
      expect(result.content).toContain('0                 01ANZ');
      expect(result.content).toContain('7999-999');
    });

    it('should throw NotFoundException if no payroll records exist for given month/year', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(
        service.generateBankTransferFile('tenant-1', {
          month: 10,
          year: 2026,
          format: 'csv',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
