import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ResolvedAiSettings {
  provider: string;
  api_key?: string;
  model?: string;
  endpoint_url?: string;
  gcp_project_id?: string;
  gcp_location?: string;
  is_enabled: boolean;
  temperature?: number;
  max_tokens?: number;
}

const GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AiSettingsFetchService {
  private cache = new Map<string, { data: ResolvedAiSettings; expiresAt: number }>();

  constructor(private configService: ConfigService) {}

  /**
   * Fetches decrypted AI settings from the admin backend for a given tenant.
   * Falls back to global settings if tenant-specific settings are not configured.
   * Results are cached for 5 minutes to avoid hammering the admin backend.
   */
  async getSettings(tenantId: string): Promise<ResolvedAiSettings> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const adminUrl = this.configService.get<string>('ADMIN_BACKEND_URL');
    if (!adminUrl) {
      return { provider: 'gemini', is_enabled: false };
    }

    // Try tenant-specific settings first, then fall back to global
    const tenantIds = [tenantId, GLOBAL_TENANT_ID];

    for (const id of tenantIds) {
      try {
        const res = await axios.get<ResolvedAiSettings>(
          `${adminUrl}/admin/ai-settings/internal/${id}/decrypted`,
          {
            timeout: 5000,
            headers: { 'x-internal-service': 'tenant-backend' },
          },
        );

        const settings = res.data;

        if (settings && settings.is_enabled && settings.api_key) {
          this.cache.set(tenantId, { data: settings, expiresAt: Date.now() + CACHE_TTL_MS });
          return settings;
        }
      } catch {
        // Not found or error — try next
        continue;
      }
    }

    // Nothing found, return disabled
    return { provider: 'gemini', is_enabled: false };
  }

  /**
   * Clears cache for a specific tenant (call when settings are updated).
   */
  clearCache(tenantId: string) {
    this.cache.delete(tenantId);
    this.cache.delete(GLOBAL_TENANT_ID);
  }
}
