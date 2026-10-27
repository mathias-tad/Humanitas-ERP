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
    it('should return all 14 enterprise templates', () => {
      const templates = service.getBuiltinTemplates();
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBe(14);

      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('employment_verification');
      expect(templateIds).toContain('salary_certificate');
      expect(templateIds).toContain('performance_evaluation');
      expect(templateIds).toContain('attendance_monthly_report');
      expect(templateIds).toContain('project_status_report');
      expect(templateIds).toContain('hr_analytics_executive_brief');
      expect(templateIds).toContain('individual_payslip');
      expect(templateIds).toContain('payroll_summary_report');
      expect(templateIds).toContain('sales_invoice_quotation');
      expect(templateIds).toContain('purchase_order_delivery');
      expect(templateIds).toContain('inventory_stock_valuation');
      expect(templateIds).toContain('financial_statements');
      expect(templateIds).toContain('employee_contract_offer');
      expect(templateIds).toContain('leave_attendance_report');
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
      jest.spyOn<any, any>(service, 'logDocumentGeneration').mockResolvedValue(undefined);

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
        undefined,
        undefined,
      );
    });

    it('should invoke generateExcel when format is excel for attendance template', async () => {
      const mockResult = {
        buffer: Buffer.from('mock excel content'),
        filename: 'attendance_monthly_report.xlsx',
      };
      jest.spyOn<any, any>(service, 'generateExcel').mockResolvedValue(mockResult);
      jest.spyOn<any, any>(service, 'logDocumentGeneration').mockResolvedValue(undefined);

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
        undefined,
      );
    });
  });

  describe('logDocumentGeneration', () => {
    it('should query tenant database and insert audit log with executed_by ai_on_behalf', async () => {
      const mockTenantConn = {
        query: jest.fn().mockResolvedValue([]),
      };
      (mockDatabaseService.masterDataSource!.query as jest.Mock).mockResolvedValue([{ database_name: 'tenant_db_1' }]);
      (mockDatabaseService.getTenantConnection as jest.Mock).mockResolvedValue(mockTenantConn);

      await service.logDocumentGeneration(
        'tenant-1',
        'user-uuid-123',
        'individual_payslip',
        'pdf',
        'payslip_oct_2026.pdf',
        { employee_id: 'emp-1' },
      );

      expect(mockDatabaseService.getTenantConnection).toHaveBeenCalledWith('tenant_db_1');
      expect(mockTenantConn.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS ai_document_audit_logs'));
      expect(mockTenantConn.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_document_audit_logs'),
        ['tenant-1', 'user-uuid-123', 'individual_payslip', 'pdf', 'payslip_oct_2026.pdf', JSON.stringify({ employee_id: 'emp-1' })],
      );
    });
  });
});
