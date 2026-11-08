import { Test, TestingModule } from '@nestjs/testing';
import { TenantAiKnowledgeService } from './tenant-ai-knowledge.service';
import { DatabaseService } from '../../database/database.service';
import { AiFileParserService } from './ai-file-parser.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TenantAiKnowledgeService', () => {
  let service: TenantAiKnowledgeService;
  let mockDatabaseService: any;
  let mockFileParserService: any;
  let mockTenantConnection: any;

  beforeEach(async () => {
    mockTenantConnection = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      masterDataSource: {
        query: jest.fn().mockResolvedValue([{ id: 'tenant-123', database_name: 'tenant_db_1' }]),
      },
      getTenantConnection: jest.fn().mockResolvedValue(mockTenantConnection),
    };

    mockFileParserService = {
      extractText: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantAiKnowledgeService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: AiFileParserService, useValue: mockFileParserService },
      ],
    }).compile();

    service = module.get<TenantAiKnowledgeService>(TenantAiKnowledgeService);
  });

  describe('chunkText', () => {
    it('should return empty array for empty or whitespace text', () => {
      expect(service.chunkText('')).toEqual([]);
      expect(service.chunkText('   ')).toEqual([]);
    });

    it('should identify section headers and create titled chunks', () => {
      const text = `
SECTION 1: PROBATION PERIOD
All employees serve a 60-day probation period. During this period either party can terminate with 7 days notice.

SECTION 2: WORKING HOURS
Business hours are 8:30 AM to 5:30 PM Monday to Friday. Overtime must be pre-approved.
      `;

      const chunks = service.chunkText(text);
      expect(chunks.length).toBe(2);
      expect(chunks[0].section_title).toBe('SECTION 1: PROBATION PERIOD');
      expect(chunks[0].chunk_text).toContain('All employees serve a 60-day probation period');
      expect(chunks[1].section_title).toBe('SECTION 2: WORKING HOURS');
      expect(chunks[1].chunk_text).toContain('Business hours are 8:30 AM to 5:30 PM');
    });

    it('should break oversized sections into multiple numbered chunks', () => {
      const longSentence = 'This is a long sentence explaining corporate policy and operational guidelines. ';
      const longSection = `ARTICLE 5: CODE OF CONDUCT\n` + longSentence.repeat(60);

      const chunks = service.chunkText(longSection);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].section_title).toContain('ARTICLE 5: CODE OF CONDUCT');
    });
  });

  describe('createDocument', () => {
    it('should throw BadRequestException if neither raw_text nor file provided', async () => {
      await expect(
        service.createDocument('test-slug', 'user-1', { title: 'Test Policy' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should parse uploaded file when file is provided', async () => {
      mockFileParserService.extractText.mockResolvedValue({
        text: 'SECTION 1: SCOPE\nThis document applies to all staff members.',
        isImage: false,
      });

      mockTenantConnection.query
        .mockResolvedValueOnce([{ id: 'doc-1', title: 'File Policy' }]) // insert doc
        .mockResolvedValueOnce([]); // insert chunk

      const result = await service.createDocument(
        'test-slug',
        'user-1',
        { title: 'File Policy', category: 'company_policy' },
        { buffer: Buffer.from('fake'), mimetype: 'application/pdf', originalname: 'policy.pdf', size: 1024 },
      );

      expect(mockFileParserService.extractText).toHaveBeenCalled();
      expect(result.id).toBe('doc-1');
      expect(result.chunk_count).toBe(1);
    });

    it('should insert document and chunks from direct text input', async () => {
      mockTenantConnection.query
        .mockResolvedValueOnce([{ id: 'doc-2', title: 'Written Policy' }])
        .mockResolvedValueOnce([]);

      const result = await service.createDocument('test-slug', 'user-1', {
        title: 'Written Policy',
        raw_text: 'SECTION 1: ATTENDANCE\nPunctuality is mandatory for all personnel.',
      });

      expect(result.id).toBe('doc-2');
      expect(result.chunk_count).toBe(1);
    });
  });

  describe('getDocuments', () => {
    it('should query documents with chunk count and category filter', async () => {
      mockTenantConnection.query.mockResolvedValue([
        { id: 'doc-1', title: 'Policy A', category: 'code_of_conduct', chunk_count: 3 },
      ]);

      const docs = await service.getDocuments('test-slug', 'Policy', 'code_of_conduct');
      expect(docs.length).toBe(1);
      expect(docs[0].title).toBe('Policy A');
      expect(mockTenantConnection.query).toHaveBeenCalled();
    });
  });

  describe('searchKnowledge', () => {
    it('should return empty array for empty query', async () => {
      const results = await service.searchKnowledge('test-slug', '');
      expect(results).toEqual([]);
    });

    it('should rank matching chunks with highest relevance score on top', async () => {
      mockTenantConnection.query.mockResolvedValue([
        {
          chunk_id: 'c-1',
          document_id: 'd-1',
          document_title: 'Staff Handbook',
          category: 'company_policy',
          section_title: 'Notice Period & Resignation',
          chunk_text: 'Employees must provide thirty (30) days notice period prior to resignation.',
          page_number: 1,
        },
        {
          chunk_id: 'c-2',
          document_id: 'd-1',
          document_title: 'Staff Handbook',
          category: 'company_policy',
          section_title: 'Parking Rules',
          chunk_text: 'Staff parking is free in zone B.',
          page_number: 2,
        },
      ]);

      const results = await service.searchKnowledge('test-slug', 'notice period resignation');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].section_title).toBe('Notice Period & Resignation');
      expect(results[0].relevance_score).toBeGreaterThan(results[1].relevance_score);
    });
  });

  describe('deleteDocument', () => {
    it('should throw NotFoundException if document does not exist', async () => {
      mockTenantConnection.query.mockResolvedValue([]);
      await expect(service.deleteDocument('test-slug', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should delete document and return success', async () => {
      mockTenantConnection.query.mockResolvedValue([{ id: 'good-id' }]);
      const res = await service.deleteDocument('test-slug', 'good-id');
      expect(res.success).toBe(true);
    });
  });
});
