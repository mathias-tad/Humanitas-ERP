
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
import { useMyAttendance } from "@/hooks/useAttendance";
import { Loader2, Calendar as CalendarIcon, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface AbsenceHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId?: string; // Future proofing, though useMyAttendance currently uses current user
}

export function AbsenceHistoryDialog({
    open,
    onOpenChange,
    // userId // Unused for now as hook uses current user context
}: AbsenceHistoryDialogProps) {
    // Initialize with current month
    const [selectedMonth, setSelectedMonth] = useState("");

    useEffect(() => {
        if (open) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            setSelectedMonth(`${year}-${month}`);
        }
    }, [open]);

    // Parse selected month for the hook
    const year = selectedMonth ? parseInt(selectedMonth.split('-')[0]) : new Date().getFullYear();
    const month = selectedMonth ? parseInt(selectedMonth.split('-')[1]) : new Date().getMonth() + 1;

    // Fetch records for the selected month
    const { data: records = [], isLoading, isError } = useMyAttendance(month, year);

    // Filter for absences
    const absenceRecords = records.filter(r => r.status === 'Absent');

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateString;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <div className="flex items-center justify-between mr-8">
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" />
                            My Absence Report
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
                            Failed to load attendance data.
                        </div>
                    ) : absenceRecords.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            No absences recorded for {selectedMonth}.
                        </div>
                    ) : (
                        <div className="border rounded-md max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {absenceRecords.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-medium">
                                                {formatDate(record.date)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Absent
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">
                                                {record.remarks || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
