import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle, XCircle, RefreshCw, Loader2, Clock, Check, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { usePresence } from "@/context/PresenceContext";
import { SOCKET_URL } from "@/config/api.config";
import { io, Socket } from "socket.io-client";
import { useLeave, type LeaveRequest } from "@/hooks/useLeave";



const getStatusColor = (status: string) => {
  switch (status) {
    case "Approved":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "Rejected":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    case "Pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    default:
      return "bg-surface-2 text-muted-foreground border border-border";
  }
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    "Annual Leave": "bg-primary/10 text-primary border border-primary/20",
    "Sick Leave": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
    "Personal Leave": "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
    "Unpaid Leave": "bg-surface-2 text-muted-foreground border border-border",
  };
  return colors[type] || "bg-primary/10 text-primary border border-primary/20";
};

export default function LeaveRequests() {
  const { isAuthenticated, isLoading: authLoading, user, hasPermission } = useAuth();
  const { isUserOnline } = usePresence();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState<'all' | 'my-approval'>('all');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isLiveMode, setIsLiveMode] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  const { allRequestsQuery, approveRequestMutation, rejectRequestMutation, workflowQuery } = useLeave();

  const requests = allRequestsQuery.data || [];
  const workflow = workflowQuery.data || [];
  const isLoading = allRequestsQuery.isLoading || workflowQuery.isLoading;
  const isProcessing = approveRequestMutation.isPending || rejectRequestMutation.isPending;

  // WebSocket connection
  useEffect(() => {
    if (isAuthenticated && isLiveMode && !socketRef.current) {
      // Initialize socket only if Live Mode is ON
      socketRef.current = io(`${SOCKET_URL}/leave`, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Connected to leave namespace');
      });

      socketRef.current.on('newLeaveRequest', (request: LeaveRequest) => {
        console.log('📝 New leave request received:', request);
        queryClient.setQueryData(['all-leave-requests'], (old: LeaveRequest[] = []) => [request, ...old]);
      });

      socketRef.current.on('leaveRequestUpdate', (updatedRequest: LeaveRequest) => {
        console.log('✏️ Leave request updated:', updatedRequest);
        queryClient.setQueryData(['all-leave-requests'], (old: LeaveRequest[] = []) =>
          old.map(req => req.id === updatedRequest.id ? updatedRequest : req)
        );
      });

      socketRef.current.on('leaveRequestCancelled', ({ id }: { id: string }) => {
        console.log('❌ Leave request cancelled:', id);
        queryClient.setQueryData(['all-leave-requests'], (old: LeaveRequest[] = []) =>
          old.filter(req => req.id !== id)
        );
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('❌ Disconnected from leave namespace:', reason);
      });
    } else if ((!isLiveMode || !isAuthenticated) && socketRef.current) {
      // Disconnect if Live Mode is OFF
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    return () => {
      // Cleanup on unmount (optional, but good practice if component unmounts while live)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, authLoading, isLiveMode]);



  const handleApprove = (requestId: string) => {
    if (!confirm("Are you sure you want to approve this leave step?")) return;

    approveRequestMutation.mutate(requestId, {
      onSuccess: () => {
        toast.success("Leave step approved");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to approve request");
      }
    });
  };

  const openRejectModal = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  const handleReject = () => {
    if (!selectedRequest) return;

    rejectRequestMutation.mutate({ requestId: selectedRequest.id, reason: rejectionReason }, {
      onSuccess: () => {
        setIsRejectModalOpen(false);
        setSelectedRequest(null);
        setRejectionReason("");
        toast.success("Leave request rejected");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to reject request");
        return;
      }
    });
  };

  const handleRefresh = () => {
    allRequestsQuery.refetch();
    workflowQuery.refetch();
  };

  const checkCanApprove = (request: LeaveRequest) => {
    if (request.status !== 'Pending') return false;

    // Admin/Owner override
    if (user?.role === 'admin' || user?.role === 'owner') return true;

    // Workflow check
    if (workflow.length === 0) {
      // If no workflow, allow managers/admins/hr (using existing permission check)
      return hasPermission('approve_leave_requests');
    }

    // If workflow exists, check role for current step
    const currentStepIdx = (request.current_step || 1) - 1;
    const stepConfig = workflow[currentStepIdx];

    if (!stepConfig) return false; // Should not happen if data consistent

    return user?.role === stepConfig.role_required;
  };

  const getStepLabel = (request: LeaveRequest) => {
    if (request.status !== 'Pending') return request.status;
    if (workflow.length === 0) return 'Pending Approval';

    const currentStepIdx = (request.current_step || 1) - 1;
    const stepConfig = workflow[currentStepIdx];

    if (!stepConfig) return `Step ${request.current_step}`;

    return `Step ${request.current_step}: ${stepConfig.role_required}`;
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      (request.user_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (request.department?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      request.leave_type_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || request.status === statusFilter;

    const matchesTab = tab === 'all' || (request.status === 'Pending' && checkCanApprove(request));

    return matchesSearch && matchesStatus && matchesTab;
  });

  const stats = {
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Executive Page Header */}
      <PageHeader
        title="Leave Management"
        description="Review, approve, or reject employee time-off and vacation requests with multi-level workflow approval."
        breadcrumbs={[
          { label: "HRMS", href: "/dashboard" },
          { label: "Leaves" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={isLiveMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={isLiveMode ? "gold-gradient gold-glow border-none font-bold text-slate-950" : "h-8 text-xs font-semibold"}
            >
              {isLiveMode ? (
                <>
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
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
            <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 text-xs font-semibold">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPITile
          title="Pending Requests"
          value={stats.pending}
          subtitle="Awaiting management action"
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
        <KPITile
          title="Approved Leaves"
          value={stats.approved}
          subtitle="Processed and approved"
          icon={CheckCircle}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <KPITile
          title="Rejected Requests"
          value={stats.rejected}
          subtitle="Declined by management"
          icon={XCircle}
          iconColor="text-rose-500"
          iconBg="bg-rose-500/10"
        />
      </div>

      <div className="flex gap-4 border-b border-border">
        <button
          className={`pb-2.5 px-4 text-xs font-bold transition-colors ${tab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('all')}
        >
          All Requests
        </button>
        <button
          className={`pb-2.5 px-4 text-xs font-bold transition-colors ${tab === 'my-approval' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('my-approval')}
        >
          Pending My Approval
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees or departments..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">
            {tab === 'all' ? 'All Requests' : 'Requests Awaiting Your Approval'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status / Step</TableHead>
                <TableHead>Applied On</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No leave requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-surface-1 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(request.user_name || "")}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${isUserOnline(request.user_id || "") ? "bg-emerald-500" : "bg-muted-foreground/30"
                              }`}
                            title={isUserOnline(request.user_id || "") ? "Online" : "Offline"}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {request.user_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.department || request.user_email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(request.leave_type_name)}>
                        {request.leave_type_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="text-foreground font-medium">
                          {new Date(request.start_date).toLocaleDateString()}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          to {new Date(request.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{request.days} days</TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {request.reason || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        {request.status === 'Pending' && workflow.length > 0 && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {getStepLabel(request)}
                          </span>
                        )}
                        {request.status === "Rejected" && request.rejection_reason && (
                          <p className="text-xs text-rose-500 mt-1 truncate max-w-[100px]" title={request.rejection_reason}>
                            {request.rejection_reason}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {checkCanApprove(request) && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={isProcessing}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRejectModal(request)}
                            disabled={isProcessing}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {!checkCanApprove(request) && request.status === 'Pending' && (
                        <span className="text-xs text-gray-400 italic">Waiting approval</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium">{selectedRequest.user_name}</p>
                <p className="text-sm text-gray-500">
                  {selectedRequest.leave_type_name} - {selectedRequest.days} days
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(selectedRequest.start_date).toLocaleDateString()} to {new Date(selectedRequest.end_date).toLocaleDateString()}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Rejection Reason (Optional)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
