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

// ========== SHARED INTERFACES ==========
export interface Role {
    id: string;
    name: string;
}

export interface Category {
    id: string;
    name: string;
}

export interface CommunicationUser {
    id: string;
    full_name: string;
    email: string;
    department?: string;
}

// ========== ANNOUNCEMENTS ==========
export interface Announcement {
    id: string;
    title: string;
    content: string;
    priority: string;
    target_type: string;
    target_ids: string[];
    created_by_name: string;
    created_at: string;
}

export interface AnnouncementFormData {
    title: string;
    content: string;
    priority: string;
    target_type: string;
    target_ids: string[];
}

export function useAnnouncements() {
    const queryClient = useQueryClient();

    const announcementsQuery = useQuery<Announcement[]>({
        queryKey: ['announcements'],
        queryFn: () => fetcher<Announcement[]>(`${API_BASE_URL}/announcements`),
    });

    const rolesQuery = useQuery<Role[]>({
        queryKey: ['roles'],
        queryFn: () => fetcher<Role[]>(`${API_BASE_URL}/roles`),
    });

    const categoriesQuery = useQuery<Category[]>({
        queryKey: ['employee-categories'],
        queryFn: () => fetcher<Category[]>(`${API_BASE_URL}/employee-categories`),
    });

    const usersQuery = useQuery<CommunicationUser[]>({
        queryKey: ['users'],
        queryFn: () => fetcher<CommunicationUser[]>(`${API_BASE_URL}/users`),
    });

    const createMutation = useMutation({
        mutationFn: async (data: AnnouncementFormData) => {
            const res = await fetch(`${API_BASE_URL}/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create announcement');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            toast.success('Announcement created');
        },
        onError: () => toast.error('Failed to create announcement'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: AnnouncementFormData }) => {
            const res = await fetch(`${API_BASE_URL}/announcements/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update announcement');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            toast.success('Announcement updated');
        },
        onError: () => toast.error('Failed to update announcement'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/announcements/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete announcement');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            toast.success('Announcement deleted');
        },
        onError: () => toast.error('Failed to delete announcement'),
    });

    return {
        announcementsQuery,
        rolesQuery,
        categoriesQuery,
        usersQuery,
        createMutation,
        updateMutation,
        deleteMutation,
    };
}

// ========== EVENTS ==========
export interface Event {
    id: string;
    title: string;
    content?: string;
    event_date: string;
    event_time?: string;
    location?: string;
    target_type: string;
    target_ids: string[];
    created_by_name: string;
    created_at: string;
}

export interface EventFormData {
    title: string;
    content: string;
    event_date: string;
    event_time: string;
    location: string;
    target_type: string;
    target_ids: string[];
}

export function useEvents() {
    const queryClient = useQueryClient();

    const eventsQuery = useQuery<Event[]>({
        queryKey: ['events'],
        queryFn: () => fetcher<Event[]>(`${API_BASE_URL}/events`),
    });

    const rolesQuery = useQuery<Role[]>({
        queryKey: ['roles'],
        queryFn: () => fetcher<Role[]>(`${API_BASE_URL}/roles`),
    });

    const categoriesQuery = useQuery<Category[]>({
        queryKey: ['employee-categories'],
        queryFn: () => fetcher<Category[]>(`${API_BASE_URL}/employee-categories`),
    });

    const usersQuery = useQuery<CommunicationUser[]>({
        queryKey: ['users'],
        queryFn: () => fetcher<CommunicationUser[]>(`${API_BASE_URL}/users`),
    });

    const createMutation = useMutation({
        mutationFn: async (data: EventFormData) => {
            const res = await fetch(`${API_BASE_URL}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast.success('Event created');
        },
        onError: () => toast.error('Failed to create event'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: EventFormData }) => {
            const res = await fetch(`${API_BASE_URL}/events/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast.success('Event updated');
        },
        onError: () => toast.error('Failed to update event'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/events/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast.success('Event deleted');
        },
        onError: () => toast.error('Failed to delete event'),
    });

    return {
        eventsQuery,
        rolesQuery,
        categoriesQuery,
        usersQuery,
        createMutation,
        updateMutation,
        deleteMutation,
    };
}
