import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";
import { getAuthHeaders } from "@/context/AuthContext";

export const ProjectStatus = {
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
} as const;
export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export const ProjectPriority = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
} as const;
export type ProjectPriority = typeof ProjectPriority[keyof typeof ProjectPriority];

export const TaskStatus = {
    BACKLOG: 'Backlog',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    BLOCKED: 'Blocked',
    DONE: 'Done',
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export interface Project {
    id: string;
    name: string;
    description?: string;
    status: ProjectStatus;
    priority: ProjectPriority;
    visibility?: 'public' | 'private';
    start_date?: string;
    target_end_date?: string;
    actual_end_date?: string;
    budget?: number;
    actual_cost?: number;
    currency: string;
    manager?: { id: string; full_name: string; email: string };
    creator?: { id: string; full_name: string; email: string };
    members?: { user: { id: string; full_name: string; email: string }; role: string; can_create_tasks: boolean }[];
    team_id?: string;
    team?: { id: string; name: string; leader_id: string };
    created_at: string;
}

export interface PMSUser {
    id: string;
    full_name: string;
    email: string;
    role?: string;
    status?: string;
    department?: string;
    position?: string;
    tenant_id?: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: ProjectPriority;
    project_id: string;
    assignee_id?: string;
    sprint_id?: string;
    estimated_hours?: number;
    actual_hours?: number;
    story_points?: number;
    backlog_order?: number;
    is_milestone?: boolean;
    due_date?: string;
    start_date?: string;
    project?: Project;
    assignee?: PMSUser;
    reporter_id: string;
    reporter?: PMSUser;
    reviewer_id?: string;
    reviewer?: PMSUser;
    status_changed_at?: string;
    status_changed_by?: string;
    blocker_category?: string;
    return_comment?: string;

    tenant_id: string;
    created_at: string;
    completed_at?: string;
}

export interface SprintBurndown {
    sprint: {
        id: string;
        name: string;
        start_date: string;
        end_date: string;
        status: string;
    };
    total_story_points: number;
    completed_points: number;
    remaining_points: number;
    dates: string[];
    ideal_burndown: number[];
    actual_burndown: number[];
}

export interface SprintVelocityItem {
    sprint_id: string;
    sprint_name: string;
    start_date: string;
    end_date: string;
    status: string;
    committed_points: number;
    completed_points: number;
    velocity_percentage: number;
}

export interface SprintVelocity {
    project_id: string;
    sprints: SprintVelocityItem[];
    average_velocity: number;
}

export interface GanttTask {
    id: string;
    title: string;
    start_date: string;
    due_date: string;
    status: TaskStatus;
    priority: ProjectPriority;
    progress: number;
    is_milestone: boolean;
    story_points: number;
    parent_task_id?: string;
    sprint_id?: string;
    assignee?: { id: string; name: string } | null;
}

export interface GanttData {
    project: {
        id: string;
        name: string;
        start_date?: string;
        target_end_date?: string;
        status: ProjectStatus;
    };
    sprints: {
        id: string;
        name: string;
        start_date: string;
        end_date: string;
        status: string;
    }[];
    tasks: GanttTask[];
    milestones: GanttTask[];
}

export interface ProjectCalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    type: 'sprint' | 'task' | 'milestone';
    status?: string;
    priority?: string;
    is_milestone?: boolean;
    entity_id: string;
    assignee_name?: string | null;
}

export interface TimeTrackingMemberSummary {
    user_id: string;
    user_name: string;
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    billable_amount: number;
}

export interface TimeTrackingTaskSummary {
    task_id: string;
    task_title: string;
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    billable_amount: number;
}

export interface TimeTrackingSummary {
    project_id: string;
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    billable_percentage: number;
    total_billable_amount: number;
    by_member: TimeTrackingMemberSummary[];
    by_task: TimeTrackingTaskSummary[];
}



export interface Sprint {
    id: string;
    name: string;
    goal?: string;
    start_date: string;
    end_date: string;
    status: string;
}

export interface Team {
    id: string;
    name: string;
    description?: string;
    leader_id?: string;
    leader?: PMSUser;
    members?: { user: PMSUser; role: string; joined_at: string }[];
    created_at: string;
}

export interface TeamDashboard {
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    blocked_tasks: number;
    completion_rate: number;
}

export interface PMSSettings {
    enable_budget_tracking: boolean;
    enable_hr_integration: boolean;
    enable_payroll_integration: boolean;
    enable_time_tracking: boolean;
    default_task_time_estimate: number;
    kpi_include_completion_rate: boolean;
    kpi_include_on_time_rate: boolean;
    kpi_include_avg_duration: boolean;
    kpi_include_overdue_count: boolean;
    kpi_weight_system?: number;
    kpi_weight_manual?: number;
}

export interface ManualKPIMetric {
    id: string;
    name: string;
    description?: string;
    max_score: number;
    weight: number;
    is_active: boolean;
}

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        credentials: 'include',
        headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch data');
    const data = await res.json();
    return data.data || data;
}

export function usePMS() {
    const queryClient = useQueryClient();

    // ============ QUERIES ============

    const useProjects = () => useQuery<Project[]>({
        queryKey: ['pms-projects'],
        queryFn: () => fetcher<Project[]>(`${API_BASE_URL}/pms/projects`),
    });

    const useProject = (id: string, enabled: boolean = true) => useQuery<Project>({
        queryKey: ['pms-project', id],
        queryFn: () => fetcher<Project>(`${API_BASE_URL}/pms/projects/${id}`),
        enabled: !!id && enabled,
    });

    const useTasks = (filters: any) => useQuery<Task[]>({
        queryKey: ['pms-tasks', filters],
        queryFn: async () => {
            const params = new URLSearchParams(filters);
            return fetcher<Task[]>(`${API_BASE_URL}/pms/tasks?${params.toString()}`);
        },
    });

    const useTask = (id: string, enabled: boolean = true) => useQuery<Task>({
        queryKey: ['pms-task', id],
        queryFn: () => fetcher<Task>(`${API_BASE_URL}/pms/tasks/${id}`),
        enabled: !!id && enabled,
    });

    const useSprints = (projectId: string) => useQuery<Sprint[]>({
        queryKey: ['pms-sprints', projectId],
        queryFn: () => fetcher<Sprint[]>(`${API_BASE_URL}/pms/sprints?projectId=${projectId}`),
        enabled: !!projectId,
    });

    const usePMSSettings = () => useQuery<PMSSettings>({
        queryKey: ['pms-settings'],
        queryFn: () => fetcher<PMSSettings>(`${API_BASE_URL}/pms/settings`),
    });

    const useThemeSettings = () => useQuery<any>({
        queryKey: ['theme-settings'],
        queryFn: () => fetcher<any>(`${API_BASE_URL}/settings/theme`),
        retry: false,
    });

    const useProjectKPIs = (id: string) => useQuery<any>({
        queryKey: ['pms-project-kpi', id],
        queryFn: () => fetcher<any>(`${API_BASE_URL}/pms/projects/${id}/kpi`),
        enabled: !!id,
    });

    const useUserKPIs = (tenantId: string, userId: string) => useQuery<any>({
        queryKey: ['pms-user-kpi', tenantId, userId],
        queryFn: () => fetcher<any>(`${API_BASE_URL}/pms/kpi/user/${userId}`),
        enabled: !!userId && !!tenantId,
    });

    const useTenantKPIs = (tenantId: string) => useQuery<any>({
        queryKey: ['pms-tenant-kpi', tenantId],
        queryFn: () => fetcher<any>(`${API_BASE_URL}/pms/kpi/tenant/${tenantId}`),
        enabled: !!tenantId,
    });

    const useAllUsersKPIs = () => useQuery<any[]>({
        queryKey: ['pms-all-users-kpi'],
        queryFn: () => fetcher<any[]>(`${API_BASE_URL}/pms/kpi/all-users`),
    });

    const useUsers = () => useQuery<PMSUser[]>({
        queryKey: ['pms-users'],
        queryFn: () => fetcher<PMSUser[]>(`${API_BASE_URL}/users`),
    });

    const useCurrentUser = () => useQuery<PMSUser>({
        queryKey: ['current-user'],
        queryFn: () => fetcher<PMSUser>(`${API_BASE_URL}/auth/me`), // Assuming this endpoint exists, or /users/me
        retry: false,
    });

    const useSprintBurndown = (sprintId?: string) => useQuery<SprintBurndown>({
        queryKey: ['pms-sprint-burndown', sprintId],
        queryFn: () => fetcher<SprintBurndown>(`${API_BASE_URL}/pms/sprints/${sprintId}/burndown`),
        enabled: !!sprintId,
    });

    const useSprintVelocity = (projectId?: string) => useQuery<SprintVelocity>({
        queryKey: ['pms-sprint-velocity', projectId],
        queryFn: () => fetcher<SprintVelocity>(`${API_BASE_URL}/pms/projects/${projectId}/velocity`),
        enabled: !!projectId,
    });

    const useProjectBacklog = (projectId?: string) => useQuery<Task[]>({
        queryKey: ['pms-project-backlog', projectId],
        queryFn: () => fetcher<Task[]>(`${API_BASE_URL}/pms/projects/${projectId}/backlog`),
        enabled: !!projectId,
    });

    const useProjectGantt = (projectId?: string) => useQuery<GanttData>({
        queryKey: ['pms-project-gantt', projectId],
        queryFn: () => fetcher<GanttData>(`${API_BASE_URL}/pms/projects/${projectId}/gantt`),
        enabled: !!projectId,
    });

    const useProjectCalendar = (projectId?: string) => useQuery<ProjectCalendarEvent[]>({
        queryKey: ['pms-project-calendar', projectId],
        queryFn: () => fetcher<ProjectCalendarEvent[]>(`${API_BASE_URL}/pms/projects/${projectId}/calendar`),
        enabled: !!projectId,
    });

    const useTimeTrackingSummary = (projectId?: string) => useQuery<TimeTrackingSummary>({
        queryKey: ['pms-time-summary', projectId],
        queryFn: () => fetcher<TimeTrackingSummary>(`${API_BASE_URL}/pms/projects/${projectId}/time-summary`),
        enabled: !!projectId,
    });

    // ============ MUTATIONS ============

    const createProject = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/pms/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create project');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-projects'] });
            toast.success('Project created');
        },
        onError: () => toast.error('Failed to create project'),
    });

    const updateProject = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/pms/projects/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update project');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-projects'] });
            queryClient.invalidateQueries({ queryKey: ['pms-project', variables.id] });
            toast.success('Project updated');
        },
        onError: () => toast.error('Failed to update project'),
    });

    const deleteProject = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/pms/projects/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete project');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-projects'] });
            toast.success('Project deleted');
        },
        onError: () => toast.error('Failed to delete project'),
    });

    const createTask = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/pms/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create task');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-tasks'] });
            toast.success('Task created');
        },
        onError: () => toast.error('Failed to create task'),
    });

    const updateTask = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/pms/tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update task');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['pms-task', variables.id] });
            toast.success('Task updated');
        },
        onError: () => toast.error('Failed to update task'),
    });

    const deleteTask = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/pms/tasks/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete task');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-tasks'] });
            toast.success('Task deleted');
        },
        onError: () => toast.error('Failed to delete task'),
    });

    const createSprint = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/pms/sprints`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create sprint');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-sprints', variables.project_id] });
            toast.success('Sprint created');
        },
        onError: () => toast.error('Failed to create sprint'),
    });

    const updateSettings = useMutation({
        mutationFn: async (data: PMSSettings) => {
            const res = await fetch(`${API_BASE_URL}/pms/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update settings');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-settings'] });
            toast.success('Settings updated');
        },
        onError: () => toast.error('Failed to update settings'),
    });

    const updateTheme = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/settings/theme`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update theme');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['theme-settings'] });
            toast.success('Theme updated');
        },
        onError: () => toast.error('Failed to update theme'),
    });

    const createUser = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create user');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-users'] });
            toast.success('User created');
        },
        onError: () => toast.error('Failed to create user'),
    });

    const updateUser = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update user');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-users'] });
            toast.success('User updated');
        },
        onError: () => toast.error('Failed to update user'),
    });

    // ============ TEAMS ============
    const useTeams = () => useQuery<Team[]>({
        queryKey: ['pms-teams'],
        queryFn: () => fetcher<Team[]>(`${API_BASE_URL}/pms/teams`),
    });

    const useTeam = (id: string, enabled: boolean = true) => useQuery<Team>({
        queryKey: ['pms-team', id],
        queryFn: () => fetcher<Team>(`${API_BASE_URL}/pms/teams/${id}`),
        enabled: !!id && enabled,
    });

    const useTeamDashboard = (id: string, enabled: boolean = true) => useQuery<TeamDashboard>({
        queryKey: ['pms-team-dashboard', id],
        queryFn: () => fetcher<TeamDashboard>(`${API_BASE_URL}/pms/teams/${id}/dashboard`),
        enabled: !!id && enabled,
    });

    const createTeam = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/pms/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create team');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-teams'] });
            toast.success('Team created');
        },
        onError: () => toast.error('Failed to create team'),
    });

    const updateTeam = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/pms/teams/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update team');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-teams'] });
            queryClient.invalidateQueries({ queryKey: ['pms-team', variables.id] });
            toast.success('Team updated');
        },
        onError: () => toast.error('Failed to update team'),
    });

    const deleteTeam = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/pms/teams/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete team');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-teams'] });
            toast.success('Team deleted');
        },
        onError: () => toast.error('Failed to delete team'),
    });

    const addTeamMember = useMutation({
        mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
            const res = await fetch(`${API_BASE_URL}/pms/teams/${teamId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: userId }),
            });
            if (!res.ok) throw new Error('Failed to add member');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-team', variables.teamId] });
            toast.success('Member added');
        },
        onError: () => toast.error('Failed to add member'),
    });

    const removeTeamMember = useMutation({
        mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
            const res = await fetch(`${API_BASE_URL}/pms/teams/${teamId}/members/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to remove member');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-team', variables.teamId] });
            toast.success('Member removed');
        },
        onError: () => toast.error('Failed to remove member'),
    });

    // ============ MANUAL METRICS ============
    const useMetrics = () => useQuery<ManualKPIMetric[]>({
        queryKey: ['pms-metrics'],
        queryFn: () => fetcher<ManualKPIMetric[]>(`${API_BASE_URL}/pms/metrics`),
    });

    const createMetric = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/pms/metrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create metric');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-metrics'] });
            toast.success('Metric created');
        },
        onError: () => toast.error('Failed to create metric'),
    });

    const updateMetric = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/pms/metrics/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update metric');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-metrics'] });
            toast.success('Metric updated');
        },
        onError: () => toast.error('Failed to update metric'),
    });

    const deleteMetric = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/pms/metrics/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete metric');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pms-metrics'] });
            toast.success('Metric deleted');
        },
        onError: () => toast.error('Failed to delete metric'),
    });

    // ============ PROJECT MEMBERS ============
    const addProjectMember = useMutation({
        mutationFn: async ({ projectId, userId, data }: { projectId: string; userId: string; data?: any }) => {
            // Support passing role/can_create_tasks via data
            const payload = { user_id: userId, ...data };
            const res = await fetch(`${API_BASE_URL}/pms/projects/${projectId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to add member');
            }
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-project', variables.projectId] });
            toast.success('Member added');
        },
        onError: (err: any) => toast.error(err.message || 'Failed to add member'),
    });

    const updateProjectMember = useMutation({
        mutationFn: async ({ projectId, userId, data }: { projectId: string; userId: string; data: any }) => {
            const res = await fetch(`${API_BASE_URL}/pms/projects/${projectId}/members/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update member');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-project', variables.projectId] });
            toast.success('Member updated');
        },
        onError: () => toast.error('Failed to update member'),
    });

    const removeProjectMember = useMutation({
        mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
            const res = await fetch(`${API_BASE_URL}/pms/projects/${projectId}/members/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to remove member');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-project', variables.projectId] });
            toast.success('Member removed');
        },
        onError: () => toast.error('Failed to remove member'),
    });

    const updateBacklogOrder = useMutation({
        mutationFn: async ({ taskIds }: { taskIds: string[]; projectId: string }) => {
            const res = await fetch(`${API_BASE_URL}/pms/tasks/backlog-order`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                credentials: 'include',
                body: JSON.stringify({ task_ids: taskIds }),
            });
            if (!res.ok) throw new Error('Failed to update backlog order');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-project-backlog', variables.projectId] });
            queryClient.invalidateQueries({ queryKey: ['pms-tasks'] });
            toast.success('Backlog order updated');
        },
        onError: () => toast.error('Failed to reorder backlog'),
    });

    const assignTaskToSprint = useMutation({
        mutationFn: async ({ taskId, sprintId }: { taskId: string; sprintId: string | null; projectId: string }) => {
            const res = await fetch(`${API_BASE_URL}/pms/tasks/${taskId}/assign-sprint`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                credentials: 'include',
                body: JSON.stringify({ sprint_id: sprintId }),
            });
            if (!res.ok) throw new Error('Failed to assign task to sprint');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pms-project-backlog', variables.projectId] });
            queryClient.invalidateQueries({ queryKey: ['pms-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['pms-sprints', variables.projectId] });
            toast.success(variables.sprintId ? 'Task assigned to sprint' : 'Task moved to backlog');
        },
        onError: () => toast.error('Failed to assign task to sprint'),
    });

    return {
        // Queries
        useProjects,
        useProject,
        useTasks,
        useTask,
        useSprints,
        usePMSSettings,
        useProjectKPIs,
        useUserKPIs,
        useTenantKPIs,
        useAllUsersKPIs,
        useUsers,
        useCurrentUser,
        useTeams,
        useTeam,
        useTeamDashboard,
        useSprintBurndown,
        useSprintVelocity,
        useProjectBacklog,
        useProjectGantt,
        useProjectCalendar,
        useTimeTrackingSummary,
        // Mutations
        createProject,
        updateProject,
        deleteProject,
        createTask,
        updateTask,
        deleteTask,
        createSprint,
        updateSettings,
        useThemeSettings,
        updateTheme,
        createUser,
        updateUser,
        createTeam,
        updateTeam,
        deleteTeam,
        addTeamMember,
        removeTeamMember,
        updateBacklogOrder,
        assignTaskToSprint,
        // Manual Metrics
        useMetrics,
        createMetric,
        updateMetric,
        deleteMetric,
        // Project Members
        addProjectMember,
        removeProjectMember,
        updateProjectMember,
    };
}
