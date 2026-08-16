import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/config/api.config";
import {
    Activity,
    Target,
    UserCheck,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Timer,
    RefreshCcw,
    Wifi
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePMS } from "@/hooks/usePMS";

interface PerformanceOverviewProps {
    userId?: string;
    tenantId?: string;
    showTitle?: boolean;
}

export function PerformanceOverview({ userId, tenantId }: PerformanceOverviewProps) {
    const { useUserKPIs, useTenantKPIs } = usePMS();
    const { tenant } = useAuth();

    // Resolve tenantId: prop > tenant context
    const resolvedTenantId = tenantId || tenant?.id || '';

    const [isLive, setIsLive] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Conditional Fetching: Tenant vs User
    const userQuery = useUserKPIs(resolvedTenantId, userId || '');
    const tenantQuery = useTenantKPIs(resolvedTenantId);

    const { data: kpisRaw, isLoading, refetch, isFetching } = tenantId ? tenantQuery : userQuery;

    // WebSocket for Live Updates
    useEffect(() => {
        if (!isLive) return;

        const socketUrl = SOCKET_URL || 'http://localhost:3001';

        const socket = io(socketUrl + '/notifications', {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

        socket.on('newNotification', (data: any) => {
            if (data?.type === 'pms-kpi-update') {
                refetch();
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [isLive, refetch]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6 h-48 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </CardContent>
            </Card>
        );
    }

    if (!kpisRaw) {
        return null;
    }

    // Handle nested data structure from API response { status: 'success', data: ... }
    const kpis = kpisRaw.data || kpisRaw;

    // Safe defaults
    const finalScore = kpis.final_score || 0;
    const systemScore = kpis.system_score || 0;
    const manualScore = kpis.manual_score || 0;

    const weights = kpis.weights || { system: 50, manual: 50 };
    const completionRate = kpis.completion_rate || 0;
    const onTimeRate = kpis.on_time_delivery_rate || 0;
    const avgDuration = kpis.average_task_duration_hours || 0;
    const overdueCount = kpis.overdue_tasks_count || 0;

    // Color logic for score
    const getScoreColor = (score: number) => {
        if (score >= 90) return "text-green-600";
        if (score >= 70) return "text-blue-600";
        if (score >= 50) return "text-orange-600";
        return "text-red-600";
    };

    const getProgressColor = (score: number) => {
        if (score >= 90) return "bg-green-600";
        if (score >= 70) return "bg-primary";
        if (score >= 50) return "bg-orange-600";
        return "bg-red-600";
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            Performance Score
                        </CardTitle>
                        <CardDescription>
                            Combined score based on system metrics and manual reviews
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Controls */}
                        <div className="flex items-center gap-2 mr-4">
                            <Switch
                                id="live-mode"
                                checked={isLive}
                                onCheckedChange={setIsLive}
                            />
                            <Label htmlFor="live-mode" className={`text-xs flex items-center gap-1 ${isLive ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                <Wifi className="h-3 w-3" />
                                {isLive ? 'Live' : 'Off'}
                            </Label>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing || isFetching}
                            className="h-8 gap-2"
                        >
                            <RefreshCcw className={`h-3 w-3 ${(isRefreshing || isFetching) ? 'animate-spin' : ''}`} />
                            {isRefreshing || isFetching ? 'Refreshing...' : 'Refresh'}
                        </Button>

                        <div className={`text-4xl font-bold ml-4 ${getScoreColor(finalScore)}`}>
                            {finalScore}%
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-8">
                {/* Score Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* System Score */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700 flex items-center gap-2">
                                <Target className="h-4 w-4 text-blue-500" />
                                System KPIs ({weights.system}%)
                            </span>
                            <span className="font-bold text-gray-900">{systemScore}%</span>
                        </div>
                        <Progress value={systemScore} className="h-2" indicatorClassName={getProgressColor(systemScore)} />
                        <p className="text-xs text-gray-400">
                            Calculated from task completion, timeliness, and workload.
                        </p>
                    </div>

                    {/* Manual Score */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700 flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-purple-500" />
                                Manager Review ({weights.manual}%)
                            </span>
                            <span className="font-bold text-gray-900">{manualScore}%</span>
                        </div>
                        <Progress value={manualScore} className="h-2" indicatorClassName={getProgressColor(manualScore)} />
                        <p className="text-xs text-gray-400">
                            Average score from manual performance evaluations.
                        </p>
                    </div>
                </div>

                {/* Detailed Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Completion
                        </div>
                        <div className="text-xl font-bold text-gray-900">{completionRate}%</div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <Clock className="h-4 w-4 text-blue-500" />
                            On-Time
                        </div>
                        <div className="text-xl font-bold text-gray-900">{onTimeRate}%</div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <Timer className="h-4 w-4 text-orange-500" />
                            Avg Duration
                        </div>
                        <div className="text-xl font-bold text-gray-900">{avgDuration}h</div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Overdue
                        </div>
                        <div className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdueCount}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
