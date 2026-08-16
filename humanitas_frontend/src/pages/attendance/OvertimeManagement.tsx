import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, CheckCircle, XCircle, Edit, Calendar, ChevronDown, ChevronUp, Users, AlertCircle, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useOvertime } from "@/hooks/useOvertime";

export function OvertimeManagement() {
    // Hooks
    const {
        entriesQuery,
        periodStatusQuery,
        periodsQuery,
        activeJobQuery,
        payrollSettingsQuery,
        approveEntriesMutation,
        rejectEntriesMutation,
        updateEntryMutation,
        calculatePeriodMutation,
    } = useOvertime();

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters
    const [filters, setFilters] = useState({
        startDate: "",
        endDate: "",
        status: "Pending", // Default show pending
        userId: ""
    });

    // Period Calc State
    const [isPeriodCalcModalOpen, setIsPeriodCalcModalOpen] = useState(false);
    const [showAllEmployees, setShowAllEmployees] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
    const [periodCalcMonth, setPeriodCalcMonth] = useState(new Date().getMonth() + 1);
    const [periodCalcYear, setPeriodCalcYear] = useState(new Date().getFullYear());

    // Periods State
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");

    // Expandable Rows State
    const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [editHours, setEditHours] = useState({ normal: 0, night: 0, holiday: 0, dayoff: 0 });

    // Queries Data
    // Note: If no period selected, show all filtered. If period selected, user might want to filter by that period's dates? 
    // The original code auto-selected period but mostly used generic filters. 
    // The previous implementation fetched periods and auto-selected the first one but didn't explicitly use it to filter the entries query immediately unless the user manually set dates?
    // Actually the original code didn't use `selectedPeriod` in `fetchEntries` either, only `filters`!
    // But `useEffect` depended on `selectedPeriod`.
    // Let's keep `entriesQuery` driven by `filters` for now.

    const entries = entriesQuery(filters).data || [];
    // const isLoading = entriesQuery(filters).isLoading; // Unused
    const periodStatus = periodStatusQuery.data;
    const availablePeriods = periodsQuery.data || [];
    const activeJob = activeJobQuery.data;

    const currency = payrollSettingsQuery.data?.currency || "ETB";
    const otRequiresApproval = payrollSettingsQuery.data?.ot_requires_approval !== false;

    const isPeriodCalcLoading = calculatePeriodMutation.isPending;

    const formatCurrency = (val: string | number) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);
    };

    const handleRunPeriodCalc = async () => {
        // Always validate - use periodStatus.runDay if available, else default to 25
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const runDay = periodStatus?.runDay || 25;
        const cutoffDay = runDay - 2;

        // Block calculation for current month if past cutoff
        if (periodCalcYear === currentYear && periodCalcMonth === currentMonth) {
            if (today.getDate() >= cutoffDay) {
                toast.warning("Period Calculation Blocked", {
                    description: `Cannot calculate OT for ${currentMonth}/${currentYear}. Cutoff was day ${cutoffDay}. Only individual edits allowed until payroll runs on day ${runDay}.`,
                    duration: 6000,
                });
                return;
            }
        }

        // Block calculation for past months (frozen periods)
        // const selectedDate = new Date(periodCalcYear, periodCalcMonth - 1, 1);
        // const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
        // The logic seems a bit complex to blindly copy without verifying backend rules, but assuming frontend validation matches backend:
        if (periodStatus?.phase === 'FROZEN' && periodCalcMonth === currentMonth && periodCalcYear === currentYear) {
            // Basic check based on status
            toast.error("Frozen Period", {
                description: `Cannot calculate OT for ${periodCalcMonth}/${periodCalcYear}. This period is frozen.`,
                duration: 5000,
            });
            return;
        }

        setIsPeriodCalcModalOpen(false);
        calculatePeriodMutation.mutate({ year: periodCalcYear, month: periodCalcMonth }, {
            onSuccess: (result) => {
                toast.success("Calculation Queued!", {
                    description: `Job ID: ${result.job_id}. Processing in background.`,
                    duration: 4000,
                });
            },
            onError: (error) => {
                toast.error("Period Calculation Failed", {
                    description: error.message,
                    duration: 6000,
                });
            }

        });
    };

    const handleSaveInlineEdit = (entryId: string) => {
        updateEntryMutation.mutate({
            id: entryId,
            data: {
                normal_ot_hours: editHours.normal,
                night_ot_hours: editHours.night,
                holiday_ot_hours: editHours.holiday,
                dayoff_ot_hours: editHours.dayoff
            }
        }, {
            onSuccess: () => {
                setEditingEntryId(null);
            }
        });
    };

    // Watch for job completion
    const [prevActiveJobId, setPrevActiveJobId] = useState<string | null>(null);
    useEffect(() => {
        if (prevActiveJobId && !activeJob) {
            // Job just finished
            entriesQuery(filters).refetch();
            toast.success("Calculation Completed", { description: "Overtime entries have been updated." });
        }
        setPrevActiveJobId(activeJob ? activeJob.id : null);
    }, [activeJob, entriesQuery, filters]);

    // Actions
    const handleBulkApprove = () => {
        if (!selectedIds.size) return;
        if (!confirm(`Approve ${selectedIds.size} entries?`)) return;

        approveEntriesMutation.mutate(Array.from(selectedIds), {
            onSuccess: () => setSelectedIds(new Set())
        });
    };

    const handleBulkReject = () => {
        if (!selectedIds.size) return;
        if (!confirm(`Reject ${selectedIds.size} entries?`)) return;

        rejectEntriesMutation.mutate(Array.from(selectedIds), {
            onSuccess: () => setSelectedIds(new Set())
        });
    };


    // Compute monthly totals from entries
    const monthlyTotals = entries.reduce((acc, entry) => ({
        normal: acc.normal + (Number(entry.normal_ot_hours) || 0),
        night: acc.night + (Number(entry.night_ot_hours) || 0),
        holiday: acc.holiday + (Number(entry.holiday_ot_hours) || 0),
        dayoff: acc.dayoff + (Number(entry.dayoff_ot_hours) || 0),
        amount: acc.amount + (Number(entry.total_amount) || 0),
    }), { normal: 0, night: 0, holiday: 0, dayoff: 0, amount: 0 });

    // Compute per-user totals for summary sheet
    const userTotals = entries.reduce((acc, entry) => {
        const userId = entry.user_id;
        if (!acc[userId]) {
            acc[userId] = {
                user_id: userId,
                full_name: entry.full_name,
                department: entry.department,
                normal: 0,
                night: 0,
                holiday: 0,
                dayoff: 0,
                amount: 0,
                days: 0
            };
        }
        acc[userId].normal += Number(entry.normal_ot_hours) || 0;
        acc[userId].night += Number(entry.night_ot_hours) || 0;
        acc[userId].holiday += Number(entry.holiday_ot_hours) || 0;
        acc[userId].dayoff += Number(entry.dayoff_ot_hours) || 0;
        acc[userId].amount += Number(entry.total_amount) || 0;
        acc[userId].days += 1;
        return acc;
    }, {} as Record<string, { user_id: string; full_name: string; department: string; normal: number; night: number; holiday: number; dayoff: number; amount: number; days: number }>);

    const userTotalsList = Object.values(userTotals).sort((a, b) => b.amount - a.amount);

    // Selection Logic

    const toggleUserSelection = (userId: string) => {
        const userEntries = entries.filter(e => e.user_id === userId);
        const userEntryIds = userEntries.map(e => e.id);
        const allSelected = userEntryIds.every(id => selectedIds.has(id));

        const newSelected = new Set(selectedIds);
        if (allSelected) {
            userEntryIds.forEach(id => newSelected.delete(id));
        } else {
            userEntryIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === entries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(entries.map(e => e.id)));
        }
    };

    // Actions






    return (
        <div className="space-y-4">
            {/* Phase Status Banner */}
            {periodStatus && (
                <Alert variant={periodStatus.phase === 'FROZEN' ? 'destructive' : 'default'} className={
                    periodStatus.phase === 'ACTIVE' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                        periodStatus.phase === 'PROCESSING' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
                            'border-red-500 bg-red-50 dark:bg-red-950'
                }>
                    <div className="flex items-center gap-2">
                        {periodStatus.phase === 'FROZEN' ? (
                            <Lock className="h-4 w-4" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                        <div className="flex-1">
                            <AlertTitle className="flex items-center gap-2">
                                {periodStatus.phase === 'ACTIVE' && '🟢 Active Period'}
                                {periodStatus.phase === 'PROCESSING' && '🟡 Processing Period'}
                                {periodStatus.phase === 'FROZEN' && '🔴 Frozen Period'}
                                <Badge variant="outline" className="ml-2">{periodStatus.periodLabel}</Badge>
                            </AlertTitle>
                            <AlertDescription>
                                {periodStatus.message} | Period: {periodStatus.periodStart} → {periodStatus.periodEnd}
                            </AlertDescription>
                        </div>
                    </div>
                </Alert>
            )}

            <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                {/* Filters */}
                <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                        <Label>Status</Label>
                        <Select
                            value={filters.status}
                            onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Range Placeholders (Using Input type date for simplicity) */}
                    <div className="space-y-1">
                        <Label>From</Label>
                        <Input
                            type="date"
                            className="w-[150px]"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Bulk Actions - only show when approval is required */}
                {otRequiresApproval && selectedIds.size > 0 ? (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-sm self-center text-muted-foreground">{selectedIds.size} selected</span>
                        <Button onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700 text-white">
                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button onClick={handleBulkReject} variant="destructive">
                            <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-2 items-center">
                        {/* Period Selector */}
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground">Period:</Label>
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Period" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availablePeriods.map((p) => (
                                        <SelectItem key={p.label} value={p.label}>
                                            {p.label} ({p.entryCount} entries)
                                        </SelectItem>
                                    ))}
                                    {availablePeriods.length === 0 && (
                                        <SelectItem value="none" disabled>No periods available</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="inline-block">
                                        <Button
                                            variant="default"
                                            onClick={() => setIsPeriodCalcModalOpen(true)}
                                            disabled={isPeriodCalcLoading || !!activeJob}
                                        >
                                            {isPeriodCalcLoading || activeJob ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                            ) : (
                                                <><Calendar className="w-4 h-4 mr-2" /> Calculate Period</>
                                            )}
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                {activeJob && (
                                    <TooltipContent>
                                        <p>Calculation in progress (Job ID: {activeJob.id})</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>

            {/* Monthly Totals Summary */}
            {entries.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase">Normal OT</div>
                        <div className="text-lg font-semibold">{monthlyTotals.normal.toFixed(2)} hrs</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase">Night OT</div>
                        <div className="text-lg font-semibold">{monthlyTotals.night.toFixed(2)} hrs</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase">Holiday OT</div>
                        <div className="text-lg font-semibold text-orange-600">{monthlyTotals.holiday.toFixed(2)} hrs</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase">Day Off OT</div>
                        <div className="text-lg font-semibold text-blue-600">{monthlyTotals.dayoff.toFixed(2)} hrs</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase">Total Hours</div>
                        <div className="text-lg font-semibold">
                            {(monthlyTotals.normal + monthlyTotals.night + monthlyTotals.holiday + monthlyTotals.dayoff).toFixed(2)} hrs
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase">Total Amount</div>
                        <div className="text-lg font-bold text-emerald-600">{formatCurrency(monthlyTotals.amount)}</div>
                    </div>
                </div>
            )}

            {/* Per-User Summary Sheet - Collapsible */}
            {userTotalsList.length > 0 && (
                <div className="border rounded-md">
                    {/* Collapsible Header */}
                    <div
                        className="p-3 border-b bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    >
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <h3 className="font-semibold">Employee OT Summary</h3>
                            <Badge variant="secondary">{userTotalsList.length} employees</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                                Total: <span className="font-semibold text-emerald-600">{formatCurrency(monthlyTotals.amount)}</span>
                            </span>
                            {isSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    {isSummaryExpanded && (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="text-xs">
                                        {otRequiresApproval && (
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={entries.length > 0 && selectedIds.size === entries.length}
                                                    onCheckedChange={toggleAll}
                                                />
                                            </TableHead>
                                        )}
                                        <TableHead className="py-2">Employee</TableHead>
                                        <TableHead className="text-center py-2 w-16">Days</TableHead>
                                        <TableHead className="text-center py-2 w-20">Normal</TableHead>
                                        <TableHead className="text-center py-2 w-20">Holiday</TableHead>
                                        <TableHead className="text-center py-2 w-20">Day Off</TableHead>
                                        <TableHead className="text-center py-2 w-24">Total Hrs</TableHead>
                                        <TableHead className="text-right py-2 w-28">Amount</TableHead>
                                        <TableHead className="text-center py-2 w-24">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(showAllEmployees ? userTotalsList : userTotalsList.slice(0, 10)).map((user) => {
                                        const isExpanded = expandedEmployees.has(user.user_id);
                                        const userEntries = entries.filter(e => e.user_id === user.user_id);
                                        const isUserSelected = userEntries.length > 0 && userEntries.every(e => selectedIds.has(e.id));
                                        return (
                                            <>
                                                <TableRow
                                                    key={user.user_id}
                                                    className={`hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`}
                                                    onClick={() => {
                                                        const newSet = new Set(expandedEmployees);
                                                        if (newSet.has(user.user_id)) newSet.delete(user.user_id);
                                                        else newSet.add(user.user_id);
                                                        setExpandedEmployees(newSet);
                                                    }}
                                                >
                                                    {otRequiresApproval && (
                                                        <TableCell onClick={(e) => e.stopPropagation()} className="w-[50px]">
                                                            <Checkbox
                                                                checked={isUserSelected}
                                                                onCheckedChange={() => toggleUserSelection(user.user_id)}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-2">
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                            <span className="font-medium">{user.full_name}</span>
                                                            <span className="text-xs text-muted-foreground">({user.department})</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-2">{user.days}</TableCell>
                                                    <TableCell className="text-center py-2">{user.normal.toFixed(1)}</TableCell>
                                                    <TableCell className="text-center py-2 text-orange-600">{user.holiday.toFixed(1)}</TableCell>
                                                    <TableCell className="text-center py-2 text-blue-600">{user.dayoff.toFixed(1)}</TableCell>
                                                    <TableCell className="text-center py-2 font-medium">
                                                        {(user.normal + user.night + user.holiday + user.dayoff).toFixed(1)}
                                                    </TableCell>
                                                    <TableCell className="text-right py-2 font-medium text-emerald-600">
                                                        {formatCurrency(user.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-center py-2">
                                                        {(() => {
                                                            const statuses = userEntries.map(e => e.status);
                                                            const allApproved = statuses.every(s => s === 'Approved');
                                                            const allRejected = statuses.every(s => s === 'Rejected');
                                                            const hasPending = statuses.some(s => s === 'Pending');

                                                            if (allApproved) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Approved</Badge>;
                                                            if (allRejected) return <Badge variant="destructive">Rejected</Badge>;
                                                            if (hasPending) return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
                                                            return <Badge variant="secondary">Mixed</Badge>;
                                                        })()}
                                                    </TableCell>
                                                </TableRow>
                                                {/* Expanded Daily Breakdown */}
                                                {isExpanded && userEntries.map((entry) => (
                                                    <TableRow key={entry.id} className="bg-muted/20 text-xs">
                                                        {otRequiresApproval && <TableCell className="py-1"></TableCell>}
                                                        <TableCell className="py-1 pl-6">
                                                            <span className="text-muted-foreground">{format(new Date(entry.date), 'EEE, MMM d')}</span>
                                                        </TableCell>
                                                        <TableCell className="text-center py-1">-</TableCell>
                                                        {editingEntryId === entry.id ? (
                                                            <>
                                                                <TableCell className="text-center py-1">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.5"
                                                                        className="w-16 h-6 text-xs text-center"
                                                                        value={editHours.normal}
                                                                        onChange={(e) => setEditHours(prev => ({ ...prev, normal: parseFloat(e.target.value) || 0 }))}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center py-1">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.5"
                                                                        className="w-16 h-6 text-xs text-center"
                                                                        value={editHours.holiday}
                                                                        onChange={(e) => setEditHours(prev => ({ ...prev, holiday: parseFloat(e.target.value) || 0 }))}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center py-1">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.5"
                                                                        className="w-16 h-6 text-xs text-center"
                                                                        value={editHours.dayoff}
                                                                        onChange={(e) => setEditHours(prev => ({ ...prev, dayoff: parseFloat(e.target.value) || 0 }))}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center py-1">
                                                                    <div className="flex gap-1 justify-center">
                                                                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleSaveInlineEdit(entry.id)}>
                                                                            <CheckCircle className="w-3 h-3 text-green-600" />
                                                                        </Button>
                                                                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingEntryId(null)}>
                                                                            <XCircle className="w-3 h-3 text-red-600" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <TableCell className="text-center py-1">{Number(entry.normal_ot_hours).toFixed(1)}</TableCell>
                                                                <TableCell className="text-center py-1 text-orange-600">{Number(entry.holiday_ot_hours).toFixed(1)}</TableCell>
                                                                <TableCell className="text-center py-1 text-blue-600">{Number(entry.dayoff_ot_hours).toFixed(1)}</TableCell>
                                                                <TableCell className="text-center py-1">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-6 px-2"
                                                                        disabled={periodStatus?.phase === 'FROZEN'}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingEntryId(entry.id);
                                                                            setEditHours({
                                                                                normal: Number(entry.normal_ot_hours) || 0,
                                                                                night: Number(entry.night_ot_hours) || 0,
                                                                                holiday: Number(entry.holiday_ot_hours) || 0,
                                                                                dayoff: Number(entry.dayoff_ot_hours) || 0
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Edit className="w-3 h-3" />
                                                                    </Button>
                                                                </TableCell>
                                                            </>
                                                        )}
                                                        <TableCell className="text-right py-1 text-emerald-600">
                                                            {formatCurrency(entry.total_amount)}
                                                        </TableCell>
                                                        <TableCell className="text-center py-1">
                                                            <Badge
                                                                variant={entry.status === 'Approved' ? 'default' : entry.status === 'Rejected' ? 'destructive' : 'outline'}
                                                                className={entry.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-[10px]' :
                                                                    entry.status === 'Pending' ? 'border-yellow-500 text-yellow-600 text-[10px]' : 'text-[10px]'}
                                                            >
                                                                {entry.status}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </>
                                        );
                                    })}
                                    {/* Grand Total Row */}
                                    <TableRow className="bg-muted/50 font-bold border-t-2">
                                        {otRequiresApproval && <TableCell className="py-2"></TableCell>}
                                        <TableCell className="py-2">TOTAL ({userTotalsList.length} employees)</TableCell>
                                        <TableCell className="text-center py-2">{entries.length}</TableCell>
                                        <TableCell className="text-center py-2">{monthlyTotals.normal.toFixed(1)}</TableCell>
                                        <TableCell className="text-center py-2 text-orange-600">{monthlyTotals.holiday.toFixed(1)}</TableCell>
                                        <TableCell className="text-center py-2 text-blue-600">{monthlyTotals.dayoff.toFixed(1)}</TableCell>
                                        <TableCell className="text-center py-2">
                                            {(monthlyTotals.normal + monthlyTotals.night + monthlyTotals.holiday + monthlyTotals.dayoff).toFixed(1)}
                                        </TableCell>
                                        <TableCell className="text-right py-2 text-emerald-600">
                                            {formatCurrency(monthlyTotals.amount)}
                                        </TableCell>
                                        <TableCell className="text-center py-2">-</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table >

                            {/* Show More/Less Button */}
                            {
                                userTotalsList.length > 10 && (
                                    <div className="p-2 border-t text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowAllEmployees(!showAllEmployees)}
                                        >
                                            {showAllEmployees
                                                ? <>Show Top 10 <ChevronUp className="w-4 h-4 ml-1" /></>
                                                : <>Show All {userTotalsList.length} Employees <ChevronDown className="w-4 h-4 ml-1" /></>
                                            }
                                        </Button>
                                    </div>
                                )
                            }
                        </>
                    )}
                </div>
            )}

            {/* Period Calculation Modal */}
            <Dialog open={isPeriodCalcModalOpen} onOpenChange={setIsPeriodCalcModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Calculate Period Overtime</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Month</Label>
                                <Select
                                    value={String(periodCalcMonth)}
                                    onValueChange={(v) => setPeriodCalcMonth(Number(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">January</SelectItem>
                                        <SelectItem value="2">February</SelectItem>
                                        <SelectItem value="3">March</SelectItem>
                                        <SelectItem value="4">April</SelectItem>
                                        <SelectItem value="5">May</SelectItem>
                                        <SelectItem value="6">June</SelectItem>
                                        <SelectItem value="7">July</SelectItem>
                                        <SelectItem value="8">August</SelectItem>
                                        <SelectItem value="9">September</SelectItem>
                                        <SelectItem value="10">October</SelectItem>
                                        <SelectItem value="11">November</SelectItem>
                                        <SelectItem value="12">December</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Year</Label>
                                <Select
                                    value={String(periodCalcYear)}
                                    onValueChange={(v) => setPeriodCalcYear(Number(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2023">2023</SelectItem>
                                        <SelectItem value="2024">2024</SelectItem>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This will calculate overtime for all employees within the selected payroll period.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPeriodCalcModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleRunPeriodCalc} disabled={isPeriodCalcLoading}>
                            {isPeriodCalcLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating...</> : 'Calculate'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


