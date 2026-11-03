import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";
import { getAuthHeaders } from "@/context/AuthContext";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch data");
  const data = await res.json();
  return data.data || data;
}

export type EventCategory = 'common' | 'workforce' | 'projects' | 'commercial' | 'financial';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: string;
  moduleKey: string;
  category: EventCategory;
  eventType: string;
  color: string;
  location?: string;
  sourceId?: string;
  routeUrl?: string;
  status?: string;
  priority?: string;
  isPublic?: boolean;
  createdBy?: string;
  createdByName?: string;
}

export interface CalendarSource {
  id: string;
  label: string;
  category: EventCategory;
  color: string;
  enabled: boolean;
  isCommon: boolean;
}

export interface CreateCalendarEventDto {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  event_type?: string;
  color?: string;
  location?: string;
  recurrence_rule?: string;
  is_public?: boolean;
}

export interface UpdateCalendarEventDto {
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  all_day?: boolean;
  event_type?: string;
  color?: string;
  location?: string;
  recurrence_rule?: string;
  is_public?: boolean;
}

export function useCalendar(start?: string, end?: string, sources?: string[]) {
  const queryClient = useQueryClient();

  const activeCompanyId = localStorage.getItem("active_company_id") || "";
  const activeBranchId = localStorage.getItem("active_branch_id") || "";

  const sourcesQuery = useQuery<CalendarSource[]>({
    queryKey: ["calendarSources", activeCompanyId, activeBranchId],
    queryFn: () => fetcher<CalendarSource[]>(`${API_BASE_URL}/calendar/sources`),
  });

  const queryParams = new URLSearchParams();
  if (start) queryParams.append("start", start);
  if (end) queryParams.append("end", end);
  if (sources && sources.length > 0) {
    sources.forEach((s) => queryParams.append("sources[]", s));
  }

  const eventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ["calendarEvents", start, end, sources?.join(","), activeCompanyId, activeBranchId],
    queryFn: () =>
      fetcher<CalendarEvent[]>(
        `${API_BASE_URL}/calendar/events?${queryParams.toString()}`
      ),
  });

  const createEventMutation = useMutation({
    mutationFn: async (dto: CreateCalendarEventDto) => {
      const res = await fetch(`${API_BASE_URL}/calendar/events`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create event");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Event created successfully");
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create event");
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateCalendarEventDto }) => {
      const res = await fetch(`${API_BASE_URL}/calendar/events/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update event");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Event updated successfully");
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update event");
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/calendar/events/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete event");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Event deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete event");
    },
  });

  return {
    sources: sourcesQuery.data || [],
    isLoadingSources: sourcesQuery.isLoading,
    events: eventsQuery.data || [],
    isLoadingEvents: eventsQuery.isLoading,
    isRefetchingEvents: eventsQuery.isRefetching,
    refetchEvents: eventsQuery.refetch,
    createEvent: createEventMutation.mutateAsync,
    isCreating: createEventMutation.isPending,
    updateEvent: updateEventMutation.mutateAsync,
    isUpdating: updateEventMutation.isPending,
    deleteEvent: deleteEventMutation.mutateAsync,
    isDeleting: deleteEventMutation.isPending,
  };
}
