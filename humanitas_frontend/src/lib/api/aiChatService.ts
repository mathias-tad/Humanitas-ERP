import api, { getCurrentTenantSlug, tryRefreshToken } from '../api';

export interface AiMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  created_at: string;
  attachmentName?: string;
}

export interface AiConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: AiMessage[];
}

export interface AiDocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'HRMS' | 'Payroll' | 'PMS' | 'Attendance' | 'General';
  supportedFormats: ('pdf' | 'docx' | 'excel')[];
  defaultPrompt: string;
  parameters: {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    required: boolean;
    description?: string;
  }[];
}

export const aiChatService = {
  async getConversations(): Promise<AiConversation[]> {
    const response = await api.get<AiConversation[]>('/ai/history');
    return response;
  },

  async getConversation(id: string): Promise<AiConversation> {
    const response = await api.get<AiConversation>(`/ai/history/${id}`);
    return response;
  },

  async sendMessage(
    message: string,
    conversationId?: string,
    currentRoute?: string,
    currentModule?: string,
    platform: string = 'web',
  ): Promise<{ response: string; conversationId: string }> {
    const activeRoute = currentRoute || (typeof window !== 'undefined' ? window.location.pathname : '/dashboard');
    const activeModule = currentModule || (typeof window !== 'undefined' ? (window.location.pathname.split('/')[1] || 'dashboard') : 'dashboard');
    const response = await api.post<{ response: string; conversationId: string }>('/ai/chat', {
      message,
      conversationId,
      currentRoute: activeRoute,
      currentModule: activeModule,
      platform,
    });
    return response;
  },

  async sendMessageWithFile(
    message: string,
    file: File,
    conversationId?: string,
    currentRoute?: string,
    currentModule?: string,
    platform: string = 'web',
  ): Promise<{ response: string; conversationId: string }> {
    const activeRoute = currentRoute || (typeof window !== 'undefined' ? window.location.pathname : '/dashboard');
    const activeModule = currentModule || (typeof window !== 'undefined' ? (window.location.pathname.split('/')[1] || 'dashboard') : 'dashboard');
    const formData = new FormData();
    formData.append('message', message);
    formData.append('file', file);
    if (conversationId) formData.append('conversationId', conversationId);
    formData.append('currentRoute', activeRoute);
    formData.append('currentModule', activeModule);
    formData.append('platform', platform);

    const baseUrl = import.meta.env.VITE_API_URL || 'https://humanitas.ziontech.tech/api/v1';
    const tenantSlug = getCurrentTenantSlug() || '';

    let res = await fetch(`${baseUrl}/ai/chat-with-file`, {
      method: 'POST',
      headers: { 'x-tenant-slug': tenantSlug },
      credentials: 'include',
      body: formData,
    });

    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(`${baseUrl}/ai/chat-with-file`, {
          method: 'POST',
          headers: { 'x-tenant-slug': tenantSlug },
          credentials: 'include',
          body: formData,
        });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to process file' }));
      throw new Error(err.message || 'Failed to process file');
    }
    return res.json();
  },

  async getTemplates(): Promise<AiDocumentTemplate[]> {
    const response = await api.get<AiDocumentTemplate[]>('/ai/document/templates');
    return response;
  },

  async generateFromTemplate(
    templateId: string,
    format: 'pdf' | 'docx' | 'excel',
    parameters?: Record<string, any>,
    customNotes?: string,
  ): Promise<void> {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://humanitas.ziontech.tech/api/v1';
    const tenantSlug = getCurrentTenantSlug() || '';

    let res = await fetch(`${baseUrl}/ai/document/generate-from-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': tenantSlug,
      },
      credentials: 'include',
      body: JSON.stringify({ templateId, format, parameters, customNotes }),
    });

    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(`${baseUrl}/ai/document/generate-from-template`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-slug': tenantSlug,
          },
          credentials: 'include',
          body: JSON.stringify({ templateId, format, parameters, customNotes }),
        });
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    const blob = await res.blob();
    const ext = format === 'excel' ? 'xlsx' : format;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateId}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async generateWithReferenceFile(
    file: File,
    prompt: string,
    format: 'pdf' | 'docx' | 'excel',
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', prompt);
    formData.append('format', format);

    const baseUrl = import.meta.env.VITE_API_URL || 'https://humanitas.ziontech.tech/api/v1';
    const tenantSlug = getCurrentTenantSlug() || '';

    let res = await fetch(`${baseUrl}/ai/document/generate-with-reference`, {
      method: 'POST',
      headers: { 'x-tenant-slug': tenantSlug },
      credentials: 'include',
      body: formData,
    });

    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(`${baseUrl}/ai/document/generate-with-reference`, {
          method: 'POST',
          headers: { 'x-tenant-slug': tenantSlug },
          credentials: 'include',
          body: formData,
        });
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    const blob = await res.blob();
    const ext = format === 'excel' ? 'xlsx' : format;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_template_doc_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async generateDocument(prompt: string, format: 'pdf' | 'docx' | 'excel', referenceText?: string): Promise<void> {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://humanitas.ziontech.tech/api/v1';
    const tenantSlug = getCurrentTenantSlug() || '';

    let res = await fetch(`${baseUrl}/ai/document/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-tenant-slug': tenantSlug 
      },
      credentials: 'include',
      body: JSON.stringify({ prompt, format, referenceText }),
    });

    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(`${baseUrl}/ai/document/generate`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-tenant-slug': tenantSlug 
          },
          credentials: 'include',
          body: JSON.stringify({ prompt, format, referenceText }),
        });
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    const blob = await res.blob();
    const ext = format === 'excel' ? 'xlsx' : format;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-document.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async getKnowledge(query?: string, moduleKey?: string, platform?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (moduleKey) params.append('module', moduleKey);
    if (platform) params.append('platform', platform);
    return api.get<any[]>(`/ai/knowledge?${params.toString()}`);
  },

  async getAuditLogs(limit: number = 25): Promise<any[]> {
    return api.get<any[]>(`/ai/audit-logs?limit=${limit}`);
  },
};
