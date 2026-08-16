import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSettings } from './entities/ai-settings.entity';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';
import * as crypto from 'crypto';

@Injectable()
export class AiSettingsService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey = process.env.ENCRYPTION_SECRET;

  constructor(
    @InjectRepository(AiSettings)
    private aiSettingsRepository: Repository<AiSettings>,
  ) {
    if (!this.secretKey || this.secretKey.length !== 32) {
      console.warn('ENCRYPTION_SECRET is not set or not 32 characters long. AI settings encryption might fail.');
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.secretKey!), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(text: string): string {
    const [ivHex, authTagHex, encryptedHex] = text.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted text format');
    }
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.secretKey!),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async testConnection(dto: UpdateAiSettingsDto): Promise<{ success: boolean; message: string }> {
    const { provider, api_key, endpoint_url, gcp_project_id, gcp_location, model } = dto;
    if (!api_key && provider !== 'ollama') {
      return { success: false, message: 'API key is required for testing.' };
    }

    try {
      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gemini Error: ${res.status} ${res.statusText}`);
        return { success: true, message: 'Gemini API key is valid!' };
      }
      
      if (provider === 'openai') {
        const url = endpoint_url || 'https://api.openai.com/v1';
        const res = await fetch(`${url}/models`, {
          headers: { Authorization: `Bearer ${api_key}` },
        });
        if (!res.ok) throw new Error(`OpenAI Error: ${res.status} ${res.statusText}`);
        return { success: true, message: 'OpenAI API key is valid!' };
      }

      if (provider === 'anthropic') {
        const url = endpoint_url || 'https://api.anthropic.com/v1';
        // Anthropic doesn't have a simple models list without auth, so we just try to ping messages
        const res = await fetch(`${url}/messages`, {
          method: 'POST',
          headers: { 
            'x-api-key': api_key || '', 
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json' 
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Ping' }]
          })
        });
        // 400 means key works but maybe params wrong. 401 is unauthorized.
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Anthropic Error: Unauthorized - check API key`);
        }
        return { success: true, message: 'Anthropic API key is valid!' };
      }

      if (provider === 'ollama') {
        const url = endpoint_url || 'http://host.docker.internal:11434';
        const res = await fetch(`${url}/api/tags`);
        if (!res.ok) throw new Error(`Ollama Error: ${res.status} ${res.statusText}`);
        return { success: true, message: 'Connected to Ollama successfully!' };
      }

      if (provider === 'vertex') {
        if (!gcp_project_id || !gcp_location) {
          throw new Error('GCP Project ID and Location are required for Vertex AI');
        }
        const m = model || 'gemini-1.5-pro-001';
        // Vertex using an API key uses generateContent endpoint
        const url = `https://${gcp_location}-aiplatform.googleapis.com/v1/projects/${gcp_project_id}/locations/${gcp_location}/publishers/google/models/${m}:generateContent?key=${api_key}`;
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Ping' }] }] })
        });

        if (res.status === 401 || res.status === 403) {
          throw new Error(`Vertex AI Error: Unauthorized - Check API key and GCP project setup.`);
        }
        if (!res.ok && res.status !== 400) {
           throw new Error(`Vertex AI Error: ${res.status} ${res.statusText}`);
        }
        return { success: true, message: 'Vertex API key is valid!' };
      }

      return { success: false, message: 'Unsupported provider' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' };
    }
  }

  async getSettings(tenantId: string): Promise<Partial<AiSettings>> {
    let settings = await this.aiSettingsRepository.findOne({ where: { tenant_id: tenantId } });
    if (!settings) {
      // Return default empty settings rather than 404
      return {
        tenant_id: tenantId,
        provider: 'gemini',
        is_enabled: false,
        max_tokens: 4096,
        temperature: 0.7,
      };
    }
    
    // Don't return the raw encrypted key, just indicate if it exists
    const { api_key_encrypted, ...rest } = settings;
    return {
      ...rest,
      api_key_encrypted: api_key_encrypted ? '********' : undefined,
    };
  }

  async updateSettings(tenantId: string, updateDto: UpdateAiSettingsDto): Promise<Partial<AiSettings>> {
    let settings = await this.aiSettingsRepository.findOne({ where: { tenant_id: tenantId } });
    
    if (!settings) {
      settings = this.aiSettingsRepository.create({ tenant_id: tenantId });
    }

    const { api_key, ...rest } = updateDto;
    
    Object.assign(settings, rest);
    
    if (api_key) {
      settings.api_key_encrypted = this.encrypt(api_key);
    }

    const savedSettings = await this.aiSettingsRepository.save(settings);
    
    const { api_key_encrypted, ...returnedSettings } = savedSettings;
    return {
      ...returnedSettings,
      api_key_encrypted: api_key_encrypted ? '********' : undefined,
    };
  }

  // Internal method used by other services that need the actual API key
  async getDecryptedSettings(tenantId: string): Promise<AiSettings & { api_key?: string }> {
    const settings = await this.aiSettingsRepository.findOne({ where: { tenant_id: tenantId } });
    if (!settings) {
      throw new NotFoundException('AI settings not found for this tenant');
    }

    let api_key: string | undefined;
    if (settings.api_key_encrypted) {
      try {
        api_key = this.decrypt(settings.api_key_encrypted);
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
      }
    }

    return { ...settings, api_key };
  }
}
