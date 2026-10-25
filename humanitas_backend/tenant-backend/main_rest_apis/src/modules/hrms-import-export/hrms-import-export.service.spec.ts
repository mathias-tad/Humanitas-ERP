import { Test, TestingModule } from '@nestjs/testing';
import { HrmsImportExportService } from './hrms-import-export.service';
import { DatabaseService } from '../database/database.service';
import { EntityType, FileFormat, JobStatus, ImportMode } from './dto/hrms-import-export.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('HrmsImportExportService', () => {
  let service: HrmsImportExportService;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    const mockDbService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrmsImportExportService,
        { provide: DatabaseService, useValue: mockDbService },
      ],
    }).compile();

    service = module.get<HrmsImportExportService>(HrmsImportExportService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTemplateSchema', () => {
    it('should return schema with headers, required fields, and examples for employees', () => {
      const schema = service.getTemplateSchema(EntityType.EMPLOYEES);
      expect(schema.entity).toBe('employees');
      expect(schema.headers).toContain('first_name');
      expect(schema.headers).toContain('email');
      expect(schema.required).toContain('email');
      expect(schema.example.email).toBeDefined();
    });

    it('should return schema for assets', () => {
      const schema = service.getTemplateSchema(EntityType.ASSETS);
      expect(schema.entity).toBe('assets');
      expect(schema.headers).toContain('asset_tag');
      expect(schema.required).toContain('asset_tag');
    });
  });

  describe('validateImport', () => {
    it('should identify missing required fields and invalid email format', async () => {
      mockConnection.query.mockResolvedValue([]);

      const result = await service.validateImport(
        'tenant-1',
        {
          entity_type: EntityType.EMPLOYEES,
          rows: [
            { first_name: 'John', last_name: 'Doe', email: 'valid.doe@example.com' },
            { first_name: '', last_name: 'Smith', email: 'invalid-email-string' },
          ],
        },
        'user-1'
      );

      expect(result.total_rows).toBe(2);
      expect(result.valid_rows_count).toBe(1);
      expect(result.error_rows_count).toBe(1);
      expect(result.is_valid).toBe(false);
      expect(result.validation_errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should flag duplicate keys within the import payload', async () => {
      mockConnection.query.mockResolvedValue([]);

      const result = await service.validateImport(
        'tenant-1',
        {
          entity_type: EntityType.EMPLOYEES,
          rows: [
            { first_name: 'Alice', last_name: 'Wong', email: 'alice@example.com' },
            { first_name: 'Alice', last_name: 'Duplicate', email: 'alice@example.com' },
          ],
        },
        'user-1'
      );

      expect(result.error_rows_count).toBe(1);
      expect(result.validation_errors.some((e) => e.error.includes('Duplicate'))).toBe(true);
    });
  });

  describe('commitImport and rollback', () => {
    it('should commit validated rows and enable 24h rollback window', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'job-1', status: 'validated' }]) // existing check
        .mockResolvedValueOnce([]) // asset insert
        .mockResolvedValueOnce([]); // job update

      const result = await service.commitImport(
        'tenant-1',
        {
          job_id: 'job-1',
          entity_type: EntityType.ASSETS,
          validated_rows: [{ name: 'Monitor 4K', asset_tag: 'AST-0099', purchase_cost: 450 }],
        },
        'user-1'
      );

      expect(result.status).toBe(JobStatus.COMPLETED);
      expect(result.processed_rows).toBe(1);
      expect(result.can_rollback).toBe(true);
      expect(result.rollback_window_hours).toBe(24);
    });

    it('should rollback completed import within valid window', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000 * 10);
      mockConnection.query
        .mockResolvedValueOnce([
          {
            id: 'job-1',
            status: JobStatus.COMPLETED,
            can_rollback: true,
            rollback_window_expires_at: futureDate,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.rollbackImport('tenant-1', 'job-1', 'user-1');
      expect(result.status).toBe(JobStatus.ROLLED_BACK);
      expect(result.message).toContain('rolled back');
    });

    it('should throw BadRequestException if rollback window expired', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'job-1',
          status: JobStatus.COMPLETED,
          can_rollback: true,
          rollback_window_expires_at: pastDate,
        },
      ]);

      await expect(service.rollbackImport('tenant-1', 'job-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('triggerExport and stats', () => {
    it('should generate CSV export data and record completed job', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          { email: 'emp1@test.com', role: 'admin', status: 'active' },
          { email: 'emp2@test.com', role: 'employee', status: 'active' },
        ])
        .mockResolvedValueOnce([]); // insert job

      const result = await service.triggerExport(
        'tenant-1',
        {
          entity_type: EntityType.EMPLOYEES,
          format: FileFormat.CSV,
        },
        'user-1'
      );

      expect(result.total_rows).toBe(2);
      expect(result.format).toBe(FileFormat.CSV);
      expect(result.data).toContain('email,role,status');
      expect(result.data).toContain('"emp1@test.com"');
    });

    it('should return aggregated import/export metrics', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            total_jobs: 10,
            total_imports: 6,
            total_exports: 4,
            completed_jobs: 9,
            total_rows_processed: 1200,
          },
        ])
        .mockResolvedValueOnce([{ active_schedules: 3 }]);

      const stats = await service.getImportExportStats('tenant-1');
      expect(stats.total_imports).toBe(6);
      expect(stats.total_exports).toBe(4);
      expect(stats.success_rate_pct).toBe(90);
      expect(stats.active_schedules).toBe(3);
    });
  });
});
