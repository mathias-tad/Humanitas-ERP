import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth, getAuthHeaders } from "@/context/AuthContext";

export interface AttendanceRecord {
    id: string;
    user_id: string;
    full_name?: string; // Optional depending on endpoint
    email?: string;
    department?: string;
    date: string;
    shift_id?: string;
    shift_name?: string;
    shift_color?: string;
    updated_at?: string;
    scheduled_in?: string;
    scheduled_out?: string;
    actual_in?: string;
    actual_out?: string;
    status: string;
    work_hours?: string | { hours?: number; minutes?: number } | null;
    remarks?: string;
    is_corrected?: boolean;
    corrected_by_name?: string;
    late_minutes?: number;
    clock_method?: string;
    device_id?: string;
    device_name?: string;
}

export interface UserWithAssignment {
    id: string;
    full_name: string;
    email: string;
    department: string;
    position: string;
    avatar_url?: string;
    pattern_id?: string;
    pattern_name?: string;
    rotation_type?: string;
    current_week_in_rotation?: number;
}

export interface UserDevice {
    id: string;
    user_id: string;
    device_id: string;
    device_name: string;
    device_type: string;
    is_active: boolean;
    registered_at: string;
    approved_at: string | null;
    full_name?: string;
    email?: string;
    department?: string;
}

export interface AllowedNetwork {
    id: string;
    name: string;
    ip_address: string;
    subnet_mask: string;
    description?: string;
    is_active: boolean;
    created_at: string;
}

export interface AttendanceFilters {
    date?: string;
    startDate?: string;
    endDate?: string;
    department?: string;
    branch_id?: string;
    company_id?: string;
    status?: string;
    shift?: string;
    user_id?: string;
}

export interface AbsenceThresholds {
    consecutive_threshold: number;
    monthly_threshold: number;
    notify_employee: boolean;
    notify_supervisor: boolean;
    notify_hr: boolean;
    is_enabled: boolean;
}


const getHeaders = () => getAuthHeaders();

export const useMyAttendance = (month: number, year: number) => {
    const { isAuthenticated } = useAuth();
    return useQuery<AttendanceRecord[]>({
        queryKey: ['my-attendance', month, year],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/records/my?month=${month}&year=${year}`, { // Corrected endpoint if needed, previously was attendance/my-records?
                headers: getHeaders(),
                credentials: 'include',
                cache: 'no-store'
            });
            if (!response.ok) throw new Error('Failed to fetch my attendance records');
            return response.json();
        },
        enabled: isAuthenticated,
    });
};

export const useAttendance = (filters?: string | AttendanceFilters) => {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    const filterObj: AttendanceFilters = typeof filters === 'string' ? { date: filters } : (filters || {});

    // Attendance Records
    const attendanceQuery = useQuery<AttendanceRecord[]>({
        queryKey: ['attendance-records', filterObj],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filterObj.startDate && filterObj.endDate) {
                params.append('startDate', filterObj.startDate);
                params.append('endDate', filterObj.endDate);
            } else if (filterObj.date) {
                params.append('date', filterObj.date);
            }
            if (filterObj.department && filterObj.department !== 'all') params.append('department', filterObj.department);
            if (filterObj.branch_id && filterObj.branch_id !== 'all') params.append('branch_id', filterObj.branch_id);
            if (filterObj.status && filterObj.status !== 'all') params.append('status', filterObj.status);
            if (filterObj.user_id) params.append('user_id', filterObj.user_id);
            const url = `${API_BASE_URL}/attendance/records?${params.toString()}`;
            const response = await fetch(url, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch attendance records');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // Users with assignments
    const assignmentsQuery = useQuery<UserWithAssignment[]>({
        queryKey: ['attendance-assignments'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/users/with-assignments`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch assignments');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // Devices
    const devicesQuery = useQuery<UserDevice[]>({
        queryKey: ['attendance-devices'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/devices/all`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch devices');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // Networks
    const networksQuery = useQuery<AllowedNetwork[]>({
        queryKey: ['attendance-networks'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/networks`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch networks');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // Detected IP
    const detectedIpQuery = useQuery({
        queryKey: ['detected-ip'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/network-check`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch ip');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    // Mutations
    const assignShiftMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await fetch(`${API_BASE_URL}/attendance/assignments`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to assign shift');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-assignments'] });
        }
    });

    const removeAssignmentMutation = useMutation({
        mutationFn: async (userId: string) => {
            const response = await fetch(`${API_BASE_URL}/attendance/assignments/${userId}`, {
                method: "DELETE",
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to remove assignment');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-assignments'] });
        }
    });

    const correctAttendanceMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const response = await fetch(`${API_BASE_URL}/attendance/records/${id}/correct`, {
                method: "PATCH",
                headers: getHeaders(),
                credentials: "include",
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Correction failed');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
        }
    });

    const addNetworkMutation = useMutation({
        mutationFn: async (network: any) => {
            const response = await fetch(`${API_BASE_URL}/attendance/networks`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(network),
            });
            if (!response.ok) throw new Error('Failed to add network');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-networks'] });
        }
    });

    const removeNetworkMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/attendance/networks/${id}`, {
                method: "DELETE",
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to remove network');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-networks'] });
        }
    });

    const approveDeviceMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/attendance/devices/${id}/approve`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({}),
            });
            if (!response.ok) throw new Error('Failed to approve device');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-devices'] });
        }
    });

    const rejectDeviceMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/attendance/devices/${id}/reject`, {
                method: "POST",
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({}),
            });
            if (!response.ok) throw new Error('Failed to reject device');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-devices'] });
        }
    });

    return {
        attendanceQuery,
        assignmentsQuery,
        devicesQuery,
        networksQuery,
        detectedIpQuery,
        assignShiftMutation,
        removeAssignmentMutation,
        correctAttendanceMutation,
        addNetworkMutation,
        removeNetworkMutation,
        approveDeviceMutation,
        rejectDeviceMutation
    };
};

export interface LatenessSummaryItem {
    id: string;
    full_name: string;
    department: string;
    avatar_url?: string;
    today_late: string | number;
    week_late: string | number;
    month_late: string | number;
}

export const useLatenessSummary = (date?: string, userId?: string) => {
    const { isAuthenticated } = useAuth();
    return useQuery<LatenessSummaryItem[]>({
        queryKey: ['lateness-summary', date, userId],
        queryFn: async () => {
            const queryDate = date || new Date().toISOString().split('T')[0];
            let url = `${API_BASE_URL}/attendance/late-summary?date=${queryDate}`;
            if (userId) {
                url += `&userId=${userId}`;
            }
            const response = await fetch(url, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch lateness summary');
            return response.json();
        },
        enabled: isAuthenticated,
    });
};


export const useAbsenceThresholds = () => {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery<AbsenceThresholds>({
        queryKey: ['absence-thresholds'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/attendance/absence-thresholds`, {
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch absence thresholds');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const updateMutation = useMutation({
        mutationFn: async (dto: AbsenceThresholds) => {
            const response = await fetch(`${API_BASE_URL}/attendance/absence-thresholds`, {
                method: 'PUT',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(dto),
            });
            if (!response.ok) throw new Error('Failed to update absence thresholds');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['absence-thresholds'] });
        },
    });

    return {
        thresholds: query.data,
        isLoading: query.isLoading,
        error: query.error,
        updateThresholds: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
    };
};

export const useBatchAttendanceStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            record_ids,
            status,
            remarks,
        }: {
            record_ids: string[];
            status: 'Present' | 'Absent' | 'Excused';
            remarks?: string;
        }) => {
            const response = await fetch(`${API_BASE_URL}/attendance/records/batch-status`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ record_ids, status, remarks }),
            });
            if (!response.ok) throw new Error('Failed to batch update attendance status');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
            queryClient.invalidateQueries({ queryKey: ['lateness-summary'] });
        },
    });
};
