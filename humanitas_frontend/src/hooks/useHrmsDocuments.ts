import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';

export interface EmployeeDocument {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  position?: string;
  title: string;
  category: 'contract' | 'identification' | 'tax_legal' | 'letter' | 'certification' | 'disciplinary' | 'other';
  document_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  issue_date?: string;
  expiry_date?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_by?: string;
  verified_by_first_name?: string;
  verified_by_last_name?: string;
  verified_at?: string;
  signature_status: 'not_required' | 'pending' | 'signed' | 'declined';
  signed_at?: string;
  notes?: string;
  is_confidential: boolean;
  expiry_status: 'no_expiry' | 'valid' | 'expiring_soon' | 'expired';
  days_until_expiry?: number;
  created_at: string;
  updated_at: string;
}

export interface ExpiringDocumentsSummary {
  expiredCount: number;
  expiring30Days: number;
  expiring60Days: number;
  expiring90Days: number;
  totalActiveTracked: number;
  upcomingExpiringDocuments: {
    id: string;
    title: string;
    category: string;
    document_type: string;
    expiry_date: string;
    user_id: string;
    first_name: string;
    last_name: string;
    department?: string;
    days_remaining: number;
  }[];
}

export interface LetterTemplate {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  subject: string;
  body_template: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedLetterResult {
  templateCode: string;
  templateName: string;
  employeeId: string;
  employeeName: string;
  subject: string;
  renderedText: string;
  renderedHtml: string;
  savedToVault: boolean;
  vaultDocumentId?: string;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to process document request' }));
    throw new Error(err.message || 'Failed to process document request');
  }
  const data = await res.json();
  return data.data !== undefined ? data.data : data;
}

export function useHrmsDocuments() {
  const queryClient = useQueryClient();
  const { activeCompanyId, activeBranchId } = useAuth();

  const buildQueryString = (extraParams?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (activeCompanyId) params.append('company_id', activeCompanyId);
    if (activeBranchId) params.append('branch_id', activeBranchId);
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const useDocuments = (filters?: {
    userId?: string;
    category?: string;
    verificationStatus?: string;
    expiringWithinDays?: string;
    search?: string;
  }) =>
    useQuery<EmployeeDocument[]>({
      queryKey: ['hrms-documents-list', activeCompanyId, activeBranchId, filters],
      queryFn: () => fetcher<EmployeeDocument[]>(`${API_BASE_URL}/hrms/documents${buildQueryString(filters)}`),
    });

  const useExpiringSummary = () =>
    useQuery<ExpiringDocumentsSummary>({
      queryKey: ['hrms-documents-expirations', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<ExpiringDocumentsSummary>(`${API_BASE_URL}/hrms/documents/expirations${buildQueryString()}`),
    });

  const useTemplates = () =>
    useQuery<LetterTemplate[]>({
      queryKey: ['hrms-letter-templates', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<LetterTemplate[]>(`${API_BASE_URL}/hrms/documents/templates${buildQueryString()}`),
    });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/hrms/documents`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to create document' }));
        throw new Error(err.message || 'Failed to create document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-documents-list'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-documents-expirations'] });
    },
  });

  const verifyDocumentMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'verified' | 'rejected'; notes?: string }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/documents/${id}/verify`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to verify document' }));
        throw new Error(err.message || 'Failed to verify document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-documents-list'] });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/hrms/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to delete document' }));
        throw new Error(err.message || 'Failed to delete document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-documents-list'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-documents-expirations'] });
    },
  });

  const generateLetterMutation = useMutation({
    mutationFn: async (payload: {
      templateIdOrCode: string;
      employeeId: string;
      customTokens?: Record<string, string>;
      saveToVault?: boolean;
    }): Promise<GeneratedLetterResult> => {
      const res = await fetch(`${API_BASE_URL}/hrms/documents/generate-letter`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to generate letter' }));
        throw new Error(err.message || 'Failed to generate letter');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.savedToVault) {
        queryClient.invalidateQueries({ queryKey: ['hrms-documents-list'] });
      }
    },
  });

  return {
    useDocuments,
    useExpiringSummary,
    useTemplates,
    createDocument: createDocumentMutation.mutateAsync,
    isCreatingDocument: createDocumentMutation.isPending,
    verifyDocument: verifyDocumentMutation.mutateAsync,
    isVerifyingDocument: verifyDocumentMutation.isPending,
    deleteDocument: deleteDocumentMutation.mutateAsync,
    isDeletingDocument: deleteDocumentMutation.isPending,
    generateLetter: generateLetterMutation.mutateAsync,
    isGeneratingLetter: generateLetterMutation.isPending,
  };
}
