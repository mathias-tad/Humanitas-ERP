import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { format } from "date-fns";

async function fetcher(url: string) {
    const res = await fetch(url, {
        credentials: 'include',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error('Network response was not ok');
    }
    return res.json();
}

// --- HOOKS ---

export interface Shift {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
    is_active: boolean;
    grace_minutes: number;
}

export interface RotationWeek {
    id?: string;
    week_number: number;
    shift_id: string;
}

export interface Pattern {
    id: string;
    name: string;
    rotation_type: "fixed" | "weekly" | "bi-weekly" | "custom";
    auto_rotate: boolean;
    rotation_weeks: RotationWeek[];
}

export function useShifts() {
    return useQuery<Shift[]>({
        queryKey: ['shifts'],
        queryFn: () => fetcher(`${API_BASE_URL}/attendance/shifts`),
    });
}

function mapBackendPatternToUi(data: any[]): Pattern[] {
    return data.map((p: any) => {
        const weeksCount = Math.ceil(p.cycle_length_days / 7);
        const weeks: RotationWeek[] = [];

        for (let i = 0; i < weeksCount; i++) {
            const shiftCounts: { [key: string]: number } = {};

            // Analyze days in this week (i*7 + 1 to i*7 + 7)
            const startDay = (i * 7) + 1;
            const endDay = startDay + 6;
            const weekShifts = p.shifts.filter((s: any) => s.day_number >= startDay && s.day_number <= endDay);

            weekShifts.forEach((s: any) => {
                if (s.shift_id) {
                    shiftCounts[s.shift_id] = (shiftCounts[s.shift_id] || 0) + 1;
                }
            });

            // Find majority shift
            const majorityShiftId = Object.keys(shiftCounts).reduce((a, b) => shiftCounts[a] > shiftCounts[b] ? a : b, "");

            weeks.push({
                week_number: i + 1,
                shift_id: majorityShiftId
            });
        }

        return {
            id: p.id,
            name: p.name,
            rotation_type: (p.description as any) || (weeksCount > 1 ? "weekly" : "fixed"),
            auto_rotate: true,
            rotation_weeks: weeks
        };
    });
}

export function usePatterns() {
    return useQuery<Pattern[]>({
        queryKey: ['patterns'],
        queryFn: async () => {
            const data = await fetcher(`${API_BASE_URL}/attendance/patterns`);
            return mapBackendPatternToUi(data);
        }
    });
}

export function useUserSchedule(userId: string, start: Date, end: Date, enabled = true) {
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    return useQuery({
        queryKey: ['user-schedule', userId, startStr, endStr],
        queryFn: () => fetcher(`${API_BASE_URL}/attendance/user-schedule/${userId}?startDate=${startStr}&endDate=${endStr}`),
        enabled: enabled && !!userId,
    });
}

// Prefetching Hook
export function usePrefetchScheduling() {
    const queryClient = useQueryClient();

    const prefetch = async () => {
        // Prefetch Shifts
        await queryClient.prefetchQuery({
            queryKey: ['shifts'],
            queryFn: () => fetcher(`${API_BASE_URL}/attendance/shifts`),
            staleTime: 10 * 60 * 1000, // 10 mins
        });

        // Prefetch Patterns
        await queryClient.prefetchQuery({
            queryKey: ['patterns'],
            queryFn: () => fetcher(`${API_BASE_URL}/attendance/patterns`),
            staleTime: 10 * 60 * 1000,
        });

        // We can't prefetch schedules easily without a date range or user ID, 
        // but we can prefetch 'users' here if we import the fetcher logic from useUsers
    };

    return prefetch;
}

// Audit Logs
export interface SchedulingAuditLog {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    action: string;
    target_id: string;
    details: any;
    created_at: string;
}

interface AuditLogsResponse {
    data: SchedulingAuditLog[];
    meta: { totalPages: number; currentPage: number; total: number };
}

export function useSchedulingAuditLogs(page: number, searchQuery: string) {
    return useQuery<AuditLogsResponse>({
        queryKey: ['scheduling-audit-logs', page, searchQuery],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/attendance/scheduling-audit-logs?page=${page}&limit=10&search=${searchQuery}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error('Failed to fetch logs');
            return res.json();
        },
    });
}

