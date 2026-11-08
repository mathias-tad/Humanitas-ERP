import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Shield,
  ShieldCheck,
  Clock,
  Check,
  X,
  Sliders,
  Unlock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../config/api.config';
import { getAuthHeaders, useAuth } from '../../context/AuthContext';

export interface IncomingAccessRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reason: string;
  responseNote?: string;
  expiresAt?: string;
  createdAt: string;
  requester: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    department?: string;
    avatarUrl?: string;
  };
}

export interface RoleRestrictionItem {
  id?: string;
  role: string;
  is_restricted: boolean;
  triage_prompt?: string;
}

interface ChatAccessRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestsUpdated?: () => void;
}

export function ChatAccessRequestsModal({
  isOpen,
  onClose,
  onRequestsUpdated,
}: ChatAccessRequestsModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const [activeTab, setActiveTab] = useState<'requests' | 'privacy' | 'admin'>('requests');
  const [requests, setRequests] = useState<IncomingAccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Per-request selected duration & note
  const [selectedDuration, setSelectedDuration] = useState<Record<string, string>>({});
  const [responseNotes] = useState<Record<string, string>>({});

  // Self-override state
  const [allowOverride, setAllowOverride] = useState(false);
  const [activeGrants, setActiveGrants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [proactiveDuration, setProactiveDuration] = useState('24h');
  const [proactiveNote, setProactiveNote] = useState('');
  const [isGrantingProactive, setIsGrantingProactive] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadActiveGrants = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/messaging/access-grants/active`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setActiveGrants(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // Ignore
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/list`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllUsers(data.filter((u: any) => u.id !== user?.id));
        }
      }
    } catch (e) {
      // Ignore
    }
  };
  const [isUpdatingOverride, setIsUpdatingOverride] = useState(false);

  // Admin role restrictions
  const [restrictions, setRestrictions] = useState<RoleRestrictionItem[]>([]);
  const [isLoadingRestrictions, setIsLoadingRestrictions] = useState(false);
  const [isSavingRestrictions, setIsSavingRestrictions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      loadUserOverride();
      loadActiveGrants();
      loadAllUsers();
      if (isAdmin) loadRestrictions();
    }
  }, [isOpen, isAdmin]);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/messaging/access-requests/incoming`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load access requests');
      const data = await res.json();
      setRequests(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserOverride = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAllowOverride(!!data.allow_direct_chat_override);
      }
    } catch (e) {
      // Ignore
    }
  };

  const loadRestrictions = async () => {
    try {
      setIsLoadingRestrictions(true);
      const res = await fetch(`${API_BASE_URL}/messaging/role-restrictions`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load role restrictions');
      const data = await res.json();
      setRestrictions(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoadingRestrictions(false);
    }
  };

  const handleRespond = async (grantId: string, action: 'approve' | 'reject') => {
    try {
      setRespondingId(grantId);
      const duration = selectedDuration[grantId] || '24h';
      const note = responseNotes[grantId] || '';

      const res = await fetch(`${API_BASE_URL}/messaging/access-requests/${grantId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          duration: action === 'approve' ? duration : undefined,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update request');
      }

      toast.success(action === 'approve' ? `Direct chat access granted (${duration})` : 'Request declined');
      loadRequests();
      onRequestsUpdated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to respond to request');
    } finally {
      setRespondingId(null);
    }
  };

    const handleGrantProactive = async () => {
    if (!selectedEmpId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      setIsGrantingProactive(true);
      const res = await fetch(`${API_BASE_URL}/messaging/access-grants/proactive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: selectedEmpId,
          duration: proactiveDuration,
          note: proactiveNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to grant access');
      }
      toast.success('Direct chat access granted to employee');
      setSelectedEmpId('');
      setProactiveNote('');
      loadActiveGrants();
      onRequestsUpdated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to grant direct access');
    } finally {
      setIsGrantingProactive(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    try {
      setRevokingId(grantId);
      const res = await fetch(`${API_BASE_URL}/messaging/access-grants/revoke/${grantId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to revoke access');
      toast.success('Direct chat access revoked');
      loadActiveGrants();
      onRequestsUpdated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to revoke access');
    } finally {
      setRevokingId(null);
    }
  };

  const handleToggleOverride = async (checked: boolean) => {
    try {
      setIsUpdatingOverride(true);
      const res = await fetch(`${API_BASE_URL}/messaging/self-override`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ allowOverride: checked }),
      });

      if (!res.ok) throw new Error('Failed to update direct chat override');
      setAllowOverride(checked);
      toast.success(
        checked
          ? 'Direct chat unlocked: all employees can now message you directly'
          : 'Role restriction restored: requests or AI triage required'
      );
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle override');
    } finally {
      setIsUpdatingOverride(false);
    }
  };

  const handleSaveRestrictions = async () => {
    try {
      setIsSavingRestrictions(true);
      const res = await fetch(`${API_BASE_URL}/messaging/role-restrictions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          restrictions: restrictions.map(r => ({
            role: r.role,
            isRestricted: r.is_restricted,
            triagePrompt: r.triage_prompt,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save restrictions');
      toast.success('Chat role restrictions saved successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save restrictions');
    } finally {
      setIsSavingRestrictions(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pastRequests = requests.filter(r => r.status !== 'pending');

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border shadow-2xl bg-card max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-muted/40 p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Direct Chat Access & Permissions
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage incoming 1-on-1 access requests, privacy override, and role policies
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-5 bg-muted/20">
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'requests'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Incoming Requests
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'privacy'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            Direct Chat Override
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'admin'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Admin Role Restrictions
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: INCOMING REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  Loading access requests...
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
                  <p className="text-sm font-semibold text-foreground">No Pending Access Requests</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    When employees request direct 1-on-1 chat with you, their requests will appear here for review.
                  </p>
                </div>
              ) : (
                pendingRequests.map(req => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarImage src={req.requester.avatarUrl} />
                          <AvatarFallback className="bg-primary/10 font-bold text-xs">
                            {req.requester.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {req.requester.fullName}
                          </div>
                          <div className="text-[11px] text-muted-foreground capitalize">
                            {req.requester.role.replace('_', ' ')} · {req.requester.department || 'General'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 text-xs text-foreground border border-border/50">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase mb-1">
                        Reason for request:
                      </span>
                      "{req.reason}"
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">Duration:</span>
                        <select
                          value={selectedDuration[req.id] || '24h'}
                          onChange={e =>
                            setSelectedDuration(prev => ({ ...prev, [req.id]: e.target.value }))
                          }
                          className="text-xs border rounded-lg px-2.5 py-1 bg-background text-foreground"
                        >
                          <option value="1h">1 Hour</option>
                          <option value="24h">24 Hours (1 Day)</option>
                          <option value="3d">3 Days</option>
                          <option value="7d">7 Days</option>
                          <option value="30d">30 Days</option>
                          <option value="forever">Forever (Indefinite)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespond(req.id, 'reject')}
                          disabled={respondingId === req.id}
                          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRespond(req.id, 'approve')}
                          disabled={respondingId === req.id}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-8 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Grant Access
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Resolved history */}
              {pastRequests.length > 0 && (
                <div className="pt-4 border-t border-border space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Recent Resolved Requests ({pastRequests.length})
                  </h4>
                  <div className="space-y-2">
                    {pastRequests.slice(0, 5).map(req => (
                      <div
                        key={req.id}
                        className="p-3 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-foreground">
                            {req.requester.fullName}
                          </span>
                          <span className="text-muted-foreground text-[11px] ml-2">
                            ({req.requester.role})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/15 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {req.status}
                            {req.status === 'approved' &&
                              (req.expiresAt
                                ? ` · exp ${new Date(req.expiresAt).toLocaleDateString()}`
                                : ' · forever')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT CHAT PRIVACY & OVERRIDE */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Unlock className="w-4 h-4 text-amber-500" />
                    <span>Direct Chat Self-Override</span>
                  </div>
                  <Switch
                    checked={allowOverride}
                    onCheckedChange={handleToggleOverride}
                    disabled={isUpdatingOverride}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When enabled, all employees can start direct 1-on-1 chats with you immediately.
                  This bypasses the administrator's role-based triage requirement for your account.
                </p>
                <div className="pt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  Current Status:{' '}
                  {allowOverride
                    ? '🔓 Unlocked for ALL employees'
                    : '🛡️ Protected (Restricted by default)'}
                </div>
              </div>

              {/* OPTION B: EXPOSE TO SPECIFIC EMPLOYEE */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Expose to Specific Employee (Whitelist)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Grant direct 1-on-1 messaging access to a specific colleague without them having to request it.
                </p>

                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">Select Employee</label>
                    <select
                      value={selectedEmpId}
                      onChange={e => setSelectedEmpId(e.target.value)}
                      className="w-full text-xs border rounded-lg px-3 py-2 bg-background text-foreground"
                    >
                      <option value="">-- Choose Colleague --</option>
                      {allUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role_name || u.role || 'Staff'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">Access Duration</label>
                    <select
                      value={proactiveDuration}
                      onChange={e => setProactiveDuration(e.target.value)}
                      className="w-full text-xs border rounded-lg px-3 py-2 bg-background text-foreground"
                    >
                      <option value="1h">1 Hour</option>
                      <option value="24h">24 Hours (1 Day)</option>
                      <option value="3d">3 Days</option>
                      <option value="7d">7 Days (1 Week)</option>
                      <option value="30d">30 Days</option>
                      <option value="forever">Forever (Indefinite)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button
                    size="sm"
                    onClick={handleGrantProactive}
                    disabled={isGrantingProactive || !selectedEmpId}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {isGrantingProactive ? 'Granting...' : 'Grant Direct Chat Access'}
                  </Button>
                </div>
              </div>

              {/* LIST OF CURRENTLY EXPOSED SPECIFIC EMPLOYEES */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                    Currently Whitelisted Employees ({activeGrants.length})
                  </h4>
                  <span className="text-[10px] text-muted-foreground">Active 1-on-1 Grants</span>
                </div>

                {activeGrants.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No specific individual employee grants active at this time.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeGrants.map((g: any) => (
                      <div
                        key={g.id}
                        className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 border">
                            <AvatarImage src={g.employee?.avatarUrl} />
                            <AvatarFallback className="text-[10px] font-bold">
                              {g.employee?.fullName?.[0] || 'E'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-foreground">{g.employee?.fullName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {g.expiresAt
                                ? `Expires: ${new Date(g.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                : 'Permanent Access (Forever)'}
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevoke(g.id)}
                          disabled={revokingId === g.id}
                          className="h-7 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs text-muted-foreground">
                <h4 className="font-bold text-foreground">How Role-Restricted Chat Works</h4>
                <p>
                  1. When an employee tries to direct-message a restricted role, the system guides them to the AI Assistant for immediate policy answers.
                </p>
                <p>
                  2. If their inquiry requires human escalation, they submit an access request specifying their reason.
                </p>
                <p>
                  3. You can grant access for 1 hour, 24 hours, 7 days, 30 days, or permanently.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ADMIN ROLE RESTRICTIONS */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Role-Based Direct Chat Policies
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Define which company roles require AI triage before direct employee contact
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveRestrictions}
                  disabled={isSavingRestrictions}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-8 shadow-xs"
                >
                  {isSavingRestrictions ? 'Saving...' : 'Save Restrictions'}
                </Button>
              </div>

              {isLoadingRestrictions ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading role restrictions...
                </div>
              ) : (
                <div className="space-y-3">
                  {restrictions.map((r, idx) => (
                    <div
                      key={r.role}
                      className="p-3.5 rounded-xl border border-border bg-card space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground capitalize">
                            {r.role.replace('_', ' ')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              r.is_restricted
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {r.is_restricted ? 'Restricted' : 'Open'}
                          </span>
                        </div>
                        <Switch
                          checked={r.is_restricted}
                          onCheckedChange={checked => {
                            setRestrictions(prev =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, is_restricted: checked } : item
                              )
                            );
                          }}
                        />
                      </div>

                      {r.is_restricted && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            AI Triage Guidance & Instructions:
                          </label>
                          <Textarea
                            value={r.triage_prompt || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setRestrictions(prev =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, triage_prompt: val } : item
                                )
                              );
                            }}
                            rows={2}
                            placeholder="e.g. Please check company policy documents via AI before messaging HR..."
                            className="text-xs resize-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/30 border-t border-border flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
