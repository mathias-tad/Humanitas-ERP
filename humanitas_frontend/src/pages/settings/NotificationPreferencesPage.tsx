import { useState } from 'react';
import { Bell, Mail, Smartphone, BellOff, Layers, Check, Save, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useNotificationPreferences,
  useBulkUpdateNotificationPreferences,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_DESCRIPTIONS,
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
  const isOwner = (user as any)?.role?.toLowerCase() === 'owner' || (user as any)?.role_name?.toLowerCase() === 'owner';
  const canAccess = hasPermission('view_notification_preferences') || hasPermission('use_ai') || isOwner;

  const { data: preferences = [], isLoading, isError } = useNotificationPreferences();
  const bulkUpdate = useBulkUpdateNotificationPreferences();

  const [localPrefs, setLocalPrefs] = useState<Record<string, Channel>>({});
  const [hasChanges, setHasChanges] = useState(false);

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
        const groupPrefs = categories.filter((cat) => prefsByCategory.has(cat));
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
