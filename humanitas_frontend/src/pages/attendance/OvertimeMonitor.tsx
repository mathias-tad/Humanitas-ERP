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
import { Loader2, LogOut, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { useOvertime } from "@/hooks/useOvertime";

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
    const [isLiveMode, setIsLiveMode] = useState(false);

    // Queries & Mutations
    const { workersQuery, forceClockOutMutation } = useOvertime();

    // Configure query polling based on Live Mode
    // We can't dynamically change 'refetchInterval' easily on the hook return without wrapper, 
    // but workersQuery in useOvertime is defined with defaults.
    // We'll use the query result's refetch function for manual handling.

    // Actually, useQuery accepts options. But useOvertime hardcodes them mostly.
    // But TanStack query refetchInterval can be set globally or we can invalidate.
    // In useOvertime, workersQuery doesn't accept options.
    // I should have made it accept options. 
    // But I can implement polling via useEffect if I can't pass it.
    // data is reactive.

    const { data: workers = [], isLoading, refetch } = workersQuery;

    const [_socketConnected, setSocketConnected] = useState(false);

    // Force Clockout State
    const [selectedWorker, setSelectedWorker] = useState<OTWorker | null>(null);
    const [forceReason, setForceReason] = useState("");
    const [isForceOpen, setIsForceOpen] = useState(false);

    const socketRef = useRef<Socket | null>(null);

    // Live Mode Logic (Socket + Polling)
    useEffect(() => {
        let interval: any;

        if (isLiveMode && user) {
            // 1. Socket Connection
            if (!socketRef.current) {
                socketRef.current = io(`${SOCKET_URL}/attendance`, {
                    withCredentials: true,
                    transports: ['websocket', 'polling']
                });

                socketRef.current.on('connect', () => {
                    setSocketConnected(true);
                    toast.success("Live Mode Active", { description: "Real-time updates enabled" });
                });

                socketRef.current.on('disconnect', () => setSocketConnected(false));

                socketRef.current.on('attendanceUpdate', () => {
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
                setSocketConnected(false);
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
        setIsForceOpen(true);
    };

    const confirmForceClockout = () => {
        if (!selectedWorker) return;

        forceClockOutMutation.mutate({
            userId: selectedWorker.user_id,
            reason: forceReason
        }, {
            onSuccess: () => {
                setIsForceOpen(false);
            }
        });
    };

    // Calculate duration string (HH:mm)
    const formatDuration = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    const canView = hasPermission('view_overtime_workers');
    const canForce = hasPermission('force_clockout');
    const isAdmin = user?.role === 'Administrator' || user?.role === 'Manager';

    if (!user || (!canView && !isAdmin)) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view this page.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Real-Time OT Monitor</h2>
                    <p className="text-muted-foreground">Live view of employees currently working past scheduled hours.</p>
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
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Current Overtime Workers ({workers.length})
                    </CardTitle>
                    <CardDescription>Employees who have not clocked out yet.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                    ) : workers.length === 0 ? (
                        <div className="text-center p-12 bg-muted/20 rounded-lg">
                            <CheckCircle2Icon className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                            <h3 className="font-semibold text-lg">No Overtime Detected</h3>
                            <p className="text-muted-foreground">Everyone has clocked out on time or no shifts are overdue.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Shift</TableHead>
                                    <TableHead>Scheduled Out</TableHead>
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
                                                <span className="font-medium">{w.full_name}</span>
                                                <span className="text-xs text-muted-foreground">{w.department_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{w.shift_name}</TableCell>
                                        <TableCell className="text-muted-foreground">{w.scheduled_out?.substring(0, 5)}</TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-orange-500 text-orange-600 font-bold bg-orange-50">
                                                {formatDuration(w.estimated_ot_hours)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(canForce || isAdmin) && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleForceClick(w)}
                                                >
                                                    <LogOut className="w-4 h-4 mr-2" /> Force Out
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Force Clockout Modal */}
            <Dialog open={isForceOpen} onOpenChange={setIsForceOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" /> Force Clock Out
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to force clock out <strong>{selectedWorker?.full_name}</strong>?
                            This action will be logged.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="reason">Reason / Status Note</Label>
                            <Textarea
                                id="reason"
                                placeholder="e.g. Employee forgot to clock out, Left early due to emergency..."
                                value={forceReason}
                                onChange={(e) => setForceReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsForceOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmForceClockout} disabled={forceClockOutMutation.isPending}>
                            {forceClockOutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirm Force Out"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CheckCircle2Icon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}
