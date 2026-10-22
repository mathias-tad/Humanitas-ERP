import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth, getAuthHeaders } from "@/context/AuthContext";
import { toast } from "sonner";

async function fetcher(url: string) {
    const res = await fetch(url, {
        credentials: 'include',
        headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch data');
    const data = await res.json();
    return data.data || data; // Handle { data: [...] } or [...]
}

export interface User {
    id: string;
    full_name: string;
    email: string;
    department: string;
    position: string;
    phone: string;
    role_id: string;
    role_name: string;
    created_at: string;
    is_active: boolean;
    last_login?: string;
    avatar_url?: string;
    birth_date?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    gender?: string;
    marital_status?: string;
    nationality?: string;
    national_id?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    hire_date?: string;
    employment_type?: string;
    company_id?: string;
    branch_id?: string;
    tin?: string;
    account_number?: string;
}

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
}

export function useUsers(companyId?: string, branchId?: string) {
    const { activeCompanyId, activeBranchId } = useAuth();
    const effectiveCompanyId = companyId !== undefined ? companyId : activeCompanyId;
    const effectiveBranchId = branchId !== undefined ? branchId : activeBranchId;

    const params = new URLSearchParams();
    if (effectiveCompanyId) params.append('company_id', effectiveCompanyId);
    if (effectiveBranchId) params.append('branch_id', effectiveBranchId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    return useQuery<User[]>({
        queryKey: ['users', effectiveCompanyId, effectiveBranchId],
        queryFn: () => fetcher(`${API_BASE_URL}/users${qs}`),
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
    });
}

export function useBasicUsers(companyId?: string, branchId?: string) {
    const { activeCompanyId, activeBranchId } = useAuth();
    const effectiveCompanyId = companyId !== undefined ? companyId : activeCompanyId;
    const effectiveBranchId = branchId !== undefined ? branchId : activeBranchId;

    const params = new URLSearchParams();
    if (effectiveCompanyId) params.append('company_id', effectiveCompanyId);
    if (effectiveBranchId) params.append('branch_id', effectiveBranchId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    return useQuery<User[]>({
        queryKey: ['users', 'basic', effectiveCompanyId, effectiveBranchId],
        queryFn: () => fetcher(`${API_BASE_URL}/users/list${qs}`),
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
    });
}

export function useRoles() {
    return useQuery<Role[]>({
        queryKey: ['roles'],
        queryFn: () => fetcher(`${API_BASE_URL}/roles`),
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
    });
}

// Extended hook with mutations for AccessControl page
export function useRolesWithMutations() {
    const queryClient = useQueryClient();

    const rolesQuery = useQuery<Role[]>({
        queryKey: ['roles'],
        queryFn: () => fetcher(`${API_BASE_URL}/roles`),
    });

    const createRoleMutation = useMutation({
        mutationFn: async (data: { name: string; description: string }) => {
            const res = await fetch(`${API_BASE_URL}/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...data, permissions: [] }),
            });
            if (!res.ok) throw new Error('Failed to create role');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            toast.success("Role created successfully");
        },
        onError: () => toast.error("Failed to create role"),
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
            const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update role');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            toast.success("Role updated successfully");
        },
        onError: () => toast.error("Failed to update role"),
    });

    const deleteRoleMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete role');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            toast.success("Role deleted successfully");
        },
        onError: () => toast.error("Failed to delete role"),
    });

    const updatePermissionsMutation = useMutation({
        mutationFn: async ({ id, permissions }: { id: string; permissions: string[] }) => {
            const res = await fetch(`${API_BASE_URL}/roles/${id}/permissions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ permissions }),
            });
            if (!res.ok) throw new Error('Failed to update permissions');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: () => toast.error("Failed to update permissions"),
    });

    return {
        rolesQuery,
        createRoleMutation,
        updateRoleMutation,
        deleteRoleMutation,
        updatePermissionsMutation,
    };
}
