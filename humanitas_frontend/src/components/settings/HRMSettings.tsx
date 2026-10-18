import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LeaveType {
  id?: string;
  name: string;
  days_per_year: number;
  is_paid: boolean;
}

interface HRSettingsData {
  standard_start_time: string;
  standard_end_time: string;
  late_tolerance_minutes: number;
  overtime_threshold_hours: number;
  early_punch_in_minutes: number;
  wait_for_absent_minutes?: number; // Optional
  mark_late_instead_of_absent?: boolean; // Optional
  work_hours_per_month: number;
  work_days: string[];
  days_in_month_mode: 'FIXED_30' | 'ACTUAL';
  leave_types: LeaveType[];
  // Leave accrual settings
  probation_period_days: number;
  leave_calculation_day: number;
  leave_increase_per_year: number;
  // Notification settings
  absent_notification_enabled?: boolean;
  absent_notification_roles?: string[];
  // Attendance methods & Biometric verification
  allowed_attendance_methods?: string[];
  biometric_verification_mode?: 'optional' | 'strict_finger_face' | 'strict_all';
  // Payroll settings
  payroll_run_day: number;
  auto_payroll_enabled: boolean;
  late_penalty_per_minute: number;
  currency: string;
  employee_pension_rate: number;
  employer_pension_rate: number;
}

interface HRMSettingsProps {
  disabled?: boolean;
}

export function HRMSettings({ disabled: _disabled = false }: HRMSettingsProps) {
  const [settings, setSettings] = useState<HRSettingsData>({
    standard_start_time: "09:00",
    standard_end_time: "17:00",
    late_tolerance_minutes: 15,
    overtime_threshold_hours: 2,
    early_punch_in_minutes: 30,
    wait_for_absent_minutes: 0,
    mark_late_instead_of_absent: false,
    allowed_attendance_methods: ["biometric", "qr"],
    biometric_verification_mode: "optional",
    work_hours_per_month: 192,
    work_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    days_in_month_mode: "FIXED_30",
    leave_types: [],
    payroll_run_day: 25,
    auto_payroll_enabled: false,
    late_penalty_per_minute: 0,
    currency: "ETB",
    employee_pension_rate: 7,
    employer_pension_rate: 11,
    probation_period_days: 90,
    leave_calculation_day: 1,
    leave_increase_per_year: 1,
    absent_notification_enabled: false,
    absent_notification_roles: ['admin', 'manager'],
  });
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveType | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveType>({
    name: "",
    days_per_year: 0,
    is_paid: true,
  });

  useEffect(() => {
    fetchSettings();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/roles`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  // Combine static and dynamic roles for selection
  const allRoleOptions = [
    { id: 'owner', name: 'Owner' },
    { id: 'admin', name: 'Admin' },
    { id: 'manager', name: 'Manager' },
    ...availableRoles.map(r => ({ id: r.id, name: r.name }))
  ];

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/hr`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setSettings({
            standard_start_time: data.standard_start_time || "09:00",
            standard_end_time: data.standard_end_time || "17:00",
            late_tolerance_minutes: data.late_tolerance_minutes || 15,
            overtime_threshold_hours: data.overtime_threshold_hours || 2,
            early_punch_in_minutes: data.early_punch_in_minutes || 30,
            wait_for_absent_minutes: data.wait_for_absent_minutes || 0,
            mark_late_instead_of_absent: data.mark_late_instead_of_absent || false,
            work_hours_per_month: data.work_hours_per_month || 192,
            work_days: data.work_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            days_in_month_mode: data.days_in_month_mode || "FIXED_30",
            leave_types: data.leave_types || [],
            payroll_run_day: data.payroll_run_day || 25,
            auto_payroll_enabled: data.auto_payroll_enabled || false,
            late_penalty_per_minute: data.late_penalty_per_minute || 0,
            currency: data.currency || "ETB",
            employee_pension_rate: data.employee_pension_rate || 7,
            employer_pension_rate: data.employer_pension_rate || 11,
            probation_period_days: data.probation_period_days || 90,
            leave_calculation_day: data.leave_calculation_day || 1,
            leave_increase_per_year: data.leave_increase_per_year || 1,
            allowed_attendance_methods: Array.isArray(data.allowed_attendance_methods)
              ? data.allowed_attendance_methods
              : ["biometric", "qr"],
            biometric_verification_mode: data.biometric_verification_mode || "optional",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch HR settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/settings/hr`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");
      setMessage({ type: "success", text: "HR settings saved!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  const openAddLeaveModal = () => {
    setEditingLeave(null);
    setLeaveForm({ name: "", days_per_year: 0, is_paid: true });
    setIsLeaveModalOpen(true);
  };

  const openEditLeaveModal = (leave: LeaveType) => {
    setEditingLeave(leave);
    setLeaveForm({ ...leave });
    setIsLeaveModalOpen(true);
  };

  const handleSaveLeave = () => {
    if (!leaveForm.name.trim()) return;

    const newLeaveTypes = [...settings.leave_types];
    if (editingLeave) {
      const index = newLeaveTypes.findIndex((l) => l.id === editingLeave.id);
      if (index >= 0) {
        newLeaveTypes[index] = { ...leaveForm, id: editingLeave.id };
      }
    } else {
      newLeaveTypes.push({ ...leaveForm, id: crypto.randomUUID() });
    }

    setSettings({ ...settings, leave_types: newLeaveTypes });
    setIsLeaveModalOpen(false);
  };

  const handleDeleteLeave = (id: string) => {
    setSettings({
      ...settings,
      leave_types: settings.leave_types.filter((l) => l.id !== id),
    });
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
          <CardTitle>Attendance Settings</CardTitle>
          <CardDescription>
            Configure your attendance preferences here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Absence Marking Settings */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-4">
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Absence Marking Configuration</h4>
              <p className="text-sm text-amber-700">
                Configure when employees are automatically marked absent
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="waitForAbsent">Wait Before Marking Absent (minutes)</Label>
                <Input
                  id="waitForAbsent"
                  type="number"
                  min="0"
                  max="480"
                  value={settings.wait_for_absent_minutes || 0}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      wait_for_absent_minutes: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-sm text-amber-700">
                  {settings.wait_for_absent_minutes === 0 || !settings.wait_for_absent_minutes
                    ? "Mark absent after shift end + grace period (default)"
                    : `Mark absent ${settings.wait_for_absent_minutes} minutes after shift start`}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Late Clock-In After Absence</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="markLateInstead"
                    checked={settings.mark_late_instead_of_absent || false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mark_late_instead_of_absent: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="markLateInstead" className="font-normal cursor-pointer">
                    Allow converting Absent to Late if employee clocks in
                  </Label>
                </div>
                <p className="text-sm text-amber-700">
                  {settings.mark_late_instead_of_absent
                    ? "Employees can clock in after being marked absent (converted to Late)"
                    : "Employees cannot clock in after being marked absent"}
                </p>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-4">
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Notification Configurations</h4>
              <p className="text-sm text-blue-700">
                Configure notifications for absence penalties
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableAbsentNotif"
                  checked={settings.absent_notification_enabled || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      absent_notification_enabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="enableAbsentNotif" className="font-normal cursor-pointer">
                  Enable Absent Notifications
                </Label>
              </div>
              <p className="text-sm text-blue-700 ml-6">
                Send notifications when an absence penalty is generated
              </p>
            </div>

            {settings.absent_notification_enabled && (
              <div className="grid gap-2 mt-4">
                <Label>Notify Roles (in addition to the employee)</Label>
                <div className="flex flex-wrap gap-4 p-3 bg-white border rounded-md">
                  {allRoleOptions.map((role) => (
                    <div key={role.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`role-${role.id}`}
                        checked={settings.absent_notification_roles?.includes(role.id) || false}
                        onChange={(e) => {
                          const current = settings.absent_notification_roles || [];
                          const newRoles = e.target.checked
                            ? [...current, role.id]
                            : current.filter((r) => r !== role.id);
                          setSettings({ ...settings, absent_notification_roles: newRoles });
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`role-${role.id}`} className="font-normal cursor-pointer capitalize">
                        {role.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="standardStart">Standard Start Time</Label>
              <Input
                id="standardStart"
                type="time"
                value={settings.standard_start_time}
                onChange={(e) =>
                  setSettings({ ...settings, standard_start_time: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="standardEnd">Standard End Time</Label>
              <Input
                id="standardEnd"
                type="time"
                value={settings.standard_end_time}
                onChange={(e) =>
                  setSettings({ ...settings, standard_end_time: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="grid gap-2">
              <Label htmlFor="daysInMonthMode">Days in Month Calculation</Label>
              <select
                id="daysInMonthMode"
                value={settings.days_in_month_mode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    days_in_month_mode: e.target.value as 'FIXED_30' | 'ACTUAL',
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="FIXED_30">Fixed 30 Days</option>
                <option value="ACTUAL">Actual Days in Month</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-4 p-4 border rounded-md">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <div key={day} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`day-${day}`}
                    checked={settings.work_days.includes(day)}
                    onChange={(e) => {
                      const newDays = e.target.checked
                        ? [...settings.work_days, day]
                        : settings.work_days.filter((d) => d !== day);
                      setSettings({ ...settings, work_days: newDays });
                    }}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`day-${day}`} className="font-normal cursor-pointer">{day}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="lateTolerance">Late Arrival Tolerance (minutes)</Label>
              <Input
                id="lateTolerance"
                type="number"
                value={settings.late_tolerance_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    late_tolerance_minutes: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="overtimeThreshold">Overtime Threshold (hours/day)</Label>
              <Input
                id="overtimeThreshold"
                type="number"
                step="0.5"
                value={settings.overtime_threshold_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    overtime_threshold_hours: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="earlyPunchIn">Early Punch In Allowance (minutes)</Label>
              <Input
                id="earlyPunchIn"
                type="number"
                min="0"
                max="120"
                value={settings.early_punch_in_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    early_punch_in_minutes: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-sm text-gray-500">
                How many minutes before shift start can employees clock in
              </p>
            </div>

            {/* Attendance Check-in Methods & Biometric Policy */}
            <div className="rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 space-y-4">
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">Accepted Attendance Verification Methods</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Choose which check-in methods your organization accepts (Biometric Terminals, Mobile QR Code Scan, or both).
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="methodBiometric"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    checked={(settings.allowed_attendance_methods || ['biometric', 'qr']).includes('biometric')}
                    onChange={(e) => {
                      const current = settings.allowed_attendance_methods || ['biometric', 'qr'];
                      const next = e.target.checked
                        ? Array.from(new Set([...current, 'biometric']))
                        : current.filter((m) => m !== 'biometric');
                      setSettings({ ...settings, allowed_attendance_methods: next });
                    }}
                  />
                  <Label htmlFor="methodBiometric" className="text-sm font-medium cursor-pointer">
                    Accept Biometric Hardware Devices (Fingerprint / Face / Palm Terminals)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="methodQR"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    checked={
                      (settings.allowed_attendance_methods || ['biometric', 'qr']).includes('qr') ||
                      (settings.allowed_attendance_methods || []).includes('qr_code')
                    }
                    onChange={(e) => {
                      const current = settings.allowed_attendance_methods || ['biometric', 'qr'];
                      const next = e.target.checked
                        ? Array.from(new Set([...current, 'qr']))
                        : current.filter((m) => m !== 'qr' && m !== 'qr_code');
                      setSettings({ ...settings, allowed_attendance_methods: next });
                    }}
                  />
                  <Label htmlFor="methodQR" className="text-sm font-medium cursor-pointer">
                    Accept Mobile Dynamic QR Code Scanning
                  </Label>
                </div>
              </div>

              <div className="grid gap-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                <Label htmlFor="biometricMode">Biometric Terminal Verification Mode</Label>
                <select
                  id="biometricMode"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.biometric_verification_mode || 'optional'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      biometric_verification_mode: e.target.value as any,
                    })
                  }
                >
                  <option value="optional">Optional: Any Modality (Fingerprint, Face, or Palm)</option>
                  <option value="strict_finger_face">Strict: Requires both Fingerprint & Face Enrolled</option>
                  <option value="strict_all">Strict: Requires All Modalities (Fingerprint, Face, and Palm)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Controls whether employee attendance is recognized by any single enrolled biometric or strictly requires multi-modal enrollment on employee record.
                </p>
              </div>
            </div>
          </div>
        </CardContent >
      </Card >

      <Card>
        <CardHeader>
          <CardTitle>Leave Settings</CardTitle>
          <CardDescription>
            Manage your leave policies and entitlements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {settings.leave_types.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div>
                  <span className="font-medium">{leave.name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({leave.days_per_year} days/year, {leave.is_paid ? "Paid" : "Unpaid"})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditLeaveModal(leave)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteLeave(leave.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {settings.leave_types.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No leave types configured
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={openAddLeaveModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Leave Type
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save HR Settings"
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Settings</CardTitle>
          <CardDescription>
            Configure automatic payroll run and deduction settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={settings.currency}
                onChange={(e) =>
                  setSettings({ ...settings, currency: e.target.value })
                }
                placeholder="ETB"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="latePenalty">Late Penalty Per Minute ({settings.currency})</Label>
              <Input
                id="latePenalty"
                type="number"
                step="0.01"
                min="0"
                value={settings.late_penalty_per_minute}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    late_penalty_per_minute: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Amount deducted from salary for each minute late
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="payrollDay">Payroll Run Day (1-28)</Label>
              <Input
                id="payrollDay"
                type="number"
                min="1"
                max="28"
                value={settings.payroll_run_day}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payroll_run_day: Math.min(28, Math.max(1, parseInt(e.target.value) || 25)),
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Day of month when automatic payroll runs (1-28 to avoid month-end issues)
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Auto Payroll</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="autoPayroll"
                  checked={settings.auto_payroll_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, auto_payroll_enabled: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="autoPayroll" className="font-normal">
                  Enable automatic payroll calculation on day {settings.payroll_run_day} of each month
                </Label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="employeePension">Employee Pension Rate (%)</Label>
              <Input
                id="employeePension"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.employee_pension_rate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    employee_pension_rate: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Pension deducted from employee salary (default: 7%)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="employerPension">Employer Pension Rate (%)</Label>
              <Input
                id="employerPension"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.employer_pension_rate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    employer_pension_rate: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Employer pension contribution (default: 11%)
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Payroll Settings"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Leave Accrual Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Accrual Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="probationPeriod">Probation Period (Days)</Label>
              <Input
                id="probationPeriod"
                type="number"
                min="0"
                max="365"
                value={settings.probation_period_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    probation_period_days: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
              <p className="text-sm text-gray-500">
                New employees cannot request leave during this period
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leaveCalculationDay">Leave Calculation Day</Label>
              <Input
                id="leaveCalculationDay"
                type="number"
                min="1"
                max="28"
                value={settings.leave_calculation_day}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    leave_calculation_day: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)),
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Day of month when leave accrues (1-28)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leaveIncrease">Leave Increase Per Year (Days)</Label>
              <Input
                id="leaveIncrease"
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={settings.leave_increase_per_year}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    leave_increase_per_year: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Additional leave days per year of service
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 p-4">
            <h4 className="font-medium text-blue-900 mb-2">How Leave Accrual Works</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• During probation ({settings.probation_period_days} days): No leave requests allowed</li>
              <li>• After probation: Leave accrues daily (annual leave / 365 × days worked)</li>
              <li>• Monthly accrual: On day {settings.leave_calculation_day}, users get (annual leave / 12) days</li>
              <li>• Each year of service: +{settings.leave_increase_per_year} days to annual leave</li>
              <li>• Unused leave carries over to the next year</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Leave Settings"
            )}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLeave ? "Edit Leave Type" : "Add Leave Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="leaveName">Leave Type Name</Label>
              <Input
                id="leaveName"
                value={leaveForm.name}
                onChange={(e) => setLeaveForm({ ...leaveForm, name: e.target.value })}
                placeholder="e.g., Annual Leave"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leaveDays">Days Per Year</Label>
              <Input
                id="leaveDays"
                type="number"
                value={leaveForm.days_per_year}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    days_per_year: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPaid"
                checked={leaveForm.is_paid}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, is_paid: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="isPaid">Paid Leave</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLeave}>
              {editingLeave ? "Update" : "Add"} Leave Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
