import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { SOCKET_URL } from "@/config/api.config";
import { io, Socket } from "socket.io-client";
import {
  Loader2,
  LogOut,
  RefreshCw,
  Clock,
  AlertTriangle,
  Zap,
  Info,
  CalendarClock,
  ShieldAlert,
} from "lucide-react";
import { useOvertime } from "@/hooks/useOvertime";
import { usePendingReconciliationOvertime, useDecideReconciliationOvertime } from "@/hooks/useAttendance";
import { useNavigate } from "react-router-dom";

interface OTWorker {
  record_id: string;
  user_id: string;
  full_name: string;
  department_name: string;
  shift_name: string;
  clock_in: string; // HH:mm:ss
  scheduled_out: string; // HH:mm:ss
  estimated_ot_hours: number;
}

export function OvertimeMonitor() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showPolicyGuide, setShowPolicyGuide] = useState(true);

  // Queries & Mutations
  const { workersQuery, forceClockOutMutation } = useOvertime();
  const pendingOtQuery = usePendingReconciliationOvertime();
  const decideOtMutation = useDecideReconciliationOvertime();
  const pendingOtWorkers = pendingOtQuery.data || [];

  const workers = workersQuery.data || [];
  const isLoading = workersQuery.isLoading;
  const refetch = workersQuery.refetch;

  // Force Clockout State
  const [selectedWorker, setSelectedWorker] = useState<OTWorker | null>(null);
  const [forceReason, setForceReason] = useState("");
  const [isForceOpen, setIsForceOpen] = useState(false);
  const [grantOvertime, setGrantOvertime] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Live Mode Logic (Socket + Polling)
  useEffect(() => {
    let interval: any;

    if (isLiveMode && user) {
      // 1. Socket Connection
      if (!socketRef.current) {
        socketRef.current = io(`${SOCKET_URL}/attendance`, {
          withCredentials: true,
          transports: ["websocket", "polling"],
        });

        socketRef.current.on("connect", () => {
          toast.success("Live OT Mode Active", { description: "Real-time updates enabled via WebSocket" });
        });

        socketRef.current.on("disconnect", () => {});

        socketRef.current.on("attendanceUpdate", () => {
          refetch();
        });
      }

      // 2. Polling (every 60s) for duration updates
      interval = setInterval(() => refetch(), 60000);
    } else {
      // Cleanup if Live Mode turned off
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (interval) clearInterval(interval);
    };
  }, [isLiveMode, user, refetch]);

  const handleForceClick = (worker: OTWorker) => {
    setSelectedWorker(worker);
    setForceReason("");
    setGrantOvertime(false);
    setIsForceOpen(true);
  };

  const confirmForceClockout = () => {
    if (!selectedWorker) return;

    forceClockOutMutation.mutate(
      {
        userId: selectedWorker.user_id,
        reason: forceReason.trim(),
        grant_overtime: grantOvertime,
      },
      {
        onSuccess: () => {
          setIsForceOpen(false);
          toast.success(
            grantOvertime
              ? `Shift closed for ${selectedWorker.full_name} with overtime credited.`
              : `Shift closed for ${selectedWorker.full_name} at standard shift end (0 OT credited).`
          );
        },
      }
    );
  };

  // Calculate duration string (HH:mm)
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const canView = hasPermission("view_overtime_workers");
  const canForce = hasPermission("force_clockout");
  const isAdmin = user?.role === "Administrator" || user?.role === "Manager";

  if (!user || (!canView && !isAdmin)) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">
        <ShieldAlert className="w-12 h-12 mx-auto text-amber-500 mb-2 opacity-80" />
        <h3 className="font-semibold text-lg text-foreground">Access Restricted</h3>
        <p className="text-sm">You do not have permission to view the Real-Time Overtime Monitor.</p>
        <p className="text-xs text-muted-foreground mt-1">Required permissions: <code>view_overtime_workers</code></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1">
            <span>Time & Attendance</span>
            <span>/</span>
            <span className="text-primary font-semibold">Live Overtime Monitor</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider ml-1 border-primary/30 text-primary">
              /attendance/overtime-monitor
            </Badge>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Zap className="h-7 w-7 text-amber-500 fill-amber-500/20" />
            Real-Time Overtime & Active Shift Monitor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live real-time monitoring of employees working past their scheduled shift end, with supervisory shift closure and strict overtime governance.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={isLiveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLiveMode(!isLiveMode)}
            className={isLiveMode ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          >
            {isLiveMode ? (
              <>
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Live Mode Active
              </>
            ) : (
              <>
                <span className="h-2 w-2 mr-2 rounded-full bg-muted-foreground/60"></span>
                Go Live
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Operational Policy & Menu Guidance Card */}
      <Card className="border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-base text-amber-900 dark:text-amber-200">
              Operational Guide & Overtime Policy Governance
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100/50"
            onClick={() => setShowPolicyGuide(!showPolicyGuide)}
          >
            {showPolicyGuide ? "Hide Guide" : "Show Guide"}
          </Button>
        </CardHeader>
        {showPolicyGuide && (
          <CardContent className="pt-0 text-xs sm:text-sm text-amber-950/80 dark:text-amber-100/80 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-md bg-background/60 border border-amber-200/50 dark:border-amber-900/30 space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" /> Menu Location & Accessibility
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Located in the left Contextual Dock under <strong>Time & Attendance → Live OT Monitor</strong>, and directly linked from the Attendance Command Center top action toolbar and tabs.
                </p>
              </div>
              <div className="p-2.5 rounded-md bg-background/60 border border-amber-200/50 dark:border-amber-900/30 space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <LogOut className="h-3.5 w-3.5 text-rose-600" /> Supervisory Manual Shift Closure
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Supervisors with <code>force_clockout</code> permission can manually close active overdue sessions, explicitly deciding whether extra elapsed hours should be credited as Overtime or closed with 0 OT.
                </p>
              </div>
              <div className="p-2.5 rounded-md bg-background/60 border border-amber-200/50 dark:border-amber-900/30 space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Midnight Auto-Close Safeguard
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Any day shift remaining open at <strong>00:00 (Midnight)</strong> is automatically closed with strictly <strong>0 Overtime credited</strong>. Pre-midnight warnings fire at 23:15 for employees and supervisors.
                </p>
              </div>
              <div className="p-2.5 rounded-md bg-background/60 border border-amber-200/50 dark:border-amber-900/30 space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-primary" /> VET & VTO Policy Recommendation
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <strong>Do not run continuous endless shifts for overtime.</strong> Staff performing extra hours should close their regular shift and clock in to an approved Voluntary Extra Time (VET) shift at{" "}
                  <button
                    onClick={() => navigate("/scheduling/opportunities")}
                    className="text-primary underline font-medium hover:text-primary/80"
                  >
                    /scheduling/opportunities
                  </button>.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Pending Overtime Approvals from Offline Sync Reconciliation */}
      {pendingOtWorkers.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Pending Overtime Decisions ({pendingOtWorkers.length} Reconciled from Offline Sync)
                  </CardTitle>
                  <CardDescription>
                    These historical shifts had clock-out timestamps synchronized from offline device backlogs exceeding scheduled hours. Decide whether to grant OT or close with standard shift hours.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
                Action Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift Date</TableHead>
                  <TableHead>Clock In / Out</TableHead>
                  <TableHead>Extra Time</TableHead>
                  <TableHead className="text-right">Decision Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOtWorkers.map((rec: any) => (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{rec.first_name} {rec.last_name}</div>
                      <div className="text-xs text-muted-foreground">{rec.department_name || "General"}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{rec.date}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {rec.actual_in ? new Date(rec.actual_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"} →{" "}
                      {rec.actual_out ? new Date(rec.actual_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-semibold text-amber-700 bg-amber-100/80 dark:bg-amber-950 dark:text-amber-300">
                        +{rec.pending_overtime_hours || 0} hrs OT
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                          disabled={decideOtMutation.isPending}
                          onClick={() => {
                            decideOtMutation.mutate({ recordId: rec.id, grantOvertime: true }, {
                              onSuccess: () => toast.success("Overtime hours approved for employee."),
                            });
                          }}
                        >
                          Approve OT
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                          disabled={decideOtMutation.isPending}
                          onClick={() => {
                            decideOtMutation.mutate({ recordId: rec.id, grantOvertime: false }, {
                              onSuccess: () => toast.info("Shift closed with standard hours (0 OT)."),
                            });
                          }}
                        >
                          Zero OT
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Overtime Workers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Current Active Overtime Workers ({workers.length})
              </CardTitle>
              <CardDescription>
                Employees who have passed their scheduled shift end time and have not yet clocked out.
              </CardDescription>
            </div>
            {workers.length > 0 && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 font-mono text-xs">
                {workers.length} {workers.length === 1 ? "Employee" : "Employees"} Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Checking active clock-ins against scheduled rosters...</p>
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-12 px-4 bg-muted/20 rounded-lg space-y-3">
              <CheckCircle2Icon className="w-12 h-12 mx-auto text-emerald-500" />
              <div>
                <h3 className="font-semibold text-lg text-foreground">No Overtime Detected</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  All employees have clocked out on time, or no active shifts are past their scheduled end time.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/attendance/view")}>
                  View Attendance Ledger
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  onClick={() => navigate("/scheduling/opportunities")}
                >
                  <CalendarClock className="h-4 w-4 mr-1.5" />
                  Manage VET / VTO Shifts
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Scheduled End</TableHead>
                    <TableHead>Current Time</TableHead>
                    <TableHead>Est. Overtime</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((w: OTWorker) => (
                    <TableRow key={w.record_id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{w.full_name}</span>
                          <span className="text-xs text-muted-foreground">{w.department_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal text-xs">
                          {w.shift_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {w.scheduled_out?.substring(0, 5)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40">
                          +{formatDuration(w.estimated_ot_hours)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {(canForce || isAdmin) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleForceClick(w)}
                          >
                            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Force Clock Out
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Force Clockout Modal with Overtime Decision Radio */}
      <Dialog open={isForceOpen} onOpenChange={setIsForceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> Force Clock Out & Overtime Decision
            </DialogTitle>
            <DialogDescription>
              Manually close active shift for <strong>{selectedWorker?.full_name}</strong> ({selectedWorker?.department_name}).
            </DialogDescription>
          </DialogHeader>

          {selectedWorker && (
            <div className="space-y-4 py-2">
              {/* Shift info summary */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Shift:</span>
                  <span className="font-medium text-foreground">{selectedWorker.shift_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled End:</span>
                  <span className="font-mono">{selectedWorker.scheduled_out?.substring(0, 5)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-400">
                  <span>Elapsed Extra Time:</span>
                  <span>+{formatDuration(selectedWorker.estimated_ot_hours)}</span>
                </div>
              </div>

              {/* Overtime Decision Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Overtime Credit Decision <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  <div
                    onClick={() => setGrantOvertime(true)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      grantOvertime
                        ? "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-xs">
                      <input
                        type="radio"
                        checked={grantOvertime}
                        onChange={() => setGrantOvertime(true)}
                        className="text-amber-600"
                      />
                      <span>Approve & Grant Overtime Credit</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 pl-5 leading-normal">
                      Extra hours past scheduled shift will be credited to payroll as approved overtime with multiplier calculation.
                    </p>
                  </div>

                  <div
                    onClick={() => setGrantOvertime(false)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      !grantOvertime
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-xs">
                      <input
                        type="radio"
                        checked={!grantOvertime}
                        onChange={() => setGrantOvertime(false)}
                        className="text-primary"
                      />
                      <span>No Overtime Credit (Standard Shift Close)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 pl-5 leading-normal">
                      Close the active shift at regular scheduled hours. Overtime credited will be strictly 0.00 hours.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason textarea */}
              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs">
                  Reason / Justification Note
                </Label>
                <Textarea
                  id="reason"
                  rows={2}
                  placeholder="e.g. Employee forgot to clock out, verified departure at shift end, emergency site visit..."
                  value={forceReason}
                  onChange={(e) => setForceReason(e.target.value)}
                />
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border">
                💡 <strong>Tip:</strong> For planned extra work, employees should be scheduled into a formal Voluntary Extra Time (VET) shift instead of letting regular shifts run continuously.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsForceOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={grantOvertime ? "default" : "destructive"}
              onClick={confirmForceClockout}
              disabled={forceClockOutMutation.isPending}
            >
              {forceClockOutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {grantOvertime ? "Confirm & Grant OT" : "Force Out (0 OT)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckCircle2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
