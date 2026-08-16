import { useState } from "react";
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
import { API_BASE_URL } from "@/config/api.config";
import { Search, Trash2, FileText, Plus, AlertTriangle } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface User {
    id: string;
    full_name: string;
    department?: string;
}

interface Penalty {
    id: string;
    amount: string;
    reason: string;
    attachment_url: string | null;
    created_at: string;
    created_by_name: string;
    month?: number;
    year?: number;
}

export function UserPenaltySettings() {
    const [searchTerm, setSearchTerm] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [penalties, setPenalties] = useState<Penalty[]>([]);
    const [loading, setLoading] = useState(false);

    // Add Penalty Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [file, setFile] = useState<File | null>(null);

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
        fetchPenalties(user.id);
    };

    const fetchPenalties = async (userId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/penalties/${userId}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setPenalties(data);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load penalties");
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePenalty = async () => {
        if (!selectedUser || !amount || !reason) {
            toast.error("Amount and reason are required");
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('reason', reason);
        formData.append('month', month.toString());
        formData.append('year', year.toString());
        if (file) {
            formData.append('file', file);
        }

        try {
            const res = await fetch(`${API_BASE_URL}/payroll/penalties/${selectedUser.id}`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (res.ok) {
                toast.success('Penalty assigned successfully');
                setIsAddModalOpen(false);
                setAmount("");
                setReason("");
                setFile(null);
                fetchPenalties(selectedUser.id);
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to assign penalty');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to assign penalty');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePenalty = async (id: string) => {
        if (!confirm("Are you sure you want to delete this penalty?")) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/penalties/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                toast.success('Penalty deleted successfully');
                if (selectedUser) fetchPenalties(selectedUser.id);
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to delete penalty');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete penalty');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Specific Penalties</CardTitle>
                <CardDescription>
                    Assign financial penalties to specific employees for a specific month.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 mb-6">
                    <Input
                        placeholder="Search employee by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                    />
                    <Button onClick={searchUsers} disabled={loading}>
                        <Search className="h-4 w-4 mr-2" /> Search
                    </Button>
                </div>

                {users.length > 0 && !selectedUser && (
                    <div className="border rounded-md p-2 max-h-48 overflow-y-auto mb-4 bg-white shadow-sm absolute z-10 w-full max-w-md">
                        {users.map(u => (
                            <div key={u.id}
                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                                onClick={() => selectUser(u)}
                            >
                                <span className="font-medium">{u.full_name}</span>
                                <span className="text-gray-500 text-xs">{u.department || 'No Dept'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {selectedUser && (
                    <div className="space-y-6">
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
                                    <Plus className="h-4 w-4 mr-2" /> Add Penalty
                                </Button>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Apply Month</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Amount (ETB)</TableHead>
                                    <TableHead>Attachment</TableHead>
                                    <TableHead>Added By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {penalties.map((penalty) => (
                                    <TableRow key={penalty.id}>
                                        <TableCell className="font-medium">
                                            {penalty.month && penalty.year
                                                ? `${new Date(penalty.year, penalty.month - 1).toLocaleString('default', { month: 'long' })} ${penalty.year}`
                                                : new Date(penalty.created_at).toLocaleDateString()
                                            }
                                        </TableCell>
                                        <TableCell>{penalty.reason}</TableCell>
                                        <TableCell className="font-medium text-red-600">
                                            -{Number(penalty.amount).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {penalty.attachment_url ? (
                                                <a
                                                    href={penalty.attachment_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center text-blue-600 hover:underline gap-1 text-sm"
                                                >
                                                    <FileText className="h-3 w-3" /> View
                                                </a>
                                            ) : <span className="text-gray-400">—</span>}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {penalty.created_by_name}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeletePenalty(penalty.id)}
                                                disabled={
                                                    // Freeze logic: Disable if month/year is in the past
                                                    !!(penalty.year && penalty.month &&
                                                        (penalty.year < new Date().getFullYear() ||
                                                            (penalty.year === new Date().getFullYear() && penalty.month < new Date().getMonth() + 1)))
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {penalties.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            No penalties assigned to this user.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Penalty</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-start gap-2 bg-yellow-50 p-3 rounded-md text-sm text-yellow-800 border border-yellow-200">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>
                                Note: The penalty amount cannot exceed 1/3 of the employee's <strong>Net Salary</strong> (Basic - Pension - Tax).
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Month</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={month}
                                    onChange={(e) => setMonth(parseInt(e.target.value))}
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Year</Label>
                                <Input
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Amount (ETB)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea
                                placeholder="Describe the reason for this penalty..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Attachment (Optional)</Label>
                            <Input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={(e) => e.target.files && setFile(e.target.files[0])}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreatePenalty} disabled={loading} className="bg-red-600 hover:bg-red-700">
                            Assign Penalty
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
