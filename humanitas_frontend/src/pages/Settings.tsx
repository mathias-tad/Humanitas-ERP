import { useSearchParams, useNavigate } from "react-router-dom";
import {
  User,
  Building2,
  Bell,
  Mail,
  CalendarDays,
  Palette,
  Blocks,
  Globe2,
  ShieldCheck,
  Briefcase,
  FolderKanban,
  ExternalLink
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { EmailSettings } from "@/components/settings/EmailSettings";
import { HolidaySettings } from "@/components/settings/HolidaySettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { useAuth } from "@/context/AuthContext";
import { useERPModules } from "@/context/ModuleContext";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";

// Common Universal Platform Settings Tabs (Available to any tenant, regardless of subscribed modules)
const commonSettingsTabs = [
  { value: "General", label: "General & Regional", icon: Globe2, permissions: ["view_general_settings", "edit_general_settings"] },
  { value: "Company", label: "Company & Entities", icon: Building2, permissions: ["view_company_settings", "edit_company_settings"] },
  { value: "Appearance", label: "Theme & Appearance", icon: Palette, permissions: ["view_general_settings"] },
  { value: "Account", label: "Account & Security", icon: User, permissions: ["view_accounts_privacy_settings", "edit_accounts_privacy_settings"] },
  { value: "Notifications", label: "Notifications", icon: Bell, permissions: ["view_notification_preferences", "view_notifications_settings", "edit_notifications_settings"] },
  { value: "Email", label: "Email & SMTP", icon: Mail, permissions: ["view_email_settings", "edit_email_settings"] },
  { value: "Holidays", label: "Public Holidays", icon: CalendarDays, permissions: ["view_holidays", "manage_holidays"] },
  { value: "Integrations", label: "Integrations & API", icon: Blocks, permissions: ["view_general_settings", "edit_general_settings"] },
];

export function Settings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasAnyPermission } = useAuth();
  const { isModuleSubscribed } = useERPModules();

  // Filter tabs based on permissions
  const accessibleTabs = commonSettingsTabs.filter(tab => hasAnyPermission(tab.permissions));

  const requestedTab = searchParams.get("tab") || "General";
  const defaultTab = accessibleTabs.some(t => t.value === requestedTab)
    ? requestedTab
    : accessibleTabs[0]?.value || "General";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto animate-fadeIn">
      <PageHeader
        title="Common Platform Settings"
        description="Configure universal organization preferences, regional localization, appearance, authentication, and communication channels."
        badge={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="h-3 w-3" />
            Universal Platform
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {isModuleSubscribed("hrms") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/hr/settings')}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                <span>HR Settings</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Button>
            )}
            {isModuleSubscribed("pms") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/pms/settings')}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
                <span>PMS Settings</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Button>
            )}
          </div>
        }
      />

      <Separator className="my-2" />

      <Tabs
        defaultValue={defaultTab}
        className="flex flex-col md:flex-row gap-8"
      >
        <aside className="md:w-1/4">
          <TabsList className="flex flex-col h-auto items-start justify-start gap-1.5 bg-card/60 border border-border p-2 rounded-xl w-full">
            {accessibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="w-full justify-start gap-2.5 px-3 py-2.5 h-10 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        <div className="flex-1 max-w-4xl min-w-0">
          {hasAnyPermission(["view_general_settings", "edit_general_settings"]) && (
            <TabsContent value="General" className="space-y-6 m-0">
              <GeneralSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_company_settings", "edit_company_settings"]) && (
            <TabsContent value="Company" className="space-y-6 m-0">
              <CompanySettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_general_settings"]) && (
            <TabsContent value="Appearance" className="space-y-6 m-0">
              <AppearanceSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_accounts_privacy_settings", "edit_accounts_privacy_settings"]) && (
            <TabsContent value="Account" className="space-y-6 m-0">
              <AccountSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_notification_preferences", "view_notifications_settings", "edit_notifications_settings"]) && (
            <TabsContent value="Notifications" className="space-y-6 m-0">
              <NotificationSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_email_settings", "edit_email_settings"]) && (
            <TabsContent value="Email" className="space-y-6 m-0">
              <EmailSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_holidays", "manage_holidays"]) && (
            <TabsContent value="Holidays" className="space-y-6 m-0">
              <HolidaySettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_general_settings", "edit_general_settings"]) && (
            <TabsContent value="Integrations" className="space-y-6 m-0">
              <IntegrationsSettings />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

export default Settings;
