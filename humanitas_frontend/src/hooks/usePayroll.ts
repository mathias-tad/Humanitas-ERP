import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";

// Interfaces
export interface PayrollRun {
    id: string;
    month: number;
    year: number;
    status: "pending" | "processing" | "completed" | "failed";
    total_employees: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    run_at: string;
    completed_at: string | null;
}

export interface PayrollSettings {
    payroll_run_day: number;
    auto_payroll_enabled: boolean;
    late_penalty_per_minute: number;
    currency: string;
}

export interface PayrollSummary {
    employee_id: string;
    employee_name: string;
    department: string;
    basic_salary: number;
    days_worked: number;
    days_absent: number;
    late_minutes: number;
    late_deduction: number;
    other_deductions: number;
    allowances: number;
    gross_salary: number;
    total_deductions: number;
    net_salary: number;
}

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch data');
    const data = await res.json();
    return data.data || data;
}

export function usePayroll() {
    const queryClient = useQueryClient();

    // Query: Payroll Settings
    const settingsQuery = useQuery<PayrollSettings>({
        queryKey: ['payroll-settings'],
        queryFn: async () => {
            const data = await fetcher<any>(`${API_BASE_URL}/settings/hr`);
            return {
                payroll_run_day: data.payroll_run_day || 25,
                auto_payroll_enabled: data.auto_payroll_enabled || false,
                late_penalty_per_minute: data.late_penalty_per_minute || 0,
                currency: data.currency || "ETB",
            };
        },
    });

    // Query: Payroll History
    const historyQuery = useQuery<PayrollRun[]>({
        queryKey: ['payroll-history'],
        queryFn: () => fetcher<PayrollRun[]>(`${API_BASE_URL}/payroll/history`),
    });

    // Query: Active Payroll Job
    // Polls status for the current context (we need to know which month/year to poll, OR poll for ANY processing job)
    // Since the backend status endpoint requires month/year, we might need to pass params or make a new "latest status" endpoint.
    // For now, let's keep it simple and maybe NOT put it here if it depends on component state (month/year).
    // BUT OvertimeManagement uses a generic system log.

    // Alternative: The RunPayroll component tracks month/year. 
    // Let's create a specialized hook or just add the query capability here but driven by args.

    // Actually, to mirror OvertimeManagement correctly, the query needs to be enabled/disabled based on args.
    // See usePayroll below.

    const activeJobQuery = (month: number, year: number) => useQuery({
        queryKey: ['active-payroll-job', month, year],
        queryFn: async () => {
            // Add timestamp to prevent browser caching
            const url = `${API_BASE_URL}/payroll/status?month=${month}&year=${year}&_t=${Date.now()}`;

            const response = await fetch(url, {
                credentials: 'include',
            });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();

            // Return status data regardless of state so UI can react to completion etc.
            if (data.status) {
                return {
                    status: data.status,
                    id: data.payroll_run_id,
                    total_employees: data.total_employees,
                    message: data.message, // Capture error message
                    details: data.details
                };
            }
            return null;
        },
        refetchInterval: (query) => {
            // Poll frequently if processing, less frequently otherwise?
            // If completed, we might want to stop polling or poll slow?
            // Actually, if we are on the page, we probably want to see if status changes (e.g. someone else runs it).
            // But for "Run Payroll" flow, we care about the transition.

            const status = query.state.data?.status;
            if (status === 'processing' || status === 'pending' || status === 'not_found') return 1000;
            return 3000; // Moderate poll otherwise matched with user activity
        },
    });

    // Query: My Payslips
    const myPayslipsQuery = useQuery<any[]>({
        queryKey: ['my-payslips'],
        queryFn: () => fetcher<any[]>(`${API_BASE_URL}/payroll/my-payslips`),
    });

    const useMyPayslipDetail = (id: string, enabled: boolean = false) => useQuery({
        queryKey: ['my-payslip-detail', id],
        queryFn: () => fetcher<any>(`${API_BASE_URL}/payroll/my-payslips/${id}`),
        enabled: enabled && !!id,
    });

    // Mutation: Run Payroll
    const runPayrollMutation = useMutation({
        mutationFn: async ({ month, year }: { month: number; year: number }) => {
            const res = await fetch(`${API_BASE_URL}/payroll/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ month, year }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to run payroll');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll-history'] });
            // Toast handled by component state "Queuing..."
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to run payroll');
        },
    });

    // Query: Tax Rules
    const taxRulesQuery = useQuery<any[]>({
        queryKey: ['tax-rules'],
        queryFn: () => fetcher<any[]>(`${API_BASE_URL}/payroll/tax-rules`),
    });

    return {
        settingsQuery,
        historyQuery,
        runPayrollMutation,
        activeJobQuery,
        myPayslipsQuery,
        useMyPayslipDetail,
        taxRulesQuery,
    };
}
