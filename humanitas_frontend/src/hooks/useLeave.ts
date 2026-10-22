import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth, getAuthHeaders } from "@/context/AuthContext";

export interface LeaveType {
    id: string;
    name: string;
    days_per_year: number;
    is_paid: boolean;
}

export interface LeaveBalance {
    leave_type_id: string;
    leave_type_name: string;
    base_annual_leave?: number;
    years_of_service?: number;
    current_annual_leave?: number;
    pro_rated_annual_leave?: number;
    months_worked_this_year?: number;
    total_days: number;
    used_days: number;
    carried_over?: number;
    available_days: number;
    is_paid: boolean;
    year?: number;
}

export interface LeaveRequest {
    id: string;
    user_id?: string;
    user_name?: string;
    user_email?: string;
    department?: string;
    leave_type_id: string;
    leave_type_name: string;
    start_date: string;
    end_date: string;
    days: number;
    reason: string;
    status: "Pending" | "Approved" | "Rejected";
    approver_name?: string;
    rejection_reason?: string;
    current_step?: number;
    approval_status?: string;
    created_at: string;
}

export interface LeaveApplyData {
    leave_type_id: string;
    leave_type_name: string;
    start_date: string;
    end_date: string;
    reason?: string;
}

export interface UserBalanceData {
    user: {
        id: string;
        full_name: string;
        hire_date: string;
        years_of_service: number;
        months_worked_this_year: number;
        gender?: string;
    };
    settings: {
        leave_increase_per_year: number;
        probation_period_days: number;
    };
    balances: LeaveBalance[];
}

export interface User {
    id: string;
    full_name: string;
    email: string;
    hire_date: string;
    department: string;
    gender?: string;
}

export interface WorkflowStep {
    id: string;
    step_order: number;
    role_required: string;
    is_final: boolean;
}

const getHeaders = () => getAuthHeaders();

export const useLeave = () => {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    // --- QUERIES ---

    const workflowQuery = useQuery<WorkflowStep[]>({
        queryKey: ['leave-workflow'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/workflow`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch leave workflow');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const usersQuery = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch users');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const leaveTypesQuery = useQuery<LeaveType[]>({
        queryKey: ['leave-types'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/types`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch leave types');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const myBalancesQuery = useQuery<LeaveBalance[]>({
        queryKey: ['my-leave-balances'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/my-balances`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch leave balances');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const myRequestsQuery = useQuery<LeaveRequest[]>({
        queryKey: ['my-leave-requests'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/my-requests`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch leave requests');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const allRequestsQuery = useQuery<LeaveRequest[]>({
        queryKey: ['all-leave-requests'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/leave/requests`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch all leave requests');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // Sub-hook for specific user balances (Admin)
    const useUserBalances = (userId: string | null) => useQuery<UserBalanceData>({
        queryKey: ['user-leave-balances', userId],
        queryFn: async () => {
            if (!userId) throw new Error('User ID is required');
            const response = await fetch(`${API_BASE_URL}/leave/balances/${userId}`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch user balances');
            return response.json();
        },
        enabled: isAuthenticated && !!userId,
    });

    // --- MUTATIONS ---

    const applyLeaveMutation = useMutation({
        mutationFn: async (data: LeaveApplyData) => {
            const response = await fetch(`${API_BASE_URL}/leave/apply`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to apply for leave');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
            queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
            queryClient.invalidateQueries({ queryKey: ['all-leave-requests'] });
        }
    });

    const cancelRequestMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const response = await fetch(`${API_BASE_URL}/leave/my-requests/${requestId}`, {
                method: "DELETE",
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to cancel request');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
            queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
            queryClient.invalidateQueries({ queryKey: ['all-leave-requests'] });
        }
    });

    const approveRequestMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const response = await fetch(`${API_BASE_URL}/leave/requests/${requestId}/approve`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({}),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to approve request');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-leave-requests'] });
            queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] }); // In case admin approves their own?
        }
    });

    const rejectRequestMutation = useMutation({
        mutationFn: async ({ requestId, reason }: { requestId: string, reason: string }) => {
            const response = await fetch(`${API_BASE_URL}/leave/requests/${requestId}/reject`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ reason }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to reject request');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-leave-requests'] });
        }
    });

    const calculateBalancesMutation = useMutation({
        mutationFn: async (userId: string) => {
            const response = await fetch(`${API_BASE_URL}/leave/balances/${userId}/calculate`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({}),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to calculate balances');
            }
            return response.json();
        },
        onSuccess: (_, userId) => {
            queryClient.invalidateQueries({ queryKey: ['user-leave-balances', userId] });
        }
    });

    const updateBalanceMutation = useMutation({
        mutationFn: async ({ userId, data }: { userId: string, data: any }) => {
            const response = await fetch(`${API_BASE_URL}/leave/balances/${userId}`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update balance');
            }
            return response.json();
        },
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ['user-leave-balances', userId] });
        }
    });

    return {
        workflowQuery,
        usersQuery,
        leaveTypesQuery,
        myBalancesQuery,
        myRequestsQuery,
        allRequestsQuery,
        useUserBalances,
        applyLeaveMutation,
        cancelRequestMutation,
        approveRequestMutation,
        rejectRequestMutation,
        calculateBalancesMutation,
        updateBalanceMutation
    };
};
