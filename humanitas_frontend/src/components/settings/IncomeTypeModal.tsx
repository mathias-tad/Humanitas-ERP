import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL } from "@/config/api.config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface CategoryRule {
    category_id: string;
    category_name: string;
    calculation_mode: string;
    fixed_amount: number | null;
    percentage_value: number | null;
}

export interface IncomeTypeData {
    name: string;
    taxable: boolean;
    pensionable: boolean;
    is_category_specific?: boolean;
    universal_calculation_mode?: string;
    universal_fixed_amount?: number | null;
    universal_percentage_value?: number | null;
    category_rules?: CategoryRule[];
}

interface IncomeTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    incomeType?: IncomeTypeData;
    onSave: (data: IncomeTypeData) => void;
    isSaving?: boolean;
}

export function IncomeTypeModal({ isOpen, onClose, incomeType, onSave, isSaving = false }: IncomeTypeModalProps) {
    const [formData, setFormData] = useState<IncomeTypeData>(
        incomeType || {
            name: "",
            taxable: true,
            pensionable: false,
            is_category_specific: false,
            universal_calculation_mode: "both_highest",
            universal_fixed_amount: null,
            universal_percentage_value: null,
            category_rules: [],
        }
    );
    const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
    const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);

    // Fetch employee categories when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    // Reset form when incomeType changes or modal closes
    useEffect(() => {
        if (isOpen && incomeType) {
            setFormData(incomeType);
            setCategoryRules(incomeType.category_rules || []);
        } else if (isOpen && !incomeType) {
            setFormData({
                name: "",
                taxable: true,
                pensionable: false,
                is_category_specific: false,
                universal_calculation_mode: "both_highest",
                universal_fixed_amount: null,
                universal_percentage_value: null,
                category_rules: [],
            });
            setCategoryRules([]);
        }
    }, [isOpen, incomeType]);

    // Initialize category rules when categories are loaded or category-specific is toggled
    useEffect(() => {
        if (formData.is_category_specific && categories.length > 0 && categoryRules.length === 0) {
            const initialRules: CategoryRule[] = categories.map(cat => ({
                category_id: cat.id,
                category_name: cat.name,
                calculation_mode: "both_highest",
                fixed_amount: null,
                percentage_value: null,
            }));
            setCategoryRules(initialRules);
        }
    }, [formData.is_category_specific, categories]);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/payroll/employee-categories`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setCategories(data);
            }
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const updateCategoryRule = (categoryId: string, field: keyof CategoryRule, value: any) => {
        setCategoryRules(prev => {
            const existing = prev.find(r => r.category_id === categoryId);
            if (existing) {
                return prev.map(r => r.category_id === categoryId ? { ...r, [field]: value } : r);
            } else {
                const category = categories.find(c => c.id === categoryId);
                return [...prev, {
                    category_id: categoryId,
                    category_name: category?.name || '',
                    calculation_mode: "both_highest",
                    fixed_amount: null,
                    percentage_value: null,
                    [field]: value,
                }];
            }
        });
    };

    const isEditMode = !!incomeType;

    const handleSave = () => {
        if (!formData.name) {
            alert('Please enter an income type name');
            return;
        }

        // Validation for universal settings
        if (!formData.is_category_specific) {
            const mode = formData.universal_calculation_mode;
            const fixed = formData.universal_fixed_amount;
            const percentage = formData.universal_percentage_value;

            if (mode === 'fixed_only' && !fixed) {
                alert('Please enter a fixed amount for Fixed Only mode');
                return;
            }
            if (mode === 'percentage_only' && !percentage) {
                alert('Please enter a percentage for Percentage Only mode');
                return;
            }
            if (mode === 'both_highest' && !fixed && !percentage) {
                alert('Please enter at least fixed amount or percentage for Both (Highest) mode');
                return;
            }
        } else {
            // Validation for category-specific settings
            if (categoryRules.length === 0) {
                alert('Please configure at least one category rule');
                return;
            }
        }

        const dataToSave = {
            ...formData,
            category_rules: formData.is_category_specific ? categoryRules : undefined,
        };

        onSave(dataToSave);
        // onClose(); // Controlled by parent
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Edit Income Type" : "Add Income Type"}</DialogTitle>
                    <DialogDescription>
                        {isEditMode ? "Update the income type details below." : "Configure how this income type calculates automatically."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="income-name">Income Type Name *</Label>
                        <Input
                            id="income-name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Desert Allowance, Transportation"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="income-taxable"
                            checked={formData.taxable}
                            onCheckedChange={(checked) => {
                                setFormData({ ...formData, taxable: checked === true });
                            }}
                        />
                        <Label htmlFor="income-taxable" className="text-sm font-normal cursor-pointer">
                            Taxable (applies to base assignments)
                        </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="income-pensionable"
                            checked={formData.pensionable}
                            onCheckedChange={(checked) => {
                                setFormData({ ...formData, pensionable: checked === true });
                            }}
                        />
                        <Label htmlFor="income-pensionable" className="text-sm font-normal cursor-pointer">
                            Pensionable
                        </Label>
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <div className="flex items-center space-x-2 mb-4">
                            <Checkbox
                                id="category-specific"
                                checked={formData.is_category_specific}
                                onCheckedChange={(checked) => {
                                    setFormData({ ...formData, is_category_specific: checked === true });
                                }}
                            />
                            <Label htmlFor="category-specific" className="text-sm font-normal cursor-pointer">
                                Different amounts by Employee Category
                            </Label>
                        </div>

                        {formData.is_category_specific ? (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                    <p className="text-sm text-blue-900 font-medium mb-2">
                                        📊 Configure amounts for each employee category below:
                                    </p>
                                </div>
                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Calculation Mode</TableHead>
                                                <TableHead>Fixed Amount</TableHead>
                                                <TableHead>Percentage (%)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {categories.map((category) => {
                                                const rule = categoryRules.find(r => r.category_id === category.id);
                                                return (
                                                    <TableRow key={category.id}>
                                                        <TableCell className="font-medium">{category.name}</TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={rule?.calculation_mode || "both_highest"}
                                                                onValueChange={(value) => updateCategoryRule(category.id, 'calculation_mode', value)}
                                                            >
                                                                <SelectTrigger className="w-[180px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="fixed_only">Fixed Only</SelectItem>
                                                                    <SelectItem value="percentage_only">Percentage Only</SelectItem>
                                                                    <SelectItem value="both_highest">Both (Highest)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0.00"
                                                                value={rule?.fixed_amount || ''}
                                                                onChange={(e) => updateCategoryRule(category.id, 'fixed_amount', e.target.value ? parseFloat(e.target.value) : null)}
                                                                disabled={rule?.calculation_mode === 'percentage_only'}
                                                                className="w-[120px]"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0.00"
                                                                value={rule?.percentage_value || ''}
                                                                onChange={(e) => updateCategoryRule(category.id, 'percentage_value', e.target.value ? parseFloat(e.target.value) : null)}
                                                                disabled={rule?.calculation_mode === 'fixed_only'}
                                                                className="w-[120px]"
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 bg-gray-50 border rounded-md p-4">
                                <div>
                                    <Label>Calculation Mode</Label>
                                    <Select
                                        value={formData.universal_calculation_mode}
                                        onValueChange={(value) => setFormData({ ...formData, universal_calculation_mode: value })}
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed_only">Fixed Amount Only</SelectItem>
                                            <SelectItem value="percentage_only">Percentage of Salary Only</SelectItem>
                                            <SelectItem value="both_highest">Both (System picks highest)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(formData.universal_calculation_mode === 'fixed_only' || formData.universal_calculation_mode === 'both_highest') && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="fixed-amount">Fixed Amount</Label>
                                        <Input
                                            id="fixed-amount"
                                            type="number"
                                            step="0.01"
                                            placeholder="Enter fixed amount"
                                            value={formData.universal_fixed_amount || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                universal_fixed_amount: e.target.value ? parseFloat(e.target.value) : null
                                            })}
                                        />
                                    </div>
                                )}

                                {(formData.universal_calculation_mode === 'percentage_only' || formData.universal_calculation_mode === 'both_highest') && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="percentage">Percentage of Basic Salary</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="percentage"
                                                type="number"
                                                step="0.01"
                                                placeholder="Enter percentage"
                                                value={formData.universal_percentage_value || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    universal_percentage_value: e.target.value ? parseFloat(e.target.value) : null
                                                })}
                                            />
                                            <span className="text-sm text-gray-500">%</span>
                                        </div>
                                    </div>
                                )}

                                {formData.universal_calculation_mode === 'both_highest' && (
                                    <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                                        💡 System will automatically calculate both the fixed amount and percentage, then assign the HIGHER value to the user.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            isEditMode ? "Update" : "Create"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
