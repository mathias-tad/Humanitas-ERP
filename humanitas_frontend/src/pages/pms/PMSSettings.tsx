import { useEffect, useState } from "react";
import { usePMS } from "@/hooks/usePMS";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import type { PMSSettings } from "@/hooks/usePMS";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskSettings } from "@/components/settings/TaskSettings";
import { KPISettings } from "@/components/settings/KPISettings";
import { useSearchParams } from "react-router-dom";

export default function PMSSettingsPage() {
    const { usePMSSettings, updateSettings } = usePMS();
    const { data: settings, isLoading } = usePMSSettings();
    const [searchParams, setSearchParams] = useSearchParams();

    const activeTab = searchParams.get("tab") || "general";

    const [formData, setFormData] = useState<PMSSettings>({
        enable_budget_tracking: false,
        enable_hr_integration: true,
        enable_payroll_integration: false,
        enable_time_tracking: true,
        default_task_time_estimate: 8,
        kpi_include_completion_rate: true,
        kpi_include_on_time_rate: true,
        kpi_include_avg_duration: true,
        kpi_include_overdue_count: true,
    });

    useEffect(() => {
        if (settings) {
            setFormData(settings);
        }
    }, [settings]);

    const handleToggle = (key: keyof PMSSettings) => {
        setFormData((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleChange = (key: keyof PMSSettings, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleSave = async () => {
        try {
            await updateSettings.mutateAsync(formData);
        } catch (error) {
            console.error("Failed to save settings", error);
        }
    };

    const handleTabChange = (value: string) => {
        setSearchParams({ tab: value });
    };

    if (isLoading) {
        return (
            <div className="flex w-full h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">PMS Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Configure Project Management System modules, workflows, and performance metrics.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-lg mb-8">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Module Configuration</CardTitle>
                            <CardDescription>
                                Enable or disable specific features for your tenant.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="budget">Budget Tracking</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Track project budgets and actual costs.
                                    </p>
                                </div>
                                <Switch
                                    id="budget"
                                    checked={formData.enable_budget_tracking}
                                    onCheckedChange={() => handleToggle("enable_budget_tracking")}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="hr">HR Integration</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Link PMS users with HR employee profiles.
                                    </p>
                                </div>
                                <Switch
                                    id="hr"
                                    checked={formData.enable_hr_integration}
                                    onCheckedChange={() => handleToggle("enable_hr_integration")}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="payroll">Payroll Integration</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Integrate time logs with payroll processing.
                                    </p>
                                </div>
                                <Switch
                                    id="payroll"
                                    checked={formData.enable_payroll_integration}
                                    onCheckedChange={() => handleToggle("enable_payroll_integration")}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="time">Time Tracking</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Allow users to log time and use timers on tasks.
                                    </p>
                                </div>
                                <Switch
                                    id="time"
                                    checked={formData.enable_time_tracking}
                                    onCheckedChange={() => handleToggle("enable_time_tracking")}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>KPI Dashboard Configuration</CardTitle>
                            <CardDescription>
                                Select which metrics to display in the main PMS dashboard.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="kpi_completion">Task Completion Rate</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Percentage of completed tasks vs total assigned.
                                    </p>
                                </div>
                                <Switch
                                    id="kpi_completion"
                                    checked={formData.kpi_include_completion_rate ?? true}
                                    onCheckedChange={() => handleToggle("kpi_include_completion_rate")}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="kpi_ontime">On-Time Rate</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Percentage of tasks completed before due date.
                                    </p>
                                </div>
                                <Switch
                                    id="kpi_ontime"
                                    checked={formData.kpi_include_on_time_rate ?? true}
                                    onCheckedChange={() => handleToggle("kpi_include_on_time_rate")}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="kpi_duration">Average Duration</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Average actual hours spend on completed tasks.
                                    </p>
                                </div>
                                <Switch
                                    id="kpi_duration"
                                    checked={formData.kpi_include_avg_duration ?? true}
                                    onCheckedChange={() => handleToggle("kpi_include_avg_duration")}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="kpi_overdue">Overdue Count</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Number of active tasks past their due date.
                                    </p>
                                </div>
                                <Switch
                                    id="kpi_overdue"
                                    checked={formData.kpi_include_overdue_count ?? true}
                                    onCheckedChange={() => handleToggle("kpi_include_overdue_count")}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Defaults</CardTitle>
                            <CardDescription>
                                Set default values for new tasks and projects.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="estimate">Default Task Estimate (Hours)</Label>
                                <Input
                                    type="number"
                                    id="estimate"
                                    value={formData.default_task_time_estimate}
                                    onChange={(e) => handleChange("default_task_time_estimate", parseFloat(e.target.value))}
                                    step={0.5}
                                    min={0}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Initial estimated hours when creating a new task.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSave}
                            className="gap-2"
                            disabled={updateSettings.isPending}
                        >
                            {updateSettings.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="workflow" className="space-y-6">
                    <TaskSettings />
                </TabsContent>

                <TabsContent value="performance" className="space-y-6">
                    <KPISettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
