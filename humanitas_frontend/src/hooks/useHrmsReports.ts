import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';

export interface HrmsSummaryMetrics {
  totalHeadcount: number;
  activeEmployees: number;
  newHiresThisMonth: number;
  turnoverRatePercentage: number;
  averageTenureYears: number;
  absenteeismRatePercentage: number;
  monthlyWorkforceSpend: number;
}

export interface HeadcountDemographics {
  byDepartment: { name: string; count: number }[];
  byGender: { name: string; count: number }[];
  byTenure: { name: string; count: number }[];
  byEmploymentType: { name: string; count: number }[];
  byCompany: { name: string; count: number }[];
}

export interface TurnoverAnalytics {
  monthlyTrend: { month: string; hired: number; exited: number; netGrowth: number }[];
  milestoneRetention: { milestone: string; rate: number }[];
  turnoverByDepartment: { department: string; count: number }[];
}

export interface AttendanceAnalytics {
  weekdayHeatmap: { day: string; presentRate: number; lateRate: number; absentRate: number }[];
  departmentStats: { department: string; punctualityRate: number; overtimeHours: number; absentCount: number }[];
  totalOvertimeHours: number;
}

export interface PayrollAnalytics {
  departmentSpend: {
    department: string;
    employeeCount: number;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    employerPension: number;
  }[];
  historicalRuns: {
    month: number;
    year: number;
    totalGross: number;
    totalNet: number;
    totalDeductions: number;
    employeeCount: number;
  }[];
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch HRMS reports data' }));
    throw new Error(err.message || 'Failed to fetch HRMS reports data');
  }
  const data = await res.json();
  return data.data !== undefined ? data.data : data;
}

export function useHrmsReports() {
  const { activeCompanyId, activeBranchId } = useAuth();

  const buildQueryString = (extraParams?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (activeCompanyId) params.append('company_id', activeCompanyId);
    if (activeBranchId) params.append('branch_id', activeBranchId);
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const useSummary = () =>
    useQuery<HrmsSummaryMetrics>({
      queryKey: ['hrms-reports-summary', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<HrmsSummaryMetrics>(`${API_BASE_URL}/hrms/reports/summary${buildQueryString()}`),
    });

  const useHeadcount = () =>
    useQuery<HeadcountDemographics>({
      queryKey: ['hrms-reports-headcount', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<HeadcountDemographics>(`${API_BASE_URL}/hrms/reports/headcount${buildQueryString()}`),
    });

  const useTurnover = () =>
    useQuery<TurnoverAnalytics>({
      queryKey: ['hrms-reports-turnover', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<TurnoverAnalytics>(`${API_BASE_URL}/hrms/reports/turnover${buildQueryString()}`),
    });

  const useAttendance = () =>
    useQuery<AttendanceAnalytics>({
      queryKey: ['hrms-reports-attendance', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<AttendanceAnalytics>(`${API_BASE_URL}/hrms/reports/attendance-analytics${buildQueryString()}`),
    });

  const usePayroll = () =>
    useQuery<PayrollAnalytics>({
      queryKey: ['hrms-reports-payroll', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<PayrollAnalytics>(`${API_BASE_URL}/hrms/reports/payroll-analytics${buildQueryString()}`),
    });

  const downloadBankTransferFile = async (month: number, year: number, format: 'csv' | 'nacha' | 'aba' = 'csv') => {
    const qs = buildQueryString({ month, year, format });
    const url = `${API_BASE_URL}/hrms/reports/bank-transfer-file${qs}`;

    const res = await fetch(url, {
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to download bank transfer file' }));
      throw new Error(err.message || 'Failed to download bank transfer file');
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `Bank_Transfer_${year}_${String(month).padStart(2, '0')}.${format === 'csv' ? 'csv' : 'txt'}`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  };

  return {
    useSummary,
    useHeadcount,
    useTurnover,
    useAttendance,
    usePayroll,
    downloadBankTransferFile,
  };
}
