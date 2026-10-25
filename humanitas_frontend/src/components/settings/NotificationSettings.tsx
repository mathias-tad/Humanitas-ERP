import { useState } from 'react';
import { Bell, Mail, Smartphone, BellOff, Layers, Check, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useNotificationPreferences,
  useBulkUpdateNotificationPreferences,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_DESCRIPTIONS,
  NOTIFICATION_CATEGORY_PERMISSION_MAP,
  CATEGORY_GROUPS,
  type NotificationPreference,
} from '@/hooks/useNotifications';
import { toast } from 'sonner';

type Channel = 'email' | 'push' | 'both' | 'none';

const CHANNEL_OPTIONS: { value: Channel; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'email', label: 'Email Only', icon: <Mail className="h-4 w-4" />, description: 'Delivered to your registered email' },
  { value: 'push', label: 'Push Only', icon: <Smartphone className="h-4 w-4" />, description: 'In-app and browser alerts' },
  { value: 'both', label: 'Email & Push', icon: <Layers className="h-4 w-4" />, description: 'Both channels' },
  { value: 'none', label: 'Disabled', icon: <BellOff className="h-4 w-4" />, description: 'Mute alerts' },
];

interface NotificationSettingsProps {
  disabled?: boolean;
}

export function NotificationSettings({ disabled = false }: NotificationSettingsProps) {
  const { hasPermission, user } = useAuth();
  const role = (user as any)?.role?.toLowerCase() || (user as any)?.role_name?.toLowerCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin' || role === 'administrator';

  const { data: preferences = [], isLoading, isError } = useNotificationPreferences();
  const bulkUpdate = useBulkUpdateNotificationPreferences();

  const [localPrefs, setLocalPrefs] = useState<Record<string, Channel>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const getChannel = (category: string): Channel => {
    if (localPrefs[category] !== undefined) return localPrefs[category];
    const pref = preferences.find((p) => p.category === category);
    return (pref?.channel as Channel) || 'both';
  };

  const handleChannelChange = (category: string, channel: Channel) => {
    if (disabled) return;
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

  const prefsByCategory = new Map<string, NotificationPreference>(preferences.map((p) => [p.category, p]));

  const canSeeCategory = (category: string) => {
    if (!prefsByCategory.has(category)) return false;
    const requiredPermission = NOTIFICATION_CATEGORY_PERMISSION_MAP[category];
    if (requiredPermission === null || requiredPermission === undefined) return true;
    if (isOwnerOrAdmin) return true;
    return hasPermission(requiredPermission);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-destructive">
        <Bell className="h-8 w-8" />
        <p className="font-medium text-sm">Failed to load notification preferences</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Personal Notification Preferences
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure your individual notification channels. Categories shown are filtered to your active role and permissions.
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSaveAll}
            disabled={bulkUpdate.isPending || disabled}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
          >
            {bulkUpdate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Preferences
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CHANNEL_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card/60 text-xs">
            <span className="text-muted-foreground">{opt.icon}</span>
            <div>
              <p className="font-medium text-[11px]">{opt.label}</p>
              <p className="text-[9px] text-muted-foreground">{opt.description}</p>
            </div>
          </div>
        ))}
      </div>

      {Object.entries(CATEGORY_GROUPS).map(([groupName, categories]) => {
        const groupPrefs = categories.filter(canSeeCategory);
        if (groupPrefs.length === 0) return null;

        return (
          <div key={groupName} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                {groupName}
              </h4>
            </div>
            <div className="divide-y">
              {groupPrefs.map((category) => {
                const currentChannel = getChannel(category);
                const isModified = localPrefs[category] !== undefined;

                return (
                  <div key={category} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-xs">
                          {NOTIFICATION_CATEGORY_LABELS[category] || category}
                        </p>
                        {isModified && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                            Modified
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {NOTIFICATION_CATEGORY_DESCRIPTIONS[category] || ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {CHANNEL_OPTIONS.map((opt) => {
                        const isSelected = currentChannel === opt.value;
                        return (
                          <button
                            key={opt.value}
                            disabled={disabled}
                            onClick={() => handleChannelChange(category, opt.value)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                            } disabled:opacity-50`}
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
    </div>
  );
}
