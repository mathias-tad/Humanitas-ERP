import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth, getAuthHeaders } from "@/context/AuthContext";

export interface UserDelegation {
    id: string;
    delegator_id: string;
    delegatee_id: string;
    delegator_first_name?: string;
    delegator_last_name?: string;
    delegator_name?: string;
    delegator_email?: string;
    delegator_position?: string;
    delegator_basic_salary?: number;
    delegatee_first_name?: string;
    delegatee_last_name?: string;
    delegatee_name?: string;
    delegatee_email?: string;
    delegatee_position?: string;
    start_date: string;
    end_date: string;
    scope: string; // 'ALL' | 'APPROVALS' | 'ATTENDANCE' | 'PMS'
    reason?: string;
    status: 'active' | 'revoked' | 'expired';
    company_id?: string;
    branch_id?: string;
    is_acting_assignment?: boolean;
    acting_position_title?: string;
    acting_allowance_type?: 'percentage' | 'fixed_amount';
    acting_allowance_percentage?: number;
    acting_allowance_amount?: number;
    acting_notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface DelegationAuditLog {
    id: string;
    delegation_id: string;
    performed_by: string;
    on_behalf_of: string;
    performed_by_name?: string;
    on_behalf_of_name?: string;
    performed_by_first_name?: string;
    performed_by_last_name?: string;
    performed_by_email?: string;
    on_behalf_of_first_name?: string;
    on_behalf_of_last_name?: string;
    on_behalf_of_email?: string;
    action: string;
    resource?: string;
    details?: any;
    is_acting_assignment?: boolean;
    acting_position_title?: string;
    delegation_scope?: string;
    created_at: string;
}

export interface CreateDelegationPayload {
    delegatee_id: string;
    start_date: string;
    end_date: string;
    scope?: string;
    reason?: string;
    delegator_id?: string;
    company_id?: string;
    branch_id?: string;
    is_acting_assignment?: boolean;
    acting_position_title?: string;
    acting_allowance_type?: string;
    acting_allowance_percentage?: number;
    acting_allowance_amount?: number;
    acting_notes?: string;
}

export interface ActingPreviewData {
    delegator_id: string;
    delegator_name: string;
    delegator_position: string;
    delegator_department: string;
    delegator_basic_salary: number;
    allowance_type: string;
    allowance_percentage: number;
    fixed_amount: number;
    estimated_monthly_allowance: number;
}

const getHeaders = () => getAuthHeaders();

export const useMyDelegations = () => {
    const { isAuthenticated } = useAuth();
    return useQuery<{ granted: UserDelegation[]; received: UserDelegation[] }>({
        queryKey: ['my-delegations'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/delegations/my`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch delegations');
            const data = await res.json();
            // Normalize rows into granted and received lists if backend returns array
            if (Array.isArray(data)) {
                return {
                    granted: data,
                    received: [],
                };
            }
            return data;
        },
        enabled: isAuthenticated,
    });
};

export const useActiveDelegations = () => {
    const { isAuthenticated } = useAuth();
    return useQuery<UserDelegation[]>({
        queryKey: ['active-delegations'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/delegations/active`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch active delegations');
            return res.json();
        },
        enabled: isAuthenticated,
    });
};

export const useDelegationAudit = (delegationId?: string) => {
    const { isAuthenticated } = useAuth();
    return useQuery<DelegationAuditLog[]>({
        queryKey: ['delegation-audit', delegationId],
        queryFn: async () => {
            let url = `${API_BASE_URL}/delegations/audit`;
            if (delegationId) url += `?delegation_id=${delegationId}`;
            const res = await fetch(url, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch delegation audit trail');
            return res.json();
        },
        enabled: isAuthenticated,
    });
};

export const useActingPreview = (
    delegatorId?: string,
    percentage?: number,
    amount?: number,
    enabled: boolean = false,
) => {
    return useQuery<ActingPreviewData>({
        queryKey: ['acting-allowance-preview', delegatorId, percentage, amount],
        queryFn: async () => {
            if (!delegatorId) throw new Error('Delegator ID required');
            const params = new URLSearchParams({
                delegator_id: delegatorId,
                percentage: (percentage || 0).toString(),
                amount: (amount || 0).toString(),
            });
            const res = await fetch(`${API_BASE_URL}/delegations/acting-preview?${params.toString()}`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch acting allowance preview');
            return res.json();
        },
        enabled: enabled && Boolean(delegatorId),
    });
};

export const useCreateDelegation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CreateDelegationPayload) => {
            const res = await fetch(`${API_BASE_URL}/delegations`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to create delegation');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['active-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['delegation-audit'] });
        },
    });
};

export const useRevokeDelegation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/delegations/${id}/revoke`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to revoke delegation');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['active-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['delegation-audit'] });
        },
    });
};
