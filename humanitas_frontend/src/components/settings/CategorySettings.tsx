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
import { Loader2, Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface EmployeeCategory {
    id?: string;
    slug: string;
    name: string;
    description?: string;
    is_system?: boolean;
    default_transport_allowance?: number;
    default_per_diem_fixed?: number;
    per_diem_no_receipt_fixed?: number;
    per_diem_no_receipt_percent?: number;
    per_diem_receipt_fixed: number;
    per_diem_receipt_percent?: number;
    desert_min_percent?: number;
    desert_mid_percent?: number;
    desert_max_percent?: number;
    hardship_min_percent?: number;
    hardship_mid_percent?: number;
    hardship_max_percent?: number;
    transport_min_percent?: number;
    transport_mid_percent?: number;
    transport_max_percent?: number;
    per_diem_min_percent?: number;
    per_diem_mid_percent?: number;
    per_diem_max_percent?: number;
    desert_default_tier?: string;
    hardship_default_tier?: string;
    transport_default_tier?: string;
    per_diem_default_tier?: string;
    use_transport_allowance?: boolean;
    use_per_diem?: boolean;
}

interface CategorySettingsProps {
    disabled?: boolean;
}

export function CategorySettings({ disabled: _disabled = false }: CategorySettingsProps) {
    const [categories, setCategories] = useState<EmployeeCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<EmployeeCategory | null>(null);
    const [formData, setFormData] = useState<EmployeeCategory>({
        slug: "",
        name: "",
        description: "",
        default_transport_allowance: 0,
        default_per_diem_fixed: 0,
        per_diem_no_receipt_fixed: 0,
        per_diem_no_receipt_percent: 0,
        per_diem_receipt_fixed: 0,
        per_diem_receipt_percent: 0,
        desert_min_percent: 0,
        desert_mid_percent: 0,
        desert_max_percent: 0,
        hardship_min_percent: 0,
        hardship_mid_percent: 0,
        hardship_max_percent: 0,
        transport_min_percent: 0,
        transport_mid_percent: 0,
        transport_max_percent: 0,
        per_diem_min_percent: 0,
        per_diem_mid_percent: 0,
        per_diem_max_percent: 0,
        desert_default_tier: 'none',
        hardship_default_tier: 'none',
        transport_default_tier: 'none',
        per_diem_default_tier: 'none',
        use_transport_allowance: true,
        use_per_diem: true,
    });

    // Dynamic Income Types State
    const [incomeTypes, setIncomeTypes] = useState<any[]>([]);
    const [categoryAllowances, setCategoryAllowances] = useState<any[]>([]);
    const [newAllowanceType, setNewAllowanceType] = useState("");
    const [newAllowanceData, setNewAllowanceData] = useState({
        amount: 0,
        min_amount: 0,
        mid_amount: 0,
        max_amount: 0,
        default_tier: 'none'
    });
    const [isAddingAllowance, setIsAddingAllowance] = useState(false);

    useEffect(() => {
        fetchCategories();
        fetchIncomeTypes();
    }, []);

    const fetchIncomeTypes = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/settings/income-types`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setIncomeTypes(data);
            }
        } catch (error) {
            console.error("Failed to fetch income types:", error);
        }
    };

    const fetchCategoryAllowances = async (categoryId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/categories/${categoryId}/allowances`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setCategoryAllowances(data);
            }
        } catch (error) {
            console.error("Failed to fetch category allowances:", error);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/employee-categories`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setCategories(data);
            }
        } catch (error) {
            console.error("Failed to fetch employee categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormData({
            slug: "",
            name: "",
            description: "",
            default_transport_allowance: 0,
            default_per_diem_fixed: 0,
            per_diem_no_receipt_fixed: 0,
            per_diem_no_receipt_percent: 0,
            per_diem_receipt_fixed: 0,
            per_diem_receipt_percent: 0,
            desert_min_percent: 0,
            desert_mid_percent: 0,
            desert_max_percent: 0,
            hardship_min_percent: 0,
            hardship_mid_percent: 0,
            hardship_max_percent: 0,
            transport_min_percent: 0,
            transport_mid_percent: 0,
            transport_max_percent: 0,
            per_diem_min_percent: 0,
            per_diem_mid_percent: 0,
            per_diem_max_percent: 0,
            desert_default_tier: 'none',
            hardship_default_tier: 'none',
            transport_default_tier: 'none',
            per_diem_default_tier: 'none',
            use_transport_allowance: true,
            use_per_diem: true,
        });
        setCategoryAllowances([]);
        setIsModalOpen(true);
    };

    const openEditModal = (category: EmployeeCategory) => {
        setEditingCategory(category);
        setFormData({ ...category });
        setIsModalOpen(true);
        if (category.id) {
            fetchCategoryAllowances(category.id);
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.slug.trim()) return;

        setIsSaving(true);
        setMessage({ type: "", text: "" });

        try {
            const url = editingCategory
                ? `${API_BASE_URL}/employee-categories/${editingCategory.id}`
                : `${API_BASE_URL}/employee-categories`;

            const method = editingCategory ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to save category");
            }

            await fetchCategories();
            setIsModalOpen(false);
            setMessage({ type: "success", text: `Category ${editingCategory ? 'updated' : 'created'} successfully` });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to save category" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this category?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/employee-categories/${id}`, {
                method: "DELETE",
                credentials: 'include',
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to delete category");
            }

            await fetchCategories();
            setMessage({ type: "success", text: "Category deleted successfully" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to delete category" });
        }
    };

    const handleAddAllowance = async () => {
        if (!editingCategory?.id || !newAllowanceType) return;

        setIsAddingAllowance(true);
        try {
            const response = await fetch(`${API_BASE_URL}/users/categories/${editingCategory.id}/allowances`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    income_type_id: newAllowanceType,
                    amount: newAllowanceData.amount,
                    min_amount: newAllowanceData.min_amount,
                    mid_amount: newAllowanceData.mid_amount,
                    max_amount: newAllowanceData.max_amount,
                    default_tier: newAllowanceData.default_tier
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to add allowance");
            }

            await fetchCategoryAllowances(editingCategory.id);
            await fetchCategoryAllowances(editingCategory.id);
            setNewAllowanceType("");
            setNewAllowanceData({
                amount: 0,
                min_amount: 0,
                mid_amount: 0,
                max_amount: 0,
                default_tier: 'none'
            });
            setMessage({ type: "success", text: "Allowance added successfully" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to add allowance" });
        } finally {
            setIsAddingAllowance(false);
        }
    };

    const handleDeleteAllowance = async (allowanceId: string) => {
        if (!confirm("Remove this allowance from the category?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/users/categories/allowances/${allowanceId}`, {
                method: "DELETE",
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error("Failed to delete allowance");
            }

            if (editingCategory?.id) {
                await fetchCategoryAllowances(editingCategory.id);
            }
            setMessage({ type: "success", text: "Allowance removed successfully" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to remove allowance" });
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {message.text && (
                <div
                    className={`px-4 py-2 rounded text-sm ${message.type === "success"
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                        }`}
                >
                    {message.text}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Employee Categories</CardTitle>
                    <CardDescription>
                        Manage employee classifications (e.g., Management, Field Worker) for payroll and policy purposes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[100px]">Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((category) => (
                                <TableRow key={category.id}>
                                    <TableCell className="font-medium">{category.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{category.slug}</TableCell>
                                    <TableCell>{category.description || "-"}</TableCell>
                                    <TableCell>
                                        {category.is_system ? <Badge variant="secondary">System</Badge> : <Badge variant="outline">Custom</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditModal(category)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {!category.is_system && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(category.id!)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {categories.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                                        No categories found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <div className="mt-4">
                        <Button onClick={openAddModal}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Category
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? "Edit Category" : "Add New Category"}
                        </DialogTitle>
                        <DialogDescription>
                            Define the category name and identifier.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="catName">Name</Label>
                            <Input
                                id="catName"
                                value={formData.name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({
                                        ...formData,
                                        name: val,
                                        // Auto-generate slug if adding new and slug is empty or matches previous name slug
                                        slug: !editingCategory ? val.toLowerCase().replace(/\s+/g, '-') : formData.slug
                                    });
                                }}
                                placeholder="e.g. Field Worker"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="catSlug">Slug (ID)</Label>
                            <Input
                                id="catSlug"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                placeholder="e.g. field-worker"
                                disabled={!!editingCategory?.is_system}
                            />
                            {editingCategory?.is_system && <p className="text-xs text-muted-foreground">System category slugs cannot be changed.</p>}
                        </div>
                        <Input
                            id="catDesc"
                            value={formData.description || ""}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Optional description"
                        />


                        <div className="grid gap-4 border-t pt-4">
                            <h4 className="font-medium text-sm">Allowances Configuration</h4>


                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="useTransport" className="font-medium">Transport Allowance</Label>
                                    <Switch
                                        id="useTransport"
                                        checked={formData.use_transport_allowance !== false}
                                        onCheckedChange={(checked) => setFormData({ ...formData, use_transport_allowance: checked })}
                                    />
                                </div>
                                {formData.use_transport_allowance !== false && (
                                    <div className="grid gap-2 pl-4 border-l-2 border-muted ml-1">
                                        <Label htmlFor="transport">Default Amount</Label>
                                        <Input
                                            id="transport"
                                            type="number"
                                            value={formData.default_transport_allowance}
                                            onChange={(e) => setFormData({ ...formData, default_transport_allowance: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="usePerDiem" className="font-medium">Per Diem Allowance</Label>
                                    <Switch
                                        id="usePerDiem"
                                        checked={formData.use_per_diem !== false}
                                        onCheckedChange={(checked) => setFormData({ ...formData, use_per_diem: checked })}
                                    />
                                </div>

                                {formData.use_per_diem !== false && (
                                    <div className="space-y-3 pl-4 border-l-2 border-muted ml-1">
                                        <div className="space-y-3">
                                            <Label className="text-xs text-muted-foreground uppercase font-bold">Per Diem (No Receipt)</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="pdnrFixed" className="text-xs">Fixed Amount</Label>
                                                    <Input
                                                        id="pdnrFixed"
                                                        type="number"
                                                        value={formData.per_diem_no_receipt_fixed}
                                                        onChange={(e) => setFormData({ ...formData, per_diem_no_receipt_fixed: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="pdnrPercent" className="text-xs">Percentage of Salary (%)</Label>
                                                    <Input
                                                        id="pdnrPercent"
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.per_diem_no_receipt_percent}
                                                        onChange={(e) => setFormData({ ...formData, per_diem_no_receipt_percent: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-xs text-muted-foreground uppercase font-bold">Per Diem (With Receipt)</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="pdrFixed" className="text-xs">Fixed Amount</Label>
                                                    <Input
                                                        id="pdrFixed"
                                                        type="number"
                                                        value={formData.per_diem_receipt_fixed}
                                                        onChange={(e) => setFormData({ ...formData, per_diem_receipt_fixed: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="pdrPercent" className="text-xs">Percentage of Salary (%)</Label>
                                                    <Input
                                                        id="pdrPercent"
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.per_diem_receipt_percent}
                                                        onChange={(e) => setFormData({ ...formData, per_diem_receipt_percent: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">Desert Allowance Tiers</Label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="desertMin" className="text-xs">Min (%)</Label>
                                        <Input
                                            id="desertMin"
                                            type="number"
                                            step="0.01"
                                            value={formData.desert_min_percent}
                                            onChange={(e) => setFormData({ ...formData, desert_min_percent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="desertMid" className="text-xs">Mid (%)</Label>
                                        <Input
                                            id="desertMid"
                                            type="number"
                                            step="0.01"
                                            value={formData.desert_mid_percent}
                                            onChange={(e) => setFormData({ ...formData, desert_mid_percent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="desertMax" className="text-xs">Max (%)</Label>
                                        <Input
                                            id="desertMax"
                                            type="number"
                                            step="0.01"
                                            value={formData.desert_max_percent}
                                            onChange={(e) => setFormData({ ...formData, desert_max_percent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2 mt-3">
                                    <Label htmlFor="desertDefaultTier" className="text-xs">Default Tier (Auto-assigned)</Label>
                                    <select
                                        id="desertDefaultTier"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.desert_default_tier}
                                        onChange={(e) => setFormData({ ...formData, desert_default_tier: e.target.value })}
                                    >
                                        <option value="none">None (No auto-assignment)</option>
                                        <option value="min">Min</option>
                                        <option value="mid">Mid</option>
                                        <option value="max">Max</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground uppercase font-bold">Hardship Allowance Tiers</Label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="hardshipMin" className="text-xs">Min (%)</Label>
                                        <Input
                                            id="hardshipMin"
                                            type="number"
                                            step="0.01"
                                            value={formData.hardship_min_percent}
                                            onChange={(e) => setFormData({ ...formData, hardship_min_percent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="hardshipMid" className="text-xs">Mid (%)</Label>
                                        <Input
                                            id="hardshipMid"
                                            type="number"
                                            step="0.01"
                                            value={formData.hardship_mid_percent}
                                            onChange={(e) => setFormData({ ...formData, hardship_mid_percent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="hardshipMax" className="text-xs">Max (%)</Label>
                                        <Input
                                            id="hardshipMax"
                                            type="number"
                                            step="0.01"
                                            value={formData.hardship_max_percent}
                                            onChange={(e) => setFormData({ ...formData, hardship_max_percent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2 mt-3">
                                    <Label htmlFor="hardshipDefaultTier" className="text-xs">Default Tier (Auto-assigned)</Label>
                                    <select
                                        id="hardshipDefaultTier"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.hardship_default_tier}
                                        onChange={(e) => setFormData({ ...formData, hardship_default_tier: e.target.value })}
                                    >
                                        <option value="none">None (No auto-assignment)</option>
                                        <option value="min">Min</option>
                                        <option value="mid">Mid</option>
                                        <option value="max">Max</option>
                                    </select>
                                </div>
                            </div>

                            {/* Dynamic Additional Allowances Section */}
                            {editingCategory?.id && (
                                <div className="space-y-3 pt-4 border-t">
                                    <Label className="text-xs text-muted-foreground uppercase font-bold">Additional Allowances</Label>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="py-2 h-9">Allowance Type</TableHead>
                                                    <TableHead className="py-2 h-9">Fixed</TableHead>
                                                    <TableHead className="py-2 h-9">Min/Mid/Max</TableHead>
                                                    <TableHead className="py-2 h-9">Default</TableHead>
                                                    <TableHead className="py-2 h-9 w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {categoryAllowances.map((allowance) => (
                                                    <TableRow key={allowance.id}>
                                                        <TableCell className="py-2">
                                                            <div>{allowance.income_type_name}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase">{allowance.calculation_type}</div>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            {allowance.amount > 0 ? allowance.amount : '-'}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs">
                                                            {(allowance.min_amount > 0 || allowance.mid_amount > 0 || allowance.max_amount > 0) ? (
                                                                <div className="grid grid-cols-3 gap-1 w-full text-center">
                                                                    <div className="bg-slate-100 dark:bg-slate-800 rounded px-1" title="Min">{allowance.min_amount}</div>
                                                                    <div className="bg-slate-100 dark:bg-slate-800 rounded px-1" title="Mid">{allowance.mid_amount}</div>
                                                                    <div className="bg-slate-100 dark:bg-slate-800 rounded px-1" title="Max">{allowance.max_amount}</div>
                                                                </div>
                                                            ) : '-'}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs uppercase">{allowance.default_tier}</TableCell>
                                                        <TableCell className="py-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                                onClick={() => handleDeleteAllowance(allowance.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {categoryAllowances.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                                                            No additional allowances assigned.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <div className="grid gap-3 p-3 border rounded-md bg-muted/20">
                                        <div className="grid gap-2">
                                            <Label htmlFor="newAllowanceType" className="text-xs font-semibold">Step 1: Select Income Type</Label>
                                            <select
                                                id="newAllowanceType"
                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                                value={newAllowanceType}
                                                onChange={(e) => setNewAllowanceType(e.target.value)}
                                            >
                                                <option value="">Select type...</option>
                                                {incomeTypes
                                                    .filter(type => !categoryAllowances.some(ca => ca.income_type_id === type.id))
                                                    .map(type => (
                                                        <option key={type.id} value={type.id}>
                                                            {type.name} ({type.calculation_type})
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-4 gap-3 items-end">
                                            <div className="grid gap-1">
                                                <Label htmlFor="tierMin" className="text-[10px] text-muted-foreground">Min</Label>
                                                <Input
                                                    id="tierMin"
                                                    type="number"
                                                    className="h-8 text-xs"
                                                    value={newAllowanceData.min_amount}
                                                    onChange={(e) => setNewAllowanceData({ ...newAllowanceData, min_amount: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor="tierMid" className="text-[10px] text-muted-foreground">Mid</Label>
                                                <Input
                                                    id="tierMid"
                                                    type="number"
                                                    className="h-8 text-xs"
                                                    value={newAllowanceData.mid_amount}
                                                    onChange={(e) => setNewAllowanceData({ ...newAllowanceData, mid_amount: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor="tierMax" className="text-[10px] text-muted-foreground">Max</Label>
                                                <Input
                                                    id="tierMax"
                                                    type="number"
                                                    className="h-8 text-xs"
                                                    value={newAllowanceData.max_amount}
                                                    onChange={(e) => setNewAllowanceData({ ...newAllowanceData, max_amount: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor="tierDef" className="text-[10px] text-muted-foreground">Default</Label>
                                                <select
                                                    id="tierDef"
                                                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                    value={newAllowanceData.default_tier}
                                                    onChange={(e) => setNewAllowanceData({ ...newAllowanceData, default_tier: e.target.value })}
                                                >
                                                    <option value="none">None</option>
                                                    <option value="min">Min</option>
                                                    <option value="mid">Mid</option>
                                                    <option value="max">Max</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <Button
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={handleAddAllowance}
                                                disabled={!newAllowanceType || isAddingAllowance}
                                            >
                                                {isAddingAllowance ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                                Add Assignment
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}



                        </div>

                        {editingCategory?.is_system && (
                            <div className="rounded-md bg-yellow-50 p-3 flex gap-2 text-sm text-yellow-800">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                <div>This is a system default category. Some fields may be locked to ensure system stability.</div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                editingCategory ? "Update" : "Create"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
