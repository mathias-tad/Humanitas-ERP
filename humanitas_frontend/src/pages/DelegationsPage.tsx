import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  UserPlus,
  History,
  FileText,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Coins,
  Briefcase,
} from "lucide-react";
import {
  useMyDelegations,
  useCreateDelegation,
  useRevokeDelegation,
  useDelegationAudit,
  useActingPreview,
} from "@/hooks/useDelegations";
import { useBasicUsers } from "@/hooks/useUsers";
import { useAuth } from "@/context/AuthContext";
import { useModules } from "@/context/ModuleContext";
import { toast } from "sonner";

const DelegationsPage: React.FC = () => {
  const { user } = useAuth();
  const { isModuleSubscribed } = useModules();
  const hasHR = isModuleSubscribed("hrms") || isModuleSubscribed("payroll");

  const { data: delegationsData, isLoading: isLoadingDelegations } =
    useMyDelegations();
  const { data: auditLogs = [], isLoading: isLoadingAudit } =
    useDelegationAudit();
  const { data: users = [] } = useBasicUsers();

  const createMutation = useCreateDelegation();
  const revokeMutation = useRevokeDelegation();

  const [activeTab, setActiveTab] = useState<"grant" | "my_delegations" | "audit">("grant");

  // Form state
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const toInputDate = (d: Date) => d.toISOString().split("T")[0];

  const [form, setForm] = useState({
    delegatee_id: "",
    scope: "ALL",
    start_date: toInputDate(tomorrow) + "T08:00",
    end_date: toInputDate(nextWeek) + "T18:00",
    reason: "",
    is_acting_assignment: false,
    acting_position_title: "",
    acting_allowance_type: "percentage" as "percentage" | "fixed_amount",
    acting_allowance_percentage: 15,
    acting_allowance_amount: 0,
    acting_notes: "",
  });

  const availableColleagues = users.filter((u) => u.id !== user?.id);

  // Live calculation preview
  const { data: actingPreview } = useActingPreview(
    user?.id,
    form.acting_allowance_type === "percentage" ? form.acting_allowance_percentage : 0,
    form.acting_allowance_type === "fixed_amount" ? form.acting_allowance_amount : 0,
    hasHR && form.is_acting_assignment,
  );

  const handleCreate = async () => {
    if (!form.delegatee_id) {
      toast.error("Please select a colleague to delegate authority to");
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast.error("Please set both start and end timestamps");
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      toast.error("End date must be strictly after start date");
      return;
    }

    try {
      await createMutation.mutateAsync({
        delegatee_id: form.delegatee_id,
        scope: form.scope,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        reason: form.reason,
        is_acting_assignment: hasHR ? form.is_acting_assignment : false,
        acting_position_title:
          hasHR && form.is_acting_assignment ? form.acting_position_title : undefined,
        acting_allowance_type:
          hasHR && form.is_acting_assignment ? form.acting_allowance_type : undefined,
        acting_allowance_percentage:
          hasHR && form.is_acting_assignment && form.acting_allowance_type === "percentage"
            ? form.acting_allowance_percentage
            : 0,
        acting_allowance_amount:
          hasHR && form.is_acting_assignment && form.acting_allowance_type === "fixed_amount"
            ? form.acting_allowance_amount
            : 0,
        acting_notes: hasHR && form.is_acting_assignment ? form.acting_notes : undefined,
      });

      toast.success(
        form.is_acting_assignment
          ? "Acting assignment and authority delegation registered successfully"
          : "Position authority delegated successfully",
      );
      setActiveTab("my_delegations");
      setForm({
        delegatee_id: "",
        scope: "ALL",
        start_date: toInputDate(tomorrow) + "T08:00",
        end_date: toInputDate(nextWeek) + "T18:00",
        reason: "",
        is_acting_assignment: false,
        acting_position_title: "",
        acting_allowance_type: "percentage",
        acting_allowance_percentage: 15,
        acting_allowance_amount: 0,
        acting_notes: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to delegate authority");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this authority delegation immediately?")) {
      return;
    }
    try {
      await revokeMutation.mutateAsync(id);
      toast.success("Delegation revoked successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke delegation");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Active
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="outline" className="text-rose-600 border-rose-300 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Revoked
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Expired
          </Badge>
        );
    }
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case "ALL":
        return <Badge className="bg-primary text-primary-foreground">Full Position Authority</Badge>;
      case "APPROVALS":
        return <Badge className="bg-amber-600 text-white">Approvals Only</Badge>;
      case "ATTENDANCE":
        return <Badge className="bg-blue-600 text-white">Attendance &amp; Shifts</Badge>;
      case "PMS":
        return <Badge className="bg-purple-600 text-white">PMS &amp; Tasks</Badge>;
      default:
        return <Badge variant="outline">{scope}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      {/* Page Header */}
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Authority Delegations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage on-behalf delegations and acting assignments
          </p>
        </div>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Universal Authority Delegation &amp; Acting Engine
          </CardTitle>
          <CardDescription className="text-xs">
            Temporarily transfer your job duties, approval rights, and position authority to another
            team member. In HR-enabled organizations, link directly with Acting Assignments and
            prorated financial compensation allowances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="grant" className="flex items-center gap-2 text-xs sm:text-sm">
                <UserPlus className="h-4 w-4" />
                Delegate Authority
              </TabsTrigger>
              <TabsTrigger value="my_delegations" className="flex items-center gap-2 text-xs sm:text-sm">
                <History className="h-4 w-4" />
                My Delegations ({delegationsData?.granted?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Grant Delegation */}
            <TabsContent value="grant" className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg border border-border flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-foreground">Universal Delegation Policy</p>
                  <p className="text-muted-foreground">
                    The designated colleague receives your operational permissions during the active
                    window. Once the end timestamp is reached or when revoked, all delegated
                    authority and acting allowances terminate automatically.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delegatee_id" className="text-sm font-medium">
                    Delegate To (Colleague) *
                  </Label>
                  <Select
                    value={form.delegatee_id}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, delegatee_id: val }))}
                  >
                    <SelectTrigger id="delegatee_id">
                      <SelectValue placeholder="Select a team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColleagues.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name} ({u.department || u.position || u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope" className="text-sm font-medium">
                    Authority Scope *
                  </Label>
                  <Select
                    value={form.scope}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, scope: val }))}
                  >
                    <SelectTrigger id="scope">
                      <SelectValue placeholder="Select Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ALL — Full Authority &amp; Position</SelectItem>
                      <SelectItem value="APPROVALS">APPROVALS — Leave, Expense, Overtime</SelectItem>
                      <SelectItem value="ATTENDANCE">ATTENDANCE — Punch Corrections, Shifts</SelectItem>
                      <SelectItem value="PMS">PMS — Tasks, Sprints, Projects</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-sm font-medium">
                    Start Date &amp; Time *
                  </Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-sm font-medium">
                    End Date &amp; Time *
                  </Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* HR Subscription Acting Assignment & Allowance Section */}
              {hasHR && (
                <div className="border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px]">
                          HR Acting Assignment
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          Official Acting Assignment &amp; Allowance
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Designate the actor to receive financial compensation (percentage of covered
                        salary or fixed allowance) for the delegation duration.
                      </p>
                    </div>
                    <Switch
                      checked={form.is_acting_assignment}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, is_acting_assignment: checked }))
                      }
                    />
                  </div>

                  {form.is_acting_assignment && (
                    <div className="pt-3 space-y-3 border-t border-indigo-200/60 dark:border-indigo-900/40">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="acting_position_title" className="text-xs font-medium flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                            Acting Position Title
                          </Label>
                          <Input
                            id="acting_position_title"
                            placeholder="e.g. Acting Department Head / Operations Lead"
                            value={form.acting_position_title}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, acting_position_title: e.target.value }))
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="acting_allowance_type" className="text-xs font-medium flex items-center gap-1.5">
                            <Coins className="h-3.5 w-3.5 text-indigo-600" />
                            Allowance Mode
                          </Label>
                          <Select
                            value={form.acting_allowance_type}
                            onValueChange={(val: any) =>
                              setForm((prev) => ({ ...prev, acting_allowance_type: val }))
                            }
                          >
                            <SelectTrigger id="acting_allowance_type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage of Delegator Basic Salary (%)
                              </SelectItem>
                              <SelectItem value="fixed_amount">Fixed Monthly Allowance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {form.acting_allowance_type === "percentage" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="acting_allowance_percentage" className="text-xs font-medium">
                              Allowance Rate (%)
                            </Label>
                            <Input
                              id="acting_allowance_percentage"
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={form.acting_allowance_percentage}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  acting_allowance_percentage: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Standard allowance is typically 10% to 20% of delegator basic salary.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Label htmlFor="acting_allowance_amount" className="text-xs font-medium">
                              Fixed Monthly Amount
                            </Label>
                            <Input
                              id="acting_allowance_amount"
                              type="number"
                              min="0"
                              step="100"
                              value={form.acting_allowance_amount}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  acting_allowance_amount: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Fixed allowance credited to the actor per active month.
                            </p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label htmlFor="acting_notes" className="text-xs font-medium">
                            Acting Memo / Reference
                          </Label>
                          <Input
                            id="acting_notes"
                            placeholder="e.g. Board Resolution / HR Memo #2026-ACT-12"
                            value={form.acting_notes}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, acting_notes: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      {actingPreview && (
                        <div className="bg-background/90 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900 text-xs space-y-1">
                          <div className="flex justify-between items-center text-foreground font-medium">
                            <span>Covered Role: {actingPreview.delegator_position}</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                              Est. Monthly Allowance: {actingPreview.estimated_monthly_allowance?.toLocaleString()} ETB
                            </span>
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            Proration &amp; Automatic Payroll Credit: The allowance will be computed
                            strictly across the active days between{" "}
                            {new Date(form.start_date).toLocaleDateString()} and{" "}
                            {new Date(form.end_date).toLocaleDateString()} and itemized on the
                            delegatee's payslip.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium">
                  Reason for Authority Delegation
                </Label>
                <Textarea
                  id="reason"
                  placeholder="e.g. Annual Vacation, Family Emergency, Official Business Trip..."
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {form.is_acting_assignment ? "Confirm & Appoint Acting Role" : "Confirm & Delegate Position"}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: My Delegations */}
            <TabsContent value="my_delegations" className="space-y-4 py-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Delegations I Have Granted</h3>
                {isLoadingDelegations ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !delegationsData?.granted || delegationsData.granted.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg bg-muted/20">
                    You haven't delegated your authority to anyone yet.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Delegatee</TableHead>
                          <TableHead>Scope</TableHead>
                          <TableHead>Active Window</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {delegationsData.granted.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium text-xs">
                              <p>
                                {[d.delegatee_first_name, d.delegatee_last_name].filter(Boolean).join(" ") ||
                                  d.delegatee_name ||
                                  d.delegatee_email ||
                                  "Colleague"}
                              </p>
                              {d.is_acting_assignment && (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] px-1.5 py-0">
                                    Acting
                                  </Badge>
                                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                                    {d.acting_position_title || "Covering Role"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    ({d.acting_allowance_type === "fixed_amount"
                                      ? `${d.acting_allowance_amount} ETB`
                                      : `${d.acting_allowance_percentage}% allowance`})
                                  </span>
                                </div>
                              )}
                              {d.reason && <p className="text-[11px] text-muted-foreground italic mt-0.5">{d.reason}</p>}
                            </TableCell>
                            <TableCell>{getScopeBadge(d.scope)}</TableCell>
                            <TableCell className="text-xs">
                              {formatDate(d.start_date)} — {formatDate(d.end_date)}
                            </TableCell>
                            <TableCell>{getStatusBadge(d.status)}</TableCell>
                            <TableCell className="text-right">
                              {d.status === "active" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => handleRevoke(d.id)}
                                  disabled={revokeMutation.isPending}
                                >
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold text-foreground">Delegations Granted to Me</h3>
                {!delegationsData?.received || delegationsData.received.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg bg-muted/20">
                    No active or past authority has been delegated to you.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Delegator</TableHead>
                          <TableHead>Scope</TableHead>
                          <TableHead>Active Window</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {delegationsData.received.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium text-xs">
                              <p>
                                {[d.delegator_first_name, d.delegator_last_name].filter(Boolean).join(" ") ||
                                  d.delegator_name ||
                                  d.delegator_email ||
                                  "Colleague"}
                              </p>
                              {d.is_acting_assignment && (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] px-1.5 py-0">
                                    Acting Assignment
                                  </Badge>
                                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                                    {d.acting_position_title || "Covering Role"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    ({d.acting_allowance_type === "fixed_amount"
                                      ? `${d.acting_allowance_amount} ETB`
                                      : `${d.acting_allowance_percentage}% allowance`})
                                  </span>
                                </div>
                              )}
                              {d.reason && <p className="text-[11px] text-muted-foreground italic mt-0.5">{d.reason}</p>}
                            </TableCell>
                            <TableCell>{getScopeBadge(d.scope)}</TableCell>
                            <TableCell className="text-xs">
                              {formatDate(d.start_date)} — {formatDate(d.end_date)}
                            </TableCell>
                            <TableCell>{getStatusBadge(d.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Audit Log */}
            <TabsContent value="audit" className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">On-Behalf-Of Actions Audit Trail</h3>
                  <p className="text-xs text-muted-foreground">
                    Complete historic record of who acted on whose behalf with full attribution and
                    position context.
                  </p>
                </div>
              </div>

              {isLoadingAudit ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center border rounded-lg bg-muted/20">
                  No delegated actions have been recorded yet.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>On Behalf Of</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {[log.performed_by_first_name, log.performed_by_last_name].filter(Boolean).join(" ") ||
                              log.performed_by_name ||
                              log.performed_by}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-primary">
                            {[log.on_behalf_of_first_name, log.on_behalf_of_last_name].filter(Boolean).join(" ") ||
                              log.on_behalf_of_name ||
                              log.on_behalf_of}
                            {log.acting_position_title && (
                              <span className="text-[10px] block font-normal text-indigo-600 dark:text-indigo-400">
                                (Acting: {log.acting_position_title})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.resource || (log.details ? JSON.stringify(log.details) : "-")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DelegationsPage;
