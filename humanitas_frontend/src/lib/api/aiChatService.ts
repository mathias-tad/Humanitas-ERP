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

export const aiChatService = {
  async getConversations(): Promise<AiConversation[]> {
    const response = await api.get<AiConversation[]>('/ai/history');
    return response;
  },

  async getConversation(id: string): Promise<AiConversation> {
    const response = await api.get<AiConversation>(`/ai/history/${id}`);
    return response;
  },

  async sendMessage(message: string, conversationId?: string): Promise<{ response: string; conversationId: string }> {
    const response = await api.post<{ response: string; conversationId: string }>('/ai/chat', {
      message,
      conversationId,
    });
    return response;
  },

  async sendMessageWithFile(message: string, file: File, conversationId?: string): Promise<{ response: string; conversationId: string }> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('file', file);
    if (conversationId) formData.append('conversationId', conversationId);

    const baseUrl = import.meta.env.VITE_API_URL || 'https://humanitas-erp.ziontech.tech/api/v1';
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

  async generateDocument(prompt: string, format: 'pdf' | 'docx' | 'excel', referenceText?: string): Promise<void> {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://humanitas-erp.ziontech.tech/api/v1';
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
};

