import { useEffect, useState } from "react";
import { ArrowRight, ShieldAlert, GitPullRequest } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useGeneralSettings } from "@/hooks/useSettings";
import { normalizeTimezone } from "@/lib/utils";

interface TaskActivityLog {
    id: string;
    action: 'CREATE' | 'STATUS_CHANGE' | 'ASSIGN' | 'CLAIM_REVIEW' | 'COMMENT' | 'BLOCK' | 'UNBLOCK' | 'UNDO';
    user: {
        id: string;
        full_name: string;
        email: string;
    };
    from_value?: string;
    to_value?: string;
    reason?: string;
    created_at: string;
}

export function TaskHistory({ taskId }: { taskId: string }) {
    const [logs, setLogs] = useState<TaskActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { settingsQuery } = useGeneralSettings();
    const timezone = settingsQuery.data?.timezone ? normalizeTimezone(settingsQuery.data.timezone) : "UTC";

    // Debugging Timezone
    useEffect(() => {
        if (settingsQuery.isFetched) {
            console.log('[TaskHistory] General Settings Loaded:', settingsQuery.data);
            console.log('[TaskHistory] Resolved Timezone:', timezone);
            console.log('[TaskHistory] Browser Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
    }, [settingsQuery.isFetched, settingsQuery.data, timezone]);

    useEffect(() => {
        const fetchHistory = async () => {
            console.log('[TaskHistory] Fetching history for taskId:', taskId);
            try {
                const token = localStorage.getItem('token');

                const res = await fetch(`${API_BASE_URL}/pms/tasks/${taskId}/history`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    setLogs(data);
                } else {
                    const errText = await res.text();
                    console.error('[TaskHistory] Error response:', errText);
                    setError(`Failed to load history: ${res.status}`);
                }
            } catch (err) {
                console.error("[TaskHistory] Failed to fetch history", err);
                setError('Network error');
            } finally {
                setLoading(false);
            }
        };

        if (taskId) fetchHistory();
    }, [taskId]);

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const formatted = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            }).format(date);
            console.log(`[TaskHistory] Formatting '${dateString}' -> '${formatted}' (Zone: ${timezone})`);
            return formatted;
        } catch (e) {
            console.error("Date formatting error:", e);
            return dateString;
        }
    };

    if (loading) return <div className="p-4 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (logs.length === 0) return <div className="p-8 text-center text-gray-500">No activity yet.</div>;

    return (
        <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6 pl-2">
                {logs.map((log) => (
                    <div key={log.id} className="relative flex gap-4 pb-2">
                        {/* Timeline Line */}
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200 -z-10 last:hidden" />

                        <Avatar className="h-8 w-8 border-2 border-white bg-white">
                            {/* Use initials if no image */}
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                {log.user.full_name ? log.user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U'}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">{log.user.full_name}</p>
                                <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                            </div>

                            <div className="text-sm text-gray-600">
                                {getActionLabel(log)}
                            </div>

                            {log.reason && (
                                <div className="mt-2 text-sm bg-gray-50 p-2 rounded border border-gray-100 italic text-gray-600">
                                    "{log.reason}"
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

function getActionLabel(log: TaskActivityLog) {
    switch (log.action) {
        case 'CREATE':
            return <span>Task created by <strong>{log.user.full_name}</strong></span>;
        case 'STATUS_CHANGE':
            return (
                <span className="flex items-center gap-2">
                    Changed status from <strong className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{log.from_value}</strong>
                    <ArrowRight className="h-3 w-3" />
                    <strong className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{log.to_value}</strong>
                </span>
            );
        case 'ASSIGN':
            return <span>Assigned to <strong>{log.to_value}</strong></span>;
        case 'CLAIM_REVIEW':
            return <span className="text-purple-600 font-medium flex items-center gap-1"><GitPullRequest className="h-3 w-3" /> Claimed for Review</span>;
        case 'BLOCK':
            return <span className="text-red-600 font-bold flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> BLOCKED TASK</span>;
        case 'UNDO':
            return <span className="text-orange-600 flex items-center gap-1">Undid previous action</span>;
        default:
            return <span>{log.action}</span>;
    }
}
