import { useState, useEffect } from "react";
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
import { Plus, Trash2, Search, Edit, DollarSign, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface User {
    id: string;
    full_name: string;
    department?: string;
    basic_salary?: number;
}

interface IncomeType {
    id: string;
    name: string;
    is_taxable: boolean;
    is_pensionable: boolean;
    calculation_type?: string;
}

interface UserIncome {
    id: string;
    user_id: string;
    income_type_id: string;
    income_type_name: string;
    amount: number;
    is_taxable: boolean | null; // null means use default from income type
    alias: string | null;
    default_taxable: boolean; // from income_types
    default_pensionable: boolean;
    is_active: boolean;
    start_date?: string;
    end_date?: string;
}

export function UserIncomeSettings() {
    const [searchTerm, setSearchTerm] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userIncomes, setUserIncomes] = useState<UserIncome[]>([]);
    const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
    const [loading, setLoading] = useState(false);

    // Add/Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIncome, setEditingIncome] = useState<UserIncome | null>(null);
    const [modalIncomeTypeId, setModalIncomeTypeId] = useState("");
    const [modalAmount, setModalAmount] = useState("");
    const [modalIsTaxable, setModalIsTaxable] = useState<boolean | null>(null);
    const [modalAlias, setModalAlias] = useState("");
    const [modalStartDate, setModalStartDate] = useState("");
    const [modalEndDate, setModalEndDate] = useState("");

    // Category check state
    const [userCategoryAllowances, setUserCategoryAllowances] = useState<any[]>([]);
    const [categoryOverrideWarning, setCategoryOverrideWarning] = useState<string | null>(null);

    // Calculated amount state
    const [calculatedAmount, setCalculatedAmount] = useState<{ amount: number; details: string } | null>(null);

    // Fetch income types on mount
    useEffect(() => {
        fetchIncomeTypes();
    }, []);

    // Calculate amount when income type is selected (for new assignments only)
    useEffect(() => {
        if (modalIncomeTypeId && selectedUser && !editingIncome) {
            fetchCalculatedAmount();
        } else {
            setCalculatedAmount(null);
        }

        // Check for category override
        if (modalIncomeTypeId && userCategoryAllowances.length > 0) {
            const override = userCategoryAllowances.find(ca => ca.income_type_id === modalIncomeTypeId);
            if (override) {
                setCategoryOverrideWarning(`User's category already provides "${override.income_type_name}". This assignment will be an additional/override entry.`);
            } else {
                setCategoryOverrideWarning(null);
            }
        } else {
            setCategoryOverrideWarning(null);
        }

    }, [modalIncomeTypeId, selectedUser, editingIncome, userCategoryAllowances]);

    const fetchCalculatedAmount = async () => {
        if (!modalIncomeTypeId || !selectedUser) return;


        try {
            const res = await fetch(
                `${API_BASE_URL}/payroll/income-types/${modalIncomeTypeId}/calculate/${selectedUser.id}`,
                { credentials: 'include' }
            );
            if (res.ok) {
                const data = await res.json();
                setCalculatedAmount(data);
            }
        } catch (e) {
            console.error('Failed to calculate amount:', e);
        } finally {
        }
    };

    const fetchIncomeTypes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/income-types`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setIncomeTypes(data);
            }
        } catch (e) {
            console.error('Failed to fetch income types:', e);
        }
    };

    const searchUsers = async () => {
        if (!searchTerm) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/users`, { credentials: 'include' });
            if (res.ok) {
                const allUsers = await res.json();
                setUsers(allUsers.filter((u: any) => u.full_name.toLowerCase().includes(searchTerm.toLowerCase())));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const selectUser = async (user: User) => {
        setSelectedUser(user);
        setLoading(true);
        try {
            // Fetch user incomes
            const incomesRes = await fetch(`${API_BASE_URL}/payroll/user-incomes/${user.id}`, {
                credentials: 'include'
            });
            if (incomesRes.ok) {
                const incomesData = await incomesRes.json();
                setUserIncomes(incomesData);
            }

            // Fetch user details including basic salary and category
            const userRes = await fetch(`${API_BASE_URL}/users/${user.id}`, {
                credentials: 'include'
            });
            if (userRes.ok) {
                const userData = await userRes.json();
                setSelectedUser({
                    ...user,
                    basic_salary: userData.basic_salary || 0,
                    employee_category_id: userData.employee_category_id
                } as any);

                // Fetch category allowances if user is categorized
                if (userData.employee_category_id) {
                    const catRes = await fetch(`${API_BASE_URL}/payroll/category-allowances/${userData.employee_category_id}`, {
                        credentials: 'include'
                    });
                    if (catRes.ok) {
                        setUserCategoryAllowances(await catRes.json());
                    } else {
                        setUserCategoryAllowances([]);
                    }
                } else {
                    setUserCategoryAllowances([]);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingIncome(null);
        setModalIncomeTypeId("");
        setModalAmount("");
        setModalIsTaxable(null);
        setModalAlias("");
        setModalStartDate(new Date().toISOString().split('T')[0]);
        setModalEndDate("");
        setCategoryOverrideWarning(null);
        setIsModalOpen(true);
    };

    const openEditModal = (income: UserIncome) => {
        setEditingIncome(income);
        setModalIncomeTypeId(income.income_type_id);
        setModalAmount(income.amount.toString());
        setModalIsTaxable(income.is_taxable);
        setModalAlias(income.alias || "");
        setModalStartDate(income.start_date ? income.start_date.split('T')[0] : "");
        setModalEndDate(income.end_date ? income.end_date.split('T')[0] : "");
        setCategoryOverrideWarning(null);
        setIsModalOpen(true);
    };

    const handleModalSave = async () => {
        if (!selectedUser) return;

        // Check if creating base assignment
        const hasBaseAssignment = userIncomes.some(
            ui => ui.income_type_id === modalIncomeTypeId && ui.is_taxable === null
        );
        const isCreatingBase = !hasBaseAssignment && !modalAlias;

        if (!editingIncome) {
            // For new assignments
            if (isCreatingBase) {
                // Creating base - backend will auto-calculate
                if (!modalIncomeTypeId) {
                    alert('Please select an income type');
                    return;
                }
            } else {
                // Adding additional - amount is required
                if (!modalIncomeTypeId || !modalAmount) {
                    alert('Please fill in income type and amount for additional assignment');
                    return;
                }
            }
        } else {
            // For editing - amount is required
            if (!modalIncomeTypeId || !modalAmount) {
                alert('Please fill in all required');
                return;
            }
        }

        setLoading(true);
        try {
            const payload: any = {
                income_type_id: modalIncomeTypeId,
                start_date: modalStartDate || null,
                end_date: modalEndDate || null,
            };

            // Only include amount for additional assignments or when editing
            if (!isCreatingBase || editingIncome) {
                payload.amount = parseFloat(modalAmount);
            }

            // Include alias and is_taxable when provided
            if (modalAlias) {
                payload.alias = modalAlias;
            }
            if (modalIsTaxable !== null && editingIncome) {
                payload.is_taxable = modalIsTaxable;
            }

            if (editingIncome) {
                // Update existing
                await fetch(`${API_BASE_URL}/payroll/user-incomes/${editingIncome.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });
            } else {
                // Create new
                const response = await fetch(`${API_BASE_URL}/payroll/user-incomes/${selectedUser.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });

                const result = await response.json();

                // Show message if backend enforced rules
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to assign income');
                }
                if (result.message) {
                    alert(result.message);
                }
            }

            setIsModalOpen(false);
            selectUser(selectedUser); // Refresh
        } catch (e: any) {
            console.error(e);
            alert(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (incomeId: string) => {
        if (!selectedUser) return;
        if (!confirm('Are you sure you want to remove this income assignment?')) return;

        setLoading(true);
        try {
            await fetch(`${API_BASE_URL}/payroll/user-incomes/${incomeId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            selectUser(selectedUser); // Refresh
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getTaxabilityDisplay = (income: UserIncome) => {
        const effectiveTaxable = income.is_taxable !== null ? income.is_taxable : income.default_taxable;
        const isOverridden = income.is_taxable !== null;

        return (
            <div className="flex items-center gap-2">
                {effectiveTaxable ? (
                    <Badge variant="destructive">Taxable</Badge>
                ) : (
                    <Badge variant="secondary">Non-Taxable</Badge>
                )}
                {isOverridden && (
                    <Badge variant="outline" className="text-xs">Custom</Badge>
                )}
            </div>
        );
    };

    const selectedIncomeType = incomeTypes.find(it => it.id === modalIncomeTypeId);
    const defaultTaxable = selectedIncomeType?.is_taxable || false;

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Specific Income Assignments</CardTitle>
                <CardDescription>
                    Assign income types to employees and customize their taxability.
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
                    <div className="border rounded-md p-2 max-h-48 overflow-y-auto mb-4">
                        {users.map(u => (
                            <div key={u.id}
                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                                onClick={() => selectUser(u)}
                            >
                                <span>{u.full_name}</span>
                                <span className="text-gray-500 text-sm">{u.department}</span>
                            </div>
                        ))}
                    </div>
                )}

                {selectedUser && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-md">
                            <div>
                                <h3 className="font-bold">{selectedUser.full_name}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                    <span>{userIncomes.length} income assignment(s)</span>
                                    {selectedUser.basic_salary !== undefined && (
                                        <span className="font-medium">
                                            • Basic Salary: ${parseFloat(selectedUser.basic_salary.toString()).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={openAddModal}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Income
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                                    Change User
                                </Button>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Income Type</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Taxability</TableHead>
                                    <TableHead>Alias</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userIncomes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-500">
                                            No income assignments. Click "Add Income" to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    userIncomes.map(income => (
                                        <TableRow key={income.id}>
                                            <TableCell className="font-medium">
                                                {income.income_type_name}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <DollarSign className="h-3 w-3 text-gray-400" />
                                                    {income.amount.toFixed(2)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getTaxabilityDisplay(income)}
                                            </TableCell>
                                            <TableCell>
                                                {income.alias ? (
                                                    <Badge variant="outline">{income.alias}</Badge>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditModal(income)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(income.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Add/Edit Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingIncome ? 'Edit' : 'Add'} Income Assignment
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="income-type">Income Type *</Label>
                                <Select
                                    value={modalIncomeTypeId}
                                    onValueChange={(value) => {
                                        setModalIncomeTypeId(value);
                                        // Auto-set taxability based on income type default
                                        const selectedType = incomeTypes.find(it => it.id === value);
                                        if (selectedType && !editingIncome) {
                                            setModalIsTaxable(null); // Use default
                                        }
                                    }}
                                    disabled={!!editingIncome}
                                >
                                    <SelectTrigger id="income-type">
                                        <SelectValue placeholder="Select income type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {incomeTypes.map(it => (
                                            <SelectItem key={it.id} value={it.id}>
                                                {it.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Category Override Warning */}
                            {categoryOverrideWarning && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                    <p className="text-sm text-yellow-800">
                                        {categoryOverrideWarning}
                                    </p>
                                </div>
                            )}

                            {/* Show calculated base amount */}
                            {calculatedAmount && !editingIncome && (() => {
                                const hasBaseAssignment = userIncomes.some(
                                    ui => ui.income_type_id === modalIncomeTypeId && ui.is_taxable === null
                                );

                                if (!hasBaseAssignment) {
                                    return (
                                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                            <div className="flex items-start gap-2">
                                                <div className="mt-0.5">💰</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-green-900">
                                                        Calculated Base Amount
                                                    </p>
                                                    <div className="mt-2 space-y-1 text-xs text-green-800">
                                                        <div>Employee: {selectedUser?.full_name}</div>
                                                        {selectedUser?.basic_salary && (
                                                            <div>Basic Salary: ${parseFloat(selectedUser.basic_salary.toString()).toFixed(2)}</div>
                                                        )}
                                                        <div className="font-medium mt-1">
                                                            Calculation: {calculatedAmount.details}
                                                        </div>
                                                        <div className="pt-1 mt-1 border-t border-green-300 text-sm font-bold text-green-900">
                                                            Base Amount: ${calculatedAmount.amount.toFixed(2)}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-green-700 mt-2">
                                                        ✓ This will create the BASE assignment automatically
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Show existing assignments of this type */}
                            {modalIncomeTypeId && !editingIncome && (() => {
                                const existing = userIncomes.filter(ui => ui.income_type_id === modalIncomeTypeId);
                                if (existing.length > 0) {
                                    const totalExisting = existing.reduce((sum, ui) => sum + ui.amount, 0);
                                    return (
                                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                            <div className="flex items-start gap-2">
                                                <div className="mt-0.5">ℹ️</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-blue-900">
                                                        Existing Assignments for {selectedIncomeType?.name}:
                                                    </p>
                                                    <div className="mt-2 space-y-1">
                                                        {existing.map(ui => {
                                                            const effectiveTaxable = ui.is_taxable !== null ? ui.is_taxable : ui.default_taxable;
                                                            return (
                                                                <div key={ui.id} className="flex items-center justify-between text-xs">
                                                                    <span className="text-blue-800">
                                                                        {ui.alias ? `${ui.alias}: ` : ''}${ui.amount.toFixed(2)}
                                                                        {ui.start_date && <span className="text-gray-500 ml-1">({ui.start_date.split('T')[0]})</span>}
                                                                    </span>
                                                                    <Badge
                                                                        variant={effectiveTaxable ? "destructive" : "secondary"}
                                                                        className="text-xs"
                                                                    >
                                                                        {effectiveTaxable ? 'Taxable' : 'Non-Taxable'}
                                                                    </Badge>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="pt-1 mt-1 border-t border-blue-300 font-medium text-blue-900">
                                                            Total: ${totalExisting.toFixed(2)}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-blue-700 mt-2">
                                                        💡 You are adding an <strong>additional</strong> assignment. This will create a separate entry.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div className="space-y-2">
                                <Label htmlFor="amount">
                                    {editingIncome ? 'Amount *' : 'Additional Amount *'}
                                </Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="Enter amount"
                                    value={modalAmount}
                                    onChange={(e) => setModalAmount(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start-date">Start Date *</Label>
                                    <Input
                                        id="start-date"
                                        type="date"
                                        value={modalStartDate}
                                        onChange={(e) => setModalStartDate(e.target.value)}
                                        required
                                    />
                                    <p className="text-[10px] text-gray-500">Applicable from this date</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end-date">End Date (Optional)</Label>
                                    <Input
                                        id="end-date"
                                        type="date"
                                        value={modalEndDate}
                                        onChange={(e) => setModalEndDate(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-500">Leave empty for unlimited</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="alias">Alias (Optional)</Label>
                                <Input
                                    id="alias"
                                    placeholder="e.g., Performance Bonus, Extra Allowance"
                                    value={modalAlias}
                                    onChange={(e) => setModalAlias(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                    Recommended when adding multiple assignments of the same type.
                                </p>
                            </div>

                            <div className="space-y-3 border rounded-md p-3 bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Taxability</Label>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Default for <strong>{selectedIncomeType?.name || 'this type'}</strong>: {' '}
                                            <Badge variant={defaultTaxable ? "destructive" : "secondary"} className="text-xs">
                                                {defaultTaxable ? 'Taxable' : 'Non-Taxable'}
                                            </Badge>
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="use-default"
                                            checked={modalIsTaxable === null}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setModalIsTaxable(null); // Use default
                                                } else {
                                                    setModalIsTaxable(defaultTaxable); // Start with default value for override
                                                }
                                            }}
                                        />
                                        <label htmlFor="use-default" className="text-sm cursor-pointer">
                                            Use default setting ({defaultTaxable ? 'Taxable' : 'Non-Taxable'})
                                        </label>
                                    </div>
                                    {modalIsTaxable !== null && (
                                        <div className="ml-6 p-2 bg-white rounded border">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="is-taxable"
                                                    checked={modalIsTaxable}
                                                    onCheckedChange={(checked) => setModalIsTaxable(!!checked)}
                                                />
                                                <label htmlFor="is-taxable" className="text-sm cursor-pointer font-medium">
                                                    Mark as {modalIsTaxable ? 'Taxable' : 'Non-Taxable'}
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleModalSave} disabled={loading}>
                                {editingIncome ? 'Update' : 'Add Assignment'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
