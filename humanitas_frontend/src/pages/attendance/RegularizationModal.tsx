import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  type AttendanceRecord,
  useRequestAttendanceCorrection,
} from "@/hooks/useAttendance";
import { formatInTimeZone } from "@/lib/utils";

interface RegularizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AttendanceRecord | null;
  timezone?: string;
}

export function RegularizationModal({
  open,
  onOpenChange,
  record,
  timezone = "UTC",
}: RegularizationModalProps) {
  const [requestedIn, setRequestedIn] = useState("");
  const [requestedOut, setRequestedOut] = useState("");
  const [reason, setReason] = useState("");

  const requestMutation = useRequestAttendanceCorrection();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && record) {
      // Prepopulate
      setRequestedIn("");
      setRequestedOut("");
      setReason("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (!reason.trim()) {
      toast.error("Please provide a reason or justification for regularization.");
      return;
    }
    if (!requestedIn && !requestedOut) {
      toast.error("Please specify at least a requested Clock-In or Clock-Out time.");
      return;
    }

    try {
      await requestMutation.mutateAsync({
        recordId: record.id,
        requested_clock_in: requestedIn || undefined,
        requested_clock_out: requestedOut || undefined,
        reason: reason.trim(),
      });
      toast.success("Attendance regularization request submitted for supervisor approval.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit regularization request.");
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Attendance Regularization</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-muted/40 rounded-lg space-y-1 text-sm border border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee:</span>
              <span className="font-medium text-foreground">{record.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Work Date:</span>
              <span className="font-medium text-foreground">{record.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Recorded:</span>
              <span className="font-mono text-xs">
                In: {formatInTimeZone(record.actual_in, timezone) || "-"} | Out:{" "}
                {formatInTimeZone(record.actual_out, timezone) || "-"}
              </span>
            </div>
            {record.missed_punch_type && (
              <div className="flex justify-between text-rose-600 font-semibold text-xs">
                <span>Missed Punch Flag:</span>
                <span>
                  {record.missed_punch_type === "missed_in" ? "Missed Clock-In" : "Missed Clock-Out"}
                </span>
              </div>
            )}
            {record.auto_closed_at && (
              <div className="text-xs text-amber-600">
                Shift was auto-closed at midnight (0 Overtime credited).
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="req_in">Correct Clock-In</Label>
              <Input
                id="req_in"
                type="time"
                value={requestedIn}
                onChange={(e) => setRequestedIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req_out">Correct Clock-Out</Label>
              <Input
                id="req_out"
                type="time"
                value={requestedOut}
                onChange={(e) => setRequestedOut(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req_reason">
              Reason / Justification <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="req_reason"
              rows={3}
              placeholder="e.g. Biometric device scanner failed, client site emergency, forgot to clock out before midnight..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={requestMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={requestMutation.isPending}>
              {requestMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
