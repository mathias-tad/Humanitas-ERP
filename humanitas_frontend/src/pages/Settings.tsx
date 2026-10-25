import { useSearchParams } from "react-router-dom";
import {
  User,
  Building2,
  Settings as SettingsIcon,
  Briefcase,
  Calculator,
  Bell,
  Mail,
  Users,
  UserPlus,
  CalendarDays,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PayrollSettings } from "@/components/settings/PayrollSettings";
import { HRMSettings } from "@/components/settings/HRMSettings";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

import { EmailSettings } from "@/components/settings/EmailSettings";
import { CategorySettings } from "@/components/settings/CategorySettings";
import { ActingSettings } from "@/components/settings/ActingSettings";
import { HolidaySettings } from "@/components/settings/HolidaySettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { useAuth } from "@/context/AuthContext";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { Palette, Blocks } from "lucide-react";

// Settings tabs with their permission requirements
const settingsTabs = [
  { value: "Appearance", label: "Appearance", icon: Palette, permissions: ["view_general_settings"] }, // General settings perm for now
  { value: "General", label: "General", icon: SettingsIcon, permissions: ["view_general_settings", "edit_general_settings"] },
  { value: "Company", label: "Company", icon: Building2, permissions: ["view_company_settings", "edit_company_settings"] },
  { value: "Account", label: "Account & Security", icon: User, permissions: ["view_accounts_privacy_settings", "edit_accounts_privacy_settings"] },
  { value: "HR", label: "HR Management", icon: Briefcase, permissions: ["view_hrm_settings", "edit_hrm_settings"] },
  { value: "Categories", label: "Employee Categories", icon: Users, permissions: ["view_hrm_settings", "edit_hrm_settings"] },
  { value: "Acting", label: "Acting Assignments", icon: UserPlus, permissions: ["view_payroll_settings", "edit_payroll_settings"] },
  { value: "Payroll", label: "Payroll & Accounting", icon: Calculator, permissions: ["view_payroll_settings", "edit_payroll_settings"] },
  { value: "Notifications", label: "Notifications", icon: Bell, permissions: ["view_notification_preferences", "view_notifications_settings", "edit_notifications_settings"] },
  { value: "Email", label: "Email Settings", icon: Mail, permissions: ["view_email_settings", "edit_email_settings"] },
  { value: "Integrations", label: "Integrations", icon: Blocks, permissions: ["view_general_settings", "edit_general_settings"] },
  { value: "Holidays", label: "Holidays", icon: CalendarDays, permissions: ["view_holidays", "manage_holidays"] },
];

export function Settings() {
  const [searchParams] = useSearchParams();
  const { hasAnyPermission, hasPermission } = useAuth();

  // Filter tabs based on permissions
  const accessibleTabs = settingsTabs.filter(tab => hasAnyPermission(tab.permissions));

  // Default to first accessible tab, or requested tab if user has permission
  const requestedTab = searchParams.get("tab") || "General";
  const defaultTab = accessibleTabs.some(t => t.value === requestedTab)
    ? requestedTab
    : accessibleTabs[0]?.value || "General";

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
            <p className="text-sm text-muted-foreground">
              Manage your company preferences, and system configuration.
            </p>
          </div>
          <SettingsIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <Separator className="my-4" />
        <Tabs
          defaultValue={defaultTab}
          className="flex flex-col md:flex-row gap-8"
        >
          <aside className="md:w-1/5">
            <TabsList className="flex flex-col h-auto items-start justify-start gap-2 bg-transparent p-0 w-full">
              {accessibleTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="w-full justify-start gap-2 px-3 py-2 h-10 data-[state=active]:!bg-sidebar-accent data-[state=active]:!text-sidebar-accent-foreground"
                >
                  <tab.icon size={18} />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>
          <div className="flex-1 max-w-4xl">
            {/* Only render tab contents for accessible tabs */}
            {hasAnyPermission(["view_general_settings"]) && (
              <TabsContent value="Appearance" className="space-y-6 m-0">
                <AppearanceSettings disabled={!hasPermission("edit_general_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_general_settings", "edit_general_settings"]) && (
              <TabsContent value="General" className="space-y-6 m-0">
                <GeneralSettings disabled={!hasPermission("edit_general_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_company_settings", "edit_company_settings"]) && (
              <TabsContent value="Company" className="space-y-6 m-0">
                <CompanySettings disabled={!hasPermission("edit_company_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_accounts_privacy_settings", "edit_accounts_privacy_settings"]) && (
              <TabsContent value="Account" className="space-y-6 m-0">
                <AccountSettings disabled={!hasPermission("edit_accounts_privacy_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_payroll_settings", "edit_payroll_settings"]) && (
              <TabsContent value="Payroll" className="space-y-6 m-0">
                <PayrollSettings disabled={!hasPermission("edit_payroll_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_hrm_settings", "edit_hrm_settings"]) && (
              <TabsContent value="HR" className="space-y-6 m-0">
                <HRMSettings disabled={!hasPermission("edit_hrm_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_hrm_settings", "edit_hrm_settings"]) && (
              <TabsContent value="Categories" className="space-y-6 m-0">
                <CategorySettings disabled={!hasPermission("edit_hrm_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_payroll_settings", "edit_payroll_settings"]) && (
              <TabsContent value="Acting" className="space-y-6 m-0">
                <ActingSettings disabled={!hasPermission("edit_payroll_settings")} />
              </TabsContent>
            )}


            {hasAnyPermission(["view_notification_preferences", "view_notifications_settings", "edit_notifications_settings"]) && (
              <TabsContent value="Notifications" className="space-y-6 m-0">
                <NotificationSettings disabled={!hasAnyPermission(["view_notification_preferences", "edit_notifications_settings"])} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_email_settings", "edit_email_settings"]) && (
              <TabsContent value="Email" className="space-y-6 m-0">
                <EmailSettings disabled={!hasPermission("edit_email_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_general_settings", "edit_general_settings"]) && (
              <TabsContent value="Integrations" className="space-y-6 m-0">
                <IntegrationsSettings disabled={!hasPermission("edit_general_settings")} />
              </TabsContent>
            )}

            {hasAnyPermission(["view_holidays", "manage_holidays"]) && (
              <TabsContent value="Holidays" className="space-y-6 m-0">
                <HolidaySettings disabled={!hasPermission("manage_holidays")} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </>
  );
}
