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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeneralSettings, type GeneralSettingsData } from "@/hooks/useSettings";

interface GeneralSettingsProps {
  disabled?: boolean;
}

export function GeneralSettings({ disabled = false }: GeneralSettingsProps) {
  const { settingsQuery, timezonesQuery, updateSettingsMutation } = useGeneralSettings();

  const initialSettings = settingsQuery.data || {
    language: "en",
    timezone: "UTC",
    date_format: "YYYY-MM-DD",
    currency: "USD",
  };

  const [settings, setSettings] = useState<GeneralSettingsData>(initialSettings);
  const timezones = timezonesQuery.data || [];
  const isLoading = settingsQuery.isLoading || timezonesQuery.isLoading;
  const [message, setMessage] = useState({ type: "", text: "" });
  const [timezoneOpen, setTimezoneOpen] = useState(false);

  // Sync local state when query data changes
  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(prev => ({ ...prev, ...settingsQuery.data }));
    }
  }, [settingsQuery.data]);

  const getTimezoneLabel = (value: string) => {
    const tz = timezones.find(t => t.value === value);
    return tz ? `${tz.label} (${tz.offset})` : value;
  };

  const handleSave = () => {
    setMessage({ type: "", text: "" });
    updateSettingsMutation.mutate(settings, {
      onSuccess: () => setMessage({ type: "success", text: "Settings saved successfully!" }),
      onError: () => setMessage({ type: "error", text: "Failed to save settings" }),
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
    <Card>
      <CardHeader>
        <CardTitle>System Preferences</CardTitle>
        <CardDescription>
          Configure your application-wide settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <div className="grid gap-2">
          <Label htmlFor="language">Language</Label>
          <select
            id="language"
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            disabled={disabled}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="am">Amharic</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={timezoneOpen}
                className="w-full justify-between font-normal"
                disabled={disabled}
              >
                {settings.timezone ? getTimezoneLabel(settings.timezone) : "Select timezone..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search timezone..." />
                <CommandList>
                  <CommandEmpty>No timezone found.</CommandEmpty>
                  <CommandGroup>
                    {timezones.map((tz) => (
                      <CommandItem
                        key={tz.value}
                        value={`${tz.value} ${tz.label}`}
                        onSelect={() => {
                          setSettings({ ...settings, timezone: tz.value });
                          setTimezoneOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            settings.timezone === tz.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1">{tz.label}</span>
                        <span className="text-muted-foreground text-xs">{tz.offset}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateFormat">Date Format</Label>
          <select
            id="dateFormat"
            value={settings.date_format}
            onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            disabled={disabled}
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            disabled={disabled}
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="ETB">ETB - Ethiopian Birr</option>
            <option value="KES">KES - Kenyan Shilling</option>
            <option value="NGN">NGN - Nigerian Naira</option>
          </select>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={updateSettingsMutation.isPending || disabled}>
          {updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
