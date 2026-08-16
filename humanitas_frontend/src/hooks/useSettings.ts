import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

// ========== GENERAL SETTINGS ==========
export interface GeneralSettingsData {
    language: string;
    timezone: string;
    date_format: string;
    currency: string;
}

export interface TimezoneOption {
    value: string;
    label: string;
    offset: string;
}

export function useGeneralSettings() {
    const queryClient = useQueryClient();

    const settingsQuery = useQuery<GeneralSettingsData>({
        queryKey: ['settings-general'],
        queryFn: () => fetcher<GeneralSettingsData>(`${API_BASE_URL}/settings/general`),
    });

    const timezonesQuery = useQuery<TimezoneOption[]>({
        queryKey: ['timezones'],
        queryFn: () => fetcher<TimezoneOption[]>(`${API_BASE_URL}/settings/timezones`),
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async (data: GeneralSettingsData) => {
            const res = await fetch(`${API_BASE_URL}/settings/general`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to save settings');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-general'] });
            toast.success('Settings saved successfully');
        },
        onError: () => toast.error('Failed to save settings'),
    });

    return { settingsQuery, timezonesQuery, updateSettingsMutation };
}

// ========== COMPANY SETTINGS ==========
export interface CompanySettingsData {
    company_name: string;
    company_address: string;
    company_phone: string;
    company_email: string;
    tax_id: string;
}

export interface Department {
    id: string;
    name: string;
    description: string;
}

export function useCompanySettings() {
    const queryClient = useQueryClient();

    const settingsQuery = useQuery<CompanySettingsData>({
        queryKey: ['settings-company'],
        queryFn: () => fetcher<CompanySettingsData>(`${API_BASE_URL}/settings/company`),
    });

    const departmentsQuery = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: () => fetcher<Department[]>(`${API_BASE_URL}/settings/departments`),
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async (data: CompanySettingsData) => {
            const res = await fetch(`${API_BASE_URL}/settings/company`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to save settings');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-company'] });
            toast.success('Company info saved successfully');
        },
        onError: () => toast.error('Failed to save company info'),
    });

    const createDepartmentMutation = useMutation({
        mutationFn: async (data: { name: string; description: string }) => {
            const res = await fetch(`${API_BASE_URL}/settings/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create department');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            toast.success('Department created');
        },
        onError: () => toast.error('Failed to create department'),
    });

    const updateDepartmentMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
            const res = await fetch(`${API_BASE_URL}/settings/departments/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update department');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            toast.success('Department updated');
        },
        onError: () => toast.error('Failed to update department'),
    });

    const deleteDepartmentMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/settings/departments/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete department');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            toast.success('Department deleted');
        },
        onError: () => toast.error('Failed to delete department'),
    });

    return {
        settingsQuery,
        departmentsQuery,
        updateSettingsMutation,
        createDepartmentMutation,
        updateDepartmentMutation,
        deleteDepartmentMutation,
    };
}

// ========== HRM SETTINGS ==========
export interface HRMSettingsData {
    payroll_run_day: number;
    auto_payroll_enabled: boolean;
    late_penalty_per_minute: number;
    max_leave_carryover: number;
    probation_period_days: number;
}

export function useHRMSettings() {
    const queryClient = useQueryClient();

    const settingsQuery = useQuery<HRMSettingsData>({
        queryKey: ['settings-hr'],
        queryFn: () => fetcher<HRMSettingsData>(`${API_BASE_URL}/settings/hr`),
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async (data: Partial<HRMSettingsData>) => {
            const res = await fetch(`${API_BASE_URL}/settings/hr`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to save settings');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-hr'] });
            toast.success('HRM settings saved');
        },
        onError: () => toast.error('Failed to save HRM settings'),
    });

    return { settingsQuery, updateSettingsMutation };
}
