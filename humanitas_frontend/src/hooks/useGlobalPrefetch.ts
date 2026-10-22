import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        credentials: 'include',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        }
    });
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
}

/**
 * Global prefetch hook that preloads critical data for navigation performance.
 * Call this once in the Layout component after authentication.
 * 
 * When a component mounts that needs this data, TanStack Query will:
 * 1. Return cached data immediately if prefetch completed
 * 2. Wait for prefetch to complete if still in progress
 * 3. Fetch fresh data if staleTime has passed
 */
export function useGlobalPrefetch() {
    const queryClient = useQueryClient();

    const prefetchAll = useCallback(async () => {
        const staleTime = 60 * 1000; // 1 minute (60s)

        // === USERS & ROLES ===
        await queryClient.prefetchQuery({
            queryKey: ['users'],
            queryFn: () => fetcher(`${API_BASE_URL}/users`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['roles'],
            queryFn: () => fetcher(`${API_BASE_URL}/roles`),
            staleTime,
        });

        // === SCHEDULING ===
        await queryClient.prefetchQuery({
            queryKey: ['shifts'],
            queryFn: () => fetcher(`${API_BASE_URL}/attendance/shifts`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['patterns'],
            queryFn: () => fetcher(`${API_BASE_URL}/attendance/patterns`),
            staleTime,
        });

        // === SETTINGS ===
        await queryClient.prefetchQuery({
            queryKey: ['settings-general'],
            queryFn: () => fetcher(`${API_BASE_URL}/settings/general`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['settings-company'],
            queryFn: () => fetcher(`${API_BASE_URL}/settings/company`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['settings-hr'],
            queryFn: () => fetcher(`${API_BASE_URL}/settings/hr`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['departments'],
            queryFn: () => fetcher(`${API_BASE_URL}/settings/departments`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['timezones'],
            queryFn: () => fetcher(`${API_BASE_URL}/settings/timezones`),
            staleTime,
        });

        // === PAYROLL ===
        await queryClient.prefetchQuery({
            queryKey: ['payroll-settings'],
            queryFn: () => fetcher(`${API_BASE_URL}/settings/hr`),
            staleTime,
        });

        await queryClient.prefetchQuery({
            queryKey: ['payroll-history'],
            queryFn: () => fetcher(`${API_BASE_URL}/payroll/history`),
            staleTime,
        });
    }, [queryClient]);

    return prefetchAll;
}
