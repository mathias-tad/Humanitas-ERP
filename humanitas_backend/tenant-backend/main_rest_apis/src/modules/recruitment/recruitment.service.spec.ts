import { RecruitmentService } from './recruitment.service';
import { of } from 'rxjs';
import { BadRequestException } from '@nestjs/common';

describe('RecruitmentService Unit Tests', () => {
  let service: RecruitmentService;
  let mockHttpService: any;
  let mockSettingsService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    mockSettingsService = {
      getIntegrationsSettings: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn(),
    };
    service = new RecruitmentService(mockHttpService, mockSettingsService, mockConfigService);
  });

  describe('getJobs', () => {
    it('returns empty list gracefully when API key is not configured', async () => {
      mockSettingsService.getIntegrationsSettings.mockResolvedValueOnce({});
      const result = await service.getJobs('tenant-abc');

      expect(result).toEqual({ jobs: [], total: 0, configured: false });
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('fetches and normalizes jobs from Krinai API when configured', async () => {
      mockSettingsService.getIntegrationsSettings.mockResolvedValueOnce({
        krinai_api_key: 'test-api-key-123',
      });

      const mockJobsData = {
        items: [
          { id: 'job-1', title: 'Senior Full Stack Engineer', department: 'Engineering' },
          { id: 'job-2', title: 'HR Manager', department: 'Operations' },
        ],
        total: 2,
      };

      mockHttpService.get.mockReturnValueOnce(of({ data: mockJobsData }));

      const result = await service.getJobs('tenant-abc');
      expect(result).toHaveProperty('items');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Senior Full Stack Engineer');
    });
  });

  describe('getApiKey', () => {
    it('throws BadRequestException when API key is missing', async () => {
      mockSettingsService.getIntegrationsSettings.mockResolvedValueOnce(null);
      await expect(service.getApiKey('tenant-abc')).rejects.toThrow(BadRequestException);
    });

    it('returns API key string when correctly configured', async () => {
      mockSettingsService.getIntegrationsSettings.mockResolvedValueOnce({
        krinai_api_key: 'secret-key',
      });
      const key = await service.getApiKey('tenant-abc');
      expect(key).toBe('secret-key');
    });
  });

  describe('getApplications', () => {
    it('returns empty list gracefully when API key is not configured', async () => {
      mockSettingsService.getIntegrationsSettings.mockResolvedValueOnce({});
      const result = await service.getApplications('tenant-abc');
      expect(result).toEqual({ applications: [], total: 0, configured: false });
    });

    it('normalizes applications and extracts items array', async () => {
      mockSettingsService.getIntegrationsSettings.mockResolvedValueOnce({
        krinai_api_key: 'test-key',
      });
      mockHttpService.get.mockReturnValueOnce(of({
        data: {
          items: [
            { id: 'app-1', candidate_name: 'Alice Smith', ai_score: 92, status: 'interview' }
          ],
          total: 1
        }
      }));

      const result = await service.getApplications('tenant-abc', 'job-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].candidate_name).toBe('Alice Smith');
      expect(result.items[0].ai_score).toBe(92);
    });
  });
});
