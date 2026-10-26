import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface AiSettingsConfig {
  ai_capability_tiers_enabled: string[];
  max_action_records_per_bulk: number;
  response_language: string;
  doc_branding_logo?: string;
  doc_branding_primary_color: string;
  doc_branding_font: string;
}

@Injectable()
export class AiSettingsConfigService {
  constructor(private databaseService: DatabaseService) {}

  private async getConn(tenantId: string) {
    return this.databaseService.getTenantConnectionById(tenantId);
  }

  async getAiConfig(tenantId: string): Promise<AiSettingsConfig> {
    const conn = await this.getConn(tenantId);
    const rows = await conn.query(
      `SELECT key, value FROM system_settings WHERE key LIKE 'ai_%' LIMIT 20`
    ).catch(() => []);
    const map: Record<string, string> = {};
    for (const row of rows) { if (row.key) map[row.key] = row.value; }
    return {
      ai_capability_tiers_enabled: map['ai_capability_tiers_enabled']
        ? JSON.parse(map['ai_capability_tiers_enabled'])
        : ['ai.help', 'ai.actions', 'ai.documents'],
      max_action_records_per_bulk: parseInt(map['ai_max_action_records'] || '50'),
      response_language: map['ai_response_language'] || 'en',
      doc_branding_logo: map['ai_doc_branding_logo'],
      doc_branding_primary_color: map['ai_doc_branding_color'] || '#D4AF37',
      doc_branding_font: map['ai_doc_branding_font'] || 'Inter',
    };
  }

  async updateAiConfig(tenantId: string, config: Partial<AiSettingsConfig>): Promise<void> {
    const conn = await this.getConn(tenantId);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    const updates: Array<[string, string]> = [];
    if (config.ai_capability_tiers_enabled !== undefined) updates.push(['ai_capability_tiers_enabled', JSON.stringify(config.ai_capability_tiers_enabled)]);
    if (config.max_action_records_per_bulk !== undefined) updates.push(['ai_max_action_records', String(config.max_action_records_per_bulk)]);
    if (config.response_language !== undefined) updates.push(['ai_response_language', config.response_language]);
    if (config.doc_branding_logo !== undefined) updates.push(['ai_doc_branding_logo', config.doc_branding_logo || '']);
    if (config.doc_branding_primary_color !== undefined) updates.push(['ai_doc_branding_color', config.doc_branding_primary_color]);
    if (config.doc_branding_font !== undefined) updates.push(['ai_doc_branding_font', config.doc_branding_font]);

    for (const [key, value] of updates) {
      await conn.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }
  }
}
