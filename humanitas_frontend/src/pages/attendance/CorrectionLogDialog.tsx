import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2 } from "lucide-react";

interface CorrectionLog {
    id: string;
    action: string;
    previous_state: any;
    new_state: any;
    reason: string | null;
    corrected_at: string;
    corrected_by_name: string;
    target_user_name: string;
}

interface CorrectionLogsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    timezone?: string;
}

export function CorrectionLogDialog({ open, onOpenChange }: CorrectionLogsModalProps) {
    const [logs, setLogs] = useState<CorrectionLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchLogs();
        }
    }, [open]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/attendance/correction-logs`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setLogs(data.data || []);
            }
        } catch (error) {
            console.error("Error fetching correction logs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatLogTime = (isoString?: string) => {
        if (!isoString) return "-";
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return "-";
            // Simple format: MM/DD/YY, HH:MM
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            const year = d.getFullYear().toString().slice(-2);
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            return `${month}/${day}/${year}, ${hours}:${mins}`;
        } catch {
            return "-";
        }
    };

    const formatTimeOnly = (timeStr?: string) => {
        if (!timeStr) return "-";
        try {
            const d = new Date(timeStr);
            if (isNaN(d.getTime())) {
                // If it's already HH:mm format, return as-is
                if (timeStr.includes(':')) return timeStr.substring(0, 5);
                return "-";
            }
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            return `${hours}:${mins}`;
        } catch {
            return timeStr || "-";
        }
    };

    const renderChange = (prev: any, curr: any) => {
        const changes: string[] = [];
        if (prev?.status !== curr?.status) changes.push(`Status: ${prev?.status || '-'} → ${curr?.status || '-'}`);
        if (prev?.clock_in !== curr?.clock_in) changes.push(`In: ${formatTimeOnly(prev?.clock_in)} → ${formatTimeOnly(curr?.clock_in)}`);
        if (prev?.clock_out !== curr?.clock_out) changes.push(`Out: ${formatTimeOnly(prev?.clock_out)} → ${formatTimeOnly(curr?.clock_out)}`);

        return changes.length > 0 ? changes.join(", ") : "Manual Update";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Attendance Correction Logs</DialogTitle>
                </DialogHeader>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Changes</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Corrected By</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No correction logs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{formatLogTime(log.corrected_at)}</TableCell>
                                        <TableCell>{log.target_user_name}</TableCell>
                                        <TableCell className="max-w-[300px] break-words">
                                            {renderChange(log.previous_state, log.new_state)}
                                        </TableCell>
                                        <TableCell>{log.reason || "-"}</TableCell>
                                        <TableCell>{log.corrected_by_name}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
