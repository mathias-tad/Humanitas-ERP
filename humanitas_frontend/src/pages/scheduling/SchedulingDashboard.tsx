
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SchedulingAuditLogs } from './SchedulingAuditLogs';

import { SchedulerView } from '@/components/scheduling/SchedulerView';
import { ShiftManager } from '@/components/scheduling/ShiftManager';

// Placeholder components for future implementation

import { usePermissions } from '@/hooks/usePermissions';

export default function SchedulingDashboard() {
    const { hasPermission } = usePermissions();
    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Scheduling & Rostering</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage shifts, create patterns, and assign schedules to employees.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="roster" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="roster">Roster</TabsTrigger>
                    {(hasPermission("view_shifts") || hasPermission("manage_shifts") || hasPermission("view_roster") || hasPermission("manage_roster")) && (
                        <TabsTrigger value="shifts">Shifts & Patterns</TabsTrigger>
                    )}
                    <TabsTrigger value="audit">History & Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="roster" className="mt-6">
                    <SchedulerView />
                </TabsContent>

                {(hasPermission("view_shifts") || hasPermission("manage_shifts") || hasPermission("view_roster") || hasPermission("manage_roster")) && (
                    <TabsContent value="shifts" className="mt-6">
                        <ShiftManager />
                    </TabsContent>
                )}

                <TabsContent value="audit" className="mt-6">
                    <SchedulingAuditLogs />
                </TabsContent>
            </Tabs>
        </div>
    );
}
