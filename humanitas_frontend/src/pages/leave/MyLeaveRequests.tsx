import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Plus,
    MoreVertical,
    FileText,
    PieChart
} from "lucide-react";

interface MyLeaveRequest {
    id: number;
    type: "Annual" | "Sick" | "Personal" | "Unpaid";
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    status: "Pending" | "Approved" | "Rejected";
    appliedOn: string;
    approver: string;
}

const myRequests: MyLeaveRequest[] = [
    { id: 1, type: "Annual", startDate: "2025-12-20", endDate: "2025-12-26", days: 5, reason: "Family vacation", status: "Pending", appliedOn: "2025-11-28", approver: "Sarah Jenkins" },
    { id: 2, type: "Sick", startDate: "2025-10-15", endDate: "2025-10-16", days: 2, reason: "Flu", status: "Approved", appliedOn: "2025-10-14", approver: "Sarah Jenkins" },
    { id: 3, type: "Personal", startDate: "2025-09-05", endDate: "2025-09-05", days: 1, reason: "Appointment", status: "Approved", appliedOn: "2025-09-01", approver: "Sarah Jenkins" },
    { id: 4, type: "Annual", startDate: "2025-08-10", endDate: "2025-08-20", days: 10, reason: "Summer trip", status: "Rejected", appliedOn: "2025-07-25", approver: "Sarah Jenkins" },
];

const leaveBalances = [
    { type: "Annual Leave", available: 12, used: 8, total: 20, color: "text-primary", bg: "bg-primary/10" },
    { type: "Sick Leave", available: 5, used: 5, total: 10, color: "text-orange-600", bg: "bg-orange-100" },
    { type: "Personal Leave", available: 2, used: 1, total: 3, color: "text-purple-600", bg: "bg-purple-100" },
];

const getStatusColor = (status: MyLeaveRequest["status"]) => {
    switch (status) {
        case "Approved": return "bg-green-100 text-green-800";
        case "Rejected": return "bg-red-100 text-red-800";
        case "Pending": return "bg-yellow-100 text-yellow-800";
        default: return "bg-gray-100 text-gray-800";
    }
};

export default function MyLeaveRequests() {
    return (
        <>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
                        <p className="text-gray-500 mt-1">View your leave balance and request history</p>
                    </div>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                        <Plus className="h-4 w-4" />
                        Apply for Leave
                    </Button>
                </div>

                {/* Leave Balances */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {leaveBalances.map((balance) => (
                        <Card key={balance.type} className="py-2">
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${balance.bg}`}>
                                        <PieChart className={`h-6 w-6 ${balance.color}`} />
                                    </div>
                                    <span className="text-2xl font-bold text-gray-900">{balance.available}</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{balance.type}</p>
                                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                                        <span>Available</span>
                                        <span>{balance.used} used of {balance.total}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                                        <div
                                            className={`h-2 rounded-full ${balance.type === "Annual Leave" ? "bg-primary" : balance.type === "Sick Leave" ? "bg-orange-500" : "bg-purple-500"}`}
                                            style={{ width: `${(balance.used / balance.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Recent Requests */}
                <Card>
                    <CardHeader className="border-b flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Request History</CardTitle>
                        <Button variant="outline" size="sm" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Download Report
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Leave Type</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Days</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Approver</TableHead>
                                    <TableHead>Applied On</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myRequests.map((request) => (
                                    <TableRow key={request.id} className="hover:bg-gray-50">
                                        <TableCell className="font-medium text-gray-900">
                                            {request.type}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm">
                                                <span className="text-gray-900">{request.startDate}</span>
                                                <span className="text-gray-500 text-xs">to {request.endDate}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{request.days} days</TableCell>
                                        <TableCell className="text-gray-600 max-w-[200px] truncate">
                                            {request.reason}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-600">{request.approver}</TableCell>
                                        <TableCell className="text-gray-500 text-sm">{request.appliedOn}</TableCell>
                                        <TableCell>
                                            <button className="p-1 hover:bg-gray-100 rounded">
                                                <MoreVertical className="h-4 w-4 text-gray-400" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
