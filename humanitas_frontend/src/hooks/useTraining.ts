import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';

export interface TrainingCourse {
  id: string;
  title: string;
  category: string;
  description?: string;
  prerequisites?: string;
  delivery_method: 'online' | 'in_person' | 'blended';
  duration_hours: number;
  capacity_limit: number;
  is_mandatory: boolean;
  passing_score: number;
  provider_name?: string;
  cost_per_learner: number;
  is_active: boolean;
  total_enrolled?: number;
  total_completed?: number;
  sessions?: TrainingSession[];
  created_at?: string;
}

export interface TrainingSession {
  id: string;
  course_id: string;
  course_title?: string;
  course_category?: string;
  instructor_name?: string;
  venue_or_link?: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  enrolled_count?: number;
  created_at?: string;
}

export interface TrainingEnrollment {
  id: string;
  course_id: string;
  session_id?: string;
  course_title?: string;
  course_category?: string;
  duration_hours?: number;
  is_mandatory?: boolean;
  passing_score?: number;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_department?: string;
  status: 'nominated' | 'waitlisted' | 'confirmed' | 'attended' | 'completed' | 'failed' | 'cancelled';
  completion_percentage: number;
  score?: number;
  attendance_confirmed: boolean;
  certificate_issued: boolean;
  completion_date?: string;
  expiry_date?: string;
  created_at?: string;
}

export interface EmployeeSkill {
  id: string;
  user_id: string;
  user_name?: string;
  user_department?: string;
  skill_name: string;
  category: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
}

export interface TrainingStats {
  total_courses: number;
  mandatory_courses: number;
  total_enrollments: number;
  completed_enrollments: number;
  active_enrollments: number;
  waitlisted_enrollments: number;
  completion_rate: number;
  compliance_rate: number;
  average_score: number;
  total_skills_logged: number;
  verified_skills: number;
  employees_with_skills: number;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch learning data');
  }
  const data = await res.json();
  return data.data || data;
}

// ── QUERIES ─────────────────────────────────────────────────────────────────

export function useCourses(filters?: { category?: string; delivery_method?: string; is_mandatory?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.delivery_method) params.append('delivery_method', filters.delivery_method);
  if (filters?.is_mandatory !== undefined) params.append('is_mandatory', String(filters.is_mandatory));

  const url = `${API_BASE_URL}/hrms/training/courses${params.toString() ? `?${params.toString()}` : ''}`;
  return useQuery<TrainingCourse[], Error>({
    queryKey: ['training_courses', filters],
    queryFn: () => fetcher<TrainingCourse[]>(url),
  });
}

export function useCourse(id: string) {
  return useQuery<TrainingCourse, Error>({
    queryKey: ['training_course', id],
    queryFn: () => fetcher<TrainingCourse>(`${API_BASE_URL}/hrms/training/courses/${id}`),
    enabled: !!id,
  });
}

export function useSessions(courseId?: string) {
  const url = courseId
    ? `${API_BASE_URL}/hrms/training/sessions?course_id=${courseId}`
    : `${API_BASE_URL}/hrms/training/sessions`;
  return useQuery<TrainingSession[], Error>({
    queryKey: ['training_sessions', courseId],
    queryFn: () => fetcher<TrainingSession[]>(url),
  });
}

export function useEnrollments(filters?: { course_id?: string; user_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.course_id) params.append('course_id', filters.course_id);
  if (filters?.user_id) params.append('user_id', filters.user_id);
  if (filters?.status) params.append('status', filters.status);

  const url = `${API_BASE_URL}/hrms/training/enrollments${params.toString() ? `?${params.toString()}` : ''}`;
  return useQuery<TrainingEnrollment[], Error>({
    queryKey: ['training_enrollments', filters],
    queryFn: () => fetcher<TrainingEnrollment[]>(url),
  });
}

export function useMyEnrollments() {
  return useQuery<TrainingEnrollment[], Error>({
    queryKey: ['my_training_enrollments'],
    queryFn: () => fetcher<TrainingEnrollment[]>(`${API_BASE_URL}/hrms/training/my-enrollments`),
  });
}

export function useEmployeeSkills(userId?: string) {
  const url = userId
    ? `${API_BASE_URL}/hrms/training/skills?user_id=${userId}`
    : `${API_BASE_URL}/hrms/training/skills`;
  return useQuery<EmployeeSkill[], Error>({
    queryKey: ['employee_skills', userId],
    queryFn: () => fetcher<EmployeeSkill[]>(url),
  });
}

export function useTrainingStats() {
  return useQuery<TrainingStats, Error>({
    queryKey: ['training_stats'],
    queryFn: () => fetcher<TrainingStats>(`${API_BASE_URL}/hrms/training/stats`),
  });
}

// ── MUTATIONS ───────────────────────────────────────────────────────────────

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TrainingCourse>) => {
      const res = await fetch(`${API_BASE_URL}/hrms/training/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create training course');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training_courses'] });
      queryClient.invalidateQueries({ queryKey: ['training_stats'] });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TrainingCourse> }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/training/courses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update training course');
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['training_courses'] });
      queryClient.invalidateQueries({ queryKey: ['training_course', id] });
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TrainingSession>) => {
      const res = await fetch(`${API_BASE_URL}/hrms/training/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to schedule session');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['training_courses'] });
    },
  });
}

export function useEnrollLearner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { course_id: string; session_id?: string; user_id?: string }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/training/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to enroll learner');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training_enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my_training_enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['training_courses'] });
      queryClient.invalidateQueries({ queryKey: ['training_stats'] });
    },
  });
}

export function useUpdateEnrollmentProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TrainingEnrollment>;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/training/enrollments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update progress');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training_enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my_training_enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['training_stats'] });
    },
  });
}

export function useUpsertEmployeeSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmployeeSkill>) => {
      const res = await fetch(`${API_BASE_URL}/hrms/training/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to log skill');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_skills'] });
      queryClient.invalidateQueries({ queryKey: ['training_stats'] });
    },
  });
}
