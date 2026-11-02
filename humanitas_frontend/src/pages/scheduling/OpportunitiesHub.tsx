import React, { useState } from 'react';
import {
  useWfmSettings,
  useUpdateWfmSettings,
  useWfmOpportunities,
  useMyWfmClaims,
  useWfmClaimsQueue,
  useWfmStats,
  useBroadcastOpportunity,
  useClaimOpportunity,
  useCancelClaim,
  useReviewClaim,
  type WfmOpportunity,
} from '@/hooks/useWfm';
import { useShifts } from '@/hooks/useScheduling';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Clock,
  Calendar,
  CheckCircle2,
  PlusCircle,
  UserCheck,
  ShieldAlert,
  Flame,
  TrendingUp,
  Award,
  Zap,
  Info,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export default function OpportunitiesHub() {
  const { hasPermission } = usePermissions();

  const [activeTab, setActiveTab] = useState('opportunities');
  const [typeFilter, setTypeFilter] = useState<'all' | 'VET' | 'VTO'>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Queries
  const { data: stats } = useWfmStats();
  const { data: settings } = useWfmSettings();
  const { data: opportunities = [], isLoading: loadingOpps } = useWfmOpportunities({
    type: typeFilter,
    status: statusFilter,
  });
  const { data: myClaims = [], isLoading: loadingClaims } = useMyWfmClaims();
  const { data: pendingClaims = [], isLoading: loadingQueue } = useWfmClaimsQueue({ status: 'pending' });
  const { data: shifts = [] } = useShifts();

  // Mutations
  const broadcastMutation = useBroadcastOpportunity();
  const claimMutation = useClaimOpportunity();
  const cancelClaimMutation = useCancelClaim();
  const reviewMutation = useReviewClaim();
  const updateSettingsMutation = useUpdateWfmSettings();

  // Dialog States
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<WfmOpportunity | null>(null);
  const [usePto, setUsePto] = useState(false);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    type: 'VET' as 'VET' | 'VTO',
    title: '',
    date: new Date().toISOString().split('T')[0],
    shift_id: '',
    start_time: '09:00',
    end_time: '17:00',
    hours: 8,
    slots_available: 2,
    ot_rate_multiplier: 0,
    ot_category: 'normal' as 'normal' | 'night' | 'dayoff' | 'holiday',
    vto_compensation_type: 'unpaid' as 'unpaid' | 'paid',
    urgency: 'normal' as 'normal' | 'high' | 'critical',
    reason: '',
    notes: '',
    expiry_option: 'shift_start' as 'shift_start' | '1h_before' | '2h_before' | '24h_before' | 'custom',
    expires_at: '',
  });

  // Payroll Overtime Multipliers sourced dynamically from tenant settings (without fallback)
  const payrollOtRates = React.useMemo(() => ({
    normal: settings?.payroll_ot_rates?.normal ?? null,
    night: settings?.payroll_ot_rates?.night ?? null,
    dayoff: settings?.payroll_ot_rates?.dayoff ?? null,
    holiday: settings?.payroll_ot_rates?.holiday ?? null,
  }), [settings?.payroll_ot_rates]);

  const otCategories = [
    {
      key: 'normal' as const,
      name: 'Standard Overtime',
      desc: 'Regular daily/weekly extra hours',
      rate: payrollOtRates.normal,
    },
    {
      key: 'night' as const,
      name: 'Night Shift Overtime',
      desc: 'Unsocial overnight hours',
      rate: payrollOtRates.night,
    },
    {
      key: 'dayoff' as const,
      name: 'Rest Day / Weekend Overtime',
      desc: 'Scheduled weekly rest day work',
      rate: payrollOtRates.dayoff,
    },
    {
      key: 'holiday' as const,
      name: 'Public Holiday Overtime',
      desc: 'Statutory public holidays',
      rate: payrollOtRates.holiday,
    },
  ];

  const currentVetRate = payrollOtRates[broadcastForm.ot_category];
  const isVetRateConfigured = currentVetRate !== null && currentVetRate > 0;

  const handleTypeChange = (newType: 'VET' | 'VTO') => {
    const rate = newType === 'VET' ? (payrollOtRates[broadcastForm.ot_category] ?? 0) : 1.0;
    setBroadcastForm((prev) => ({
      ...prev,
      type: newType,
      hours: newType === 'VET' ? (prev.hours === 4 ? 8 : prev.hours || 8) : (prev.hours === 8 ? 4 : prev.hours || 4),
      ot_rate_multiplier: rate,
      vto_compensation_type: newType === 'VTO' ? (settings?.default_vto_compensation || 'unpaid') : 'paid',
    }));
  };

  const handleOtCategoryChange = (category: 'normal' | 'night' | 'dayoff' | 'holiday') => {
    const rate = payrollOtRates[category] ?? 0;
    setBroadcastForm((prev) => ({
      ...prev,
      ot_category: category,
      ot_rate_multiplier: rate,
    }));
  };

  const handleShiftSelect = (shiftId: string) => {
    if (shiftId === 'none' || !shiftId) {
      setBroadcastForm((prev) => ({ ...prev, shift_id: '' }));
      return;
    }
    const s = shifts.find((sh) => sh.id === shiftId);
    if (s) {
      setBroadcastForm((prev) => ({
        ...prev,
        shift_id: shiftId,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
      }));
    } else {
      setBroadcastForm((prev) => ({ ...prev, shift_id: shiftId }));
    }
  };

  const handleOpenBroadcastModal = () => {
    const rate = broadcastForm.type === 'VET' ? (payrollOtRates[broadcastForm.ot_category] ?? 0) : 1.0;
    setBroadcastForm((prev) => ({
      ...prev,
      ot_rate_multiplier: rate,
    }));
    setBroadcastOpen(true);
  };

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedClaimForReview, setSelectedClaimForReview] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [claimHours, setClaimHours] = useState<number>(0);

  // Handle Claim
  const handleOpenClaimDialog = (opp: WfmOpportunity) => {
    setSelectedOpp(opp);
    setClaimHours(Number(opp.hours));
    setUsePto(false);
    setClaimDialogOpen(true);
  };

  const submitClaim = async () => {
    if (!selectedOpp) return;
    try {
      const res = await claimMutation.mutateAsync({
        id: selectedOpp.id,
        use_pto_balance: usePto,
        hours: claimHours || Number(selectedOpp.hours),
      });
      toast.success(res.message || 'Claim submitted successfully!');
      setClaimDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim opportunity');
    }
  };

  // Handle Cancel Claim
  const handleCancelClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to cancel this claim?')) return;
    try {
      await cancelClaimMutation.mutateAsync(claimId);
      toast.success('Claim cancelled successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel claim');
    }
  };

  // Handle Broadcast
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (broadcastForm.type === 'VET' && !isVetRateConfigured) {
      toast.error(
        `Overtime rate for '${otCategories.find((c) => c.key === broadcastForm.ot_category)?.name || broadcastForm.ot_category}' is not configured in Settings → Payroll Settings. Please configure overtime rates before broadcasting.`,
      );
      return;
    }
    try {
      let computedExpiresAt: string | undefined = undefined;
      if (broadcastForm.expiry_option === 'custom' && broadcastForm.expires_at) {
        computedExpiresAt = new Date(broadcastForm.expires_at).toISOString();
      } else {
        const shiftTime = broadcastForm.start_time || '09:00';
        const shiftDate = new Date(`${broadcastForm.date}T${shiftTime}`);
        if (broadcastForm.expiry_option === '1h_before') {
          shiftDate.setHours(shiftDate.getHours() - 1);
        } else if (broadcastForm.expiry_option === '2h_before') {
          shiftDate.setHours(shiftDate.getHours() - 2);
        } else if (broadcastForm.expiry_option === '24h_before') {
          shiftDate.setHours(shiftDate.getHours() - 24);
        }
        computedExpiresAt = shiftDate.toISOString();
      }

      await broadcastMutation.mutateAsync({
        ...broadcastForm,
        hours: Number(broadcastForm.hours),
        slots_available: Number(broadcastForm.slots_available),
        ot_rate_multiplier: broadcastForm.type === 'VET' ? Number(currentVetRate) : 1.0,
        expires_at: computedExpiresAt,
      });
      toast.success('Opportunity broadcasted! Notifications sent to department.');
      setBroadcastOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to broadcast opportunity');
    }
  };

  // Handle Review
  const handleOpenReview = (claim: any, action: 'approved' | 'rejected') => {
    setSelectedClaimForReview(claim);
    setReviewAction(action);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const submitReview = async () => {
    if (!selectedClaimForReview) return;
    try {
      await reviewMutation.mutateAsync({
        claimId: selectedClaimForReview.id,
        status: reviewAction,
        review_notes: reviewNotes,
      });
      toast.success(`Claim ${reviewAction} successfully!`);
      setReviewDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to review claim');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">VET & VTO Opportunities Hub</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              Workforce Flex
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Claim voluntary extra overtime shifts (VET) or voluntary time off (VTO) with automated fatigue compliance and scheduling integration.
          </p>
        </div>

        {hasPermission('broadcast_wfm_opportunities') && (
          <Button onClick={handleOpenBroadcastModal} className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            Broadcast Opportunity
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center justify-between">
              Open VET Shifts
              <Clock className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.open_vet_slots ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Available overtime slots</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              Open VTO Slots
              <CheckCircle2 className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.open_vto_slots ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Excused time-off slots</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center justify-between">
              Total VET Fulfilled
              <TrendingUp className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_vet_claimed ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Shifts claimed & worked</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
              Pending Reviews
              <UserCheck className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_reviews ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Manager approval queue</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="opportunities">Available Opportunities</TabsTrigger>
          <TabsTrigger value="my-claims">My Claims ({myClaims.length})</TabsTrigger>
          {hasPermission('broadcast_wfm_opportunities') && (
            <TabsTrigger value="broadcasts">Broadcast Center</TabsTrigger>
          )}
          {hasPermission('manage_wfm_claims') && (
            <TabsTrigger value="claims">Review Queue ({pendingClaims.length})</TabsTrigger>
          )}
          {hasPermission('manage_wfm_settings') && (
            <TabsTrigger value="settings">Policy & Rules</TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Available Opportunities */}
        <TabsContent value="opportunities" className="mt-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/30 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Button
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('all')}
              >
                All
              </Button>
              <Button
                variant={typeFilter === 'VET' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('VET')}
                className="gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                VET (Extra Shifts)
              </Button>
              <Button
                variant={typeFilter === 'VTO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('VTO')}
                className="gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                VTO (Time Off)
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open Only</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingOpps ? (
            <div className="text-center py-12 text-muted-foreground">Loading opportunities...</div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-16 border rounded-lg bg-card">
              <Award className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-semibold">No active opportunities</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                There are currently no open VET extra shifts or VTO voluntary time-off slots broadcast for your department.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities.map((opp) => {
                const isVet = opp.type === 'VET';
                const isClaimed = opp.has_claimed;
                const isFilled = opp.slots_remaining <= 0;
                const isExpired = opp.status === 'expired' || (opp.expires_at ? new Date(opp.expires_at) < new Date() : false);

                return (
                  <Card key={opp.id} className="relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div
                      className={`h-1.5 w-full ${isVet ? 'bg-blue-600' : 'bg-emerald-600'}`}
                    />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className={isVet ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}
                          >
                            {isVet ? 'VET • Extra Overtime' : 'VTO • Voluntary Off'}
                          </Badge>
                          {!isVet && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                opp.vto_compensation_type === 'paid'
                                  ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                                  : 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                              }`}
                            >
                              {opp.vto_compensation_type === 'paid' ? 'Company-Paid' : 'Unpaid VTO'}
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-600 bg-rose-500/10">
                              Expired
                            </Badge>
                          )}
                        </div>
                        {opp.urgency === 'critical' && (
                          <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                            <Flame className="w-3 h-3" /> Critical
                          </Badge>
                        )}
                        {opp.urgency === 'high' && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">
                            High Priority
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg mt-2">{opp.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-xs mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {opp.date}
                        {opp.start_time && opp.end_time && ` • ${opp.start_time.slice(0, 5)} - ${opp.end_time.slice(0, 5)}`}
                      </CardDescription>
                      {opp.expires_at && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground/70" />
                          {isExpired ? (
                            <span className="text-destructive font-medium">Claims Closed (Expired)</span>
                          ) : (
                            <span>
                              Closes: {new Date(opp.expires_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4 pb-4">
                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-md">
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <p className="font-semibold">{opp.hours} Hours</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate:</span>
                          <p className="font-semibold text-primary">
                            {isVet ? `${opp.ot_rate_multiplier}x (${opp.ot_category})` : 'Excused'}
                          </p>
                        </div>
                      </div>

                      {opp.reason && (
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                          "{opp.reason}"
                        </p>
                      )}

                      {/* Slots Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Availability</span>
                          <span className="font-medium">
                            {opp.slots_claimed} / {opp.slots_available} slots claimed
                          </span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isVet ? 'bg-blue-600' : 'bg-emerald-600'}`}
                            style={{
                              width: `${Math.min(100, (opp.slots_claimed / opp.slots_available) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Action */}
                      <div className="pt-2">
                        {isExpired ? (
                          <Button variant="outline" disabled className="w-full text-xs text-muted-foreground">
                            Expired
                          </Button>
                        ) : isClaimed ? (
                          <Button variant="outline" disabled className="w-full text-xs">
                            Claimed ({opp.my_claim_status})
                          </Button>
                        ) : isFilled ? (
                          <Button variant="secondary" disabled className="w-full text-xs">
                            Filled
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleOpenClaimDialog(opp)}
                            className={`w-full text-xs ${isVet ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                          >
                            {isVet ? 'Claim Shift' : 'Claim Time Off'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: My Claims History */}
        <TabsContent value="my-claims" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>My VET & VTO Claims History</CardTitle>
              <CardDescription>
                Track the status of your claimed shifts and time-off requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClaims ? (
                <div className="text-center py-8 text-muted-foreground">Loading your claims...</div>
              ) : myClaims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  You have not submitted any shift or time-off claims yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-3 px-4">Opportunity</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Hours</th>
                        <th className="py-3 px-4">Rate Multiplier</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Claimed At</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myClaims.map((claim) => (
                        <tr key={claim.id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{claim.opportunity_title}</td>
                          <td className="py-3 px-4">
                            <Badge variant={claim.claim_type === 'VET' ? 'default' : 'secondary'}>
                              {claim.claim_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{claim.opportunity_date}</td>
                          <td className="py-3 px-4">{claim.hours}h</td>
                          <td className="py-3 px-4">{claim.ot_rate_multiplier ? `${claim.ot_rate_multiplier}x` : '—'}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                claim.status === 'approved'
                                  ? 'default'
                                  : claim.status === 'rejected'
                                  ? 'destructive'
                                  : 'outline'
                              }
                            >
                              {claim.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {new Date(claim.claimed_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {claim.status !== 'cancelled' && claim.status !== 'rejected' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelClaim(claim.id)}
                                className="text-red-500 hover:text-red-700 h-8 text-xs"
                              >
                                Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Broadcast Center */}
        {hasPermission('broadcast_wfm_opportunities') && (
          <TabsContent value="broadcasts" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Active Staffing Broadcasts</CardTitle>
                    <CardDescription>
                      Monitor current VET and VTO broadcasts and fill rates across departments.
                    </CardDescription>
                  </div>
                  <Button onClick={handleOpenBroadcastModal} size="sm">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    New Broadcast
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Hours</th>
                        <th className="py-3 px-4">Multiplier</th>
                        <th className="py-3 px-4">Slots</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((opp) => (
                        <tr key={opp.id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{opp.title}</td>
                          <td className="py-3 px-4">
                            <Badge variant={opp.type === 'VET' ? 'default' : 'secondary'}>{opp.type}</Badge>
                          </td>
                          <td className="py-3 px-4">{opp.date}</td>
                          <td className="py-3 px-4">{opp.hours}h</td>
                          <td className="py-3 px-4">{opp.ot_rate_multiplier}x</td>
                          <td className="py-3 px-4">
                            {opp.slots_claimed} / {opp.slots_available}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={opp.status === 'open' ? 'default' : 'secondary'}>
                              {opp.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 4: Review Queue */}
        {hasPermission('manage_wfm_claims') && (
          <TabsContent value="claims" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Claims Review & Approval Queue</CardTitle>
                <CardDescription>
                  Review employee claims. Priority is automatically ordered by your tenant's strategy ({settings?.vet_claim_strategy?.toUpperCase() || 'FCFS'}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingQueue ? (
                  <div className="text-center py-8 text-muted-foreground">Loading queue...</div>
                ) : pendingClaims.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No pending claims awaiting review. All caught up!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Tenure / Hire Date</th>
                          <th className="py-3 px-4">Month OT Hours</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Shift & Date</th>
                          <th className="py-3 px-4">Hours</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingClaims.map((claim) => (
                          <tr key={claim.id} className="border-b hover:bg-muted/30">
                            <td className="py-3 px-4">
                              <div className="font-medium">{claim.full_name}</div>
                              <div className="text-xs text-muted-foreground">{claim.department || 'General'}</div>
                            </td>
                            <td className="py-3 px-4 text-xs">{claim.hire_date || 'N/A'}</td>
                            <td className="py-3 px-4 text-xs font-semibold">{claim.month_ot_hours || 0}h</td>
                            <td className="py-3 px-4">
                              <Badge variant={claim.claim_type === 'VET' ? 'default' : 'secondary'}>
                                {claim.claim_type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{claim.opportunity_title}</div>
                              <div className="text-xs text-muted-foreground">{claim.opportunity_date}</div>
                            </td>
                            <td className="py-3 px-4">{claim.hours}h</td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-50 h-8"
                                onClick={() => handleOpenReview(claim, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-600/30 hover:bg-red-50 h-8"
                                onClick={() => handleOpenReview(claim, 'rejected')}
                              >
                                Reject
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 5: Settings & Policy */}
        {hasPermission('manage_wfm_settings') && settings && (
          <TabsContent value="settings" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workforce Flex & Fatigue Policies</CardTitle>
                <CardDescription>
                  Configure tenant-wide guardrails, auto-approval thresholds, and claim ranking strategies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* General Switches */}
                  <div className="space-y-4 border p-4 rounded-lg">
                    <h4 className="font-semibold text-sm">Feature Activation</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable VET (Voluntary Extra Time)</Label>
                        <p className="text-xs text-muted-foreground">Allow broadcasting and claiming overtime shifts</p>
                      </div>
                      <Switch
                        checked={settings.vet_enabled}
                        onCheckedChange={(val) => updateSettingsMutation.mutate({ vet_enabled: val })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable VTO (Voluntary Time Off)</Label>
                        <p className="text-xs text-muted-foreground">Allow employees to claim voluntary excused absence</p>
                      </div>
                      <Switch
                        checked={settings.vto_enabled}
                        onCheckedChange={(val) => updateSettingsMutation.mutate({ vto_enabled: val })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Allow PTO Funding for VTO</Label>
                        <p className="text-xs text-muted-foreground">Allow employee to deduct VTO hours from paid annual leave</p>
                      </div>
                      <Switch
                        checked={settings.vto_allow_pto_funding}
                        onCheckedChange={(val) => updateSettingsMutation.mutate({ vto_allow_pto_funding: val })}
                      />
                    </div>
                  </div>

                  {/* Auto-Approvals & Strategies */}
                  <div className="space-y-4 border p-4 rounded-lg">
                    <h4 className="font-semibold text-sm">Approval & Claim Strategies</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>VET Auto-Approval</Label>
                        <p className="text-xs text-muted-foreground">Instantly approve VET claims that pass fatigue limits</p>
                      </div>
                      <Switch
                        checked={settings.vet_auto_approval}
                        onCheckedChange={(val) => updateSettingsMutation.mutate({ vet_auto_approval: val })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>VTO Auto-Approval</Label>
                        <p className="text-xs text-muted-foreground">Instantly approve VTO claims when scheduled</p>
                      </div>
                      <Switch
                        checked={settings.vto_auto_approval}
                        onCheckedChange={(val) => updateSettingsMutation.mutate({ vto_auto_approval: val })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>VET Claim Prioritization Strategy</Label>
                      <Select
                        value={settings.vet_claim_strategy || 'fcfs'}
                        onValueChange={(val: any) => updateSettingsMutation.mutate({ vet_claim_strategy: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fcfs">First-Come First-Served (FCFS)</SelectItem>
                          <SelectItem value="seniority">Seniority (Longest Tenure First)</SelectItem>
                          <SelectItem value="fairness">Fairness (Least OT Worked This Month First)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Fatigue Limits */}
                  <div className="space-y-4 border p-4 rounded-lg">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Labor Law & Fatigue Compliance
                    </h4>
                    <div className="space-y-1">
                      <Label>Maximum Weekly Overtime Hours</Label>
                      <Input
                        type="number"
                        defaultValue={settings.max_weekly_ot_hours}
                        onBlur={(e) => updateSettingsMutation.mutate({ max_weekly_ot_hours: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Claims exceeding this weekly cap are automatically blocked</p>
                    </div>
                    <div className="space-y-1">
                      <Label>Minimum Rest Hours Between Consecutive Shifts</Label>
                      <Input
                        type="number"
                        defaultValue={settings.min_rest_hours_between_shifts}
                        onBlur={(e) => updateSettingsMutation.mutate({ min_rest_hours_between_shifts: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Protects required recovery window between work sessions</p>
                    </div>
                  </div>

                  {/* Cancellation Policies */}
                  <div className="space-y-4 border p-4 rounded-lg">
                    <h4 className="font-semibold text-sm">Cancellation Cutoff Windows</h4>
                    <div className="space-y-1">
                      <Label>VET Cancellation Cutoff (Hours Before Shift)</Label>
                      <Input
                        type="number"
                        defaultValue={settings.vet_cancellation_cutoff_hours}
                        onBlur={(e) => updateSettingsMutation.mutate({ vet_cancellation_cutoff_hours: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>VTO Cancellation Cutoff (Hours Before Shift)</Label>
                      <Input
                        type="number"
                        defaultValue={settings.vto_cancellation_cutoff_hours}
                        onBlur={(e) => updateSettingsMutation.mutate({ vto_cancellation_cutoff_hours: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Claim Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim {selectedOpp?.type} Slot</DialogTitle>
            <DialogDescription>
              {selectedOpp?.type === 'VET'
                ? 'Claim this extra overtime shift. Your schedule and payroll entries will be updated.'
                : 'Claim voluntary time off. This absence will be marked as excused.'}
            </DialogDescription>
          </DialogHeader>

          {selectedOpp && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-md space-y-1 text-sm">
                <div className="font-semibold">{selectedOpp.title}</div>
                <div className="text-xs text-muted-foreground">
                  Date: {selectedOpp.date} • {selectedOpp.hours} Hours Available
                </div>
                {selectedOpp.type === 'VET' && (
                  <div className="text-xs font-medium text-primary">
                    Overtime Multiplier: {selectedOpp.ot_rate_multiplier}x ({selectedOpp.ot_category})
                  </div>
                )}
                {selectedOpp.type === 'VTO' && (
                  <div className="text-xs font-medium">
                    Policy: {selectedOpp.vto_compensation_type === 'paid' ? 'Company-Paid VTO (100% pay, zero salary deduction)' : 'Unpaid VTO (Salary deducted unless PTO funded)'}
                  </div>
                )}
              </div>

              {/* Hours to Claim input */}
              <div className="space-y-1.5">
                <Label className="text-xs">Hours to Claim *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={Number(selectedOpp.hours)}
                  value={claimHours}
                  onChange={(e) => setClaimHours(Math.min(Number(selectedOpp.hours), Math.max(0.5, Number(e.target.value))))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Specify how many hours you want to claim (up to {selectedOpp.hours}h maximum).
                </p>
              </div>

              {selectedOpp.type === 'VTO' && selectedOpp.vto_compensation_type === 'paid' && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Company-Sponsored Paid Time Off</span>
                    <p className="text-emerald-800/90 dark:text-emerald-300/90">
                      Your full basic salary is preserved with zero deductions on payroll run day. No PTO balance is required.
                    </p>
                  </div>
                </div>
              )}

              {selectedOpp.type === 'VTO' && selectedOpp.vto_compensation_type !== 'paid' && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Unpaid Voluntary Time Off</span>
                    <p className="text-amber-800/90 dark:text-amber-300/90">
                      Unworked hours will be deducted from your salary on payroll run day unless you elect to fund it with your available PTO balance below.
                    </p>
                  </div>
                </div>
              )}

              {selectedOpp.type === 'VTO' && selectedOpp.vto_compensation_type !== 'paid' && settings?.vto_allow_pto_funding && (
                <div className="flex items-center justify-between border p-3 rounded-md">
                  <div>
                    <Label className="text-sm">Fund with Paid Leave Balance (PTO)</Label>
                    <p className="text-xs text-muted-foreground">Cover these {claimHours}h using your accrued leave balance to prevent salary deductions</p>
                  </div>
                  <Switch checked={usePto} onCheckedChange={setUsePto} />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitClaim} disabled={claimMutation.isPending}>
              {claimMutation.isPending ? 'Claiming...' : 'Confirm Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Opportunity Dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Broadcast Workforce Opportunity</DialogTitle>
            <DialogDescription>
              Open extra overtime shifts (VET) or voluntary time-off (VTO) slots for employees with automated department notifications.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBroadcastSubmit} className="space-y-4 py-2">
            {/* Opportunity Type Interactive Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opportunity Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('VET')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    broadcastForm.type === 'VET'
                      ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 ring-2 ring-amber-500/30'
                      : 'border-border/60 hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${broadcastForm.type === 'VET' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm">VET</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${broadcastForm.type === 'VET' ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10' : ''}`}>
                      Paid Overtime
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Voluntary Extra Time Shift</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('VTO')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    broadcastForm.type === 'VTO'
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 ring-2 ring-emerald-500/30'
                      : 'border-border/60 hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${broadcastForm.type === 'VTO' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm">VTO</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${broadcastForm.type === 'VTO' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10' : ''}`}>
                      Excused Absence
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Voluntary Time Off Flex</p>
                </button>
              </div>
            </div>

            {/* Contextual Banner */}
            {broadcastForm.type === 'VET' ? (
              <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Paid Overtime Shift Broadcast</div>
                  <p className="text-amber-800/90 dark:text-amber-300/90">
                    Extra hours worked will be compensated at the tenant's configured payroll overtime rate multiplier. Eligible department staff will receive instant notifications.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 text-xs">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Voluntary Time Off Flex Broadcast</div>
                  <p className="text-emerald-800/90 dark:text-emerald-300/90">
                    Allows staff to take voluntary excused leave during reduced workflow without attendance penalty. Staff may choose to use accrued PTO if permitted by company policy.
                  </p>
                </div>
              </div>
            )}

            {/* Title with dynamic label & placeholder */}
            <div className="space-y-1">
              <Label>
                {broadcastForm.type === 'VET' ? 'Overtime Shift Title *' : 'Voluntary Time Off Title *'}
              </Label>
              <Input
                placeholder={
                  broadcastForm.type === 'VET'
                    ? 'e.g. Surge Support Overtime - Critical Backlog Dispatch / Weekend Coverage'
                    : 'e.g. Low Volume Early Release - Friday Afternoon Production Flex'
                }
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                required
              />
            </div>

            {/* Date and Shift */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Opportunity Date *</Label>
                <Input
                  type="date"
                  value={broadcastForm.date}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Shift (Optional)</Label>
                <Select
                  value={broadcastForm.shift_id || 'none'}
                  onValueChange={handleShiftSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Shift / Custom Times</SelectItem>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hours and Headcount (Slots) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  {broadcastForm.type === 'VET' ? 'Overtime Shift Duration (Hours) *' : 'Excused Absence Duration (Hours) *'}
                </Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={broadcastForm.hours}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, hours: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>
                  {broadcastForm.type === 'VET' ? 'Required Overtime Workers (Slots) *' : 'Approved Staff Count (Slots) *'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={broadcastForm.slots_available}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, slots_available: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            {/* VET Overtime Rate Configuration */}
            {broadcastForm.type === 'VET' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* Category selector sourced from payroll settings */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <span>Overtime Type (Payroll Policy)</span>
                    </Label>
                    <Select
                      value={broadcastForm.ot_category}
                      onValueChange={(val: any) => handleOtCategoryChange(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {otCategories.map((cat) => (
                          <SelectItem key={cat.key} value={cat.key}>
                            {cat.name} {cat.rate != null ? `(${cat.rate}x)` : '(Not set ⚠️)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {otCategories.find((c) => c.key === broadcastForm.ot_category)?.desc}
                    </p>
                  </div>

                  {/* Multiplier display card */}
                  <div className="space-y-1.5">
                    <Label>Rate Multiplier</Label>
                    {isVetRateConfigured ? (
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 min-h-[58px]">
                        <div>
                          <div className="text-xl font-bold tracking-tight text-foreground flex items-baseline gap-1">
                            <span>{currentVetRate}x</span>
                            <span className="text-xs font-normal text-muted-foreground">Hourly Rate</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">Settings → Payroll Settings</span>
                        </div>
                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] bg-emerald-500/10">
                          Auto-Sourced
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 min-h-[58px]">
                        <div>
                          <div className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Not set on Settings
                          </div>
                          <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90">
                            Multiplier not configured
                          </span>
                        </div>
                        <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 text-[10px]">
                          Action Required
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Warning announcement if rate is not set */}
                {!isVetRateConfigured && (
                  <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200 text-xs space-y-1.5">
                    <div className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Overtime Rate Not Set in Payroll Settings</span>
                    </div>
                    <p className="text-rose-800/90 dark:text-rose-300/90">
                      The overtime multiplier for <strong>{otCategories.find((c) => c.key === broadcastForm.ot_category)?.name}</strong> has not been configured in your tenant's Payroll Settings. Please configure overtime rates before broadcasting.
                    </p>
                    <div className="pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-rose-500/40 text-rose-800 dark:text-rose-200 hover:bg-rose-500/20"
                        onClick={() => window.open('/settings', '_blank')}
                      >
                        Configure in Payroll Settings <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VTO Compensation Policy */}
            {broadcastForm.type === 'VTO' && (
              <div className="space-y-2 pt-1">
                <Label>VTO Compensation Policy *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, vto_compensation_type: 'unpaid' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      broadcastForm.vto_compensation_type === 'unpaid'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/30'
                        : 'border-border/60 hover:border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Unpaid VTO</span>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-600">Standard</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hours deducted from basic salary on payroll day. Staff may fund with PTO if allowed.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, vto_compensation_type: 'paid' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      broadcastForm.vto_compensation_type === 'paid'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30'
                        : 'border-border/60 hover:border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Company-Paid VTO</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600">Sponsored</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      100% covered by company. Full salary maintained with zero deductions on payroll day.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* VTO Policy Note */}
            {broadcastForm.type === 'VTO' && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 text-xs text-muted-foreground">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Absence Policy:</span> VTO does not use overtime multipliers. Time off is recorded as excused absence, and staff may choose to use accrued PTO if permitted by company policy.
                </div>
              </div>
            )}

            {/* Reason / Notes */}
            <div className="space-y-1">
              <Label>
                {broadcastForm.type === 'VET' ? 'Business Need / Overtime Justification' : 'Reason for Voluntary Time Off / Operational Context'}
              </Label>
              <Input
                placeholder={
                  broadcastForm.type === 'VET'
                    ? 'e.g. Critical backlog dispatch, weekend order surge, or emergency floor coverage...'
                    : 'e.g. Production queue cleared early, line maintenance, or voluntary early release without penalty...'
                }
                value={broadcastForm.reason}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, reason: e.target.value })}
              />
            </div>

            {/* Urgency */}
            <div className="space-y-1">
              <Label>Broadcast Urgency / Priority</Label>
              <Select
                value={broadcastForm.urgency}
                onValueChange={(val: any) => setBroadcastForm({ ...broadcastForm, urgency: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal (Standard broadcast)</SelectItem>
                  <SelectItem value="high">High (Priority staffing)</SelectItem>
                  <SelectItem value="critical">Critical (Immediate coverage required)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Expiration & Cutoff Window */}
            <div className="space-y-2 p-3 rounded-xl border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Claim Deadline & Expiration *</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  When claims automatically close
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={broadcastForm.expiry_option}
                  onValueChange={(val: any) => setBroadcastForm({ ...broadcastForm, expiry_option: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shift_start">At Shift Start (Default)</SelectItem>
                    <SelectItem value="1h_before">1 Hour Before Shift</SelectItem>
                    <SelectItem value="2h_before">2 Hours Before Shift</SelectItem>
                    <SelectItem value="24h_before">24 Hours Before Shift</SelectItem>
                    <SelectItem value="custom">Custom Date & Time</SelectItem>
                  </SelectContent>
                </Select>

                {broadcastForm.expiry_option === 'custom' ? (
                  <Input
                    type="datetime-local"
                    value={broadcastForm.expires_at}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, expires_at: e.target.value })}
                    className="text-xs"
                    required
                  />
                ) : (
                  <div className="text-xs text-muted-foreground flex items-center px-3 border rounded-md bg-muted/40">
                    Auto-computed from shift start
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Once the deadline passes, unfilled slots expire automatically and cannot be claimed retroactively.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBroadcastOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={broadcastMutation.isPending || (broadcastForm.type === 'VET' && !isVetRateConfigured)}
              >
                {broadcastMutation.isPending ? (
                  'Broadcasting...'
                ) : broadcastForm.type === 'VET' ? (
                  isVetRateConfigured ? (
                    `Broadcast Paid VET Shift (${currentVetRate}x OT)`
                  ) : (
                    'Cannot Broadcast: Rate Not Set in Settings'
                  )
                ) : (
                  'Broadcast Voluntary Time Off (VTO)'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' ? 'Approve' : 'Reject'} {selectedClaimForReview?.claim_type} Claim
            </DialogTitle>
            <DialogDescription>
              Employee: {selectedClaimForReview?.full_name} ({selectedClaimForReview?.opportunity_date})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Reviewer Notes / Feedback</Label>
              <Input
                placeholder="Optional notes for the employee..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approved' ? 'default' : 'destructive'}
              onClick={submitReview}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? 'Processing...' : `Confirm ${reviewAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
