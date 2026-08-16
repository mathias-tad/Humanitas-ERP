import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, PieChart, Loader2, Trash2, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLeave } from "@/hooks/useLeave";



const getStatusColor = (status: string) => {
  switch (status) {
    case "Approved":
      return "bg-green-100 text-green-800";
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "Pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getLeaveColor = (index: number) => {
  const colors = [
    { color: "text-primary", bg: "bg-primary/10", bar: "bg-primary" },
    { color: "text-orange-600", bg: "bg-orange-100", bar: "bg-orange-500" },
    { color: "text-purple-600", bg: "bg-purple-100", bar: "bg-purple-500" },
    { color: "text-green-600", bg: "bg-green-100", bar: "bg-green-500" },
    { color: "text-pink-600", bg: "bg-pink-100", bar: "bg-pink-500" },
  ];
  return colors[index % colors.length];
};

export default function MyLeaveRequests() {
  const { isLoading: authLoading } = useAuth();
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type_id: "",
    leave_type_name: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const {
    leaveTypesQuery,
    myBalancesQuery,
    myRequestsQuery,
    workflowQuery,
    applyLeaveMutation,
    cancelRequestMutation
  } = useLeave();

  const leaveTypes = leaveTypesQuery.data || [];
  const balances = myBalancesQuery.data || [];
  const requests = myRequestsQuery.data || [];
  const isLoading = leaveTypesQuery.isLoading || myBalancesQuery.isLoading || myRequestsQuery.isLoading;
  const isSaving = applyLeaveMutation.isPending || cancelRequestMutation.isPending;

  const handleRefresh = () => {
    myRequestsQuery.refetch();
    myBalancesQuery.refetch();
  };

  const handleApplyLeave = () => {
    if (!applyForm.leave_type_id || !applyForm.start_date || !applyForm.end_date) {
      toast.error("Please fill in all required fields");
      return;
    }

    applyLeaveMutation.mutate(applyForm, {
      onSuccess: () => {
        setIsApplyModalOpen(false);
        setApplyForm({
          leave_type_id: "",
          leave_type_name: "",
          start_date: "",
          end_date: "",
          reason: "",
        });
        toast.success("Leave request submitted successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to apply for leave");
      }
    });
  };

  const handleCancelRequest = (requestId: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;

    cancelRequestMutation.mutate(requestId, {
      onSuccess: () => {
        toast.success("Leave request cancelled");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to cancel request");
      }
    });
  };

  const handleLeaveTypeChange = (leaveTypeId: string) => {
    const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
    setApplyForm({
      ...applyForm,
      leave_type_id: leaveTypeId,
      leave_type_name: leaveType?.name || "",
    });
  };

  const calculateDays = () => {
    if (applyForm.start_date && applyForm.end_date) {
      const start = new Date(applyForm.start_date);
      const end = new Date(applyForm.end_date);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 0;
    }
    return 0;
  };

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
          <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
          <p className="text-gray-500 mt-1">
            View your leave balance and request history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            onClick={() => setIsApplyModalOpen(true)}
            disabled={leaveTypes.length === 0}
          >
            <Plus className="h-4 w-4" />
            Apply for Leave
          </Button>
        </div>
      </div>

      {/* Leave Balances */}
      {balances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {balances.map((balance, index) => {
            const colors = getLeaveColor(index);
            return (
              <Card key={balance.leave_type_id} className="py-2">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-lg ${colors.bg}`}>
                      <PieChart className={`h-6 w-6 ${colors.color}`} />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">
                      {balance.available_days}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{balance.leave_type_name}</p>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>Available</span>
                      <span>
                        {balance.used_days} used of {balance.total_days}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                      <div
                        className={`h-2 rounded-full ${colors.bar}`}
                        style={{
                          width: `${balance.total_days > 0 ? (balance.used_days / balance.total_days) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No leave types configured. Contact your administrator to set up leave policies.
          </CardContent>
        </Card>
      )}

      {/* Recent Requests */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Request History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Applied On</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No leave requests yet. Click "Apply for Leave" to submit your first request.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const currentStepIdx = (request.current_step || 1) - 1;
                  const workflow = workflowQuery.data || [];
                  const stepConfig = workflow[currentStepIdx];
                  const stepLabel = stepConfig ? `Step ${request.current_step}: ${stepConfig.role_required}` : `Step ${request.current_step}`;
                  const isWorkflowActive = workflow.length > 0 && request.status === 'Pending';

                  return (
                    <TableRow key={request.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-900">
                        {request.leave_type_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span className="text-gray-900">
                            {new Date(request.start_date).toLocaleDateString()}
                          </span>
                          <span className="text-gray-500 text-xs">
                            to {new Date(request.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{request.days} days</TableCell>
                      <TableCell className="text-gray-600 max-w-[200px] truncate">
                        {request.reason || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge className={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                          {isWorkflowActive && (
                            <span className="text-xs text-muted-foreground mt-1">
                              {stepLabel}
                            </span>
                          )}
                          {request.status === "Rejected" && request.rejection_reason && (
                            <p className="text-xs text-red-500 mt-1">{request.rejection_reason}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {request.approver_name || "-"}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(request.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {request.status === "Pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelRequest(request.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Apply Leave Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Leave Type</Label>
              <Select
                value={applyForm.leave_type_id}
                onValueChange={handleLeaveTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => {
                    const balance = balances.find(b => b.leave_type_id === type.id);
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({balance?.available_days || 0} days available)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={applyForm.start_date}
                  onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={applyForm.end_date}
                  onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
                  min={applyForm.start_date || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            {calculateDays() > 0 && (
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-lg">
                <Calendar className="h-4 w-4" />
                <span>Total: {calculateDays()} day(s)</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                placeholder="Enter reason for leave..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyLeave}
              disabled={isSaving || !applyForm.leave_type_id || !applyForm.start_date || !applyForm.end_date}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
