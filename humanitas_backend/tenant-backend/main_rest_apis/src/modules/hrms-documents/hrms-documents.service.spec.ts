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
        .mockResolvedValueOnce([]) // signature lookup
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

  // ── B6: New method tests ──────────────────────────────────────────────────

  describe('addDocumentVersion', () => {
    it('should add a version entry and return next version number', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'doc-1', user_id: 'u-1' }]) // getDocumentById
        .mockResolvedValueOnce([{ next_version: 2 }]) // max version query
        .mockResolvedValueOnce([]); // insert

      const result = await service.addDocumentVersion('tenant-1', 'doc-1', {
        fileUrl: 'https://storage.example.com/v2.pdf',
        uploadedBy: 'admin-1',
        uploadedByName: 'Admin User',
        changeNotes: 'Updated contract terms',
        fileSize: 12345,
      });

      expect(result.version).toBe(2);
      expect(mockConnection.query).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException if document does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // getDocumentById returns empty

      await expect(
        service.addDocumentVersion('tenant-1', 'nonexistent', {
          fileUrl: 'https://storage.example.com/v1.pdf',
          uploadedBy: 'u-1',
          uploadedByName: 'User',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEmployeesWithMissingDocuments', () => {
    it('should return list of employees with zero documents', async () => {
      const mockEmployees = [
        { id: 'u-2', full_name: 'New Hire', email: 'newhire@example.com', department: 'Sales', doc_count: 0 },
      ];
      mockConnection.query.mockResolvedValue(mockEmployees);

      const result = await service.getEmployeesWithMissingDocuments('tenant-1');
      expect(result).toEqual(mockEmployees);
      expect(result[0].doc_count).toBe(0);
    });
  });

  describe('bulkGenerateLetters', () => {
    it('should generate letters for multiple employees and return count', async () => {
      const mockTemplate = { id: 't-1', name: 'Offer Letter', code: 'OFFER_LETTER' };
      mockConnection.query
        .mockResolvedValueOnce([mockTemplate]) // template lookup
        .mockResolvedValueOnce([{ id: 'u-1', full_name: 'Abebe Kebede' }]) // employee 1
        .mockResolvedValueOnce([]) // insert for employee 1
        .mockResolvedValueOnce([{ id: 'u-2', full_name: 'Sara Bekele' }]) // employee 2
        .mockResolvedValueOnce([]); // insert for employee 2

      const result = await service.bulkGenerateLetters('tenant-1', 'OFFER_LETTER', ['u-1', 'u-2']);

      expect(result.generated).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should record errors for missing employees without failing the whole batch', async () => {
      const mockTemplate = { id: 't-1', name: 'Offer Letter', code: 'OFFER_LETTER' };
      mockConnection.query
        .mockResolvedValueOnce([mockTemplate]) // template lookup
        .mockResolvedValueOnce([]) // employee u-missing not found
        .mockResolvedValueOnce([{ id: 'u-2', full_name: 'Sara Bekele' }]) // employee 2 found
        .mockResolvedValueOnce([]); // insert for employee 2

      const result = await service.bulkGenerateLetters('tenant-1', 'OFFER_LETTER', ['u-missing', 'u-2']);

      expect(result.generated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('u-missing');
    });

    it('should throw NotFoundException when template does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // template not found

      await expect(
        service.bulkGenerateLetters('tenant-1', 'NONEXISTENT', ['u-1']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── B7: Document Vault & Letter Templates Extensions ───────────────────────

  describe('Document Vault & Letter Templates Extensions', () => {
    it('getDocumentVersions returns empty array when no versions exist', async () => {
      mockConnection.query.mockResolvedValue([]);
      const result = await service.getDocumentVersions('tenant-1', 'doc-none');
      expect(result).toEqual([]);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version_number DESC'),
        ['doc-none'],
      );
    });

    it('addDocumentVersion calls query with correct params', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'doc-1' }]) // getDocumentById
        .mockResolvedValueOnce([{ next_version: 1 }]) // version query
        .mockResolvedValueOnce([]); // insert query

      await service.addDocumentVersion('tenant-1', 'doc-1', {
        file_url: 'https://cdn.example.com/contract_v1.pdf',
        file_name: 'contract_v1.pdf',
        file_size: 2048,
        uploaded_by: 'user-123',
        change_notes: 'Initial signed copy',
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO document_versions'),
        [
          'doc-1',
          1,
          'https://cdn.example.com/contract_v1.pdf',
          'contract_v1.pdf',
          2048,
          'user-123',
          null,
          'Initial signed copy',
        ],
      );
    });

    it('getLetterAuditLog returns empty array for new tenant', async () => {
      mockConnection.query.mockResolvedValue([]);
      const result = await service.getLetterAuditLog('tenant-1');
      expect(result).toEqual([]);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM letter_audit_log la'),
        [],
      );
    });

    it('getMissingDocumentAlerts returns employees without contracts', async () => {
      const mockAlerts = [
        {
          id: 'user-missing-contract',
          first_name: 'Kebede',
          last_name: 'Tadesse',
          department: 'Operations',
          has_contract: 0,
          has_id: 1,
        },
      ];
      mockConnection.query.mockResolvedValue(mockAlerts);
      const result = await service.getMissingDocumentAlerts('tenant-1');
      expect(result).toEqual(mockAlerts);
      expect(result[0].has_contract).toBe(0);
    });
  });

  describe('Digital Signature & E-Sign Config', () => {
    it('getUserSignature returns null when user has no signature', async () => {
      (service as any).ensuredTenants.add('t1');
      mockConnection.query.mockResolvedValue([]);
      const result = await service.getUserSignature('t1', 'user-1');
      expect(result.signature_url).toBeNull();
    });

    it('getUserSignature returns signature_url when present', async () => {
      (service as any).ensuredTenants.add('t1');
      mockConnection.query.mockResolvedValue([{ signature_url: 'data:image/png;base64,123' }]);
      const result = await service.getUserSignature('t1', 'user-1');
      expect(result.signature_url).toBe('data:image/png;base64,123');
    });

    it('upsertUserSignature calls execute with user_id and url', async () => {
      (service as any).ensuredTenants.add('t1');
      mockConnection.query.mockResolvedValue([]);
      await expect(service.upsertUserSignature('t1', 'user-1', 'data:image/png;base64,abc')).resolves.not.toThrow();
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_signatures'),
        ['user-1', 'data:image/png;base64,abc'],
      );
    });

    it('deleteUserSignature deletes signature row', async () => {
      (service as any).ensuredTenants.add('t1');
      mockConnection.query.mockResolvedValue([]);
      await expect(service.deleteUserSignature('t1', 'user-1')).resolves.not.toThrow();
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_signatures'),
        ['user-1'],
      );
    });

    it('getEsignProviderConfig returns default provider none', async () => {
      (service as any).ensuredTenants.add('t1');
      mockConnection.query.mockResolvedValue([]);
      const config = await service.getEsignProviderConfig('t1');
      expect(config).toHaveProperty('provider');
      expect(config.provider).toBe('none');
    });

    it('updateEsignProviderConfig saves provider credentials', async () => {
      (service as any).ensuredTenants.add('t1');
      mockConnection.query.mockResolvedValue([]);
      await expect(
        service.updateEsignProviderConfig('t1', {
          provider: 'docusign',
          client_id: 'cid-123',
          client_secret: 'sec-456',
          account_id: 'acc-789',
        }),
      ).resolves.not.toThrow();
    });
  });
});


