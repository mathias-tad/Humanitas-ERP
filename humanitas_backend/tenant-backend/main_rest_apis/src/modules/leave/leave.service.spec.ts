import { LeaveService } from './leave.service';

describe('LeaveService Unit Tests', () => {
  let service: LeaveService;
  let mockConnection: any;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
    };
    mockDatabaseService = {
      getTenantConnection: jest.fn().mockResolvedValue(mockConnection),
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };
    service = new LeaveService(mockDatabaseService);
  });

  describe('calculateAnnualLeave (Service Years Accrual Logic)', () => {
    it('calculates baseline leave when years of service is 0', () => {
      const annualLeave = (service as any).calculateAnnualLeave(16, 1, 0);
      expect(annualLeave).toBe(16);
    });

    it('adds 1 day per year of service to base annual leave', () => {
      // 16 base + 4 years * 1 day/year = 20 days
      const annualLeave = (service as any).calculateAnnualLeave(16, 1, 4);
      expect(annualLeave).toBe(20);
    });

    it('supports custom leave increase rates', () => {
      // 14 base + 3 years * 2 days/year = 20 days
      const annualLeave = (service as any).calculateAnnualLeave(14, 2, 3);
      expect(annualLeave).toBe(20);
    });
  });

  describe('getYearsOfService', () => {
    it('returns 0 if hired within the past 11 months', () => {
      const hireDate = new Date();
      hireDate.setMonth(hireDate.getMonth() - 6);
      const years = (service as any).getYearsOfService(hireDate);
      expect(years).toBe(0);
    });

    it('returns exactly 2 for employee hired 2 years ago', () => {
      const hireDate = new Date();
      hireDate.setFullYear(hireDate.getFullYear() - 2);
      hireDate.setDate(hireDate.getDate() - 5); // 2 years + 5 days
      const years = (service as any).getYearsOfService(hireDate);
      expect(years).toBe(2);
    });

    it('never returns negative years of service', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const years = (service as any).getYearsOfService(futureDate);
      expect(years).toBe(0);
    });
  });

  describe('isUserInProbation', () => {
    it('flags probation as true if user has no hire date recorded', async () => {
      mockConnection.query.mockResolvedValueOnce([{ hire_date: null }]);
      const result = await (service as any).isUserInProbation(mockConnection, 'user-1', 90);
      expect(result.inProbation).toBe(true);
      expect(result.noHireDate).toBe(true);
    });

    it('flags probation as true if employee hired 30 days ago (probation is 90 days)', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      mockConnection.query.mockResolvedValueOnce([{ hire_date: recentDate.toISOString() }]);

      const result = await (service as any).isUserInProbation(mockConnection, 'user-2', 90);
      expect(result.inProbation).toBe(true);
      expect(result.daysSinceHire).toBe(30);
    });

    it('flags probation as false if employee passed 90 days probation', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 120);
      mockConnection.query.mockResolvedValueOnce([{ hire_date: pastDate.toISOString() }]);

      const result = await (service as any).isUserInProbation(mockConnection, 'user-3', 90);
      expect(result.inProbation).toBe(false);
      expect(result.daysSinceHire).toBeGreaterThanOrEqual(90);
    });
  });
});
