import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
// Remove ScrollArea if not present, use div
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSchedulingAuditLogs, type SchedulingAuditLog } from '@/hooks/useScheduling';

export const SchedulingAuditLogs = () => {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");

    const { data, isLoading, isFetching, refetch } = useSchedulingAuditLogs(page, searchQuery);

    const logs = data?.data || [];
    const totalPages = data?.meta?.totalPages || 1;

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
        if (action.includes('ASSIGN')) return 'bg-primary/20 text-primary';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    // Generate human-readable action description
    const getActionDescription = (log: SchedulingAuditLog) => {
        const actor = log.user_name || 'Someone';
        const target = log.details?.target_user_name || 'a user';
        const change = log.details?.change_description || '';

        switch (log.action) {
            case 'ASSIGN_SCHEDULE':
                return `${actor} ${change ? change.toLowerCase() : 'modified the schedule'} for ${target}`;
            case 'CREATE_SHIFT':
                return `${actor} created shift "${log.details?.name || 'Unknown'}"`;
            case 'UPDATE_SHIFT':
                return `${actor} updated shift "${log.details?.name || 'Unknown'}"`;
            case 'DELETE_SHIFT':
                return `${actor} deleted a shift`;
            case 'CREATE_PATTERN':
                return `${actor} created pattern "${log.details?.name || 'Unknown'}"`;
            case 'UPDATE_PATTERN':
                return `${actor} updated pattern "${log.details?.name || 'Unknown'}"`;
            case 'DELETE_PATTERN':
                return `${actor} deleted a pattern`;
            case 'ASSIGN_PATTERN':
                return `${actor} assigned a pattern to ${target}`;
            case 'REMOVE_ASSIGNMENT':
                return `${actor} removed assignment for ${target}`;
            default:
                return `${actor} performed ${log.action.replace(/_/g, ' ').toLowerCase()}`;
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Scheduling History</CardTitle>
                        <CardDescription>
                            Tracking all changes made to shifts, patterns, and schedules (Who, When, and Why).
                        </CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} // Reset to page 1 on search
                            className="pl-8 h-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && logs.length === 0 ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="h-[600px] w-full rounded-md border overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[180px]">Timestamp</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Reason / Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && logs.length > 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                                <span className="text-muted-foreground text-sm">Loading...</span>
                                            </TableCell>
                                        </TableRow>
                                    ) : logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-medium">
                                                {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{log.user_name || 'Unknown'}</span>
                                                    <span className="text-xs text-muted-foreground">{log.user_email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getActionColor(log.action)}>
                                                    {log.action.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {/* Human-readable action description */}
                                                    <div className="text-sm font-medium">
                                                        {getActionDescription(log)}
                                                    </div>

                                                    {/* Reason Display */}
                                                    {log.details?.reason && (
                                                        <div className="text-sm font-medium text-gray-700 italic">
                                                            "{log.details.reason}"
                                                        </div>
                                                    )}

                                                    {/* Technical Details (Collapsed or Small) */}
                                                    <div className="text-xs text-muted-foreground truncate max-w-[300px]" title={JSON.stringify(log.details, null, 2)}>
                                                        {!log.details.change_description && (
                                                            <>
                                                                {log.action === 'ASSIGN_SCHEDULE' && `Date: ${log.details.date}`}
                                                                {log.action === 'CREATE_SHIFT' && `Shift: ${log.details.name}`}
                                                                {log.action === 'ASSIGN_PATTERN' && `Pattern: ${log.details.pattern_id}`}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <div className="flex-1 text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </div>
                            <div className="space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-2" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card >
    );
};
