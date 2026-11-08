import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Loader2, FileQuestion } from "lucide-react";
import {
  useAttendanceCorrectionRequests,
  useReviewAttendanceCorrection,
  type AttendanceCorrectionRequest,
} from "@/hooks/useAttendance";
import { useAuth } from "@/context/AuthContext";

export function RegularizationRequestsView() {
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [selectedRequest, setSelectedRequest] = useState<AttendanceCorrectionRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { hasPermission } = useAuth();
  const canReview = hasPermission("correct_attendance");

  const { data: requests, isLoading } = useAttendanceCorrectionRequests(
    filterStatus === "all" ? undefined : filterStatus
  );

  const reviewMutation = useReviewAttendanceCorrection();

  const handleOpenAction = (req: AttendanceCorrectionRequest, action: "approve" | "reject") => {
    setSelectedRequest(req);
    setActionType(action);
    setReviewNote("");
    setIsConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest) return;
    try {
      await reviewMutation.mutateAsync({
        requestId: selectedRequest.id,
        action: actionType,
        review_note: reviewNote.trim() || undefined,
      });
      toast.success(
        actionType === "approve"
          ? "Regularization request approved and attendance record corrected."
          : "Regularization request rejected."
      );
      setIsConfirmOpen(false);
      setSelectedRequest(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to process review.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20">Rejected</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Attendance Regularization & Missed Punch Requests
            </CardTitle>
            <CardDescription>
              Review employee requests to correct missed clock-ins, missed clock-outs, or debounced biometric timestamps.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
            {(["pending", "approved", "rejected", "all"] as const).map((st) => (
              <Button
                key={st}
                size="sm"
                variant={filterStatus === st ? "default" : "ghost"}
                className="h-8 text-xs capitalize"
                onClick={() => setFilterStatus(st)}
              >
                {st}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileQuestion className="h-10 w-10 mb-2 opacity-50" />
              <p className="font-medium">No regularization requests found</p>
              <p className="text-xs">There are no {filterStatus !== "all" ? filterStatus : ""} requests at this time.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Work Date</TableHead>
                    <TableHead>Recorded In / Out</TableHead>
                    <TableHead>Requested In / Out</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review Details</TableHead>
                    {canReview && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <p className="font-medium">{req.employee_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{req.department || "-"}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{req.record_date}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        In: {req.current_clock_in || "-"}<br />
                        Out: {req.current_clock_out || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        In: {req.requested_clock_in || "No change"}<br />
                        Out: {req.requested_clock_out || "No change"}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <span className="line-clamp-2" title={req.reason}>
                          {req.reason}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.reviewer_name ? (
                          <div>
                            <span className="font-medium">{req.reviewer_name}</span>
                            {req.review_note && <p className="text-[11px] italic">"{req.review_note}"</p>}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {canReview && (
                        <TableCell className="text-right">
                          {req.status === "pending" ? (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                onClick={() => handleOpenAction(req, "approve")}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                onClick={() => handleOpenAction(req, "reject")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">{req.status}</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Approve Attendance Regularization
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-600" />
                  Reject Attendance Regularization
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 py-2 text-sm">
              <p>
                Are you sure you want to <strong>{actionType}</strong> this regularization request for{" "}
                <strong>{selectedRequest.employee_name}</strong> on <strong>{selectedRequest.record_date}</strong>?
              </p>
              {actionType === "approve" && (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 rounded-md text-xs space-y-1">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Changes that will be applied:</p>
                  {selectedRequest.requested_clock_in && (
                    <p>• Clock-In: {selectedRequest.requested_clock_in}</p>
                  )}
                  {selectedRequest.requested_clock_out && (
                    <p>• Clock-Out: {selectedRequest.requested_clock_out}</p>
                  )}
                  <p className="text-muted-foreground pt-1">
                    An immutable entry will be recorded in the audit log attributing this correction to you.
                  </p>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="review_note">Review Note / Justification (Optional)</Label>
                <Textarea
                  id="review_note"
                  rows={2}
                  placeholder={
                    actionType === "approve"
                      ? "Approved based on biometric log review or manager confirmation..."
                      : "Reason for rejection..."
                  }
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleConfirmAction}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
