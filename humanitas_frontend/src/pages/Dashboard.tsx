import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';
import {
  LucideCalendar,
  LucideCheck,
  LucideIdCardLanyard,
  LucideUser,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  activeUsers: number;
  attendanceToday: number;
  leavesPending: number;
  newHires: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE_URL}/users/dashboard-stats`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  const data = await res.json();
  return data.data || data;
}

function Dashboard() {
  const { activeCompanyId, activeBranchId, activeCompanyIds } = useAuth();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', activeCompanyId, activeBranchId],
    queryFn: fetchDashboardStats,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {activeCompanyIds.length > 1 && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary font-medium">
          <span className="font-bold text-sm bg-primary/20 px-1.5 py-0.5 rounded">∪</span>
          <span>Consolidated Union View: Showing aggregated metrics across {activeCompanyIds.length} selected companies</span>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 mt-2 gap-2 w-full">
          <div className="p-2 md:p-3 lg:p-4 bg-gray-50 shadow-md mb-5 rounded-md flex flex-col items-center max-w-[130px]">
            <LucideUser size={40} className="mb-4 text-blue-600" />
            <div className="text-2xl font-semibold">{stats.activeUsers}</div>
            <div className="text-gray-500">Active Users</div>
          </div>
          <div className="p-2 md:p-3 lg:p-4 bg-gray-50 shadow-md mb-5 rounded-md flex flex-col items-center max-w-[130px]">
            <LucideCheck size={40} className="mb-4 text-green-600" />
            <div className="text-2xl font-semibold">{stats.attendanceToday}</div>
            <div className="text-gray-500">Attendance Today</div>
          </div>
          <div className="p-2 md:p-3 lg:p-4 bg-gray-50 shadow-md mb-5 rounded-md flex flex-col items-center w-[130px]">
            <LucideCalendar size={40} className="mb-4 text-purple-600" />
            <div className="text-2xl font-semibold">{stats.leavesPending}</div>
            <div className="text-gray-500">Leaves Pending</div>
          </div>
          <div className="p-2 md:p-3 lg:p-4 bg-gray-50 shadow-md mb-5 rounded-md flex flex-col items-center w-[130px]">
            <LucideIdCardLanyard size={40} className="mb-4 text-yellow-600" />
            <div className="text-2xl font-semibold">{stats.newHires}</div>
            <div className="text-gray-500">This Month Hire</div>
          </div>
        </div>
      </div>
    </>
  );
}
export default Dashboard;
