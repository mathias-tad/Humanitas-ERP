import { useState } from "react";
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
import { Search, Loader2, Calculator, Save, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { useLeave, type User } from "@/hooks/useLeave";



export default function LeaveBalances() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for editing balances
  const [editingBalance, setEditingBalance] = useState<{
    leave_type_id: string;
    carried_over: number;
    used_days: number;
  } | null>(null);

  const { usersQuery, useUserBalances, calculateBalancesMutation, updateBalanceMutation } = useLeave();
  const users = usersQuery.data || [];
  const isLoading = usersQuery.isLoading;

  const userBalancesQuery = useUserBalances(selectedUser?.id || null);
  const balanceData = userBalancesQuery.data || null;
  const isLoadingBalance = userBalancesQuery.isLoading;
  const isSaving = calculateBalancesMutation.isPending || updateBalanceMutation.isPending;

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleAutoCalculate = () => {
    if (!selectedUser) return;

    calculateBalancesMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        toast.success("Leave balances calculated successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to calculate balances");
      }
    });
  };

  const handleSaveBalance = () => {
    if (!selectedUser || !editingBalance) return;

    updateBalanceMutation.mutate({ userId: selectedUser.id, data: editingBalance }, {
      onSuccess: () => {
        toast.success("Leave balance saved successfully");
        setEditingBalance(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to save balance");
      }
    });
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
            Register and manage initial leave balances for existing employees
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Balance - {selectedUser?.full_name}</DialogTitle>
            <DialogDescription>
              Manage leave balances for this employee. You can auto-calculate based on hire date or manually set values.
            </DialogDescription>
          </DialogHeader>

          {isLoadingBalance ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : balanceData ? (
            <div className="space-y-4">
              {/* User Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm text-gray-500">Hire Date</div>
                  <div className={`font-medium ${!balanceData.user?.hire_date ? 'text-red-500' : ''}`}>
                    {balanceData.user?.hire_date ? formatDate(balanceData.user.hire_date) : "Not Set!"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Years of Service</div>
                  <div className="font-medium">{balanceData.user?.years_of_service ?? 0} years</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Annual Leave Increase</div>
                  <div className="font-medium">+{balanceData.settings?.leave_increase_per_year ?? 0} days/year</div>
                </div>
              </div>

              {!balanceData.user?.hire_date && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <strong>Warning:</strong> This user's hire date is not set. Please update their profile in User Management before calculating leave balances.
                </div>
              )}

              {/* Auto-Calculate Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleAutoCalculate}
                  disabled={isSaving || !balanceData.user?.hire_date}
                  title={!balanceData.user?.hire_date ? "Set hire date first" : ""}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Auto-Calculate All Balances
                </Button>
              </div>

              {/* Leave Balances Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Leave Type</TableHead>
                      <TableHead className="text-center min-w-[80px]">Entitled</TableHead>
                      <TableHead className="text-center min-w-[80px]">Carried Over</TableHead>
                      <TableHead className="text-center min-w-[80px]">Used</TableHead>
                      <TableHead className="text-center min-w-[80px]">Available</TableHead>
                      <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(balanceData.balances || [])
                      .filter((balance) => {
                        if (!balance) return false;
                        // Filter out Maternity leave for non-female employees
                        if (balance.leave_type_name?.toLowerCase().includes('maternity')) {
                          return balanceData.user?.gender?.toLowerCase() === 'female';
                        }
                        return true;
                      })
                      .map((balance, index) => {
                        const isAnnualLeave = Boolean(balance.leave_type_name?.toLowerCase().includes('annual'));
                        // For annual leave: show calculated value, for others: show base fixed value
                        const entitledDays: number = (isAnnualLeave ? balance.current_annual_leave : balance.base_annual_leave) ?? 0;
                        const leaveTypeId = balance.leave_type_id || balance.leave_type_name || ('leave_' + index);
                        const isEditingThis = Boolean(
                          editingBalance &&
                          editingBalance.leave_type_id &&
                          editingBalance.leave_type_id === leaveTypeId
                        );

                        return (
                          <TableRow key={leaveTypeId}>
                            <TableCell>
                              <div className="font-medium">{balance.leave_type_name}</div>
                              <div className="text-xs text-gray-500">
                                {balance.is_paid ? "Paid" : "Unpaid"}
                                {isAnnualLeave && ` • ${balance.years_of_service || 0}yr service`}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{entitledDays}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {isEditingThis && isAnnualLeave ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  className="w-20 text-center"
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
                              ) : (
                                isAnnualLeave ? (balance.carried_over ?? 0) : "-"
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isEditingThis ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  className="w-20 text-center"
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
                                balance.used_days ?? 0
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={(balance.available_days ?? 0) > 0 ? "default" : "destructive"}>
                                {isAnnualLeave
                                  ? (balance.available_days ?? 0)
                                  : entitledDays - (balance.used_days ?? 0)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditingThis ? (
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" onClick={handleSaveBalance} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingBalance(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
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

              {/* Calculation Info */}
              <div className="rounded-lg bg-primary/5 p-4 text-sm">
                <h4 className="font-medium text-blue-900 mb-2">How It Works</h4>
                <ul className="text-blue-800 space-y-1">
                  <li>• <strong>Annual Leave</strong>: Increases by {balanceData.settings?.leave_increase_per_year ?? 0} day(s) per year of service. Carried over balance applies.</li>
                  <li>• <strong>Other Leaves</strong>: Fixed entitlement per year. No carry over.</li>
                  <li>• <strong>Maternity Leave</strong>: Only available for female employees.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No balance data available
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
