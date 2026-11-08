import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";

export interface OvertimeEntry {
    id: string;
    user_id: string;
    full_name: string;
    department: string;
    date: string;
    normal_ot_hours: string | number;
    night_ot_hours: string | number;
    holiday_ot_hours: string | number;
    dayoff_ot_hours: string | number;
    total_amount: string | number;
    status: 'Pending' | 'Approved' | 'Rejected';
    is_manual: boolean;
}

export interface OvertimeWorker {
    record_id: string;
    user_id: string;
    full_name: string;
    department_name: string;
    shift_name: string;
    clock_in: string; // HH:mm:ss
    scheduled_out: string; // HH:mm:ss
    estimated_ot_hours: number;
}

export interface PeriodStatus {
    phase: 'ACTIVE' | 'PROCESSING' | 'FROZEN';
    runDay: number;
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
    canCalculate: boolean;
    canAdjust: boolean;
    message: string;
}

export interface OvertimePeriod {
    label: string;
    periodStart: string;
    periodEnd: string;
    entryCount: number;
    totalAmount: number;
}

const getHeaders = () => getAuthHeaders();

export const useOvertime = () => {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    // --- QUERIES ---

    const entriesQuery = (filters?: { startDate?: string; endDate?: string; status?: string }) => useQuery<OvertimeEntry[]>({
        queryKey: ['overtime-entries', filters],
        queryFn: async () => {
            const query = new URLSearchParams();
            if (filters?.startDate) query.append("startDate", filters.startDate);
            if (filters?.endDate) query.append("endDate", filters.endDate);
            if (filters?.status && filters.status !== 'all') query.append("status", filters.status);

            const response = await fetch(`${API_BASE_URL}/overtime?${query.toString()}`, {
                headers: getAuthHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch overtime entries');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const workersQuery = useQuery<OvertimeWorker[]>({
        queryKey: ['overtime-workers'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/overtime-workers`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch overtime workers');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const periodStatusQuery = useQuery<PeriodStatus>({
        queryKey: ['overtime-period-status'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/overtime/period-status`, {
                headers: getAuthHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch period status');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const periodsQuery = useQuery<OvertimePeriod[]>({
        queryKey: ['overtime-periods'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/overtime/periods`, {
                headers: getAuthHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch periods');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const activeJobQuery = useQuery({
        queryKey: ['active-job'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/system/logs?type=OVERTIME&status=QUEUED,PROCESSING,PENDING&limit=1`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data && data.length > 0) {
                return { id: data[0].id, status: data[0].status };
            }
            return null;
        },
        refetchInterval: (query) => {
            return query.state.data ? 3000 : false; // Poll every 3s if job exists
        },
        enabled: isAuthenticated
    });


    const payrollSettingsQuery = useQuery({
        queryKey: ['payroll-settings'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/settings/payroll`, {
                headers: getAuthHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch payroll settings');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // --- MUTATIONS ---

    const approveEntriesMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const response = await fetch(`${API_BASE_URL}/overtime/approve`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids }),
            });
            if (!response.ok) throw new Error('Failed to approve entries');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overtime-entries'] });
            toast.success("Overtime entries approved");
        },
    });

    const rejectEntriesMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const response = await fetch(`${API_BASE_URL}/overtime/reject`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids }),
            });
            if (!response.ok) throw new Error('Failed to reject entries');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overtime-entries'] });
            toast.success("Overtime entries rejected");
        },
    });

    const updateEntryMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const response = await fetch(`${API_BASE_URL}/overtime/entries/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to update entry');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overtime-entries'] });
            toast.success("Entry updated successfully");
        },
    });

    const calculatePeriodMutation = useMutation({
        mutationFn: async ({ year, month }: { year: number; month: number }) => {
            const response = await fetch(`${API_BASE_URL}/overtime/calculate-period`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ year, month }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || 'Calculation failed');
            }
            return response.json();
        },
        onSuccess: () => {
            // We generally don't invalidate here because it's a background job,
            // but we might trigger a refetch of activeJobQuery if we wanted manual control
            queryClient.invalidateQueries({ queryKey: ['active-job'] });
        }
    });

    const forceClockOutMutation = useMutation({
        mutationFn: async ({ userId, reason, grant_overtime }: { userId: string; reason: string; grant_overtime?: boolean }) => {
            const response = await fetch(`${API_BASE_URL}/attendance/force-clockout`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ userId, reason, grant_overtime: grant_overtime ?? false }),
            });
            if (!response.ok) throw new Error('Failed to force clock out');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overtime-workers'] });
            toast.success("Force clock out successful");
        },
    });

    return {
        entriesQuery,
        workersQuery,
        periodStatusQuery,
        periodsQuery,
        activeJobQuery,
        payrollSettingsQuery,
        approveEntriesMutation,
        rejectEntriesMutation,
        updateEntryMutation,
        calculatePeriodMutation,
        forceClockOutMutation,
    };
};
