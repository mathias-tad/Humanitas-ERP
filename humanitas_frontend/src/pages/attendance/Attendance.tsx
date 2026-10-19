import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KPITile } from "@/components/design-system/KPITile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShiftManager } from "@/components/scheduling/ShiftManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeTimezone, formatInTimeZone } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Plus,
  Fingerprint,
  UserCog,
  Trash2,
  Loader2,
  Edit2,
  ScrollText,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { CorrectionLogDialog } from "./CorrectionLogDialog";
import { OvertimeManagement } from "./OvertimeManagement";
import { AbsencePenalties } from "./AbsencePenalties";
import { LatenessSummaryDialog } from "./LatenessSummaryDialog";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL, getUploadUrl, SOCKET_URL } from "@/config/api.config";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAttendance,
  type AttendanceRecord,
  type UserWithAssignment
} from "@/hooks/useAttendance";
import { useShifts, usePatterns } from "@/hooks/useScheduling";

const formatWorkHours = (workHours: string | { hours?: number; minutes?: number } | null | undefined): string => {
  if (!workHours) return "-";
  if (typeof workHours === "string") return workHours;
  if (typeof workHours === "object") {
    const h = workHours.hours || 0;
    const m = workHours.minutes || 0;
    return `${h}h ${m}m`;
  }
  return "-";
};

// const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Present":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "Absent":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    case "Late":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20";
    case "Early Leave":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case "Half Day":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case "Day Off":
      return "bg-surface-2 text-muted-foreground border border-border";
    default:
      return "bg-surface-2 text-muted-foreground border border-border";
  }
};



// Helper to extract HH:mm from datetime or time string
const extractTimeForInput = (time: string | null | undefined, timezone?: string): string => {
  if (!time) return "";

  // If T exists, it's an ISO string (likely UTC from backend)
  // Convert it to tenant's timezone "HH:mm"
  if (time.includes("T")) {
    const date = new Date(time);
    if (timezone) {
      try {
        return new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit', // Fix: minute, not month
          hour12: false,
          timeZone: timezone
        }).format(date);
      } catch (e) {
        console.error("Invalid timezone:", timezone);
        // Fallback to local time if timezone is invalid
      }
    }
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // If it's already HH:mm:ss or HH:mm, take first 5 chars
  return time.substring(0, 5);
};

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

export default function Attendance() {
  const { isAuthenticated, isLoading: authLoading, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Defensive check for hasPermission
  const checkPermission = (permission: string) => {
    try {
      return hasPermission ? hasPermission(permission) : false;
    } catch {
      return false;
    }
  };

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLiveMode, setIsLiveMode] = useState(false);

  const {
    attendanceQuery,
    assignmentsQuery,
    devicesQuery,
    networksQuery,
    detectedIpQuery,
    assignShiftMutation,
    removeAssignmentMutation,
    correctAttendanceMutation,
    addNetworkMutation,
    removeNetworkMutation,
    approveDeviceMutation,
    rejectDeviceMutation
  } = useAttendance(selectedDate);

  const { data: shifts = [], isLoading: isLoadingShifts } = useShifts();
  const { data: patterns = [], isLoading: isLoadingPatterns } = usePatterns();

  const attendanceRecords = attendanceQuery.data || [];
  const users = assignmentsQuery.data || [];
  const devices = devicesQuery.data || [];
  const networks = networksQuery.data || [];
  const detectedIp = detectedIpQuery.data?.clientIp || "";

  const isLoading = attendanceQuery.isLoading || isLoadingShifts || isLoadingPatterns || assignmentsQuery.isLoading;

  const [newNetwork, setNewNetwork] = useState({ name: "", ip_address: "", subnet_mask: "255.255.255.0", description: "" });

  const [assignmentData, setAssignmentData] = useState({
    user_id: "",
    pattern_id: "",
    start_date: new Date().toISOString().split("T")[0],
    current_week_in_rotation: 1,
  });

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithAssignment | null>(null);
  const isSaving = assignShiftMutation.isPending;

  // Correction state
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    status: "",
    clock_in: "",
    clock_out: "",
    reason: "",
  });
  const isCorrecting = correctAttendanceMutation.isPending;
  const [tenantTimezone, setTenantTimezone] = useState<string>("UTC");
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isLatenessModalOpen, setIsLatenessModalOpen] = useState(false);

  // Status Actions
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'Approve' | 'Reject' | null>(null);
  const [actionComment, setActionComment] = useState("");

  const handleStatusAction = (record: AttendanceRecord, action: 'Approve' | 'Reject') => {
    setSelectedRecord(record);
    setSelectedAction(action);
    setActionComment("");
    setIsActionModalOpen(true);
  };

  const submitStatusAction = () => {
    if (!selectedRecord || !selectedAction) return;

    const newStatus = selectedAction === 'Approve' ? 'Present' : 'Absent';
    const prefix = selectedAction === 'Approve' ? 'Approved' : 'Rejected';
    const comment = actionComment ? `${prefix}: ${actionComment}` : `${prefix} by Admin`;

    // Preserve existing time if approving, or clear if rejecting? 
    // Usually rejecting means invalidating.
    // Approving 'Pending' -> 'Present' needs a time? If manual override, maybe.
    // If it has times, keep them. If not, maybe current time? 
    // Safest: Keep existing times.

    // Append remark
    const currentRemark = selectedRecord.remarks || '';
    const newRemark = currentRemark ? `${currentRemark}; ${comment}` : comment;

    const payload = {
      status: newStatus,
      // Send existing times to avoid overwriting with null if the API expects full update
      // But correctAttendance API (patch) only updates what's sent.
      // We only send status and remarks here.
      reason: newRemark
    };

    correctAttendanceMutation.mutate({ id: selectedRecord.id, data: payload }, {
      onSuccess: () => {
        setIsActionModalOpen(false);
      }
    });
  };

  const socketRef = useRef<Socket | null>(null);

  const getHeaders = () => ({
    "Content-Type": "application/json",
  });

  // WebSocket connection for real-time updates (controlled by Live Mode)
  useEffect(() => {
    if (!isAuthenticated || authLoading || !isLiveMode) {
      // Cleanup if not in live mode
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Socket.io connects to backend WebSocket server
    const setupAttendanceWebSocket = async () => {
      try {
        const socketUrl = SOCKET_URL || window.location.origin;
        console.log(`🔌 Connecting to Attendance WebSocket: ${socketUrl}/attendance`);

        // Fetch WebSocket token first (for cross-origin connections)
        let wsToken: string | undefined;
        if (SOCKET_URL && SOCKET_URL !== window.location.origin) {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/ws-token`, {
              credentials: 'include',
            });
            if (response.ok) {
              const data = await response.json();
              wsToken = data.token;
              console.log('🎫 Attendance WebSocket token obtained');
            }
          } catch (error) {
            console.error('Failed to fetch attendance WebSocket token:', error);
          }
        }

        socketRef.current = io(`${socketUrl}/attendance`, {
          auth: wsToken ? { token: wsToken } : undefined,
          withCredentials: true, // Send HttpOnly cookies
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketRef.current.on('connect', () => {
          console.log('✅ Connected to attendance WebSocket');
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('❌ Attendance WebSocket connection error:', error.message);
        });

        const updateRecordInCache = (record: AttendanceRecord) => {
          queryClient.setQueryData(['attendance-records', selectedDate], (old: AttendanceRecord[] | undefined) => {
            if (!old) return [record];
            const exists = old.find(r => r.id === record.id);
            return exists ? old.map(r => r.id === record.id ? record : r) : [record, ...old];
          });
        };

        socketRef.current.on('clockIn', (record: AttendanceRecord) => {
          console.log('⏰ Clock in received:', record);
          updateRecordInCache(record);
        });

        socketRef.current.on('clockOut', (record: AttendanceRecord) => {
          console.log('🏁 Clock out received:', record);
          updateRecordInCache(record);
        });

        socketRef.current.on('attendanceUpdate', (record: AttendanceRecord) => {
          console.log('🔔 Attendance update received:', record);
          updateRecordInCache(record);
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('❌ Disconnected from attendance WebSocket:', reason);
        });
      } catch (error) {
        console.error('Error setting up Attendance WebSocket:', error);
      }
    };

    // Call the async function
    setupAttendanceWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, authLoading, selectedDate, queryClient, isLiveMode]);

  // Fetch settings for timezone
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchSettings();
    }
  }, [isAuthenticated, authLoading]);

  const fetchSettings = async () => {
    try {
      const settings = await fetch(`${API_BASE_URL}/settings/general`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (settings.ok) {
        const data = await settings.json();
        if (data) {
          // Handle potential response wrapping (e.g. { data: { timezone: ... } } vs { timezone: ... })
          const settings = data.data || data;
          if (settings.timezone) {
            console.log("Setting Tenant Timezone:", settings.timezone);
            setTenantTimezone(normalizeTimezone(settings.timezone));
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const handleAddNetwork = () => {
    if (!newNetwork.name || !newNetwork.ip_address) return;
    addNetworkMutation.mutate(newNetwork, {
      onSuccess: () => setNewNetwork({ name: "", ip_address: "", subnet_mask: "255.255.255.0", description: "" })
    });
  };

  const handleRemoveNetwork = (networkId: string) => {
    removeNetworkMutation.mutate(networkId);
  };

  const handleApproveDevice = (deviceId: string) => {
    approveDeviceMutation.mutate(deviceId);
  };

  const handleRejectDevice = (deviceId: string) => {
    if (!confirm("Are you sure you want to reject/remove this device?")) return;
    rejectDeviceMutation.mutate(deviceId);
  };

  // ASSIGNMENT CRUD
  const handleAssignShift = () => {
    const payload = {
      user_id: assignmentData.user_id,
      pattern_id: (!assignmentData.pattern_id || assignmentData.pattern_id === "standard") ? null : assignmentData.pattern_id,
      start_date: assignmentData.start_date || new Date().toISOString().split("T")[0],
      current_week_in_rotation: assignmentData.current_week_in_rotation || 1,
    };
    assignShiftMutation.mutate(payload, {
      onSuccess: () => {
        setIsAssignModalOpen(false);
        setSelectedUser(null);
        setAssignmentData({
          user_id: "",
          pattern_id: "",
          start_date: new Date().toISOString().split("T")[0],
          current_week_in_rotation: 1
        });
      }
    });
  };

  const handleRemoveAssignment = (userId: string) => {
    if (!confirm("Are you sure you want to remove this assignment?")) return;
    removeAssignmentMutation.mutate(userId);
  };

  const openAssignModal = (user: UserWithAssignment) => {
    setSelectedUser(user);
    setAssignmentData({
      user_id: user.id,
      pattern_id: user.pattern_id || "",
      start_date: new Date().toISOString().split("T")[0],
      current_week_in_rotation: user.current_week_in_rotation || 1,
    });
    setIsAssignModalOpen(true);
  };

  // Handle attendance correction
  const handleCorrectAttendance = () => {
    if (!selectedRecord) return;
    const payload = {
      ...correctionForm,
      clock_in: correctionForm.clock_in,
      clock_out: correctionForm.clock_out,
    };
    correctAttendanceMutation.mutate({ id: selectedRecord.id, data: payload }, {
      onSuccess: () => {
        setIsCorrectionModalOpen(false);
      }
    });
  };

  // Stats calculations
  const stats = [
    {
      title: "Total Employees",
      value: users.length.toString(),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-primary/20",
    },
    {
      title: "Present Today",
      value: attendanceRecords.filter((r) => r.status === "Present").length.toString(),
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Absent",
      value: attendanceRecords.filter((r) => r.status === "Absent").length.toString(),
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-100",
    },
    {
      title: "Late Arrivals",
      value: attendanceRecords.filter((r) => r.status === "Late").length.toString(),
      icon: AlertCircle,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch =
      record.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    const matchesShift = shiftFilter === "all" || record.shift_name === shiftFilter;
    return matchesSearch && matchesStatus && matchesShift;
  });

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance Management</h1>
          <p className="text-gray-500 mt-1">Track employee attendance and manage shifts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isLiveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLiveMode(!isLiveMode)}
            className={isLiveMode ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {isLiveMode ? (
              <>
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Live Mode
              </>
            ) : (
              <>
                <span className="h-2 w-2 mr-2 rounded-full bg-gray-400"></span>
                Go Live
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => attendanceQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {checkPermission('view_qr_display') && (
            <Button
              onClick={() => window.open('/attendance/qr-display', '_blank')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Fingerprint className="h-4 w-4 mr-2" />
              Open QR Display
            </Button>
          )}
          {checkPermission("correct_attendance") && (
            <Button variant="outline" onClick={() => setIsLogsModalOpen(true)}>
              <ScrollText className="h-4 w-4 mr-2" />
              Correction Logs
            </Button>
          )}
          {checkPermission("view_reports") && (
            <Button variant="outline" onClick={() => setIsLatenessModalOpen(true)}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Late Report
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <KPITile
            key={idx}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.color}
            iconBg={stat.bg}
          />
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Shift Configuration
          </TabsTrigger>
          {checkPermission('manage_shift_assignments') && (
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Assignments
            </TabsTrigger>
          )}
          {checkPermission('manage_attendance_devices') && (
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Devices
            </TabsTrigger>
          )}
          {checkPermission('manage_attendance_networks') && (
            <TabsTrigger value="networks" className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              Networks
            </TabsTrigger>
          )}

          {checkPermission('overtime_view') && (
            <TabsTrigger value="overtime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {/* Or DollarSign? using Clock for now */}
              Overtime
            </TabsTrigger>
          )}

          {checkPermission('absence_penalty_approve') && (
            <TabsTrigger value="penalties" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Penalties
            </TabsTrigger>
          )}
        </TabsList>

        {/* Penalties Tab Content */}
        <TabsContent value="penalties" className="space-y-4">
          <AbsencePenalties />
        </TabsContent>

        {/* Overtime Tab Content */}
        <TabsContent value="overtime" className="space-y-4">
          <OvertimeManagement />
        </TabsContent>

        {/* Attendance Records Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search employee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Late">Late</SelectItem>
                    <SelectItem value="Early Leave">Early Leave</SelectItem>
                    <SelectItem value="Day Off">Day Off</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.name}>
                        {shift.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>S. Actions</TableHead>
                  {checkPermission("correct_attendance") && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      No attendance records found for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {record.full_name}
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
                          </p>
                          <p className="text-sm text-gray-500">{record.department}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={record.shift_color || "bg-gray-500"}>
                          {record.shift_name || "No Shift"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatInTimeZone(record.scheduled_in, tenantTimezone)} - {formatInTimeZone(record.scheduled_out, tenantTimezone)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>In: {formatInTimeZone(record.actual_in, tenantTimezone)}</p>
                          <p>Out: {formatInTimeZone(record.actual_out, tenantTimezone)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                          {record.status === 'Late' && record.late_minutes ? ` (${Math.round(record.late_minutes)}m)` : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.clock_method === 'biometric' ? (
                          <Badge variant="outline" className="gap-1 font-mono text-[11px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200">
                            <Fingerprint className="h-3 w-3" />
                            {record.device_name ? record.device_name : 'Biometric'}
                          </Badge>
                        ) : record.clock_method === 'qr_code' || record.clock_method === 'qr' ? (
                          <Badge variant="outline" className="gap-1 font-mono text-[11px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200">
                            <QrCode className="h-3 w-3" />
                            QR Scan
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 font-mono text-[11px] text-muted-foreground border-border">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatWorkHours(record.work_hours)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{record.remarks || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleStatusAction(record, 'Approve')}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Approve</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleStatusAction(record, 'Reject')}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reject</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                      {checkPermission("correct_attendance") && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setCorrectionForm({
                                status: record.status || "",
                                clock_in: extractTimeForInput(record.actual_in, tenantTimezone),
                                clock_out: extractTimeForInput(record.actual_out, tenantTimezone),
                                reason: "",
                              });
                              setIsCorrectionModalOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-1" /> Correct
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Shifts & Patterns Tab */}
        <TabsContent value="shifts" className="space-y-4">
          <ShiftManager />
        </TabsContent>



        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <CardTitle>Employee Shift Assignments</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Assigned Pattern</TableHead>
                    <TableHead>Current Week</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={getUploadUrl(user.avatar_url)}
                              alt={user.full_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-xs">
                                {user.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell>
                        {user.pattern_name ? (
                          <Badge variant="outline">{user.pattern_name}</Badge>
                        ) : (
                          <span className="text-gray-400 italic">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.current_week_in_rotation ? `Week ${user.current_week_in_rotation}` : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openAssignModal(user)}>
                            {user.pattern_id ? "Edit" : "Assign"}
                          </Button>
                          {user.pattern_id && (
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveAssignment(user.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <CardTitle>Registered Devices</CardTitle>
                <p className="text-sm text-gray-500">
                  Manage employee devices for QR-based attendance
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No devices registered yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{device.full_name}</p>
                            <p className="text-sm text-gray-500">{device.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{device.device_name}</p>
                            <p className="text-sm text-gray-500">{device.device_type}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {device.device_id}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(device.registered_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {device.approved_at ? (
                            <Badge className="bg-green-100 text-green-800">Approved</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!device.approved_at && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApproveDevice(device.id)}
                                className="text-green-600"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectDevice(device.id)}
                              className="text-red-600"
                              title="Remove device (allows user to register a new one)"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Device Registration Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>Employee goes to <strong>My Attendance → Clock In/Out</strong></li>
                <li>Employee clicks <strong>"Register Device"</strong> on their phone/computer</li>
                <li>Device appears here with <Badge className="bg-yellow-100 text-yellow-800 mx-1">Pending</Badge> status</li>
                <li>Admin clicks <strong>"Approve"</strong> to allow the device</li>
                <li>Employee can now clock in/out using QR code + their registered device</li>
                <li><strong>To change device:</strong> Admin clicks <strong>"Remove"</strong> on the old device, then employee registers the new one</li>
                <li><strong>Note:</strong> Each employee can only have ONE registered device at a time</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Networks Tab */}
        <TabsContent value="networks" className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <CardTitle>Allowed Networks</CardTitle>
                <p className="text-sm text-gray-500">
                  Configure which networks can access attendance clock in/out
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Current IP Info */}
              {detectedIp && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary">
                      <strong>Your current IP:</strong> <code className="bg-primary/10 px-2 py-0.5 rounded">{detectedIp}</code>
                    </p>
                    <p className="text-xs text-primary/80 mt-1">
                      Add this IP (or its network range) to allow clock in from this location
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewNetwork({ ...newNetwork, ip_address: detectedIp })}
                  >
                    Use This IP
                  </Button>
                </div>
              )}

              {/* Add Network Form */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label>Network Name</Label>
                  <Input
                    value={newNetwork.name}
                    onChange={(e) => setNewNetwork({ ...newNetwork, name: e.target.value })}
                    placeholder="e.g., Office WiFi"
                  />
                </div>
                <div>
                  <Label>IP Address / Network</Label>
                  <Input
                    value={newNetwork.ip_address}
                    onChange={(e) => setNewNetwork({ ...newNetwork, ip_address: e.target.value })}
                    placeholder="e.g., 192.168.1.0"
                  />
                </div>
                <div>
                  <Label>Subnet Mask</Label>
                  <Input
                    value={newNetwork.subnet_mask}
                    onChange={(e) => setNewNetwork({ ...newNetwork, subnet_mask: e.target.value })}
                    placeholder="255.255.255.0"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddNetwork} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Network
                  </Button>
                </div>
              </div>

              {/* Networks List */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Subnet Mask</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {networks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No networks configured. All networks are currently allowed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    networks.map((network) => (
                      <TableRow key={network.id}>
                        <TableCell className="font-medium">{network.name}</TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {network.ip_address}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {network.subnet_mask}
                          </code>
                        </TableCell>
                        <TableCell className="text-gray-500">{network.description || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(network.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveNetwork(network.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Network Restriction Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>Add your office network IP address or range above</li>
                <li>Employees can only clock in/out when connected to allowed networks</li>
                <li>If no networks are configured, all networks are allowed</li>
                <li>Use subnet mask 255.255.255.255 for exact IP match</li>
                <li>Use subnet mask 255.255.255.0 to allow entire subnet (e.g., 192.168.1.x)</li>
              </ol>
              <div className="mt-4 p-3 bg-primary/5 rounded-lg text-sm text-primary">
                <strong>Tip:</strong> To find your network IP, check your router settings or run <code>ipconfig</code> (Windows) or <code>ifconfig</code> (Mac/Linux).
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Modals */}
      <CorrectionLogDialog
        open={isLogsModalOpen}
        onOpenChange={setIsLogsModalOpen}
        timezone={tenantTimezone}
      />
      {/* Assignment Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Schedule Pattern</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {selectedUser.avatar_url ? (
                  <img
                    src={getUploadUrl(selectedUser.avatar_url)}
                    alt={selectedUser.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {selectedUser.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedUser.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedUser.department}</p>
                </div>
              </div>

              <div>
                <Label>Schedule Pattern</Label>
                <Select
                  value={assignmentData.pattern_id}
                  onValueChange={(v: string) => setAssignmentData({ ...assignmentData, pattern_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Schedule (Default)</SelectItem>
                    {patterns.map((pattern) => (
                      <SelectItem key={pattern.id} value={pattern.id}>
                        {pattern.name} ({pattern.rotation_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Effective Start Date</Label>
                <Input
                  type="date"
                  value={assignmentData.start_date}
                  onChange={(e) => setAssignmentData({ ...assignmentData, start_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Starting Week in Rotation</Label>
                <Input
                  type="number"
                  min={1}
                  value={assignmentData.current_week_in_rotation}
                  onChange={(e) => setAssignmentData({ ...assignmentData, current_week_in_rotation: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                <Button onClick={handleAssignShift} disabled={isSaving || !assignmentData.pattern_id}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Assign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Correction Modal */}
      <Dialog open={isCorrectionModalOpen} onOpenChange={setIsCorrectionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Correct Attendance Record</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Employee</p>
                <p className="font-medium">{selectedRecord.full_name}</p>
                <p className="text-sm text-gray-500">{selectedRecord.date}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="correction-status">Status</Label>
                <Select
                  value={correctionForm.status}
                  onValueChange={(val) => setCorrectionForm({ ...correctionForm, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Late">Late</SelectItem>
                    <SelectItem value="Leave">Leave</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                    <SelectItem value="Day Off">Day Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="correction-clock-in">Clock In</Label>
                  <Input
                    id="correction-clock-in"
                    type="time"
                    value={correctionForm.clock_in}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clock_in: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correction-clock-out">Clock Out</Label>
                  <Input
                    id="correction-clock-out"
                    type="time"
                    value={correctionForm.clock_out}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clock_out: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="correction-reason">Reason for Correction</Label>
                <Input
                  id="correction-reason"
                  placeholder="Enter reason for this correction..."
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCorrectionModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCorrectAttendance} disabled={isCorrecting}>
                  {isCorrecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Correction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CorrectionLogDialog
        open={isLogsModalOpen}
        onOpenChange={setIsLogsModalOpen}
        timezone={tenantTimezone}
      />


      {/* Status Action Confirmation Modal */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction === 'Approve' ? 'Approve Attendance' : 'Reject Attendance'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              Are you sure you want to <strong>{selectedAction?.toLowerCase()}</strong> this record for <span className="font-semibold">{selectedRecord?.full_name}</span>?
            </p>
            <div className="space-y-2">
              <Label>Comment (Optional)</Label>
              <Textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder="Add a remark..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
            <Button
              variant={selectedAction === 'Approve' ? 'default' : 'destructive'}
              onClick={submitStatusAction}
              disabled={isCorrecting}
              className={selectedAction === 'Approve' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {isCorrecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CorrectionLogDialog
        open={isLogsModalOpen}
        onOpenChange={setIsLogsModalOpen}
      />

      <LatenessSummaryDialog
        open={isLatenessModalOpen}
        onOpenChange={setIsLatenessModalOpen}
        date={selectedDate}
      />
    </div>
  );
}
