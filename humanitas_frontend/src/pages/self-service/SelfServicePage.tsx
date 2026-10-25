import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CalendarDays,
  CreditCard,
  User,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText,
  DollarSign,
  Loader2,
  Check,
  X,
  Lock,
  Edit3,
} from 'lucide-react';
import {
  useSelfService,
  type SensitiveChangeRequest,
} from '@/hooks/useSelfService';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function SelfServicePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canManageRequests = hasPermission('manage_profile_requests');

  const {
    useDashboard,
    useAttendanceHeatmap,
    usePayslips,
    useProfile,
    useChangeRequests,
    useAnalytics,
    updateProfile,
    isUpdatingProfile,
    requestSensitiveChange,
    isRequestingSensitiveChange,
    reviewChangeRequest,
    isReviewingChangeRequest,
  } = useSelfService();

  const { data: dashboard, isLoading: isDashboardLoading } = useDashboard();
  const { data: heatmapData, isLoading: isHeatmapLoading } = useAttendanceHeatmap(90);
  const { data: payslipsData, isLoading: isPayslipsLoading } = usePayslips();
  const { data: profileData } = useProfile();
  const { data: analyticsData } = useAnalytics();
  const { data: pendingOrgRequests, isLoading: isRequestsLoading } = useChangeRequests('pending');

  const [activeTab, setActiveTab] = useState<'overview' | 'payslips' | 'profile' | 'requests'>('overview');

  // Profile edit state
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [emergencyRel, setEmergencyRel] = useState<string>('');
  const [isProfileFormInitialized, setIsProfileFormInitialized] = useState(false);

  // Sync profile fields once loaded
  if (profileData?.profile && !isProfileFormInitialized) {
    const p = profileData.profile;
    setPhone(p.phone || '');
    setAddress(p.address || '');
    setCity(p.city || '');
    setEmergencyName(p.emergency_contact_name || '');
    setEmergencyPhone(p.emergency_contact_phone || '');
    setEmergencyRel(p.emergency_contact_relationship || '');
    setIsProfileFormInitialized(true);
  }

  // Sensitive change modal
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [sensitiveField, setSensitiveField] = useState<'account_number' | 'bank_name' | 'tin' | 'national_id'>('account_number');
  const [proposedValue, setProposedValue] = useState('');
  const [changeReason, setChangeReason] = useState('');

  // Review modal
  const [selectedRequest, setSelectedRequest] = useState<SensitiveChangeRequest | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        phone,
        address,
        city,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        emergency_contact_relationship: emergencyRel,
      });
      toast.success('Personal profile details updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    }
  };

  const handleRequestSensitiveChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedValue.trim()) {
      toast.error('Please enter the proposed value');
      return;
    }
    try {
      await requestSensitiveChange({
        field_name: sensitiveField,
        proposed_value: proposedValue.trim(),
        reason: changeReason.trim(),
      });
      toast.success('Change request submitted to HR for review');
      setChangeModalOpen(false);
      setProposedValue('');
      setChangeReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    }
  };

  const handleReviewAction = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    try {
      await reviewChangeRequest({
        id: selectedRequest.id,
        status,
        reviewer_notes: reviewerNotes.trim(),
      });
      toast.success(`Request successfully ${status}`);
      setSelectedRequest(null);
      setReviewerNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to review request');
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <PageHeader
        title="Employee Self-Service (ESS)"
        description="Your unified personal workplace cockpit for leave, attendance, payslips, and verified profile data."
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-4 w-4" />
          My HR Overview
        </button>

        <button
          onClick={() => setActiveTab('payslips')}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'payslips'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Payslips & Tax Center
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Edit3 className="h-4 w-4" />
          Profile & Sensitive Data
        </button>

        {canManageRequests && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            HR Review Queue
            {pendingOrgRequests && pendingOrgRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {pendingOrgRequests.length}
              </Badge>
            )}
          </button>
        )}
      </div>

      {/* ── TAB 1: OVERVIEW ────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Welcome, {dashboard?.user?.first_name} {dashboard?.user?.last_name}!
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {dashboard?.user?.position || 'Team Member'} &bull; {dashboard?.user?.department || 'General'} &bull; {dashboard?.user?.email}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate('/leave/my-requests')} className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Request Leave
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('payslips')} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  View Payslips
                </Button>
              </div>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPITile
              title="Attendance Streak"
              value={isDashboardLoading ? '...' : `${dashboard?.attendance_summary?.streak || 0} Days`}
              icon={Clock}
              subtitle="Consecutive on-time days"
            />
            <KPITile
              title="Punctuality Score"
              value={analyticsData ? `${analyticsData.punctuality_score}%` : '...'}
              icon={TrendingUp}
              subtitle="6-month on-time attendance"
            />
            <KPITile
              title="Pending Requests"
              value={isDashboardLoading ? '...' : (dashboard?.pending_requests?.leave || 0) + (dashboard?.pending_requests?.profile_changes || 0)}
              icon={AlertTriangle}
              subtitle="Awaiting HR / Manager review"
            />
            <KPITile
              title="Annual Leave Balance"
              value={
                isDashboardLoading
                  ? '...'
                  : `${dashboard?.leave_balances?.find((b) => b.leave_type.toLowerCase().includes('annual'))?.remaining_days || 0} Days`
              }
              icon={CheckCircle2}
              subtitle="Remaining available days"
            />
          </div>

          {/* Two-Column Detail Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 90-Day Attendance Heatmap */}
            <div className="lg:col-span-2 rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-base">Recent Attendance History (Past 90 Days)</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Present
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Late
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" /> Absent
                  </span>
                </div>
              </div>

              {isHeatmapLoading ? (
                <div className="h-32 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !heatmapData || heatmapData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No attendance activity recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-muted/20 rounded-lg">
                    {heatmapData.map((item, i) => {
                      const color =
                        item.status === 'present'
                          ? 'bg-emerald-500 text-white'
                          : item.status === 'late'
                          ? 'bg-amber-500 text-white'
                          : item.status === 'absent'
                          ? 'bg-rose-500 text-white'
                          : 'bg-muted text-muted-foreground';
                      return (
                        <div
                          key={i}
                          title={`${item.date}: ${item.status}${item.actual_in ? ` (${item.actual_in})` : ''}`}
                          className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-medium cursor-pointer transition-transform hover:scale-110 ${color}`}
                        >
                          {new Date(item.date).getDate()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>90 Days Ago</span>
                    <span>Today</span>
                  </div>
                </div>
              )}
            </div>

            {/* Leave Balances Card */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold text-base mb-4">My Leave Balances</h3>
              {dashboard?.leave_balances && dashboard.leave_balances.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.leave_balances.map((b, i) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium text-sm capitalize">{b.leave_type} Leave</p>
                        <p className="text-xs text-muted-foreground">Used: {b.used_days} / Allocated: {b.allocated_days}</p>
                      </div>
                      <Badge variant="outline" className="text-sm font-semibold px-2.5 py-0.5">
                        {b.remaining_days} Left
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No leave balance records found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PAYSLIPS & TAX ─────────────────────────────────── */}
      {activeTab === 'payslips' && (
        <div className="space-y-6">
          {/* YTD Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border bg-card shadow-sm">
              <p className="text-xs text-muted-foreground uppercase font-semibold">YTD Gross Earnings</p>
              <p className="text-2xl font-bold text-foreground mt-2">
                ${payslipsData?.ytd_summary?.ytd_gross?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Calendar Year {payslipsData?.ytd_summary?.year}</p>
            </div>

            <div className="p-5 rounded-xl border bg-card shadow-sm">
              <p className="text-xs text-muted-foreground uppercase font-semibold">YTD Net Disbursed</p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                ${payslipsData?.ytd_summary?.ytd_net?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Direct deposit bank disbursements</p>
            </div>

            <div className="p-5 rounded-xl border bg-card shadow-sm">
              <p className="text-xs text-muted-foreground uppercase font-semibold">YTD Deductions & Tax</p>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                ${payslipsData?.ytd_summary?.ytd_deductions?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Withholding taxes & statutory funds</p>
            </div>
          </div>

          {/* Payslip History Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-base">Monthly Payslip Archive</h3>
              <Badge variant="outline">{payslipsData?.payslips?.length || 0} Records</Badge>
            </div>

            {isPayslipsLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </div>
            ) : !payslipsData?.payslips || payslipsData.payslips.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No payslips on file yet. Once payroll runs, your monthly statements will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Period</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Gross Pay</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Deductions</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Net Pay</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Status</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payslipsData.payslips.map((ps) => (
                      <tr key={ps.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4 font-semibold">
                          {new Date(ps.year, ps.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4">${parseFloat(ps.gross_pay as string || '0').toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-rose-600">-${parseFloat(ps.total_deductions as string || '0').toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">${parseFloat(ps.net_pay as string || '0').toFixed(2)}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="capitalize text-xs">
                            {ps.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-xs text-primary"
                            onClick={() => navigate('/payroll/my-payslip')}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Breakdown
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: PROFILE & SENSITIVE DATA ──────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editable Profile Information */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold text-base mb-1">Personal Contact Information</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Update your contact details anytime. Changes take effect immediately.
              </p>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Corporate Way"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City / State</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York, NY"
                    className="mt-1"
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-3">Emergency Contact</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="emName">Contact Name</Label>
                      <Input
                        id="emName"
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        placeholder="Jane Doe"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emPhone">Contact Phone</Label>
                      <Input
                        id="emPhone"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="+1 555-0200"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emRel">Relationship</Label>
                      <Input
                        id="emRel"
                        value={emergencyRel}
                        onChange={(e) => setEmergencyRel(e.target.value)}
                        placeholder="Spouse / Parent / Sibling"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isUpdatingProfile} className="w-full gap-2 mt-4">
                  {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Contact Information
                </Button>
              </form>
            </div>

            {/* Verified Sensitive Data & Approval Gate */}
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-500" />
                      Verified Banking & Tax Identification
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Direct deposit and tax IDs are locked for compliance. Modifying requires HR verification.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChangeModalOpen(true)}
                    className="gap-1.5 shrink-0"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Request Change
                  </Button>
                </div>

                <div className="space-y-3 mt-4">
                  <div className="p-3 rounded-lg bg-muted/30 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Bank Name</p>
                      <p className="text-sm font-semibold">{profileData?.profile?.bank_name || 'Not on file'}</p>
                    </div>
                    <Badge variant="outline">Verified</Badge>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Bank Account Number (IBAN/ACH)</p>
                      <p className="text-sm font-semibold tracking-wider font-mono">
                        {profileData?.profile?.account_number
                          ? `•••• •••• ${profileData.profile.account_number.slice(-4)}`
                          : 'Not on file'}
                      </p>
                    </div>
                    <Badge variant="outline">Encrypted</Badge>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Tax Identification Number (TIN / SSN)</p>
                      <p className="text-sm font-semibold tracking-wider font-mono">
                        {profileData?.profile?.tin ? `•••-••-${profileData.profile.tin.slice(-4)}` : 'Not on file'}
                      </p>
                    </div>
                    <Badge variant="outline">Confidential</Badge>
                  </div>
                </div>
              </div>

              {/* Pending Employee Requests */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h4 className="font-semibold text-sm mb-3">My Pending Sensitive Change Requests</h4>
                {profileData?.pending_change_requests && profileData.pending_change_requests.length > 0 ? (
                  <div className="space-y-2">
                    {profileData.pending_change_requests.map((r) => (
                      <div key={r.id} className="p-3 rounded-lg border bg-muted/20 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold capitalize">{r.field_name.replace('_', ' ')}</p>
                          <p className="text-muted-foreground mt-0.5">Proposed: {r.proposed_value}</p>
                          {r.reason && <p className="text-muted-foreground italic">Reason: "{r.reason}"</p>}
                        </div>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Pending HR Review
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-3 text-center">No pending change requests submitted.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: HR REVIEW QUEUE ───────────────────────────────── */}
      {activeTab === 'requests' && canManageRequests && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-base">Pending Profile Change Requests</h3>
              <p className="text-xs text-muted-foreground">
                Review and approve sensitive banking and tax updates submitted by employees.
              </p>
            </div>
            <Badge variant="outline">{pendingOrgRequests?.length || 0} Pending</Badge>
          </div>

          {isRequestsLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </div>
          ) : !pendingOrgRequests || pendingOrgRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              All profile change requests have been reviewed and resolved!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Employee</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Field</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Current Value</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Proposed Value</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Reason</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingOrgRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold">{req.first_name} {req.last_name}</p>
                        <p className="text-xs text-muted-foreground">{req.email}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono capitalize">{req.field_name.replace('_', ' ')}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">{req.current_value || 'None'}</td>
                      <td className="py-3.5 px-4 font-semibold text-primary">{req.proposed_value}</td>
                      <td className="py-3.5 px-4 text-muted-foreground max-w-xs truncate">{req.reason || 'None provided'}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => {
                            setSelectedRequest(req);
                          }}
                        >
                          Review & Decide
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: REQUEST SENSITIVE CHANGE ───────────────────────── */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="font-bold text-lg mb-2">Request Sensitive Profile Update</h3>
            <p className="text-xs text-muted-foreground mb-4">
              To update your banking details or tax ID, submit your proposed information. HR will verify and approve before the changes apply to your payroll.
            </p>

            <form onSubmit={handleRequestSensitiveChange} className="space-y-4">
              <div>
                <Label htmlFor="sensField">Field to Change</Label>
                <select
                  id="sensField"
                  value={sensitiveField}
                  onChange={(e: any) => setSensitiveField(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="account_number">Bank Account Number (IBAN / Direct Deposit)</option>
                  <option value="bank_name">Bank Name</option>
                  <option value="tin">Tax Identification Number (TIN / SSN)</option>
                  <option value="national_id">National ID / Passport Number</option>
                </select>
              </div>

              <div>
                <Label htmlFor="propVal">New Proposed Value</Label>
                <Input
                  id="propVal"
                  value={proposedValue}
                  onChange={(e) => setProposedValue(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="chgReason">Reason for Change</Label>
                <Input
                  id="chgReason"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Switched primary checking account"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setChangeModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isRequestingSensitiveChange} className="gap-2">
                  {isRequestingSensitiveChange ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit for Approval
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HR REVIEW & DECIDE ─────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="font-bold text-lg mb-1">Review Profile Change Request</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Employee: {selectedRequest.first_name} {selectedRequest.last_name} ({selectedRequest.email})
            </p>

            <div className="p-3 rounded-lg bg-muted/30 space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Field:</span>
                <span className="font-semibold uppercase">{selectedRequest.field_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Value:</span>
                <span>{selectedRequest.current_value || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proposed New Value:</span>
                <span className="font-bold text-primary">{selectedRequest.proposed_value}</span>
              </div>
              {selectedRequest.reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason:</span>
                  <span>{selectedRequest.reason}</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <Label htmlFor="revNotes" className="text-xs">Reviewer Notes (Optional)</Label>
              <Input
                id="revNotes"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="e.g. Verified with voided check copy"
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRequest(null)}
                disabled={isReviewingChangeRequest}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleReviewAction('rejected')}
                disabled={isReviewingChangeRequest}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleReviewAction('approved')}
                disabled={isReviewingChangeRequest}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="h-4 w-4" />
                Approve & Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
