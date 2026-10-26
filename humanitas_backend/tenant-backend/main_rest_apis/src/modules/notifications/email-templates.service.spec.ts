import { Test } from '@nestjs/testing';
import { EmailTemplatesService } from './email-templates.service';
import { DatabaseService } from '../database/database.service';

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;

  const mockQuery = jest.fn();
  const mockConn = { query: mockQuery };
  const mockDbService = {
    getTenantConnectionById: jest.fn().mockResolvedValue(mockConn),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Suppress CREATE TABLE and INSERT into system defaults on first init
    mockQuery.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        EmailTemplatesService,
        { provide: DatabaseService, useValue: mockDbService },
      ],
    }).compile();
    service = module.get(EmailTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null when no template exists in DB', async () => {
    // Force ensureTables to be skipped (already ensured)
    (service as any).ensuredTenants.add('tenant-1');
    mockQuery.mockResolvedValue([]); // no custom, no system default

    const result = await service.getTemplate('tenant-1', 'leave-approved');
    expect(result).toBeNull();
  });

  it('should return system default when no custom template exists', async () => {
    (service as any).ensuredTenants.add('tenant-1');
    mockQuery
      .mockResolvedValueOnce([]) // no custom template
      .mockResolvedValueOnce([{ subject: 'Default Subject', html_body: '<p>Default</p>', plain_text_body: null }]); // system default

    const result = await service.getTemplate('tenant-1', 'leave-approved');
    expect(result).not.toBeNull();
    expect(result!.subject).toBe('Default Subject');
  });

  it('should return tenant custom template when one is set', async () => {
    (service as any).ensuredTenants.add('tenant-1');
    mockQuery.mockResolvedValueOnce([{ subject: 'Custom Subject', html_body: '<p>Custom</p>', plain_text_body: null }]);

    const result = await service.getTemplate('tenant-1', 'leave-approved');
    expect(result!.subject).toBe('Custom Subject');
  });

  it('should insert when upserting non-existent custom template', async () => {
    (service as any).ensuredTenants.add('tenant-1');
    mockQuery
      .mockResolvedValueOnce([]) // no existing custom
      .mockResolvedValueOnce([]); // insert

    await expect(
      service.upsertTemplate('tenant-1', 'leave-approved', { subject: 'New', html_body: '<p>New</p>' }, 'user-1'),
    ).resolves.not.toThrow();
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('should reset to default by deactivating custom template', async () => {
    (service as any).ensuredTenants.add('tenant-1');
    mockQuery.mockResolvedValue([]);

    await expect(service.resetToDefault('tenant-1', 'leave-approved')).resolves.not.toThrow();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_active = FALSE'),
      ['leave-approved'],
    );
  });

  it('previewTemplate returns HTML string with default sample data', async () => {
    (service as any).ensuredTenants.add('tenant-1');
    mockQuery
      .mockResolvedValueOnce([]) // no custom
      .mockResolvedValueOnce([{
        subject: 'Subject',
        html_body: '<p>Hi {{employeeName}}</p>',
        plain_text_body: null,
      }]);

    const html = await service.previewTemplate('tenant-1', 'leave-approved');
    expect(html).toContain('John Smith');
  });
});
