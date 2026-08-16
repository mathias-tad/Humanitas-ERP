import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/config/api.config";
import { FileText, Save, Plus } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface AdminPerDiemClaim {
    id: string;
    user_id: string;
    user_name: string;
    month: number;
    year: number;
    has_receipt: boolean;
    receipt_file_url: string | null;
    receipt_amount: number | null;
    calculated_amount: number | null;
    status: 'PENDING_USER_ACTION' | 'PENDING_RECEIPT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
    rejection_reason?: string;
}

interface User {
    id: string;
    full_name: string;
}

const MONTHS = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

export function AdminPerDiemClaims() {
    const [claims, setClaims] = useState<AdminPerDiemClaim[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth() + 1 + "");
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear() + "");

    // Assign Modal
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignUserId, setAssignUserId] = useState<string>('');
    const [assignMonth, setAssignMonth] = useState<number>(new Date().getMonth() + 1);
    const [assignYear, setAssignYear] = useState<number>(new Date().getFullYear());

    // Review/Edit Modal
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewingClaim, setReviewingClaim] = useState<AdminPerDiemClaim | null>(null);
    const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
    const [approvedAmount, setApprovedAmount] = useState<string>('');
    const [rejectionReason, setRejectionReason] = useState<string>('');

    useEffect(() => {
        fetchClaims();
        fetchUsers();
    }, [selectedMonth, selectedYear]);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/users`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (selectedMonth && selectedMonth !== 'all') queryParams.append('month', selectedMonth);
            if (selectedYear) queryParams.append('year', selectedYear);

            const res = await fetch(`${API_BASE_URL}/per-diem/all-claims?${queryParams.toString()}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setClaims(data);
            } else {
                toast.error('Failed to load claims');
            }
        } catch (error) {
            console.error('Failed to fetch claims:', error);
            toast.error('Failed to load claims');
        } finally {
            setLoading(false);
        }
    };

    // --- Assignment Logic ---
    const handleAssignPerDiem = async () => {
        if (!assignUserId) return toast.error('Please select a user');

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/per-diem/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: assignUserId,
                    month: assignMonth,
                    year: assignYear,
                }),
            });

            if (res.ok) {
                toast.success('Per Diem Assigned Successfully');
                setIsAssignModalOpen(false);
                fetchClaims();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Failed to assign per diem');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to assign per diem');
        } finally {
            setLoading(false);
        }
    };

    // --- Review Logic ---
    const openReviewModal = (claim: AdminPerDiemClaim) => {
        setReviewingClaim(claim);
        setReviewStatus(claim.status === 'REJECTED' ? 'REJECTED' : 'APPROVED');
        setApprovedAmount(claim.receipt_amount ? claim.receipt_amount.toString() : '');
        setRejectionReason(claim.rejection_reason || '');
        setIsReviewModalOpen(true);
    };

    const handleReviewSubmit = async () => {
        if (!reviewingClaim) return;
        setLoading(true);
        try {
            const body: any = { status: reviewStatus };
            if (reviewStatus === 'APPROVED' && approvedAmount) {
                body.approved_amount = parseFloat(approvedAmount);
            }
            if (reviewStatus === 'REJECTED') {
                body.rejection_reason = rejectionReason;
            }

            const res = await fetch(`${API_BASE_URL}/per-diem/review/${reviewingClaim.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (res.ok) {
                toast.success('Claim Review Submitted');
                setIsReviewModalOpen(false);
                fetchClaims();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Review failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Review failed');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING_USER_ACTION':
                return <Badge variant="outline" className="text-gray-500">Wait User Action</Badge>;
            case 'PENDING_RECEIPT':
                return <Badge variant="outline" className="text-orange-500 border-orange-200">Wait Upload</Badge>;
            case 'PENDING_REVIEW':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
            case 'APPROVED':
                return <Badge className="bg-green-600 hover:bg-green-700">Approved</Badge>;
            case 'REJECTED':
                return <Badge variant="destructive">Rejected</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Per Diem Management</CardTitle>
                            <CardDescription>
                                Assign new per diems and review status/receipts.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024">2024</SelectItem>
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={() => setIsAssignModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" /> Assign
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Receipt Info</TableHead>
                                <TableHead>Calc. Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {claims.map((claim) => (
                                <TableRow key={claim.id}>
                                    <TableCell className="font-medium">{claim.user_name}</TableCell>
                                    <TableCell>{MONTHS.find(m => m.value === claim.month)?.label} {claim.year}</TableCell>
                                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                                    <TableCell>
                                        {claim.has_receipt ? (
                                            claim.receipt_file_url ? (
                                                <div className="flex items-center gap-2">
                                                    <a href={API_BASE_URL + claim.receipt_file_url} target="_blank" className="text-blue-600 hover:underline flex items-center text-xs">
                                                        <FileText className="h-3 w-3 mr-1" /> View
                                                    </a>
                                                    <span className="text-xs text-gray-500">
                                                        ({claim.receipt_amount} ETB)
                                                    </span>
                                                </div>
                                            ) : <span className="text-xs text-orange-400">Not Uploaded</span>
                                        ) : <span className="text-xs text-gray-400">N/A</span>}
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {claim.calculated_amount ? `${Number(claim.calculated_amount).toFixed(2)}` : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => openReviewModal(claim)}>
                                            {claim.status === 'PENDING_REVIEW' ? 'Review' : 'Edit'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {claims.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        No claims found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Assign Modal */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Per Diem</DialogTitle>
                        <DialogDescription>Assign a per diem allowance to an employee for a specific month.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>User</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                value={assignUserId}
                                onChange={(e) => setAssignUserId(e.target.value)}
                            >
                                <option value="">Select User...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Month</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={assignMonth}
                                    onChange={(e) => setAssignMonth(parseInt(e.target.value))}
                                >
                                    {MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label>Year</Label>
                                <Input type="number" value={assignYear} onChange={(e) => setAssignYear(parseInt(e.target.value))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignPerDiem} disabled={loading}>Assign</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Modal */}
            <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review Claim - {reviewingClaim?.user_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Status Decision</Label>
                            <Select value={reviewStatus} onValueChange={(v: any) => setReviewStatus(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="APPROVED">Approve</SelectItem>
                                    <SelectItem value="REJECTED">Reject</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {reviewStatus === 'APPROVED' && reviewingClaim?.has_receipt && (
                            <div className="grid gap-2">
                                <Label>Receipt Amount (ETB) {reviewingClaim.receipt_file_url && <a href={API_BASE_URL + reviewingClaim.receipt_file_url} target="_blank" className="text-xs text-blue-600 ml-2 underline">View Receipt</a>}</Label>
                                <Input
                                    type="number"
                                    value={approvedAmount}
                                    onChange={(e) => setApprovedAmount(e.target.value)}
                                    placeholder="Enter verified amount"
                                />
                                <p className="text-xs text-gray-500">Edit this if the receipt amount differs from user input.</p>
                            </div>
                        )}

                        {reviewStatus === 'REJECTED' && (
                            <div className="grid gap-2">
                                <Label>Rejection Reason</Label>
                                <Input
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Why is this claim rejected?"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleReviewSubmit} disabled={loading}>
                            <Save className="h-4 w-4 mr-1" /> Save Decision
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
