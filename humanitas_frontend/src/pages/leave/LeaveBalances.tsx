import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { getAuthHeaders } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Loader2,
  Calculator,
  Save,
  Calendar,
  Users,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Info,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useLeave, type User } from "@/hooks/useLeave";

export default function LeaveBalances() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for inline editing in the table
  const [editingBalance, setEditingBalance] = useState<{
    leave_type_id: string;
    carried_over: number;
    used_days: number;
  } | null>(null);

  // --- Onboarding / Established Company Balance Calculator State ---
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(true);
  const [calcLeaveTypeId, setCalcLeaveTypeId] = useState<string>("");
  const [calcHireDate, setCalcHireDate] = useState<string>("");
  const [calcAsOfDate, setCalcAsOfDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [calcAccrualMode, setCalcAccrualMode] = useState<"full" | "prorated">("full");
  const [calcCarriedOver, setCalcCarriedOver] = useState<number>(0);
  const [calcLegacyUsed, setCalcLegacyUsed] = useState<number>(0);
  const queryClient = useQueryClient();
  const [isSavingHireDate, setIsSavingHireDate] = useState(false);

  const handleSetOfficialHireDate = async (targetHireDate?: string): Promise<boolean> => {
    const dateToSave = targetHireDate || calcHireDate;
    if (!selectedUser || !dateToSave) {
      toast.error("Please enter a valid Hire / Start Date");
      return false;
    }
    setIsSavingHireDate(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ hire_date: dateToSave }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to update employee hire date");
      }
      toast.success(`Official hire date set to ${dateToSave} for ${selectedUser.full_name}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["userBalances", selectedUser.id] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
      ]);
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to set employee hire date");
      return false;
    } finally {
      setIsSavingHireDate(false);
    }
  };

  const { usersQuery, useUserBalances, calculateBalancesMutation, updateBalanceMutation } = useLeave();
  const users = usersQuery.data || [];
  const isLoading = usersQuery.isLoading;

  const userBalancesQuery = useUserBalances(selectedUser?.id || null);
  const balanceData = userBalancesQuery.data || null;
  const isLoadingBalance = userBalancesQuery.isLoading;
  const isSaving = calculateBalancesMutation.isPending || updateBalanceMutation.isPending;

  // Initialize calculator whenever a user is opened
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setCalcHireDate(user.hire_date ? user.hire_date.split("T")[0] : "");
    setCalcAsOfDate(new Date().toISOString().split("T")[0]);
    setCalcCarriedOver(0);
    setCalcLegacyUsed(0);
    setCalcAccrualMode("full");
    setEditingBalance(null);
    setIsModalOpen(true);
  };

  // Sync default leave type when balanceData is loaded
  useEffect(() => {
    if (balanceData?.balances && balanceData.balances.length > 0) {
      const annual = balanceData.balances.find((b) =>
        b.leave_type_name?.toLowerCase().includes("annual")
      );
      if (annual) {
        setCalcLeaveTypeId(annual.leave_type_id || annual.leave_type_name);
      } else {
        const first = balanceData.balances[0];
        setCalcLeaveTypeId(first.leave_type_id || first.leave_type_name);
      }
    }
    if (balanceData?.user?.hire_date && !calcHireDate) {
      setCalcHireDate(balanceData.user.hire_date.split("T")[0]);
    }
  }, [balanceData]);

  // Auto-calculate all balances using standard hire-date accrual
  const handleAutoCalculate = () => {
    if (!selectedUser) return;

    calculateBalancesMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        toast.success("Leave balances calculated successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to calculate balances");
      },
    });
  };

  // Inline table save
  const handleSaveBalance = () => {
    if (!selectedUser || !editingBalance) return;

    updateBalanceMutation.mutate(
      { userId: selectedUser.id, data: editingBalance },
      {
        onSuccess: () => {
          toast.success("Leave balance saved successfully");
          setEditingBalance(null);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to save balance");
        },
      }
    );
  };

  // --- Dynamic Live Math for Onboarding Calculator ---
  const selectedBalance = (balanceData?.balances || []).find(
    (b) => (b.leave_type_id || b.leave_type_name) === calcLeaveTypeId
  );
  const isAnnualLeaveSelected = Boolean(
    selectedBalance?.leave_type_name?.toLowerCase().includes("annual")
  );

  const baseEntitlement = isAnnualLeaveSelected
    ? (selectedBalance?.base_annual_leave ?? 16)
    : (selectedBalance?.total_days ?? 10);
  const increasePerYear = balanceData?.settings?.leave_increase_per_year ?? 1;

  // Compute tenure years
  const hireTime = calcHireDate ? new Date(calcHireDate).getTime() : 0;
  const asOfTime = calcAsOfDate
    ? new Date(calcAsOfDate).getTime()
    : new Date().getTime();
  const diffYears =
    hireTime > 0 && asOfTime > hireTime
      ? Math.floor((asOfTime - hireTime) / (365.25 * 24 * 60 * 60 * 1000))
      : 0;

  // Base + tenure additions
  const annualEntitled = isAnnualLeaveSelected
    ? baseEntitlement + diffYears * increasePerYear
    : baseEntitlement;

  // Mid-year pro-rata if applicable
  const hireYear = calcHireDate ? new Date(calcHireDate).getFullYear() : new Date().getFullYear();
  const asOfYear = calcAsOfDate ? new Date(calcAsOfDate).getFullYear() : new Date().getFullYear();
  let monthsActiveThisYear = 12;
  if (hireYear === asOfYear && calcHireDate) {
    monthsActiveThisYear = Math.max(1, 12 - new Date(calcHireDate).getMonth());
  }

  const calculatedEntitlement =
    calcAccrualMode === "prorated"
      ? Math.round((annualEntitled / 12) * monthsActiveThisYear * 10) / 10
      : annualEntitled;

  const totalGrossAllocated = calculatedEntitlement + (Number(calcCarriedOver) || 0);
  const netStartingAvailable = totalGrossAllocated - (Number(calcLegacyUsed) || 0);

  // Apply Onboarding Balance Mutation
  const handleApplyOnboardingBalance = async () => {
    if (!selectedUser || !calcLeaveTypeId) {
      toast.error("Please select a leave type");
      return;
    }

    // Check if employee has an official hire date
    const hasOfficialHireDate = Boolean(balanceData?.user?.hire_date);
    if (!hasOfficialHireDate) {
      if (!calcHireDate) {
        toast.error("Employee hire date is not set. Please enter a 'Hire / Start Date' in the calculator to proceed.");
        return;
      }
      // Automatically set and persist the official hire date right now!
      const ok = await handleSetOfficialHireDate(calcHireDate);
      if (!ok) {
        return;
      }
    }

    const payload = {
      leave_type_id: calcLeaveTypeId,
      carried_over: Number(calcCarriedOver) || 0,
      used_days: Number(calcLegacyUsed) || 0,
      total_days: totalGrossAllocated,
      year: asOfYear,
    };

    updateBalanceMutation.mutate(
      { userId: selectedUser.id, data: payload },
      {
        onSuccess: () => {
          toast.success(
            `Applied initial balance for ${selectedBalance?.leave_type_name || "Leave"}: ` +
            `${netStartingAvailable} available days (${calculatedEntitlement} entitled + ${calcCarriedOver} carried over - ${calcLegacyUsed} legacy used).`
          );
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to apply onboarding balance");
        },
      }
    );
  };

  const handleResetCalculator = () => {
    setCalcCarriedOver(0);
    setCalcLegacyUsed(0);
    setCalcAccrualMode("full");
    if (balanceData?.user?.hire_date) {
      setCalcHireDate(balanceData.user.hire_date.split("T")[0]);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Balance Management</h1>
          <p className="text-gray-500">
            Register and manage initial leave balances for existing employees & established company onboarding
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead>Years of Service</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const yearsOfService = user.hire_date
                    ? Math.floor(
                        (new Date().getTime() - new Date(user.hire_date).getTime()) /
                          (365.25 * 24 * 60 * 60 * 1000)
                      )
                    : 0;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell>{formatDate(user.hire_date)}</TableCell>
                      <TableCell>
                        <Badge variant={yearsOfService > 0 ? "default" : "secondary"}>
                          {yearsOfService} years
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectUser(user)}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Manage Balance
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Leave Balance Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[96vw] max-w-6xl xl:max-w-7xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Calendar className="h-5 w-5 text-primary" />
              Leave Balance Management — {selectedUser?.full_name}
            </DialogTitle>
            <DialogDescription>
              Configure starting leave balances, tenure accruals, legacy used days, and prior carry-overs.
            </DialogDescription>
          </DialogHeader>

          {isLoadingBalance ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : balanceData ? (
            <div className="space-y-6">
              {/* User Tenure Header Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/40 rounded-xl border border-border">
                <div>
                  <div className="text-xs uppercase font-semibold text-muted-foreground">Official Hire Date</div>
                  <div className={`font-semibold text-base mt-0.5 ${!balanceData.user?.hire_date ? "text-destructive" : ""}`}>
                    {balanceData.user?.hire_date ? formatDate(balanceData.user.hire_date) : "Not Set!"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase font-semibold text-muted-foreground">Years of Service</div>
                  <div className="font-semibold text-base mt-0.5">
                    {balanceData.user?.years_of_service ?? diffYears} years
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase font-semibold text-muted-foreground">Annual Policy Increase</div>
                  <div className="font-semibold text-base mt-0.5 text-primary">
                    +{balanceData.settings?.leave_increase_per_year ?? 1} day / year
                  </div>
                </div>
              </div>

              {!balanceData.user?.hire_date && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                        Official Hire Date Not Set in Profile
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        {calcHireDate ? (
                          <>
                            Hire date set in calculator: <strong>{calcHireDate}</strong>. Save it as the employee&apos;s official hire date right here, or click <em>&ldquo;Set Hire Date &amp; Apply Balance&rdquo;</em> below to update and apply in one click.
                          </>
                        ) : (
                          "Please select a 'Hire / Start Date' below to set the official hire date and calculate accurate tenure leave accruals."
                        )}
                      </p>
                    </div>
                  </div>
                  {calcHireDate && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingHireDate}
                      onClick={() => handleSetOfficialHireDate(calcHireDate)}
                      className="shrink-0 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                    >
                      {isSavingHireDate ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Set as Official Hire Date
                    </Button>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* ONBOARDING & ESTABLISHED COMPANY LEAVE CALCULATOR */}
              {/* ============================================================== */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">
                          Onboarding Leave Calculator
                        </h3>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold bg-primary/10 text-primary border-primary/30">
                          Established Company Mode
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Seamlessly transition legacy employees: compute entitled days from hire date and deduct days already taken in previous systems.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                    className="text-xs font-medium"
                  >
                    {isCalculatorOpen ? (
                      <>
                        Hide <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      </>
                    ) : (
                      <>
                        Show Calculator <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>

                {isCalculatorOpen && (
                  <div className="space-y-4 pt-2 border-t border-primary/10">
                    {/* Controls Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Leave Type Selector */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Leave Type
                        </label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={calcLeaveTypeId}
                          onChange={(e) => setCalcLeaveTypeId(e.target.value)}
                        >
                          {(balanceData.balances || []).map((b, idx) => {
                            const val = b.leave_type_id || b.leave_type_name || `leave_${idx}`;
                            return (
                              <option key={val} value={val}>
                                {b.leave_type_name} ({b.is_paid ? "Paid" : "Unpaid"})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Hire Date (Simulated / Initialized) */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Hire / Start Date
                        </label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={calcHireDate}
                          onChange={(e) => setCalcHireDate(e.target.value)}
                        />
                      </div>

                      {/* Go-Live / As-Of Date */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Go-Live / As-Of Date
                        </label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          value={calcAsOfDate}
                          onChange={(e) => setCalcAsOfDate(e.target.value)}
                        />
                      </div>

                      {/* Accrual Policy Mode */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Accrual Mode
                        </label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={calcAccrualMode}
                          onChange={(e) => setCalcAccrualMode(e.target.value as "full" | "prorated")}
                        >
                          <option value="full">Full Annual Entitlement</option>
                          <option value="prorated">Pro-Rated (Joined Mid-Year)</option>
                        </select>
                      </div>

                      {/* Carried Over Days */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Prior Carried Over (+C)
                        </label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="0"
                          className="h-9 text-xs"
                          value={calcCarriedOver}
                          onChange={(e) => setCalcCarriedOver(parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      {/* Legacy Used Days */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Legacy Days Already Taken (-U)
                        </label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="0"
                          className="h-9 text-xs"
                          value={calcLegacyUsed}
                          onChange={(e) => setCalcLegacyUsed(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Live Calculation Formula Card */}
                    <div className="bg-background/90 rounded-lg p-3.5 border border-border space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <History className="h-3.5 w-3.5 text-primary" />
                          Tenure: <strong>{diffYears} years of service</strong> (Base: {baseEntitlement}d {isAnnualLeaveSelected ? `+ ${diffYears * increasePerYear}d tenure` : ""})
                        </span>
                        <span>
                          Cycle: <strong>{asOfYear}</strong> {calcAccrualMode === "prorated" ? `(${monthsActiveThisYear} mos active)` : "(Full 12 mos)"}
                        </span>
                      </div>

                      {/* Step-by-Step Mathematical Formula Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                        <div className="bg-muted/50 rounded-lg p-2 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">Annual Entitled (E)</div>
                          <div className="text-sm font-extrabold text-foreground mt-0.5">{calculatedEntitlement}</div>
                          <div className="text-[10px] text-muted-foreground">days</div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-2 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">+ Carried Over (C)</div>
                          <div className="text-sm font-extrabold text-blue-600 mt-0.5">+{calcCarriedOver}</div>
                          <div className="text-[10px] text-muted-foreground">days</div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-2 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">= Gross Total (T)</div>
                          <div className="text-sm font-extrabold text-foreground mt-0.5">{totalGrossAllocated}</div>
                          <div className="text-[10px] text-muted-foreground">days</div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-2 border border-border">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground">- Legacy Used (U)</div>
                          <div className="text-sm font-extrabold text-amber-600 mt-0.5">-{calcLegacyUsed}</div>
                          <div className="text-[10px] text-muted-foreground">days taken</div>
                        </div>

                        <div className="col-span-2 sm:col-span-1 bg-primary/10 rounded-lg p-2 border border-primary/30">
                          <div className="text-[10px] uppercase font-bold text-primary">= Net Available (A)</div>
                          <div className={`text-base font-black mt-0.5 ${netStartingAvailable >= 0 ? "text-primary" : "text-destructive"}`}>
                            {netStartingAvailable}
                          </div>
                          <div className="text-[10px] font-semibold text-primary">starting days</div>
                        </div>
                      </div>

                      {/* Calculator Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>
                            Clicking <strong>Apply</strong> will register gross total ({totalGrossAllocated}d), legacy used ({calcLegacyUsed}d), and leave ({netStartingAvailable}d) available.
                          </span>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetCalculator}
                            className="h-8 text-xs"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleApplyOnboardingBalance}
                            disabled={isSaving || isSavingHireDate || (!balanceData?.user?.hire_date && !calcHireDate)}
                            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                          >
                            {isSaving || isSavingHireDate ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {!balanceData?.user?.hire_date ? "Set Hire Date & Apply Balance" : "Apply Onboarding Balance"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-Calculate All Balances Button & Title */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Current Employee Leave Balances</h4>
                  <p className="text-xs text-muted-foreground">
                    Active balances recorded in the database for the current cycle.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoCalculate}
                  disabled={isSaving || !balanceData.user?.hire_date}
                  title={!balanceData.user?.hire_date ? "Set hire date first" : ""}
                  className="text-xs"
                >
                  <Calculator className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Auto-Calculate All Standard Entitlements
                </Button>
              </div>

              {/* Leave Balances Table */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="min-w-[150px]">Leave Type</TableHead>
                      <TableHead className="text-center min-w-[80px]">Total Entitled</TableHead>
                      <TableHead className="text-center min-w-[80px]">Carried Over</TableHead>
                      <TableHead className="text-center min-w-[80px]">Used Days</TableHead>
                      <TableHead className="text-center min-w-[80px]">Available</TableHead>
                      <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(balanceData.balances || [])
                      .filter((balance) => {
                        if (!balance) return false;
                        // Filter out Maternity leave for non-female employees
                        if (balance.leave_type_name?.toLowerCase().includes("maternity")) {
                          return balanceData.user?.gender?.toLowerCase() === "female";
                        }
                        return true;
                      })
                      .map((balance, index) => {
                        const isAnnualLeave = Boolean(
                          balance.leave_type_name?.toLowerCase().includes("annual")
                        );
                        const entitledDays: number =
                          (isAnnualLeave
                            ? balance.current_annual_leave
                            : balance.base_annual_leave) ??
                          balance.total_days ??
                          0;
                        const leaveTypeId =
                          balance.leave_type_id ||
                          balance.leave_type_name ||
                          "leave_" + index;
                        const isEditingThis = Boolean(
                          editingBalance &&
                            editingBalance.leave_type_id &&
                            editingBalance.leave_type_id === leaveTypeId
                        );

                        return (
                          <TableRow key={leaveTypeId}>
                            <TableCell>
                              <div className="font-semibold text-foreground text-sm">
                                {balance.leave_type_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {balance.is_paid ? "Paid" : "Unpaid"}
                                {isAnnualLeave && ` • ${balance.years_of_service || 0}yr service`}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono text-xs">
                                {balance.total_days ?? entitledDays}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {isEditingThis && isAnnualLeave ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  className="w-20 text-center text-xs h-8 mx-auto"
                                  value={editingBalance?.carried_over ?? 0}
                                  onChange={(e) =>
                                    setEditingBalance((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            carried_over: parseFloat(e.target.value) || 0,
                                          }
                                        : null
                                    )
                                  }
                                />
                              ) : isAnnualLeave ? (
                                <span className="font-mono text-xs">
                                  {balance.carried_over ?? 0}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isEditingThis ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  className="w-20 text-center text-xs h-8 mx-auto"
                                  value={editingBalance?.used_days ?? 0}
                                  onChange={(e) =>
                                    setEditingBalance((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            used_days: parseFloat(e.target.value) || 0,
                                          }
                                        : null
                                    )
                                  }
                                />
                              ) : (
                                <span className="font-mono text-xs text-amber-600 font-medium">
                                  {balance.used_days ?? 0}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  (balance.available_days ?? 0) > 0 ? "default" : "destructive"
                                }
                                className="font-mono text-xs"
                              >
                                {balance.available_days ??
                                  entitledDays - (balance.used_days ?? 0)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditingThis ? (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    onClick={handleSaveBalance}
                                    disabled={isSaving}
                                    className="h-8 px-2.5"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Save className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingBalance(null)}
                                    className="h-8 px-2.5 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() =>
                                    setEditingBalance({
                                      leave_type_id: leaveTypeId,
                                      carried_over: balance.carried_over ?? 0,
                                      used_days: balance.used_days ?? 0,
                                    })
                                  }
                                >
                                  Edit
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Policy Notes */}
              <div className="rounded-xl bg-muted/40 p-4 text-xs space-y-1.5 border border-border">
                <h5 className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Statutory Leave Policy Rules
                </h5>
                <ul className="text-muted-foreground space-y-1 pl-5 list-disc">
                  <li>
                    <strong>Annual Leave</strong>: Base entitlement of {selectedBalance?.base_annual_leave ?? 16} days, plus {balanceData.settings?.leave_increase_per_year ?? 1} day for every completed year of service. Carried-over balance is valid for subsequent periods.
                  </li>
                  <li>
                    <strong>Established Companies</strong>: When entering existing employees who already used leave prior to Humanitas adoption, enter their legacy taken days in the <em>Onboarding Calculator</em> to set their true net starting available balance.
                  </li>
                  <li>
                    <strong>Maternity Leave</strong>: Filtered strictly for female personnel.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No balance records found for this employee.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
