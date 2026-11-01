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
    ot_rate_multiplier: 1.5,
    ot_category: 'normal' as 'normal' | 'night' | 'dayoff' | 'holiday',
    urgency: 'normal' as 'normal' | 'high' | 'critical',
    reason: '',
    notes: '',
  });

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedClaimForReview, setSelectedClaimForReview] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');

  // Handle Claim
  const handleOpenClaimDialog = (opp: WfmOpportunity) => {
    setSelectedOpp(opp);
    setUsePto(false);
    setClaimDialogOpen(true);
  };

  const submitClaim = async () => {
    if (!selectedOpp) return;
    try {
      const res = await claimMutation.mutateAsync({
        id: selectedOpp.id,
        use_pto_balance: usePto,
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
    try {
      await broadcastMutation.mutateAsync({
        ...broadcastForm,
        hours: Number(broadcastForm.hours),
        slots_available: Number(broadcastForm.slots_available),
        ot_rate_multiplier: Number(broadcastForm.ot_rate_multiplier),
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
          <Button onClick={() => setBroadcastOpen(true)} className="flex items-center gap-2">
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

                return (
                  <Card key={opp.id} className="relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div
                      className={`h-1.5 w-full ${isVet ? 'bg-blue-600' : 'bg-emerald-600'}`}
                    />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <Badge
                          variant="secondary"
                          className={isVet ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}
                        >
                          {isVet ? 'VET • Extra Overtime' : 'VTO • Voluntary Off'}
                        </Badge>
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
                        {isClaimed ? (
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
                  <Button onClick={() => setBroadcastOpen(true)} size="sm">
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
                        value={settings.vet_claim_strategy}
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
                  Date: {selectedOpp.date} • {selectedOpp.hours} Hours
                </div>
                {selectedOpp.type === 'VET' && (
                  <div className="text-xs font-medium text-primary">
                    Rate Multiplier: {selectedOpp.ot_rate_multiplier}x ({selectedOpp.ot_category})
                  </div>
                )}
              </div>

              {selectedOpp.type === 'VTO' && settings?.vto_allow_pto_funding && (
                <div className="flex items-center justify-between border p-3 rounded-md">
                  <div>
                    <Label className="text-sm">Fund with Paid Leave Balance (PTO)</Label>
                    <p className="text-xs text-muted-foreground">Deduct from your available annual leave days</p>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Broadcast Workforce Opportunity</DialogTitle>
            <DialogDescription>
              Open extra overtime shifts (VET) or voluntary time-off (VTO) slots for employees.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBroadcastSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Opportunity Type</Label>
                <Select
                  value={broadcastForm.type}
                  onValueChange={(val: 'VET' | 'VTO') => setBroadcastForm({ ...broadcastForm, type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VET">VET (Extra Overtime Shift)</SelectItem>
                    <SelectItem value="VTO">VTO (Voluntary Time Off)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={broadcastForm.date}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Broadcast Title</Label>
              <Input
                placeholder="e.g. Weekend Surge Support / Morning Coverage"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Shift</Label>
                <Select
                  value={broadcastForm.shift_id}
                  onValueChange={(val) => setBroadcastForm({ ...broadcastForm, shift_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={broadcastForm.hours}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, hours: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Slots Available</Label>
                <Input
                  type="number"
                  min="1"
                  value={broadcastForm.slots_available}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, slots_available: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            {broadcastForm.type === 'VET' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Overtime Multiplier</Label>
                  <Select
                    value={String(broadcastForm.ot_rate_multiplier)}
                    onValueChange={(val) => setBroadcastForm({ ...broadcastForm, ot_rate_multiplier: Number(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.25">1.25x (Standard Overtime)</SelectItem>
                      <SelectItem value="1.5">1.50x (Night Shift OT)</SelectItem>
                      <SelectItem value="2.0">2.00x (Rest Day / Weekend OT)</SelectItem>
                      <SelectItem value="2.5">2.50x (Public Holiday OT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>OT Category</Label>
                  <Select
                    value={broadcastForm.ot_category}
                    onValueChange={(val: any) => setBroadcastForm({ ...broadcastForm, ot_category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Standard Weekday</SelectItem>
                      <SelectItem value="night">Night Shift</SelectItem>
                      <SelectItem value="dayoff">Rest Day / Weekend</SelectItem>
                      <SelectItem value="holiday">Public Holiday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Broadcast Reason / Notes</Label>
              <Input
                placeholder="Reason for opening slots (e.g. Influx of orders, Low support volume)"
                value={broadcastForm.reason}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, reason: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBroadcastOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={broadcastMutation.isPending}>
                {broadcastMutation.isPending ? 'Broadcasting...' : 'Broadcast to Department'}
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
