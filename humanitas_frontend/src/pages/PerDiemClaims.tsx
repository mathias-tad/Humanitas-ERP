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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/config/api.config";
import { Upload, FileText, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
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

interface PerDiemClaim {
    id: string;
    month: number;
    year: number;
    has_receipt: boolean;
    receipt_file_url: string | null;
    receipt_uploaded_at: string | null;
    calculated_amount: number | null;
    receipt_amount: number | null;
    status: 'PENDING_USER_ACTION' | 'PENDING_RECEIPT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
    rejection_reason?: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function PerDiemClaims() {
    const [claims, setClaims] = useState<PerDiemClaim[]>([]);

    // Response Modal State
    const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
    const [responseChoice, setResponseChoice] = useState<'WITH_RECEIPT' | 'WITHOUT_RECEIPT'>('WITHOUT_RECEIPT');
    const [isSubmittingChoice, setIsSubmittingChoice] = useState(false);

    // Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadingClaimId, setUploadingClaimId] = useState<string | null>(null);
    const [receiptAmount, setReceiptAmount] = useState<string>('');

    useEffect(() => {
        fetchClaims();
    }, []);

    const fetchClaims = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/per-diem/my-claims`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setClaims(data);
            }
        } catch (error) {
            console.error('Failed to fetch claims:', error);
            toast.error('Failed to load claims');
        } finally {
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUploadReceipt = async (claimId: string) => {
        if (!selectedFile) return;
        if (!receiptAmount) {
            toast.warning('Please enter the amount shown on the receipt');
            return;
        }

        setUploadingClaimId(claimId);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('receipt_amount', receiptAmount);

        try {
            const res = await fetch(`${API_BASE_URL}/per-diem/upload-receipt/${claimId}`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (res.ok) {
                setSelectedFile(null);
                setReceiptAmount('');
                fetchClaims();
                toast.success('Receipt uploaded successfully');
            } else {
                toast.error('Failed to upload receipt');
            }
        } catch (error) {
            console.error('Failed to upload receipt:', error);
            toast.error('Failed to upload receipt');
        } finally {
            setUploadingClaimId(null);
        }
    };

    const openResponseModal = (claimId: string) => {
        setSelectedClaimId(claimId);
        setResponseChoice('WITHOUT_RECEIPT'); // Default
        setIsResponseModalOpen(true);
    };

    const handleSubmitChoice = async () => {
        if (!selectedClaimId) return;
        setIsSubmittingChoice(true);
        try {
            const res = await fetch(`${API_BASE_URL}/per-diem/choice/${selectedClaimId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ choice: responseChoice }),
            });

            if (res.ok) {
                toast.success('Response submitted successfully');
                setIsResponseModalOpen(false);
                fetchClaims();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Failed to submit choice');
            }
        } catch (error) {
            console.error('Failed to submit choice:', error);
            toast.error('Failed to submit response');
        } finally {
            setIsSubmittingChoice(false);
        }
    };

    const getStatusBadge = (claim: PerDiemClaim) => {
        switch (claim.status) {
            case 'PENDING_USER_ACTION':
                return <Badge variant="outline" className="text-orange-600 border-orange-600"><Clock className="w-3 h-3 mr-1" /> Action Required</Badge>;
            case 'PENDING_RECEIPT':
                return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Upload Receipt</Badge>;
            case 'PENDING_REVIEW':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" /> In Review</Badge>;
            case 'APPROVED':
                return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
            case 'REJECTED':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            default:
                return <Badge variant="secondary">{claim.status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>My Per Diem Assignments</CardTitle>
                    <CardDescription>
                        View your assigned per diem allowances and provide necessary responses.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month/Year</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Choice</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {claims.map((claim) => (
                                <TableRow key={claim.id}>
                                    <TableCell>
                                        {MONTHS[claim.month - 1]} {claim.year}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(claim)}</TableCell>
                                    <TableCell>
                                        {claim.status === 'PENDING_USER_ACTION' ? '—' :
                                            claim.has_receipt ? 'With Receipt' : 'Without Receipt'}
                                    </TableCell>
                                    <TableCell>
                                        {claim.calculated_amount
                                            ? `${Number(claim.calculated_amount).toFixed(2)} ETB`
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {claim.status === 'PENDING_USER_ACTION' && (
                                            <Button size="sm" onClick={() => openResponseModal(claim.id)}>
                                                Respond
                                            </Button>
                                        )}

                                        {claim.status === 'PENDING_RECEIPT' && !claim.receipt_file_url && (
                                            <div className="flex flex-col gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Receipt Amount"
                                                    value={receiptAmount}
                                                    onChange={(e) => setReceiptAmount(e.target.value)}
                                                    className="w-32 h-8 text-sm"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={handleFileSelect}
                                                        className="w-48 h-8 text-xs file:mr-2 file:py-1 file:px-2"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => handleUploadReceipt(claim.id)}
                                                        disabled={!selectedFile || !receiptAmount || uploadingClaimId === claim.id}
                                                    >
                                                        {uploadingClaimId === claim.id ? '...' : <Upload className="h-3 w-3" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {claim.receipt_file_url && (
                                            <div className="flex flex-col gap-1">
                                                <a
                                                    href={API_BASE_URL + claim.receipt_file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                                                >
                                                    <FileText className="h-3 w-3" />
                                                    View Receipt
                                                </a>
                                            </div>
                                        )}

                                        {claim.status === 'REJECTED' && claim.rejection_reason && (
                                            <div className="text-xs text-red-600 max-w-[200px]">
                                                Note: {claim.rejection_reason}
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {claims.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                                        No per diem assignments found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Response Modal */}
            <Dialog open={isResponseModalOpen} onOpenChange={setIsResponseModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Respond to Per Diem Assignment</DialogTitle>
                        <DialogDescription>
                            Please choose how you would like to claim this per diem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-3">
                            <label className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${responseChoice === 'WITHOUT_RECEIPT' ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>
                                <input
                                    type="radio"
                                    name="choice"
                                    className="mt-1"
                                    checked={responseChoice === 'WITHOUT_RECEIPT'}
                                    onChange={() => setResponseChoice('WITHOUT_RECEIPT')}
                                />
                                <div>
                                    <div className="font-medium text-gray-900">Claim Without Receipt</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        You will receive the standard fixed amount or percentage of salary. No upload required.
                                        <div className="text-xs text-green-600 font-medium mt-1">Status will be Approved immediately.</div>
                                    </div>
                                </div>
                            </label>

                            <label className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${responseChoice === 'WITH_RECEIPT' ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>
                                <input
                                    type="radio"
                                    name="choice"
                                    className="mt-1"
                                    checked={responseChoice === 'WITH_RECEIPT'}
                                    onChange={() => setResponseChoice('WITH_RECEIPT')}
                                />
                                <div>
                                    <div className="font-medium text-gray-900">Claim With Receipt</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        Upload an accommodation receipt to be reimbursed for the receipt amount + allowance.
                                        <div className="text-xs text-orange-600 font-medium mt-1">
                                            Requires Ops/Admin Review. Must upload before payroll run.
                                        </div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsResponseModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitChoice} disabled={isSubmittingChoice}>
                            {isSubmittingChoice ? 'Submitting...' : 'Confirm Choice'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
