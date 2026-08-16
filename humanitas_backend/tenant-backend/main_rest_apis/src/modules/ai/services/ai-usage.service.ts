import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export interface UsageLogPayload {
  tenant_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  provider: string;
  model: string;
  feature: string; // 'chat' | 'data_query' | 'document' | 'attrition' | 'onboarding' | etc.
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  duration_ms: number;
  status: 'success' | 'error' | 'refused';
  error_message?: string;
}

@Injectable()
export class AiUsageService {
  constructor(private configService: ConfigService) {}

  /**
   * Logs an AI call to the admin-backend usage ledger.
   * This is a fire-and-forget operation - it never blocks the main AI response.
   */
  async logUsage(payload: UsageLogPayload): Promise<void> {
    const adminUrl = this.configService.get<string>('ADMIN_BACKEND_URL');
    if (!adminUrl) return;

    try {
      // Fire-and-forget — do not await to avoid slowing down AI responses
      axios.post(`${adminUrl}/ai/usage`, payload, {
        timeout: 5000,
        headers: { 'x-internal-service': 'tenant-backend' },
      }).catch((err) => {
        console.error('Failed to log AI usage to admin-backend:', err.message, err.response?.data);
      });
    } catch (err) {
      console.error('Failed to initiate AI usage logging:', err.message);
    }
  }

  /**
   * Checks if a tenant has remaining AI token budget.
   * Returns false if the tenant has exceeded their package limit.
   */
  async checkTokenBudget(tenantId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const adminUrl = this.configService.get<string>('ADMIN_BACKEND_URL');
    if (!adminUrl) return { allowed: true, remaining: 999999, limit: 999999 };

    try {
      const res = await axios.get(`${adminUrl}/ai/usage/budget-check/${tenantId}`, {
        timeout: 3000,
        headers: { 'x-internal-service': 'tenant-backend' },
      });
      return res.data;
    } catch {
      // On error, allow the request (fail open) to avoid blocking users if admin-backend is down
      return { allowed: true, remaining: 999999, limit: 999999 };
    }
  }
}
