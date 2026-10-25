import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, Bell } from "lucide-react";

interface NotificationSettingsData {
  email_notifications: string;
  sms_notifications: string;
  push_notifications: string;
}

interface NotificationSettingsProps {
  disabled?: boolean;
}

export function NotificationSettings({ disabled: _disabled = false }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettingsData>({
    email_notifications: "all",
    sms_notifications: "important",
    push_notifications: "all",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/notifications`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setSettings({ ...settings, ...data });
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/settings/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setMessage({ type: "success", text: "Notification settings saved!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
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
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Manage how you receive system notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message.text && (
          <div
            className={`px-4 py-2 rounded text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Email Notifications</span>
            <p className="text-sm text-gray-500">Receive updates via email</p>
          </div>
          <select
            value={settings.email_notifications}
            onChange={(e) => setSettings({ ...settings, email_notifications: e.target.value })}
            className="flex h-10 w-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="important">Important Only</option>
            <option value="none">None</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">SMS Notifications</span>
            <p className="text-sm text-gray-500">Receive updates via SMS</p>
          </div>
          <select
            value={settings.sms_notifications}
            onChange={(e) => setSettings({ ...settings, sms_notifications: e.target.value })}
            className="flex h-10 w-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="important">Important Only</option>
            <option value="none">None</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Push Notifications</span>
            <p className="text-sm text-gray-500">Receive browser push notifications</p>
          </div>
          <select
            value={settings.push_notifications}
            onChange={(e) => setSettings({ ...settings, push_notifications: e.target.value })}
            className="flex h-10 w-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="important">Important Only</option>
            <option value="none">None</option>
          </select>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Notification Settings"
          )}
        </Button>
        <a
          href="/settings/notifications"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <Bell className="h-3.5 w-3.5" />
          Per-category preferences →
        </a>
      </CardFooter>
    </Card>
  );
}
