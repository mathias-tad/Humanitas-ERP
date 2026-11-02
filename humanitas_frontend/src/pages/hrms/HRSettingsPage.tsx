import { useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Calculator,
  Users,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { HRMSettings } from "@/components/settings/HRMSettings";
import { PayrollSettings } from "@/components/settings/PayrollSettings";
import { CategorySettings } from "@/components/settings/CategorySettings";
import { ActingSettings } from "@/components/settings/ActingSettings";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/design-system/PageHeader";

const hrSettingsTabs = [
  { value: "Policies", label: "Leave & Workweek", icon: Briefcase, permissions: ["view_hrm_settings", "edit_hrm_settings"] },
  { value: "Categories", label: "Employee Categories", icon: Users, permissions: ["view_hrm_settings", "edit_hrm_settings"] },
  { value: "Acting", label: "Acting Assignments", icon: UserPlus, permissions: ["view_payroll_settings", "edit_payroll_settings"] },
  { value: "Payroll", label: "Payroll & Statutory", icon: Calculator, permissions: ["view_payroll_settings", "edit_payroll_settings"] },
];

export default function HRSettingsPage() {
  const [searchParams] = useSearchParams();
  const { hasAnyPermission } = useAuth();

  const accessibleTabs = hrSettingsTabs.filter(tab => hasAnyPermission(tab.permissions));
  const requestedTab = searchParams.get("tab") || "Policies";
  const defaultTab = accessibleTabs.some(t => t.value === requestedTab)
    ? requestedTab
    : accessibleTabs[0]?.value || "Policies";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto animate-fadeIn">
      <PageHeader
        title="Human Capital (HR) Settings"
        description="Configure organizational leave policies, probation rules, employee grading categories, and statutory payroll formulas."
        badge={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <ShieldCheck className="h-3 w-3" />
            HRMS Module
          </span>
        }
      />

      <Separator className="my-2" />

      <Tabs defaultValue={defaultTab} className="flex flex-col md:flex-row gap-8">
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
          {hasAnyPermission(["view_hrm_settings", "edit_hrm_settings"]) && (
            <TabsContent value="Policies" className="space-y-6 m-0">
              <HRMSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_hrm_settings", "edit_hrm_settings"]) && (
            <TabsContent value="Categories" className="space-y-6 m-0">
              <CategorySettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_payroll_settings", "edit_payroll_settings"]) && (
            <TabsContent value="Acting" className="space-y-6 m-0">
              <ActingSettings />
            </TabsContent>
          )}

          {hasAnyPermission(["view_payroll_settings", "edit_payroll_settings"]) && (
            <TabsContent value="Payroll" className="space-y-6 m-0">
              <PayrollSettings />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
