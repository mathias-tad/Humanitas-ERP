import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Edit, Banknote, Check, X, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { Textarea } from "@/components/ui/textarea";

interface Loan {
    id: string;
    loan_type: string;
    description: string;
    total_amount: string;
    monthly_deduction: string;
    remaining_balance: string;
    start_month: number;
    start_year: number;
    term_months: number;
    status: 'pending' | 'active' | 'completed' | 'cancelled' | 'rejected' | 'frozen';
    approval_status: 'pending' | 'approved' | 'rejected';
    current_step: number;
    created_at: string;
}

interface WorkflowStep {
    step_order: number;
    role_required: string;
    is_final: boolean;
}

interface ApprovalRecord {
    step_number: number;
    status: string;
    approver_name: string;
    created_at: string;
    comment?: string;
}

interface EnrichedLoan extends Loan {
    workflow_config: WorkflowStep[];
    approval_history: ApprovalRecord[];
}

// Status Timeline Component
const StatusTimeline = ({ loan }: { loan: EnrichedLoan }) => {
    const currentStep = loan.current_step || 1;
    let config = loan.workflow_config || [];
    const isLoanApproved = loan.status === 'active' || loan.approval_status === 'approved';

    // If no workflow config (legacy/simple), build a virtual one from history or show simple state
    if (config.length === 0) {
        if (loan.approval_history && loan.approval_history.length > 0) {
            // Create virtual steps from history
            config = loan.approval_history.map(h => ({
                step_order: h.step_number,
                role_required: 'Approver', // Generic role since we don't know
                is_final: true
            }));
        } else {
            // No history and no config?
            return <p className="text-sm text-muted-foreground p-4">No approval timeline available.</p>;
        }
    }

    return (
        <div className="mt-4 space-y-4">
            <h4 className="text-sm font-semibold mb-2">Approval Progress</h4>
            <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-6 relative">
                    {config.map((step) => {
                        // If loan is fully approved, ALL steps are completed
                        // Otherwise, use standard step logic
                        const isCompleted = isLoanApproved || step.step_order < currentStep;

                        // Current is only true if NOT fully approved AND it matches step
                        const isCurrent = !isLoanApproved && step.step_order === currentStep;

                        const approval = loan.approval_history?.find(a => a.step_number === step.step_order);

                        let circleClass = "bg-gray-200 border-gray-300 text-gray-500"; // Future
                        let icon = <span className="text-xs">{step.step_order}</span>;

                        if (isCompleted) {
                            circleClass = approval?.status === 'rejected'
                                ? "bg-red-100 border-red-500 text-red-600"
                                : "bg-green-100 border-green-500 text-green-600";
                            icon = approval?.status === 'rejected' ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />;
                        } else if (isCurrent) {
                            circleClass = "bg-blue-100 border-blue-500 text-blue-600 animate-pulse";
                            icon = <span className="text-xs font-bold">{step.step_order}</span>;
                        }

                        // Fallback text if no role name
                        const roleName = step.role_required || 'Approver';

                        return (
                            <div key={step.step_order} className="flex items-start gap-3">
                                <div className={`
                                    z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border 
                                    ${circleClass}
                                `}>
                                    {icon}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {isCompleted ? (approval?.status === 'rejected' ? 'Rejected' : 'Approved') : (isCurrent ? 'Pending Approval' : 'Waiting')}
                                        <span className="ml-1 text-muted-foreground font-normal">
                                            - {roleName}
                                        </span>
                                    </p>

                                    {approval && (
                                        <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded mt-1">
                                            <p>By: {approval.approver_name || 'System Admin'}</p>
                                            <p>{new Date(approval.created_at).toLocaleDateString()}</p>
                                            {approval.comment && <p className="italic mt-1">"{approval.comment}"</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default function MyLoans() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(false);
    const [loansAllowed, setLoansAllowed] = useState(false); // Default to false for safety

    // Add/Edit Loan Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
    const [loanType, setLoanType] = useState("personal");
    const [totalAmount, setTotalAmount] = useState("");
    const [termMonths, setTermMonths] = useState("");
    const [monthlyDeduction, setMonthlyDeduction] = useState<number>(0);
    const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
    const [startYear, setStartYear] = useState(new Date().getFullYear());
    const [description, setDescription] = useState("");

    // Calculate monthly deduction automatically
    useEffect(() => {
        if (totalAmount && termMonths) {
            const amt = parseFloat(totalAmount);
            const months = parseInt(termMonths);
            if (amt > 0 && months > 0) {
                setMonthlyDeduction(amt / months);
            } else {
                setMonthlyDeduction(0);
            }
        }
    }, [totalAmount, termMonths]);

    const checkSettings = async () => {
        try {
            // Fetch public loan config
            const res = await fetch(`${API_BASE_URL}/payroll/loans/config`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setLoansAllowed(!!data.allow_employee_loans);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchMyLoans();
        checkSettings();
    }, []);

    const fetchMyLoans = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/my-requests`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setLoans(data);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load loans");
        } finally {
            setLoading(false);
        }
    };

    const handleRequestLoan = async () => {
        if (!totalAmount || !termMonths || !description) {
            toast.error("All fields are required");
            return;
        }

        setLoading(true);
        try {
            const url = editingLoan
                ? `${API_BASE_URL}/payroll/loans/my-requests/${editingLoan.id}`
                : `${API_BASE_URL}/payroll/loans/my-requests`;
            const method = editingLoan ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    loan_type: loanType,
                    total_amount: parseFloat(totalAmount),
                    term_months: parseInt(termMonths),
                    start_month: startMonth,
                    start_year: startYear,
                    description
                }),
            });

            if (res.ok) {
                toast.success(editingLoan ? 'Loan updated successfully' : 'Loan requested successfully');
                setIsModalOpen(false);
                resetForm();
                fetchMyLoans();
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to save loan request');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to save loan request');
        } finally {
            setLoading(false);
        }
    };

    const openRequestModal = () => {
        if (!loansAllowed) {
            toast.error("Loan requests are currently disabled by your organization.");
            return;
        }
        resetForm();
        setEditingLoan(null);
        setIsModalOpen(true);
    };

    const openEditModal = (loan: Loan) => {
        setEditingLoan(loan);
        setLoanType(loan.loan_type);
        setTotalAmount(loan.total_amount);
        setTermMonths(loan.term_months.toString());
        setStartMonth(loan.start_month);
        setStartYear(loan.start_year);
        setDescription(loan.description);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setLoanType("personal");
        setTotalAmount("");
        setTermMonths("");
        setDescription("");
        setStartMonth(new Date().getMonth() + 1);
        setStartYear(new Date().getFullYear());
    };

    const getStatusBadge = (loan: Loan) => {
        // ... (existing helper)
        switch (loan.status) {
            case 'pending': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">Pending Approval</span>;
            case 'active': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Active</span>;
            case 'completed': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">Completed</span>;
            case 'cancelled': return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">Cancelled</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">Rejected</span>;
            case 'frozen': return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">Frozen</span>;
            default: return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">{loan.status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {!loansAllowed && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm">Loan requests are currently disabled by your organization settings.</p>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Loans</h1>
                    <p className="text-muted-foreground mt-2">
                        Request and manage your loan applications.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchMyLoans} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    {loansAllowed && (
                        <Button onClick={openRequestModal}>
                            <Plus className="h-4 w-4 mr-2" /> Request Loan
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your Loan History</CardTitle>
                    <CardDescription>
                        View and manage all your loan requests and active loans.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="ml-2 text-muted-foreground">Loading your loans...</span>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Total Amount</TableHead>
                                        <TableHead>Remaining</TableHead>
                                        <TableHead>Monthly Pay</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loans.map((loan) => (
                                        <TableRow key={loan.id}>
                                            <TableCell className="capitalize">{loan.loan_type}</TableCell>
                                            <TableCell>{parseFloat(loan.total_amount).toLocaleString()} ETB</TableCell>
                                            <TableCell className="font-bold text-orange-600">
                                                {parseFloat(loan.remaining_balance).toLocaleString()} ETB
                                            </TableCell>
                                            <TableCell>{parseFloat(loan.monthly_deduction).toLocaleString()} ETB</TableCell>
                                            <TableCell>
                                                {new Date(loan.start_year, loan.start_month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    {getStatusBadge(loan)}

                                                    {/* Timeline Trigger */}
                                                    {(loan.status === 'pending' || loan.status === 'active') && (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600">
                                                                    View Progress
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent>
                                                                <DialogHeader>
                                                                    <DialogTitle>Loan Timeline</DialogTitle>
                                                                </DialogHeader>
                                                                <StatusTimeline loan={loan as EnrichedLoan} />
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {loan.status === 'pending' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditModal(loan)}
                                                            title="Edit Loan Request"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {loans.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                <Banknote className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                                <p>No loan requests yet. Click "Request Loan" to get started.</p>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLoan ? 'Edit Loan Request' : 'Request New Loan'}</DialogTitle>
                        <DialogDescription>
                            {editingLoan
                                ? 'Update your loan request details. You can only edit pending requests.'
                                : 'Submit a loan request. It will go through the approval process.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-md text-sm text-blue-800 border border-blue-200">
                            <Banknote className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>
                                <strong>Net Salary Rule:</strong> Your total monthly deductions (including other loans and penalties) cannot exceed 1/3 of your Net Salary.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Loan Type</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={loanType}
                                    onChange={(e) => setLoanType(e.target.value)}
                                >
                                    <option value="personal">Personal Loan</option>
                                    <option value="emergency">Emergency Advance</option>
                                    <option value="housing">Housing Loan</option>
                                    <option value="vehicle">Vehicle Loan</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Term (Months)</Label>
                                <Input
                                    type="number"
                                    value={termMonths}
                                    onChange={(e) => setTermMonths(e.target.value)}
                                    placeholder="e.g. 12"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Total Amount (ETB)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={totalAmount}
                                onChange={(e) => setTotalAmount(e.target.value)}
                            />
                        </div>

                        <div className="p-3 bg-gray-50 rounded border flex justify-between items-center">
                            <span className="text-sm font-medium">Monthly Deduction:</span>
                            <span className="text-lg font-bold text-green-700">
                                {monthlyDeduction.toFixed(2)} ETB
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Month</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={startMonth}
                                    onChange={(e) => setStartMonth(parseInt(e.target.value))}
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Start Year</Label>
                                <Input
                                    type="number"
                                    value={startYear}
                                    onChange={(e) => setStartYear(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description / Reason</Label>
                            <Textarea
                                placeholder="Explain why you need this loan..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleRequestLoan} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            {editingLoan ? 'Update Request' : 'Submit Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
