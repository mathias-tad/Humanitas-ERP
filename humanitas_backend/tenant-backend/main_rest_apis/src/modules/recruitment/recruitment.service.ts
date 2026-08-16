import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);
  private readonly krinaiApiUrl = 'https://krinaiapi.ziontech.tech/api/v1';

  constructor(
    private readonly httpService: HttpService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns null when the API key is not configured, instead of throwing.
   * This allows getJobs/getApplications to return empty lists gracefully.
   */
  private async tryGetApiKey(tenantSlug: string): Promise<string | null> {
    try {
      const settings = await this.settingsService.getIntegrationsSettings(tenantSlug);
      return settings?.krinai_api_key ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Used by registerWebhook where a key is strictly required.
   */
  async getApiKey(tenantSlug: string): Promise<string> {
    const key = await this.tryGetApiKey(tenantSlug);
    if (!key) {
      throw new BadRequestException('Krinai API key not configured for this tenant.');
    }
    return key;
  }

  async getJobs(tenantSlug: string) {
    const apiKey = await this.tryGetApiKey(tenantSlug);

    // Not configured yet — return empty list so the page loads cleanly
    if (!apiKey) {
      this.logger.warn(`[${tenantSlug}] Krinai API key not configured — returning empty jobs list.`);
      return { jobs: [], total: 0, configured: false };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      // Krinai now returns cursor-paginated shape: { items: [], next_cursor, total }
      // Normalise to always give the frontend a plain { items: [], total: n } shape.
      const data = response.data;
      const items = Array.isArray(data) ? data : (data?.items ?? data?.jobs ?? []);
      return { items, total: data?.total ?? items.length };
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to fetch jobs from Krinai: ${error.message}`);
      return { items: [], total: 0, error: 'Failed to reach Krinai API' };
    }
  }

  async getApplications(tenantSlug: string, jobId?: string) {
    const apiKey = await this.tryGetApiKey(tenantSlug);

    // Not configured yet — return empty list so the page loads cleanly
    if (!apiKey) {
      this.logger.warn(`[${tenantSlug}] Krinai API key not configured — returning empty applications list.`);
      return { applications: [], total: 0, configured: false };
    }

    try {
      if (jobId) {
        const response = await firstValueFrom(
          this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}/applications`, {
            headers: { 'x-api-key': apiKey },
          })
        );
        // Normalise: Krinai returns { items: [], next_cursor, total }
        const data = response.data;
        const items = Array.isArray(data) ? data : (data?.items ?? data?.applications ?? []);
        return { items, total: data?.total ?? items.length };
      } else {
        // Fetch all jobs first
        const jobsResponse = await firstValueFrom(
          this.httpService.get(`${this.krinaiApiUrl}/jobs`, {
            headers: { 'x-api-key': apiKey },
          })
        );
        
        const jobs = jobsResponse.data.items || jobsResponse.data || [];
        const jobsList = Array.isArray(jobs) ? jobs : [];
        const allApplications: any[] = [];
        
        // Fetch applications for each job
        const appsPromises = jobsList.map((job: any) =>
          firstValueFrom(
            this.httpService.get(`${this.krinaiApiUrl}/jobs/${job.id}/applications`, {
              headers: { 'x-api-key': apiKey },
            })
          ).catch(e => {
            this.logger.error(`[${tenantSlug}] Failed to fetch applications for job ${job.id}: ${e.message}`);
            return { data: [] };
          })
        );
        
        const appsResults = await Promise.all(appsPromises);
        for (const res of appsResults) {
          if (res.data && Array.isArray(res.data)) {
            allApplications.push(...res.data);
          } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
             allApplications.push(...res.data.items);
          }
        }
        
        return { items: allApplications, total: allApplications.length };
      }
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to fetch applications from Krinai: ${error.message}`);
      return { applications: [], total: 0, error: 'Failed to reach Krinai API' };
    }
  }

  async getJob(tenantSlug: string, jobId: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to fetch job from Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Job not found.');
    }
  }

  async getLeaderboard(tenantSlug: string, jobId: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}/leaderboard`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to fetch leaderboard from Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to fetch leaderboard.');
    }
  }

  async rerankCandidates(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/rerank`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to rerank: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to rerank.');
    }
  }

  async bulkShortlist(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/bulk-shortlist`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to bulk shortlist: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to bulk shortlist.');
    }
  }

  async startExport(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/exports/`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to start export: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to start export.');
    }
  }

  async checkExportStatus(tenantSlug: string, jobId: string, exportId: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}/exports/${exportId}`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to check export status: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to check export status.');
    }
  }

  async estimateExport(tenantSlug: string, jobId: string, scopeType: string, statusFilter?: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      let query = `?scope_type=${scopeType}`;
      if (statusFilter) query += `&status_filter=${statusFilter}`;
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}/exports/estimate${query}`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to estimate export: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to estimate export.');
    }
  }

  async getForm(tenantSlug: string, jobId: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}/form`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to fetch form from Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to fetch form.');
    }
  }

  async updateForm(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.put(`${this.krinaiApiUrl}/jobs/${jobId}/form`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to update form in Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to update form.');
    }
  }

  // --- Application Links ---

  async createApplicationLink(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/links`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to create application link: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to create application link.');
    }
  }

  async getJobLinks(tenantSlug: string, jobId: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/jobs/${jobId}/links`, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to fetch application links: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to fetch application links.');
    }
  }

  async expireJobLinks(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/expire`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to expire links: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to expire links.');
    }
  }

  async reopenJobLinks(tenantSlug: string, jobId: string, data: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/reopen`, data, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to reopen links: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to reopen links.');
    }
  }

  // --- Public Application Methods ---

  async getPublicFormByToken(token: string) {
    try {
      // Note: No x-api-key needed if the endpoint in Krinai is public, 
      // but if Krinai's /apply/:token/form is open, we can just proxy it.
      // Wait, Krinai's `apply/{token}/form` doesn't require auth.
      const response = await firstValueFrom(
        this.httpService.get(`${this.krinaiApiUrl}/apply/${token}/form`)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch public form for token ${token}: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to fetch form.');
    }
  }

  async submitApplicationByToken(token: string, payload: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/apply/${token}/submit`, payload)
      );
      return response.data;
    } catch (error) {
      const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
      this.logger.error(`Failed to submit application for token ${token}: ${error.message} | Krinai detail: ${JSON.stringify(detail)}`);
      throw new BadRequestException(detail || 'Failed to submit application.');
    }
  }

  async uploadPublicFile(token: string, formData: FormData) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/files/upload`, formData)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to upload file for token ${token}: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || 'Failed to upload file.');
    }
  }

  async createJob(tenantSlug: string, jobData: any) {

    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/jobs`, jobData, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to create job in Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || error.response?.data?.message || 'Failed to create job in Krinai API.');
    }
  }

  async createApplication(tenantSlug: string, formData: FormData) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
        // We need jobId to create an application in Krinai
        const jobId = formData.get('job_id') || formData.get('jobId');
        if (!jobId) {
            throw new BadRequestException("job_id is required to create an application");
        }
        
        const response = await firstValueFrom(
          this.httpService.post(`${this.krinaiApiUrl}/jobs/${jobId}/applications`, formData, {
            headers: { 
              'x-api-key': apiKey
            },
          })
        );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to create application in Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || error.response?.data?.message || 'Failed to create application in Krinai API.');
    }
  }
  async updateJob(tenantSlug: string, jobId: string, jobData: any) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.patch(`${this.krinaiApiUrl}/jobs/${jobId}`, jobData, {
          headers: { 'x-api-key': apiKey },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to update job in Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || error.response?.data?.message || 'Failed to update job in Krinai API.');
    }
  }

  async updateApplicationStatus(tenantSlug: string, jobId: string, appId: string, status: string) {
    const apiKey = await this.getApiKey(tenantSlug);
    try {
      const response = await firstValueFrom(
        this.httpService.patch(
          `${this.krinaiApiUrl}/jobs/${jobId}/applications/${appId}/status`,
          { status },
          { headers: { 'x-api-key': apiKey } }
        )
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to update application status in Krinai: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || error.response?.data?.message || 'Failed to update application status in Krinai API.');
    }
  }
  async registerWebhook(tenantSlug: string, apiKey: string) {
    // Build the callback URL from the env variable instead of the hardcoded placeholder
    const tenantApiUrl = this.configService.get<string>('TENANT_API_URL') || 'http://localhost:3001/api/v1';
    // Strip trailing /api/v1 if present so we can build our own path
    const cleanBase = tenantApiUrl.replace(/\/api\/v1\/?$/, '');
    const webhookUrl = `${cleanBase}/api/v1/recruitment/webhook/${tenantSlug}`;

    this.logger.log(`[${tenantSlug}] Registering webhook → ${webhookUrl}`);

    try {
      const payload = {
        url: webhookUrl,
        events: ['application.scored', 'application.submitted'],
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.krinaiApiUrl}/webhooks`, payload, {
          headers: { 'x-api-key': apiKey },
        })
      );

      this.logger.log(`[${tenantSlug}] ✅ Webhook registered successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`[${tenantSlug}] Failed to register webhook: ${error.message}`);
      throw new BadRequestException(error.response?.data?.detail || error.response?.data?.message || 'Failed to register webhook with Krinai');
    }
  }
}
