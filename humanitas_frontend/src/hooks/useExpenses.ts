import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';

export interface ExpenseCategory {
  id: string;
  company_id?: string;
  branch_id?: string;
  name: string;
  code: string;
  description?: string;
  spending_limit?: number;
  daily_per_diem_cap?: number;
  requires_receipt: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  report_id: string;
  category_id: string;
  expense_date: string;
  merchant_name?: string;
  description: string;
  amount: number;
  currency: string;
  receipt_url?: string;
  ocr_scanned: boolean;
  policy_violation: boolean;
  violation_note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  category_name?: string;
  category_code?: string;
}

export interface ExpenseReport {
  id: string;
  report_number: string;
  employee_id: string;
  company_id?: string;
  branch_id?: string;
  title: string;
  purpose?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'reimbursed';
  total_amount: number;
  approved_amount: number;
  currency: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  reimbursed_at?: string;
  include_in_payroll: boolean;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  department?: string;
  approver_first_name?: string;
  approver_last_name?: string;
  item_count?: number;
  violation_count?: number;
  items?: ExpenseItem[];
}

export interface ExpenseAnalytics {
  total_reports: number;
  approved_reports: number;
  pending_reports: number;
  reimbursed_reports: number;
  total_claimed: number;
  total_approved: number;
  policy_violations: number;
  category_spend: { name: string; spend: number }[];
  department_spend: { department: string; spend: number; count: number }[];
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

export function useExpenseCategories(companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories', companyId, branchId],
    queryFn: () => fetcher<ExpenseCategory[]>(`${API_BASE_URL}/hrms/expenses/categories${q}`),
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create expense category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}

export function useExpenseReports(employeeId?: string, status?: string, companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (employeeId) params.append('employeeId', employeeId);
  if (status) params.append('status', status);
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<ExpenseReport[]>({
    queryKey: ['expense-reports', employeeId, status, companyId, branchId],
    queryFn: () => fetcher<ExpenseReport[]>(`${API_BASE_URL}/hrms/expenses/reports${q}`),
  });
}

export function useMyExpenseReports() {
  return useQuery<ExpenseReport[]>({
    queryKey: ['my-expense-reports'],
    queryFn: () => fetcher<ExpenseReport[]>(`${API_BASE_URL}/hrms/expenses/my`),
  });
}

export function useExpenseReport(reportId: string) {
  return useQuery<ExpenseReport>({
    queryKey: ['expense-report', reportId],
    queryFn: () => fetcher<ExpenseReport>(`${API_BASE_URL}/hrms/expenses/reports/${reportId}`),
    enabled: !!reportId,
  });
}

export function useCreateExpenseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create expense report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useUpdateExpenseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, payload }: { reportId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update expense report');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-report', variables.reportId] });
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
    },
  });
}

export function useAddExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, payload }: { reportId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add expense item');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-report', variables.reportId] });
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useDeleteExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, itemId }: { reportId: string; itemId: string }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete expense item');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-report', variables.reportId] });
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useSubmitExpenseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit expense report');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useApproveExpenseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, payload }: { reportId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to approve expense report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useRejectExpenseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, reason }: { reportId: string; reason: string }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason }),
      });
      if (!res.ok) throw new Error('Failed to reject expense report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useMarkExpenseReimbursed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`${API_BASE_URL}/hrms/expenses/reports/${reportId}/reimburse`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to mark expense reimbursed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
    },
  });
}

export function useExpenseAnalytics(companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<ExpenseAnalytics>({
    queryKey: ['expense-analytics', companyId, branchId],
    queryFn: () => fetcher<ExpenseAnalytics>(`${API_BASE_URL}/hrms/expenses/analytics${q}`),
  });
}
