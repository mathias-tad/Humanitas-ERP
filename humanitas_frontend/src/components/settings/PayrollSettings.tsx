import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { CategorySettings } from "./CategorySettings";
import { UserIncomeSettings } from "./UserIncomeSettings";
import { UserPenaltySettings } from "./UserPenaltySettings";
import { IncomeTypeModal } from "./IncomeTypeModal";
import type { IncomeTypeData, CategoryRule } from "./IncomeTypeModal";
import { TaxRuleSettings } from "./TaxRuleSettings";

interface IncomeType {
  id?: string;
  name: string;
  taxable: boolean;
  pensionable: boolean;
  tax_rate: string;
  custom_tax_rate?: number;
  calculation_type?: 'fixed' | 'percentage';
  is_category_specific?: boolean;
  universal_calculation_mode?: string;
  universal_fixed_amount?: number | null;
  universal_percentage_value?: number | null;
  category_rules?: CategoryRule[];
}

interface TaxRule {
  id?: string;
  min_income: number;
  max_income: number | null;
  tax_rate: number;
  deductible: number;
}

interface PayrollSettingsData {
  currency: string;
  pay_period: string;
  income_types: IncomeType[];
  tax_rules: TaxRule[];
  employee_pension_rate: number;
  employer_pension_rate: number;
  max_deduction_percent?: number;
  penalty_base?: 'NET' | 'GROSS';
  late_penalty_per_minute: number;
  payroll_run_day: number;
  auto_payroll_enabled: boolean;
  // OT Rates
  ot_rate_normal?: number;
  ot_rate_night?: number;
  ot_rate_holiday?: number;
  ot_rate_dayoff?: number;
  monthly_working_hours?: number;
  minimum_ot_duration?: number;
  ot_requires_approval?: boolean;
  allow_employee_loans?: boolean;
}

interface PayrollSettingsProps {
  disabled?: boolean;
}

export function PayrollSettings({ disabled: _disabled = false }: PayrollSettingsProps) {
  const [settings, setSettings] = useState<PayrollSettingsData>({
    currency: "USD",
    pay_period: "monthly",
    income_types: [],
    tax_rules: [],
    employee_pension_rate: 7,
    employer_pension_rate: 11,
    max_deduction_percent: 33.33,
    penalty_base: 'NET',
    late_penalty_per_minute: 0,
    payroll_run_day: 25,
    auto_payroll_enabled: false,
    ot_rate_normal: 1.25,
    ot_rate_night: 1.5,
    ot_rate_holiday: 2.0,
    ot_rate_dayoff: 1.5,
    monthly_working_hours: 160,
    minimum_ot_duration: 30,
    ot_requires_approval: true,
    allow_employee_loans: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<IncomeType | null>(null);


  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeType | null>(null);
  const [incomeForm, setIncomeForm] = useState<IncomeType>({
    name: "",
    taxable: true,
    pensionable: true,
    tax_rate: "standard",
    calculation_type: "fixed",
    is_category_specific: false,
    universal_calculation_mode: "both_highest",
    universal_fixed_amount: null,
    universal_percentage_value: null,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/payroll`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setSettings({
            currency: data.currency || "USD",
            pay_period: data.pay_period || "monthly",
            income_types: data.income_types || [],
            tax_rules: data.tax_rules || [],
            employee_pension_rate: data.employee_pension_rate || 7,
            employer_pension_rate: data.employer_pension_rate || 11,
            max_deduction_percent: data.max_deduction_percent || 33.33,
            penalty_base: data.penalty_base || 'NET',
            late_penalty_per_minute: data.late_penalty_per_minute || 0,
            payroll_run_day: data.payroll_run_day || 25,
            auto_payroll_enabled: data.auto_payroll_enabled || false,
            ot_rate_normal: data.ot_rate_normal || 1.25,
            ot_rate_night: data.ot_rate_night || 1.5,
            ot_rate_holiday: data.ot_rate_holiday || 2.0,
            ot_rate_dayoff: data.ot_rate_dayoff || 1.5,
            monthly_working_hours: data.monthly_working_hours || 160,
            minimum_ot_duration: data.minimum_ot_duration || 30,
            ot_requires_approval: data.ot_requires_approval !== false, // Default true
            allow_employee_loans: !!data.allow_employee_loans,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch payroll settings:", error);
    } finally {
      setIsLoading(false);
    }
  };



  const openAddIncomeModal = () => {
    setEditingIncome(null);
    setIncomeForm({ name: "", taxable: true, pensionable: true, tax_rate: "standard", calculation_type: "fixed" });
    setIsIncomeModalOpen(true);
  };

  const openEditIncomeModal = (income: IncomeType) => {
    setEditingIncome(income);
    setIncomeForm({ ...income });
    setIsIncomeModalOpen(true);
  };

  // Removed handleSaveIncome - logic moved to IncomeTypeModal onSave callback



  const confirmDeleteIncome = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/payroll/income-types/${itemToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSettings({
          ...settings,
          income_types: settings.income_types.filter((i) => i.id !== itemToDelete.id),
        });
        toast.success("Income type deleted successfully");
        setItemToDelete(null); // Close modal
      } else {
        console.error('Failed to delete income type');
        toast.error("Failed to delete income type");
      }
    } catch (error) {
      console.error('Error deleting income type:', error);
      toast.error("An error occurred while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteIncome = (income: IncomeType) => {
    setItemToDelete(income);
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


      <Card>
        <CardHeader>
          <CardTitle>General Payroll Settings</CardTitle>
          <CardDescription>
            Configure currency and pay period settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="ETB">ETB - Ethiopian Birr</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payPeriod">Pay Period</Label>
              <select
                id="payPeriod"
                value={settings.pay_period}
                onChange={(e) => setSettings({ ...settings, pay_period: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="minOTDuration">Minimum OT Duration (minutes)</Label>
              <Input
                id="minOTDuration"
                type="number"
                min="0"
                value={settings.minimum_ot_duration || 30}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minimum_ot_duration: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Minimum duration required to qualify for any overtime
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxDeduction">Max Total Deduction (%)</Label>
              <Input
                id="maxDeduction"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.max_deduction_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_deduction_percent: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Cap on total deductions (loans + penalties) as % of Net Salary
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="penaltyBase">Penalty/Deduction Base</Label>
              <select
                id="penaltyBase"
                value={settings.penalty_base || 'NET'}
                onChange={(e) => setSettings({ ...settings, penalty_base: e.target.value as 'NET' | 'GROSS' })}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="NET">Net Salary (After Tax/Pension)</option>
                <option value="GROSS">Gross Salary</option>
              </select>
              <p className="text-sm text-gray-500">
                Whether to calculate limits based on Net or Gross income
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="allowLoans" className="mb-2">Employee Loans</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="allowLoans"
                  checked={settings.allow_employee_loans || false}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, allow_employee_loans: checked })
                  }
                />
                <Label htmlFor="allowLoans" className="font-normal">
                  Allow employees to request loans
                </Label>
              </div>
              <p className="text-sm text-gray-500">
                If disabled, employees cannot submit new loan requests.
              </p>
            </div>
          </div>
        </CardContent >

      </Card >

      <Card>
        <CardHeader>
          <CardTitle>Overtime Rates</CardTitle>
          <CardDescription>
            Configure value multipliers for different overtime types.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="otNormal">Normal OT Rate</Label>
              <Input
                id="otNormal"
                type="number"
                step="0.05"
                min="1"
                value={settings.ot_rate_normal || 1.25}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ot_rate_normal: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="otNight">Night OT Rate</Label>
              <Input
                id="otNight"
                type="number"
                step="0.05"
                min="1"
                value={settings.ot_rate_night || 1.5}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ot_rate_night: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="otHoliday">Holiday OT Rate</Label>
              <Input
                id="otHoliday"
                type="number"
                step="0.05"
                min="1"
                value={settings.ot_rate_holiday || 2.0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ot_rate_holiday: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="otDayOff">Day Off OT Rate</Label>
              <Input
                id="otDayOff"
                type="number"
                step="0.05"
                min="1"
                value={settings.ot_rate_dayoff || 1.5}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ot_rate_dayoff: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-2 md:w-1/2">
            <Label htmlFor="monthlyHours">Standard Monthly Working Hours</Label>
            <Input
              id="monthlyHours"
              type="number"
              value={settings.monthly_working_hours || 160}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monthly_working_hours: parseFloat(e.target.value) || 0,
                })
              }
            />
            <p className="text-sm text-muted-foreground">Used to calculate hourly rate from basic salary.</p>
          </div>
          <div className="flex items-center space-x-2 mt-4">
            <input
              type="checkbox"
              id="otApproval"
              checked={settings.ot_requires_approval !== false} // Default to true if undefined
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ot_requires_approval: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="otApproval" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Overtime Requires Verification/Approval
            </Label>
          </div>
          <p className="text-sm text-muted-foreground ml-6">
            If unchecked, calculated overtime will be automatically approved.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Income Types</CardTitle>
          <CardDescription>
            Manage different types of income for payroll.
          </CardDescription>
        </CardHeader >
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type Name</TableHead>
                <TableHead>Calculation</TableHead>
                <TableHead className="w-[100px]">Taxable</TableHead>
                <TableHead className="w-[100px]">Pensionable</TableHead>
                <TableHead>Tax Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.income_types.map((income) => (
                <TableRow key={income.id}>
                  <TableCell>{income.name}</TableCell>
                  <TableCell>
                    {income.calculation_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                  </TableCell>
                  <TableCell>{income.taxable ? "Yes" : "No"}</TableCell>
                  <TableCell>{income.pensionable ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    {income.tax_rate === "custom"
                      ? `Custom (${income.custom_tax_rate}%)`
                      : income.tax_rate === "0%"
                        ? "Tax Exempt"
                        : "Standard"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditIncomeModal(income)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteIncome(income)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {settings.income_types.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    No income types configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4">
            <Button variant="secondary" onClick={openAddIncomeModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Income Type
            </Button>
          </div>
        </CardContent>
      </Card >

      <CategorySettings />
      <UserIncomeSettings />
      <UserPenaltySettings />


      <TaxRuleSettings disabled={_disabled} />

      <IncomeTypeModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        incomeType={editingIncome ? {
          name: incomeForm.name,
          taxable: incomeForm.taxable,
          pensionable: incomeForm.pensionable,
          is_category_specific: incomeForm.is_category_specific,
          universal_calculation_mode: incomeForm.universal_calculation_mode,
          universal_fixed_amount: incomeForm.universal_fixed_amount,
          universal_percentage_value: incomeForm.universal_percentage_value,
          category_rules: incomeForm.category_rules,
        } : undefined}
        isSaving={isSaving}
        onSave={async (data: IncomeTypeData) => {
          setIsSaving(true);
          try {
            const updated = {
              ...incomeForm,
              ...data,
            };
            setIncomeForm(updated);

            let savedIncomeType: IncomeType;

            if (editingIncome && editingIncome.id) {
              // Update existing income type
              const response = await fetch(`${API_BASE_URL}/payroll/income-types/${editingIncome.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updated),
              });

              if (!response.ok) throw new Error('Failed to update income type');
              savedIncomeType = await response.json();

              // Update local state
              const newIncomeTypes = [...settings.income_types];
              const index = newIncomeTypes.findIndex((i) => i.id === editingIncome.id);
              if (index >= 0) {
                newIncomeTypes[index] = savedIncomeType;
              }
              setSettings({ ...settings, income_types: newIncomeTypes });
              toast.success("Income type updated successfully");
            } else {
              // Create new income type
              const response = await fetch(`${API_BASE_URL}/payroll/income-types`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updated),
              });

              if (!response.ok) throw new Error('Failed to create income type');
              savedIncomeType = await response.json();

              // Update local state
              const newIncomeTypes = [...settings.income_types, savedIncomeType];
              setSettings({ ...settings, income_types: newIncomeTypes });
              toast.success("Income type created successfully");
            }

            setIsIncomeModalOpen(false);
          } catch (error) {
            console.error('Error saving income type:', error);
            toast.error("Failed to save income type");
          } finally {
            setIsSaving(false);
          }
        }}
      />


      {/* Delete Confirmation Modal */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && !isDeleting && setItemToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the income type "{itemToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteIncome} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
