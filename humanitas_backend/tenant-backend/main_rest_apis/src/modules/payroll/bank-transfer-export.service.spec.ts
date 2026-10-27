import { Test, TestingModule } from '@nestjs/testing';
import {
  BankTransferExportService,
  BankTransferEmployeeItem,
} from './bank-transfer-export.service';
import { DatabaseService } from '../database/database.service';

describe('BankTransferExportService', () => {
  let service: BankTransferExportService;
  let mockDatabaseService: any;
  let mockConnection: any;

  const samplePayrollRows = [
    {
      user_id: 'usr-1001',
      employee_name: 'John Doe',
      email: 'john@example.com',
      department: 'Engineering',
      account_number: '1000123456789',
      bank_name: 'Commercial Bank of Ethiopia',
      bank_code: '12345678',
      net_salary: '15000.50',
    },
    {
      user_id: 'usr-1002',
      employee_name: 'Jane Smith',
      email: 'jane@example.com',
      department: 'Marketing',
      account_number: '1000987654321',
      bank_name: 'Awash Bank',
      bank_code: '87654321',
      net_salary: '22400.00',
    },
  ];

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn().mockResolvedValue(samplePayrollRows),
    };

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankTransferExportService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<BankTransferExportService>(BankTransferExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch and map payroll bank records properly', async () => {
    const records = await service.getPayrollBankRecords('tenant-1', 8, 2026);
    expect(records).toHaveLength(2);
    expect(records[0].employeeName).toBe('John Doe');
    expect(records[0].accountNumber).toBe('1000123456789');
    expect(records[0].netSalary).toBe(15000.50);
  });

  it('should generate NACHA ACH file with valid 94-character fixed-width records', async () => {
    const result = await service.generateBankTransferFile(
      'tenant-1',
      8,
      2026,
      'nacha',
      'Acme Corp',
    );

    expect(result.contentType).toBe('text/plain');
    expect(result.filename).toContain('NACHA_PAYROLL_2026_08.ach');
    expect(result.recordCount).toBe(2);
    expect(result.totalAmount).toBe(37400.50);

    const lines = result.content.split('\r\n');
    expect(lines.length).toBeGreaterThanOrEqual(10); // Multiple of 10 blocks
    expect(lines[0].startsWith('101')).toBe(true); // File header
    expect(lines[1].startsWith('5220')).toBe(true); // Batch header
    expect(lines[2].startsWith('622')).toBe(true); // Entry detail
    expect(lines[3].startsWith('622')).toBe(true); // Entry detail
    lines.forEach((line) => {
      expect(line.length).toBe(94);
    });
  });

  it('should generate ABA Direct Entry file with valid 120-character records', async () => {
    const result = await service.generateBankTransferFile(
      'tenant-1',
      8,
      2026,
      'aba',
      'Acme Corp',
    );

    expect(result.filename).toContain('ABA_PAYROLL_2026_08.aba');
    const lines = result.content.split('\r\n');
    expect(lines[0].startsWith('0')).toBe(true); // Descriptive
    expect(lines[1].startsWith('1')).toBe(true); // Detail
    expect(lines[2].startsWith('1')).toBe(true); // Detail
    expect(lines[3].startsWith('7999-999')).toBe(true); // Total
  });

  it('should generate CBE Direct Credit CSV format', async () => {
    const result = await service.generateBankTransferFile(
      'tenant-1',
      8,
      2026,
      'cbe',
      'Acme Corp',
    );

    expect(result.filename).toContain('CBE_SALARY_TRANSFER_2026_08.csv');
    const lines = result.content.split('\r\n');
    expect(lines[0]).toBe('Account Number,Beneficiary Name,Amount,Reference,Remark');
    expect(lines[1]).toContain('"1000123456789","John Doe",15000.50');
  });

  it('should generate Awash Bank and Generic CSV formats', async () => {
    const awashResult = await service.generateBankTransferFile(
      'tenant-1',
      8,
      2026,
      'awash',
    );
    expect(awashResult.filename).toContain('AWASH_BANK_SALARY_2026_08.csv');

    const genericResult = await service.generateBankTransferFile(
      'tenant-1',
      8,
      2026,
      'generic',
    );
    expect(genericResult.filename).toContain('BANK_TRANSFER_BATCH_2026_08.csv');
    expect(genericResult.content).toContain('Employee ID,Employee Name,Bank Name');
  });

  it('should throw BadRequestException if no records exist', async () => {
    mockConnection.query.mockResolvedValueOnce([]);
    await expect(
      service.generateBankTransferFile('tenant-1', 1, 2026, 'nacha'),
    ).rejects.toThrow('No payroll records found');
  });
});
