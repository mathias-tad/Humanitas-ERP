import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Mail, Smartphone, BellOff, Layers, Check, Save, Loader2, Lock, BarChart2, Cake } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useModules } from '@/context/ModuleContext';
import {
  useNotificationPreferences,
  useBulkUpdateNotificationPreferences,
  useDigestConfig,
  useUpdateDigestConfig,
  useBirthdaySettings,
  useUpdateBirthdaySettings,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_DESCRIPTIONS,
  NOTIFICATION_CATEGORY_PERMISSION_MAP,
  NOTIFICATION_CATEGORY_MODULE_MAP,
  CATEGORY_GROUPS,
  type NotificationPreference,
} from '@/hooks/useNotifications';
import { toast } from 'sonner';

type Channel = 'email' | 'push' | 'both' | 'none';

const CHANNEL_OPTIONS: { value: Channel; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'email', label: 'Email Only', icon: <Mail className="h-4 w-4" />, description: 'Delivered to your registered email address' },
  { value: 'push', label: 'Push Only', icon: <Smartphone className="h-4 w-4" />, description: 'In-app and browser push notifications' },
  { value: 'both', label: 'Email & Push', icon: <Layers className="h-4 w-4" />, description: 'Receive via both channels' },
  { value: 'none', label: 'Disabled', icon: <BellOff className="h-4 w-4" />, description: 'Do not receive this notification' },
];

export default function NotificationPreferencesPage() {
  const { hasPermission, user } = useAuth();
  const { isModuleSubscribed } = useModules();
  const role = (user as any)?.role?.toLowerCase() || (user as any)?.role_name?.toLowerCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin' || role === 'administrator';
  const canAccess = hasPermission('view_notification_preferences') || hasPermission('use_ai') || isOwnerOrAdmin;

  const { data: preferences = [], isLoading, isError } = useNotificationPreferences();
  const bulkUpdate = useBulkUpdateNotificationPreferences();

  const [localPrefs, setLocalPrefs] = useState<Record<string, Channel>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: digestConfig } = useDigestConfig();
  const updateDigestMutation = useUpdateDigestConfig();
  const [digestMode, setDigestMode] = useState<'instant' | 'daily' | 'weekly'>('instant');

  useEffect(() => {
    if (digestConfig?.mode) {
      setDigestMode(digestConfig.mode);
    }
  }, [digestConfig?.mode]);

  const handleUpdateDigestMode = async (mode: 'instant' | 'daily' | 'weekly') => {
    setDigestMode(mode);
    try {
      await updateDigestMutation.mutateAsync({ mode });
      toast.success(`Delivery mode updated to ${mode}`);
    } catch {
      toast.error('Failed to update delivery mode');
    }
  };

  const { data: birthdaySettings } = useBirthdaySettings();
  const updateBirthdayMutation = useUpdateBirthdaySettings();
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [notifyColleagues, setNotifyColleagues] = useState(true);

  useEffect(() => {
    if (birthdaySettings) {
      setBirthdayEnabled(birthdaySettings.enabled);
      setNotifyColleagues(birthdaySettings.notifyColleagues);
    }
  }, [birthdaySettings]);

  const handleToggleBirthday = async (enabled: boolean) => {
    setBirthdayEnabled(enabled);
    try {
      await updateBirthdayMutation.mutateAsync({ enabled });
      toast.success(enabled ? 'Automated birthday greetings activated' : 'Automated birthday greetings deactivated');
    } catch {
      toast.error('Failed to update birthday greeting settings');
    }
  };

  const handleToggleNotifyColleagues = async (notify: boolean) => {
    setNotifyColleagues(notify);
    try {
      await updateBirthdayMutation.mutateAsync({ notifyColleagues: notify });
      toast.success(notify ? 'Colleague birthday alerts activated' : 'Colleague birthday alerts deactivated');
    } catch {
      toast.error('Failed to update colleague birthday alert settings');
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          You don't have permission to manage notification preferences.
        </p>
      </div>
    );
  }

  const getChannel = (category: string): Channel => {
    if (localPrefs[category] !== undefined) return localPrefs[category];
    const pref = preferences.find((p) => p.category === category);
    return (pref?.channel as Channel) || 'both';
  };

  const handleChannelChange = (category: string, channel: Channel) => {
    setLocalPrefs((prev) => ({ ...prev, [category]: channel }));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(localPrefs).map(([category, channel]) => ({ category, channel }));
    if (updates.length === 0) return;
    try {
      await bulkUpdate.mutateAsync(updates);
      setLocalPrefs({});
      setHasChanges(false);
      toast.success('Notification preferences saved successfully');
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Bell className="h-10 w-10 text-destructive" />
        <p className="text-destructive font-medium">Failed to load notification preferences</p>
      </div>
    );
  }

  const prefsByCategory = new Map<string, NotificationPreference>(preferences.map((p) => [p.category, p]));

  const canSeeCategory = (category: string) => {
    if (!prefsByCategory.has(category)) return false;
    const mod = NOTIFICATION_CATEGORY_MODULE_MAP[category] || 'core';
    if (mod !== 'core' && !isModuleSubscribed(mod as any)) return false;
    const requiredPermission = NOTIFICATION_CATEGORY_PERMISSION_MAP[category];
    if (requiredPermission === null || requiredPermission === undefined) return true;
    if (isOwnerOrAdmin) return true;
    return hasPermission(requiredPermission);
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notification Preferences
          </h1>
          <p className="text-muted-foreground mt-1">
            Choose how you receive notifications. Categories are personalized to your role and permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(hasPermission('view_notification_reports') || isOwnerOrAdmin) && (
            <Link
              to="/settings/notifications/reports"
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors text-foreground"
            >
              <BarChart2 className="h-4 w-4 text-primary" />
              Delivery Reports
            </Link>
          )}
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              disabled={bulkUpdate.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {bulkUpdate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Delivery Mode (Digest Setting) */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-sm">
        <h3 className="font-semibold text-foreground mb-3 text-sm">Delivery Mode</h3>
        <div className="flex gap-3">
          {(['instant', 'daily', 'weekly'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleUpdateDigestMode(mode)}
              disabled={updateDigestMutation.isPending}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                digestMode === mode
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {digestMode === 'instant'
            ? 'Notifications delivered immediately.'
            : digestMode === 'daily'
            ? 'Notifications bundled in a daily summary email at 8 AM.'
            : 'Notifications bundled in a weekly summary email every Monday.'}
        </p>
      </div>

      {/* Automated Birthday Greetings & Celebrations (Default Active, Toggleable) */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                Automated Birthday Greetings
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                  Default Active
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Automatically send celebratory emails and alerts when team members have a birthday.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={birthdayEnabled}
              onChange={(e) => handleToggleBirthday(e.target.checked)}
              disabled={updateBirthdayMutation.isPending}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-medium text-foreground">Notify All Colleagues</p>
            <p className="text-[11px] text-muted-foreground">
              Notify teammates and colleagues on the day of the birthday so they can send warm wishes.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifyColleagues}
              onChange={(e) => handleToggleNotifyColleagues(e.target.checked)}
              disabled={!birthdayEnabled || updateBirthdayMutation.isPending}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CHANNEL_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
            <span className="text-muted-foreground">{opt.icon}</span>
            <div>
              <p className="text-xs font-medium">{opt.label}</p>
              <p className="text-[10px] text-muted-foreground">{opt.description}</p>
            </div>
          </div>
        ))}
      </div>

      {Object.entries(CATEGORY_GROUPS).map(([groupName, categories]) => {
        const groupPrefs = categories.filter(canSeeCategory);
        if (groupPrefs.length === 0) return null;

        return (
          <div key={groupName} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {groupName}
              </h2>
            </div>
            <div className="divide-y">
              {groupPrefs.map((category) => {
                const currentChannel = getChannel(category);
                const isModified = localPrefs[category] !== undefined;

                return (
                  <div key={category} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {NOTIFICATION_CATEGORY_LABELS[category] || category}
                        </p>
                        {isModified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            Modified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {NOTIFICATION_CATEGORY_DESCRIPTIONS[category] || ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {CHANNEL_OPTIONS.map((opt) => {
                        const isSelected = currentChannel === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleChannelChange(category, opt.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {preferences.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Bell className="h-10 w-10" />
          <p>No notification categories available for your role.</p>
        </div>
      )}
    </div>
  );
}
