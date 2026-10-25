import { Test, TestingModule } from '@nestjs/testing';
import { HrmsDocumentsService } from './hrms-documents.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentCategory, VerificationStatus } from './dto/hrms-documents.dto';

describe('HrmsDocumentsService', () => {
  let service: HrmsDocumentsService;
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
        HrmsDocumentsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsDocumentsService>(HrmsDocumentsService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDocuments', () => {
    it('should query employee documents with filters', async () => {
      const mockDocs = [
        {
          id: 'doc-1',
          title: 'Employment Contract',
          category: 'contract',
          first_name: 'John',
          last_name: 'Doe',
          expiry_status: 'valid',
        },
      ];
      mockConnection.query.mockResolvedValue(mockDocs);

      const result = await service.getDocuments('tenant-1', {
        userId: '11111111-1111-1111-1111-111111111111',
        category: DocumentCategory.CONTRACT,
        company_id: 'comp-1',
      });

      expect(result).toEqual(mockDocs);
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  describe('getDocumentById', () => {
    it('should return a document when found', async () => {
      const mockDoc = { id: 'doc-1', title: 'Passport Scan', user_id: 'u-1' };
      mockConnection.query.mockResolvedValue([mockDoc]);

      const result = await service.getDocumentById('tenant-1', 'doc-1');
      expect(result).toEqual(mockDoc);
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockConnection.query.mockResolvedValue([]);

      await expect(service.getDocumentById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createDocument', () => {
    it('should verify employee exists and insert document', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'u-1', company_id: 'comp-1', branch_id: 'br-1' }]) // user lookup
        .mockResolvedValueOnce([{ id: 'new-doc-1', title: 'Degree Certificate' }]); // insert

      const dto = {
        userId: 'u-1',
        title: 'Degree Certificate',
        category: DocumentCategory.CERTIFICATION,
        documentType: 'degree',
        fileUrl: 'https://storage.example.com/degree.pdf',
        fileName: 'degree.pdf',
      };

      const result = await service.createDocument('tenant-1', dto);
      expect(result).toEqual({ id: 'new-doc-1', title: 'Degree Certificate' });
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // no user

      const dto = {
        userId: 'u-unknown',
        title: 'Degree Certificate',
        category: DocumentCategory.CERTIFICATION,
        documentType: 'degree',
        fileUrl: 'https://storage.example.com/degree.pdf',
        fileName: 'degree.pdf',
      };

      await expect(service.createDocument('tenant-1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyDocument', () => {
    it('should update verification status and verifier ID', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'doc-1', user_id: 'u-1' }]) // getDocumentById
        .mockResolvedValueOnce([{ id: 'doc-1', verification_status: 'verified', verified_by: 'admin-1' }]);

      const result = await service.verifyDocument('tenant-1', 'doc-1', {
        status: VerificationStatus.VERIFIED,
        notes: 'Passport verified against physical copy',
      }, 'admin-1');

      expect(result.verification_status).toBe('verified');
      expect(result.verified_by).toBe('admin-1');
    });
  });

  describe('deleteDocument', () => {
    it('should delete existing document', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'doc-1' }]) // getDocumentById
        .mockResolvedValueOnce([]); // delete

      const result = await service.deleteDocument('tenant-1', 'doc-1');
      expect(result.success).toBe(true);
    });
  });

  describe('getExpiringDocumentsSummary', () => {
    it('should aggregate expiring and expired document metrics', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            expired_count: '2',
            expiring_30_days: '5',
            expiring_60_days: '3',
            expiring_90_days: '7',
            total_active_tracked: '15',
          },
        ])
        .mockResolvedValueOnce([
          { id: 'doc-exp-1', title: 'Work Visa', days_remaining: 12 },
        ]);

      const result = await service.getExpiringDocumentsSummary('tenant-1', { company_id: 'comp-1' });

      expect(result.expiredCount).toBe(2);
      expect(result.expiring30Days).toBe(5);
      expect(result.expiring60Days).toBe(3);
      expect(result.expiring90Days).toBe(7);
      expect(result.totalActiveTracked).toBe(15);
      expect(result.upcomingExpiringDocuments.length).toBe(1);
    });
  });

  describe('generateLetter', () => {
    it('should interpolate employee tokens into template', async () => {
      const mockTemplate = {
        id: 't-1',
        code: 'EXPERIENCE_LETTER',
        name: 'Certificate of Service & Experience',
        subject: 'Experience Certificate — {{employee_name}}',
        body_template: 'This is to certify that {{employee_name}} was employed as {{job_title}} in {{department}} with salary {{salary}}.',
      };

      const mockEmployee = {
        id: '12345678-0000-0000-0000-000000000000',
        first_name: 'Sara',
        last_name: 'Bekele',
        email: 'sara@example.com',
        position: 'Senior Architect',
        department: 'Engineering',
        base_salary: '75000',
        company_name: 'Tech Corp Ethiopia',
        company_address: 'Bole, Addis Ababa',
        company_id: 'comp-1',
        branch_id: 'br-1',
      };

      mockConnection.query
        .mockResolvedValueOnce([mockTemplate]) // template lookup
        .mockResolvedValueOnce([mockEmployee]) // employee lookup
        .mockResolvedValueOnce([{ first_name: 'HR', last_name: 'Lead', position: 'HR VP' }]); // issuer lookup

      const result = await service.generateLetter('tenant-1', {
        templateIdOrCode: 'EXPERIENCE_LETTER',
        employeeId: '12345678-0000-0000-0000-000000000000',
        saveToVault: false,
      }, 'issuer-1');

      expect(result.subject).toBe('Experience Certificate — Sara Bekele');
      expect(result.renderedText).toContain('Sara Bekele');
      expect(result.renderedText).toContain('Senior Architect');
      expect(result.renderedText).toContain('Engineering');
      expect(result.renderedHtml).toContain('Tech Corp Ethiopia');
      expect(result.savedToVault).toBe(false);
    });

    it('should save generated letter to vault when saveToVault is true', async () => {
      const mockTemplate = {
        id: 't-1',
        code: 'OFFER_LETTER',
        name: 'Employment Offer Letter',
        subject: 'Offer — {{employee_name}}',
        body_template: 'Welcome {{employee_name}} to {{company_name}}!',
      };

      const mockEmployee = {
        id: '12345678-0000-0000-0000-000000000000',
        first_name: 'Abebe',
        last_name: 'Kebede',
        company_id: 'comp-1',
        branch_id: 'br-1',
      };

      mockConnection.query
        .mockResolvedValueOnce([mockTemplate]) // template lookup
        .mockResolvedValueOnce([mockEmployee]) // employee lookup
        .mockResolvedValueOnce([{ first_name: 'HR', last_name: 'Lead' }]) // issuer
        .mockResolvedValueOnce([{ id: 'vault-doc-123' }]); // insert into employee_documents

      const result = await service.generateLetter('tenant-1', {
        templateIdOrCode: 'OFFER_LETTER',
        employeeId: '12345678-0000-0000-0000-000000000000',
        saveToVault: true,
      }, 'issuer-1');

      expect(result.savedToVault).toBe(true);
      expect(result.vaultDocumentId).toBe('vault-doc-123');
    });
  });
});
