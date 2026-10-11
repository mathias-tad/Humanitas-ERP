import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface CalculationLog {
    id: string;
    tenant_id: string;
    type: "OVERTIME" | "PAYROLL" | "LEAVE_BALANCE";
    status: "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    payload: any;
    result: any;
    triggered_by: string;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
}

const statusConfig = {
    PENDING: { icon: Clock, color: "bg-gray-500", label: "Pending" },
    QUEUED: { icon: Clock, color: "bg-blue-500", label: "Queued" },
    PROCESSING: { icon: Loader2, color: "bg-yellow-500", label: "Processing" },
    COMPLETED: { icon: CheckCircle2, color: "bg-green-500", label: "Completed" },
    FAILED: { icon: XCircle, color: "bg-red-500", label: "Failed" },
};

const typeLabels = {
    OVERTIME: "Overtime Calculation",
    PAYROLL: "Payroll Processing",
    LEAVE_BALANCE: "Leave Balance",
};

export function SystemLogs() {
    const { hasPermission, tenant } = useAuth();
    const [logs, setLogs] = useState<CalculationLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<'calculations' | 'server'>('calculations');
    const [serverLogs, setServerLogs] = useState<string>("");

    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [retrying, setRetrying] = useState<string | null>(null);

    const canManage = hasPermission("manage_logs");

    const fetchServerLogs = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/v1/system/logs/server?lines=200');
            if (response.ok) {
                const text = await response.text();
                setServerLogs(text);
            } else {
                toast.error("Failed to fetch server logs");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'calculations') {
            fetchLogs();
        } else if (activeTab === 'server') {
            fetchServerLogs();
        }
    }, [tenant?.id, activeTab]);


    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await api.get<CalculationLog[]>(`/system/logs?tenant_id=${tenant?.id}`);
            setLogs(response || []);
        } catch (error: any) {
            toast.error("Failed to fetch logs");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async (logId: string) => {
        if (!canManage) {
            toast.error("You don't have permission to retry calculations");
            return;
        }

        try {
            setRetrying(logId);
            await api.post(`/system/logs/${logId}/retry`);
            toast.success("Calculation retry initiated");
            fetchLogs(); // Refresh list
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to retry calculation");
        } finally {
            setRetrying(null);
        }
    };

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const getDuration = (log: CalculationLog) => {
        if (!log.completed_at) return "In Progress";
        const start = new Date(log.started_at).getTime();
        const end = new Date(log.completed_at).getTime();
        const seconds = Math.round((end - start) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    const filteredLogs = logs.filter((log) => {
        if (typeFilter !== "all" && log.type !== typeFilter) return false;
        if (statusFilter !== "all" && log.status !== statusFilter) return false;
        return true;
    });

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight">System Logs</h2>
                    <p className="text-sm text-muted-foreground">
                        View calculation history and server monitoring logs
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('calculations')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'calculations'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/50'
                            }`}
                    >
                        Calculation Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('server')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'server'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/50'
                            }`}
                    >
                        Server Logs
                    </button>
                </div>
            </div>

            {activeTab === 'calculations' ? (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Calculation Logs</CardTitle>
                                <CardDescription>
                                    Track overtime, payroll, and leave balance calculations
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Filter by type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="PAYROLL">Payroll</SelectItem>
                                        <SelectItem value="OVERTIME">Overtime</SelectItem>
                                        <SelectItem value="LEAVE_BALANCE">Leave Balance</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="FAILED">Failed</SelectItem>
                                        <SelectItem value="PROCESSING">Processing</SelectItem>
                                        <SelectItem value="QUEUED">Queued</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm" onClick={fetchLogs}>
                                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <FileText className="h-12 w-12 mb-4" />
                                <p>No calculation logs found</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Started At</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Triggered By</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogs.map((log) => {
                                        const StatusIcon = statusConfig[log.status]?.icon || Clock;
                                        const isExpanded = expandedRows.has(log.id);

                                        return (
                                            <React.Fragment key={log.id}>
                                                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {typeLabels[log.type] || log.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className={`${statusConfig[log.status]?.color} text-white flex items-center gap-1 w-fit`}
                                                        >
                                                            <StatusIcon className={`h-3 w-3 ${log.status === "PROCESSING" ? "animate-spin" : ""}`} />
                                                            {statusConfig[log.status]?.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatDate(log.started_at)}</TableCell>
                                                    <TableCell>{getDuration(log)}</TableCell>
                                                    <TableCell className="capitalize">
                                                        {log.triggered_by === 'Automatic' ? (
                                                            <Badge variant="secondary" className="text-xs">Automatic</Badge>
                                                        ) : log.triggered_by === 'Manual' ? (
                                                            <Badge variant="outline" className="text-xs">Manual</Badge>
                                                        ) : log.triggered_by}
                                                    </TableCell>
                                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                        {log.status === "FAILED" && log.triggered_by === 'Automatic' && canManage && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleRetry(log.id)}
                                                                disabled={retrying === log.id}
                                                            >
                                                                {retrying === log.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <RefreshCw className="h-4 w-4 mr-1" />
                                                                        Retry
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-muted/30">
                                                        <TableCell colSpan={7}>
                                                            <div className="p-4 space-y-4">
                                                                {log.result && log.result.message && (
                                                                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                                                                        <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-1">
                                                                            <FileText className="h-4 w-4" />
                                                                            Status Message
                                                                        </h4>
                                                                        <p className="text-sm text-blue-800 dark:text-blue-200">{log.result.message}</p>
                                                                    </div>
                                                                )}

                                                                {log.payload && (
                                                                    <div>
                                                                        <h4 className="font-medium mb-2">Request Payload</h4>
                                                                        <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                                                                            {JSON.stringify(log.payload, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                )}

                                                                {log.result && (
                                                                    <div>
                                                                        <h4 className="font-medium mb-2">Result Data</h4>
                                                                        <pre className="bg-green-50 dark:bg-green-950 p-3 rounded-md text-xs overflow-auto max-h-40">
                                                                            {JSON.stringify(log.result, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                )}

                                                                {log.error_message && (
                                                                    <div>
                                                                        <h4 className="font-medium mb-2 text-red-600 flex items-center gap-2">
                                                                            <AlertTriangle className="h-4 w-4" />
                                                                            Error Details
                                                                        </h4>
                                                                        <pre className="bg-red-50 dark:bg-red-950 p-3 rounded-md text-xs text-red-600 overflow-auto">
                                                                            {log.error_message}
                                                                        </pre>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            ) : activeTab === 'server' ? (
                <Card className="h-full">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Server Logs</CardTitle>
                                <CardDescription>
                                    Live logs from the calculation service (Python)
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchServerLogs}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-auto h-[600px] whitespace-pre-wrap">
                                {serverLogs || "No logs available."}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
