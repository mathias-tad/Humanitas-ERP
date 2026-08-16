
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
import { useLatenessSummary } from "@/hooks/useAttendance";
import { Loader2, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface LatenessSummaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date?: string; // Initial date to focus on
    userId?: string; // Optional: Filter for specific user
}

export function LatenessSummaryDialog({
    open,
    onOpenChange,
    date,
    userId
}: LatenessSummaryDialogProps) {
    // Initialize with the provided date or current month
    const [selectedMonth, setSelectedMonth] = useState("");

    useEffect(() => {
        if (open) {
            if (date) {
                // Extract YYYY-MM from the provided date string
                setSelectedMonth(date.substring(0, 7));
            } else {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                setSelectedMonth(`${year}-${month}`);
            }
        }
    }, [open, date]);

    // Construct a date string for the API (use 1st of month to ensure correct month calculation)
    const queryDate = selectedMonth ? `${selectedMonth}-01` : undefined;

    const { data: summary = [], isLoading, isError } = useLatenessSummary(queryDate, userId);

    const formatMinutes = (val: string | number) => {
        const minutes = Number(val);
        if (!minutes) return "-";
        return `${minutes}m`;
    };

    const hasData = summary.some(item => Number(item.month_late) > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <div className="flex items-center justify-between mr-8">
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-500" />
                            Monthly Lateness Report
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                            <Input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-40 h-8 text-sm"
                            />
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-4">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : isError ? (
                        <div className="text-center p-8 text-red-500">
                            Failed to load summary data.
                        </div>
                    ) : !hasData && summary.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            No late records found for {selectedMonth}.
                        </div>
                    ) : (
                        <div className="border rounded-md max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[250px]">Employee</TableHead>
                                        <TableHead className="text-right">Month Total</TableHead>
                                        <TableHead className="text-right text-gray-400 font-normal">Weekly Total</TableHead>
                                        <TableHead className="text-right text-gray-400 font-normal">Selected Day (1st)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{item.full_name}</p>
                                                    <p className="text-xs text-gray-500">{item.department}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-base">
                                                {Number(item.month_late) > 0 ? (
                                                    <span className="text-orange-600">{formatMinutes(item.month_late)}</span>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-500">
                                                {Number(item.week_late) > 0 ? formatMinutes(item.week_late) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-400">
                                                {Number(item.today_late) > 0 ? formatMinutes(item.today_late) : "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {summary.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-gray-500 h-24">
                                                No employees with late minutes this month.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
