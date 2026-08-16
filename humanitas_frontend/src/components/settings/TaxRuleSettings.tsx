import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TaxRule {
    id: string;
    min_salary: string | number;
    max_salary: string | number | null;
    tax_rate: string | number;
    deductible: string | number;
    is_active: boolean;
}

export function TaxRuleSettings({ disabled }: { disabled?: boolean }) {
    const [rules, setRules] = useState<TaxRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        min_salary: 0,
        max_salary: null as number | null,
        tax_rate: 0,
        deductible: 0,
    });

    const fetchRules = async () => {
        try {
            setLoading(true);
            const data = await api.get<TaxRule[]>('/payroll/tax-rules');
            setRules(data || []);
        } catch (error) {
            console.error("Failed to fetch tax rules:", error);
            toast.error("Failed to load tax rules");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleAdd = () => {
        setEditingRule(null);
        setFormData({ min_salary: 0, max_salary: null, tax_rate: 0, deductible: 0 });
        setIsModalOpen(true);
    };

    const handleEdit = (rule: TaxRule) => {
        setEditingRule(rule);
        setFormData({
            min_salary: Number(rule.min_salary),
            max_salary: rule.max_salary ? Number(rule.max_salary) : null,
            tax_rate: Number(rule.tax_rate),
            deductible: Number(rule.deductible),
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload = { ...formData };

            if (editingRule) {
                await api.patch(`/payroll/tax-rules/${editingRule.id}`, payload);
                toast.success("Tax rule updated");
            } else {
                await api.post('/payroll/tax-rules', payload);
                toast.success("Tax rule created");
            }

            setIsModalOpen(false);
            fetchRules();
        } catch (error) {
            console.error("Failed to save tax rule:", error);
            toast.error("Failed to save tax rule");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this tax rule?")) return;

        try {
            await api.delete(`/payroll/tax-rules/${id}`);
            toast.success("Tax rule deleted");
            fetchRules();
        } catch (error) {
            console.error("Failed to delete tax rule:", error);
            toast.error("Failed to delete tax rule");
        }
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' }).format(Number(amount));
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Tax Rules</CardTitle>
                    <CardDescription>
                        Configure tax brackets and deduction rules for payroll calculation.
                    </CardDescription>
                </div>
                {!disabled && (
                    <Button onClick={handleAdd} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rule
                    </Button>
                )}
            </CardHeader>
            <CardContent className={disabled ? "opacity-50 pointer-events-none" : ""}>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Salary Range</TableHead>
                                    <TableHead>Tax Rate</TableHead>
                                    <TableHead>Deductible</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No tax rules found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rules.map((rule) => (
                                        <TableRow key={rule.id}>
                                            <TableCell className="font-medium">
                                                {formatCurrency(rule.min_salary)} - {rule.max_salary ? formatCurrency(rule.max_salary) : 'Infinity'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
                                                    {rule.tax_rate}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatCurrency(rule.deductible)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
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
            </CardContent>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Edit Tax Rule" : "Add Tax Rule"}</DialogTitle>
                        <DialogDescription>
                            Define the salary range, tax rate, and deductible amount.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="min_salary">Min Salary</Label>
                                <Input
                                    id="min_salary"
                                    type="number"
                                    value={formData.min_salary}
                                    onChange={(e) => setFormData({ ...formData, min_salary: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="max_salary">Max Salary</Label>
                                <Input
                                    id="max_salary"
                                    type="number"
                                    placeholder="Empty for Infinity"
                                    value={formData.max_salary ?? ''}
                                    onChange={(e) => setFormData({ ...formData, max_salary: e.target.value ? parseFloat(e.target.value) : null })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                                <Input
                                    id="tax_rate"
                                    type="number"
                                    value={formData.tax_rate}
                                    onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="deductible">Deductible</Label>
                                <Input
                                    id="deductible"
                                    type="number"
                                    value={formData.deductible}
                                    onChange={(e) => setFormData({ ...formData, deductible: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Rule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
