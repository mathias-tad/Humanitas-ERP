import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Plus, Trash2, Banknote, Check, X, Loader2, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface User {
    id: string;
    full_name: string;
    department: string;
    basic_salary: string;
}

interface Loan {
    id: string;
    user_id: string;
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
    requested_by: string;
    created_at: string;
}

interface PendingLoan extends Loan {
    user_name: string;
    user_department: string;
}

export default function LoanManagement() {
    const [activeTab, setActiveTab] = useState("employee");
    const [searchTerm, setSearchTerm] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>([]);
    const [loading, setLoading] = useState(false);

    // Approval Modal
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvingLoan, setApprovingLoan] = useState<PendingLoan | null>(null);
    const [approvalComment, setApprovalComment] = useState("");
    const [isRejecting, setIsRejecting] = useState(false);

    // Add Loan Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

    useEffect(() => {
        if (activeTab === "pending") {
            fetchPendingLoans();
        }
    }, [activeTab]);

    const searchUsers = async () => {
        if (!searchTerm) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/users`, { credentials: 'include' });
            if (res.ok) {
                const allUsers = await res.json();
                setUsers(allUsers.filter((u: any) => u.full_name.toLowerCase().includes(searchTerm.toLowerCase())));
                if (allUsers.length === 0) toast.error("No users found");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to search users");
        } finally {
            setLoading(false);
        }
    };

    const selectUser = async (user: User) => {
        setSelectedUser(user);
        setUsers([]); // Clear search results
        setSearchTerm("");
        fetchLoans(user.id);
    };

    const fetchLoans = async (userId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/${userId}`, {
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

    const handleCreateLoan = async () => {
        if (!selectedUser || !totalAmount || !termMonths || !description) {
            toast.error("All fields are required");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/${selectedUser.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    loan_type: loanType,
                    total_amount: parseFloat(totalAmount),
                    term_months: parseInt(termMonths),
                    monthly_deduction: monthlyDeduction,
                    start_month: startMonth,
                    start_year: startYear,
                    description
                }),
            });

            if (res.ok) {
                toast.success('Loan created successfully');
                setIsAddModalOpen(false);
                setTotalAmount("");
                setTermMonths("");
                setDescription("");
                fetchLoans(selectedUser.id);
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to create loan');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to create loan');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelLoan = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this loan? Remaining balance will be waived.")) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                toast.success('Loan cancelled successfully');
                if (selectedUser) fetchLoans(selectedUser.id);
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to cancel loan');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to cancel loan');
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingLoans = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/pending`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setPendingLoans(data);
            } else {
                const error = await res.json();
                console.error("Failed to fetch pending loans:", error);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load pending loans");
        } finally {
            setLoading(false);
        }
    };

    const openApprovalModal = (loan: PendingLoan, reject = false) => {
        setApprovingLoan(loan);
        setIsRejecting(reject);
        setApprovalComment("");
        setIsApprovalModalOpen(true);
    };

    const handleApprove = async () => {
        if (!approvingLoan) return;

        setLoading(true);
        try {
            const action = isRejecting ? 'reject' : 'approve';
            const res = await fetch(`${API_BASE_URL}/payroll/loans/${approvingLoan.id}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ comment: approvalComment }),
            });

            if (res.ok) {
                toast.success(`Loan ${isRejecting ? 'rejected' : 'approved'} successfully`);
                setIsApprovalModalOpen(false);
                setApprovingLoan(null);
                fetchPendingLoans();
            } else {
                const error = await res.json();
                toast.error(error.message || `Failed to ${action} loan`);
            }
        } catch (error) {
            console.error(error);
            toast.error(`Failed to ${isRejecting ? 'reject' : 'approve'} loan`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Loan Management</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage employee loans and process approval requests.
                    </p>
                </div>
                <Button variant="outline" onClick={activeTab === 'pending' ? fetchPendingLoans : () => {
                    if (selectedUser) fetchLoans(selectedUser.id);
                    else toast.info("Select a user first to refresh their loans");
                }} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="employee">Employee Loans</TabsTrigger>
                    <TabsTrigger value="pending">Pending Approvals ({pendingLoans.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="employee">

                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Loans</CardTitle>
                            <CardDescription>
                                Search for an employee to view their loan history or assign a new loan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 mb-6 relative">
                                <Input
                                    placeholder="Search employee by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                                    className="max-w-md"
                                />
                                <Button onClick={searchUsers} disabled={loading}>
                                    <Search className="h-4 w-4 mr-2" /> Search
                                </Button>

                                {users.length > 0 && !selectedUser && (
                                    <div className="absolute top-12 left-0 border rounded-md p-2 max-h-48 overflow-y-auto bg-white shadow-lg w-full max-w-md z-50">
                                        {users.map(u => (
                                            <div key={u.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center rounded-sm"
                                                onClick={() => selectUser(u)}
                                            >
                                                <span className="font-medium">{u.full_name}</span>
                                                <span className="text-gray-500 text-xs">{u.department || 'No Dept'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedUser ? (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-md border">
                                        <div>
                                            <h3 className="font-bold text-lg">{selectedUser.full_name}</h3>
                                            <p className="text-sm text-muted-foreground">{selectedUser.department}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                                                Change User
                                            </Button>
                                            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" /> New Loan
                                            </Button>
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div className="flex justify-center items-center py-12">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <span className="ml-2 text-muted-foreground">Loading loans...</span>
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
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                                            ${loan.status === 'active' ? 'bg-green-100 text-green-700' :
                                                                        loan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                                            'bg-gray-100 text-gray-700'}`}>
                                                                    {loan.status.toUpperCase()}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {loan.status === 'active' && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                        onClick={() => handleCancelLoan(loan.id)}
                                                                        title="Cancel Loan"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {loans.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                                No loans found for this user.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <Banknote className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p>Search for an employee above to manage their loans</p>
                                </div>
                            )}
                        </CardContent>

                        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Loan</DialogTitle>
                                    <DialogDescription>
                                        Set up a new loan for the employee. The monthly deduction will be checked against the user's Net Salary.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-md text-sm text-blue-800 border border-blue-200">
                                        <Banknote className="h-4 w-4 mt-0.5 shrink-0" />
                                        <p>
                                            <strong>Net Salary Rule:</strong> The total monthly deduction (including other penalties/loans) cannot exceed 1/3 of the employee's Net Salary.
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
                                            placeholder="Loan purpose..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                                    <Button onClick={handleCreateLoan} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                        Create Loan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </Card>
                </TabsContent>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Loan Approvals</CardTitle>
                            <CardDescription>
                                Review and approve or reject loan requests from employees.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center items-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="ml-2 text-muted-foreground">Loading pending approvals...</span>
                                </div>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Department</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Monthly</TableHead>
                                                <TableHead>Term</TableHead>
                                                <TableHead>Requested</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingLoans.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell className="font-medium">{loan.user_name}</TableCell>
                                                    <TableCell>{loan.user_department}</TableCell>
                                                    <TableCell className="capitalize">{loan.loan_type}</TableCell>
                                                    <TableCell>{parseFloat(loan.total_amount).toLocaleString()} ETB</TableCell>
                                                    <TableCell>{parseFloat(loan.monthly_deduction).toLocaleString()} ETB</TableCell>
                                                    <TableCell>{loan.term_months} months</TableCell>
                                                    <TableCell>{new Date(loan.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-green-600 hover:bg-green-50 hover:text-green-700"
                                                                onClick={() => openApprovalModal(loan, false)}
                                                            >
                                                                <Check className="h-4 w-4 mr-1" /> Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                onClick={() => openApprovalModal(loan, true)}
                                                            >
                                                                <X className="h-4 w-4 mr-1" /> Reject
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {pendingLoans.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                        <Banknote className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                                        <p>No pending loan requests at this time.</p>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >

            {/* Approval/Rejection Modal */}
            < Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isRejecting ? 'Reject' : 'Approve'} Loan Request</DialogTitle>
                        <DialogDescription>
                            {approvingLoan && (
                                <div className="mt-2 space-y-1">
                                    <p><strong>Employee:</strong> {approvingLoan.user_name}</p>
                                    <p><strong>Amount:</strong> {parseFloat(approvingLoan.total_amount).toLocaleString()} ETB</p>
                                    <p><strong>Term:</strong> {approvingLoan.term_months} months</p>
                                    <p><strong>Monthly:</strong> {parseFloat(approvingLoan.monthly_deduction).toLocaleString()} ETB</p>
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Comment (Optional)</Label>
                            <Textarea
                                placeholder={isRejecting ? "Reason for rejection..." : "Approval notes..."}
                                value={approvalComment}
                                onChange={(e) => setApprovalComment(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsApprovalModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleApprove}
                            disabled={loading}
                            className={isRejecting ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                        >
                            {isRejecting ? 'Reject Loan' : 'Approve Loan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    );
}
