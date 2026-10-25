import { BadRequestException } from '@nestjs/common';
import { AiDocumentService } from './ai-document.service';
import { DatabaseService } from '../../database/database.service';
import { AiSettingsFetchService } from './ai-settings-fetch.service';

describe('AiDocumentService', () => {
  let service: AiDocumentService;
  let mockDatabaseService: Partial<DatabaseService>;
  let mockAiSettingsFetch: Partial<AiSettingsFetchService>;

  beforeEach(() => {
    mockDatabaseService = {
      getTenantConnection: jest.fn(),
      masterDataSource: {
        query: jest.fn(),
      } as any,
    };

    mockAiSettingsFetch = {
      getSettings: jest.fn().mockResolvedValue(null),
    };

    service = new AiDocumentService(
      mockDatabaseService as DatabaseService,
      mockAiSettingsFetch as AiSettingsFetchService,
    );
  });

  describe('getBuiltinTemplates', () => {
    it('should return all 6 enterprise templates', () => {
      const templates = service.getBuiltinTemplates();
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBe(6);

      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('employment_verification');
      expect(templateIds).toContain('salary_certificate');
      expect(templateIds).toContain('performance_evaluation');
      expect(templateIds).toContain('attendance_monthly_report');
      expect(templateIds).toContain('project_status_report');
      expect(templateIds).toContain('hr_analytics_executive_brief');
    });

    it('each template should have required properties and supportedFormats', () => {
      const templates = service.getBuiltinTemplates();
      for (const t of templates) {
        expect(t.id).toBeDefined();
        expect(t.name).toBeDefined();
        expect(t.description).toBeDefined();
        expect(t.category).toBeDefined();
        expect(t.supportedFormats.length).toBeGreaterThan(0);
        expect(t.defaultPrompt).toBeDefined();
        expect(Array.isArray(t.parameters)).toBe(true);
      }
    });
  });

  describe('generateFromTemplate', () => {
    it('should throw BadRequestException if template ID is unknown', async () => {
      await expect(
        service.generateFromTemplate(
          'tenant-1',
          'admin',
          'non_existent_template',
          'pdf',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if format is unsupported for the template', async () => {
      // employment_verification only supports pdf and docx, not excel
      await expect(
        service.generateFromTemplate(
          'tenant-1',
          'admin',
          'employment_verification',
          'excel',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should invoke generatePdf when format is pdf for supported template', async () => {
      const mockResult = {
        buffer: Buffer.from('mock pdf content'),
        filename: 'employment_verification.pdf',
      };
      jest.spyOn<any, any>(service, 'generatePdf').mockResolvedValue(mockResult);

      const result = await service.generateFromTemplate(
        'tenant-1',
        'admin',
        'employment_verification',
        'pdf',
        { employee_identifier: 'John Doe' },
        'Urgent request',
      );

      expect(result).toEqual(mockResult);
      expect((service as any).generatePdf).toHaveBeenCalledWith(
        'tenant-1',
        'admin',
        expect.stringContaining('John Doe'),
      );
    });

    it('should invoke generateExcel when format is excel for attendance template', async () => {
      const mockResult = {
        buffer: Buffer.from('mock excel content'),
        filename: 'attendance_monthly_report.xlsx',
      };
      jest.spyOn<any, any>(service, 'generateExcel').mockResolvedValue(mockResult);

      const result = await service.generateFromTemplate(
        'tenant-1',
        'admin',
        'attendance_monthly_report',
        'excel',
        { month: 10, year: 2026 },
      );

      expect(result).toEqual(mockResult);
      expect((service as any).generateExcel).toHaveBeenCalledWith(
        'tenant-1',
        'admin',
        expect.stringContaining('2026'),
      );
    });
  });
});
