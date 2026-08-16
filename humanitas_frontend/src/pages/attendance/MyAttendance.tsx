import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeTimezone, formatInTimeZone } from "@/lib/utils";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Download,
  ArrowUpDown,
  Timer,
  QrCode,
  Loader2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";
import { useMyAttendance, type AttendanceRecord } from "@/hooks/useAttendance";



const getStatusColor = (status: string) => {
  switch (status) {
    case "Present":
      return "bg-green-100 text-green-800";
    case "Absent":
      return "bg-red-100 text-red-800";
    case "Late":
      return "bg-yellow-100 text-yellow-800";
    case "Half Day":
      return "bg-orange-100 text-orange-800";
    case "On Leave":
      return "bg-primary/20 text-primary";
    case "In Progress":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getDisplayStatus = (record: AttendanceRecord) => {
  if (record.actual_in && !record.actual_out) {
    return "In Progress";
  }
  return record.status;
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
};


// Helper replaced by formatInTimeZone from utils

// Helper to format date/time for tooltips
const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${mins}`;
  } catch {
    return "-";
  }
};


const calculateWorkHours = (actualIn: string | null | undefined, actualOut: string | null | undefined) => {
  if (!actualIn || !actualOut) return "-";
  try {
    const inTime = new Date(actualIn);
    const outTime = new Date(actualOut);
    const diffMs = outTime.getTime() - inTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  } catch {
    return "-";
  }
};


import { LatenessSummaryDialog } from "./LatenessSummaryDialog";
import { AbsenceHistoryDialog } from "./AbsenceHistoryDialog";

export default function MyAttendance() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tenantTimezone, setTenantTimezone] = useState<string>("UTC");
  const [isLateReportOpen, setIsLateReportOpen] = useState(false);
  const [isAbsenceReportOpen, setIsAbsenceReportOpen] = useState(false);
  const navigate = useNavigate();
  const { hasPermission, isAuthenticated, isLoading: authLoading, user } = useAuth();

  // Use the new hook
  const { data: records = [], isLoading } = useMyAttendance(selectedMonth + 1, selectedYear);



  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchSettings();
    }
  }, [isAuthenticated, authLoading]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/general`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Handle potential response wrapping
        const settings = data.data || data.general || data;

        if (settings && settings.timezone) {
          console.log("Setting Tenant Timezone (MyAttendance):", settings.timezone);
          setTenantTimezone(normalizeTimezone(settings.timezone));
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };



  // Calculate stats from real data
  const inProgressCount = records.filter(r => r.actual_in && !r.actual_out).length;
  const stats = [
    {
      title: "Days Present",
      value: records.filter(r => r.status === "Present" || r.status === "Late").length.toString(),
      total: records.length.toString(),
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Late Arrivals",
      value: records.filter(r => r.status === "Late").length.toString(),
      total: records.length.toString(),
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-100",
    },
    {
      title: "In Progress",
      value: inProgressCount.toString(),
      icon: Timer,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: "Total Records",
      value: records.length.toString(),
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
  ];

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
            <p className="text-gray-500 mt-1">
              View and track your daily attendance records
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasPermission('clock_in_out') && (
              <Button
                onClick={() => navigate('/attendance/clock-in')}
                className="bg-primary hover:bg-primary/90"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Clock In/Out
              </Button>
            )}
            <Button
              variant="outline"
              className="flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={() => setIsLateReportOpen(true)}
            >
              <AlertCircle className="h-4 w-4" />
              My Late Report
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setIsAbsenceReportOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              My Absence Report
            </Button>
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        <LatenessSummaryDialog
          open={isLateReportOpen}
          onOpenChange={setIsLateReportOpen}
          userId={user?.id}
        />

        <AbsenceHistoryDialog
          open={isAbsenceReportOpen}
          onOpenChange={setIsAbsenceReportOpen}
          userId={user?.id}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="py-4">
              <CardContent className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                    {stat.total && (
                      <span className="text-sm text-gray-400">
                        / {stat.total}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Attendance History</CardTitle>
              <div className="flex items-center gap-3">
                <select
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {months.map((month, index) => (
                    <option key={month} value={index}>{month}</option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">
                    <button className="flex items-center gap-1 hover:text-gray-900">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No attendance records found for {months[selectedMonth]} {selectedYear}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDate(record.date)}
                          {record.is_corrected && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500 text-amber-600 cursor-help">Edited</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edited by: {record.corrected_by_name || 'Admin'}</p>
                                  {record.updated_at && (
                                    <p className="text-xs opacity-80 mt-1">
                                      {formatDateTime(record.updated_at)}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatInTimeZone(record.scheduled_in, tenantTimezone)} - {formatInTimeZone(record.scheduled_out, tenantTimezone)}
                      </TableCell>
                      <TableCell>
                        <span className={record.status === "Late" ? "text-yellow-600 font-medium" : ""}>
                          {formatInTimeZone(record.actual_in, tenantTimezone)}
                        </span>
                      </TableCell>
                      <TableCell>{formatInTimeZone(record.actual_out, tenantTimezone)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Timer className="h-4 w-4 text-gray-400" />
                          {calculateWorkHours(record.actual_in, record.actual_out)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(getDisplayStatus(record))}>
                          {getDisplayStatus(record)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm max-w-[200px] truncate">
                        {record.remarks || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
