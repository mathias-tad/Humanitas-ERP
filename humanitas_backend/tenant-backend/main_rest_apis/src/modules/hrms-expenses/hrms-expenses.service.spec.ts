import { Test, TestingModule } from '@nestjs/testing';
import { HrmsExpensesService } from './hrms-expenses.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpenseReportStatus } from './dto/hrms-expenses.dto';

describe('HrmsExpensesService', () => {
  let service: HrmsExpensesService;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    const mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrmsExpensesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<HrmsExpensesService>(HrmsExpensesService);
    // Mark tenant as ensured so ensureTables does not run in unit tests
    (service as any).ensuredTenants.add('test-tenant');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCategories and createCategory', () => {
    it('should query categories', async () => {
      const mockCats = [{ id: 'cat-1', name: 'Travel', code: 'TRAVEL' }];
      mockConnection.query.mockResolvedValue(mockCats);

      const result = await service.getCategories('test-tenant', 'comp-1');
      expect(result).toEqual(mockCats);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM expense_categories'),
        expect.arrayContaining(['comp-1'])
      );
    });

    it('should insert and return new category', async () => {
      const mockCat = { id: 'cat-new', name: 'Software', code: 'SOFTWARE' };
      mockConnection.query
        .mockResolvedValueOnce([]) // insert
        .mockResolvedValueOnce([mockCat]); // select

      const result = await service.createCategory('test-tenant', {
        name: 'Software',
        code: 'SOFTWARE',
        spending_limit: 500,
      });

      expect(result).toEqual(mockCat);
    });
  });

  describe('getReports and getReportById', () => {
    it('should query expense reports with item count', async () => {
      const mockReports = [
        { id: 'rep-1', report_number: 'EXP-202610-1001', total_amount: 150 },
      ];
      mockConnection.query.mockResolvedValue(mockReports);

      const result = await service.getReports('test-tenant', 'emp-1');
      expect(result).toEqual(mockReports);
    });

    it('should return report with line items', async () => {
      const mockReport = { id: 'rep-1', report_number: 'EXP-202610-1001' };
      const mockItems = [{ id: 'item-1', amount: 150, description: 'Train Ticket' }];
      mockConnection.query
        .mockResolvedValueOnce([mockReport])
        .mockResolvedValueOnce(mockItems);

      const result = await service.getReportById('test-tenant', 'rep-1');
      expect(result.report_number).toBe('EXP-202610-1001');
      expect(result.items).toEqual(mockItems);
    });

    it('should throw NotFoundException if report not found', async () => {
      mockConnection.query.mockResolvedValue([]);
      await expect(service.getReportById('test-tenant', 'not-exist')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('createReport and addExpenseItem with policy check', () => {
    it('should create an expense report and insert items', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // insert report
        .mockResolvedValueOnce([{ id: 'rep-1', report_number: 'EXP-202610-1001' }]) // getReportById
        .mockResolvedValueOnce([]); // items

      const result = await service.createReport(
        'test-tenant',
        { title: 'Client Meeting Trip', purpose: 'Q4 Review' },
        'user-1'
      );

      expect(result.report_number).toBe('EXP-202610-1001');
    });

    it('should flag policy violation if amount exceeds spending limit', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ spending_limit: 100, name: 'Meals' }]) // category limit check
        .mockResolvedValueOnce([]) // insert item
        .mockResolvedValueOnce([{ total: 150 }]) // recalculate sum
        .mockResolvedValueOnce([]) // update report total
        .mockResolvedValueOnce([{ id: 'item-1', amount: 150, policy_violation: true }]); // select item

      const item = await service.addExpenseItem('test-tenant', 'rep-1', {
        category_id: 'cat-meals',
        expense_date: '2026-10-24',
        description: 'Team Dinner',
        amount: 150,
      });

      expect(item.policy_violation).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO expense_items'),
        expect.arrayContaining([true])
      );
    });
  });

  describe('submitReport, approveReport, and rejectReport', () => {
    it('should throw BadRequestException when submitting an empty report', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'rep-1' }]) // report
        .mockResolvedValueOnce([]); // no items

      await expect(service.submitReport('test-tenant', 'rep-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should submit report when items exist', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'rep-1', status: 'draft' }]) // report
        .mockResolvedValueOnce([{ id: 'item-1' }]) // items
        .mockResolvedValueOnce([]) // update report status
        .mockResolvedValueOnce([{ id: 'rep-1', status: ExpenseReportStatus.SUBMITTED }]) // re-fetch
        .mockResolvedValueOnce([{ id: 'item-1' }]);

      const result = await service.submitReport('test-tenant', 'rep-1', 'user-1');
      expect(result.status).toBe(ExpenseReportStatus.SUBMITTED);
    });

    it('should approve report and flag for payroll inclusion', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'rep-1', total_amount: 200 }]) // getReportById
        .mockResolvedValueOnce([{ id: 'item-1' }]) // items
        .mockResolvedValueOnce([]) // update line items
        .mockResolvedValueOnce([]) // update report
        .mockResolvedValueOnce([{ id: 'rep-1', status: ExpenseReportStatus.APPROVED, approved_amount: 200 }])
        .mockResolvedValueOnce([{ id: 'item-1' }]);

      const result = await service.approveReport(
        'test-tenant',
        'rep-1',
        { approved_amount: 200, include_in_payroll: true },
        'manager-1'
      );

      expect(result.status).toBe(ExpenseReportStatus.APPROVED);
      expect(result.approved_amount).toBe(200);
    });

    it('should reject report with reason', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // update report status
        .mockResolvedValueOnce([{ id: 'rep-1', status: ExpenseReportStatus.REJECTED, rejection_reason: 'Missing receipts' }])
        .mockResolvedValueOnce([]); // items

      const result = await service.rejectReport('test-tenant', 'rep-1', 'Missing receipts', 'manager-1');
      expect(result.status).toBe(ExpenseReportStatus.REJECTED);
      expect(result.rejection_reason).toBe('Missing receipts');
    });
  });

  describe('getExpenseAnalytics', () => {
    it('should aggregate spend by category, department, and policy violations', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          { total_reports: 10, approved_reports: 8, total_claimed: 5000, total_approved: 4500 },
        ]) // summary
        .mockResolvedValueOnce([{ count: 2 }]) // policy violations
        .mockResolvedValueOnce([{ name: 'Travel', spend: 3000 }]) // category spend
        .mockResolvedValueOnce([{ department: 'Sales', spend: 3000, report_count: 5 }]); // dept spend

      const analytics = await service.getExpenseAnalytics('test-tenant');
      expect(analytics.total_reports).toBe(10);
      expect(analytics.approved_reports).toBe(8);
      expect(analytics.total_claimed).toBe(5000);
      expect(analytics.policy_violations).toBe(2);
      expect(analytics.category_spend).toHaveLength(1);
      expect(analytics.department_spend).toHaveLength(1);
    });
  });
});
