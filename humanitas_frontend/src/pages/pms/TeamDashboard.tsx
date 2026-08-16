import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    ArrowLeft,
    Users,
    CheckCircle2,
    Clock,
    AlertTriangle,
    BarChart3,
    Crown,
    Loader2,
} from "lucide-react";
import { usePMS } from "@/hooks/usePMS";

export default function TeamDashboard() {
    const { id } = useParams<{ id: string }>();
    const { useTeam, useTeamDashboard } = usePMS();

    const { data: team, isLoading: loadingTeam } = useTeam(id || "");
    const { data: dashboard, isLoading: loadingDashboard } = useTeamDashboard(id || "");

    if (loadingTeam || loadingDashboard) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!team) {
        return (
            <div className="p-6 text-center">
                <p className="text-gray-500">Team not found</p>
                <Link to="/pms/teams">
                    <Button variant="outline" className="mt-4">
                        Back to Teams
                    </Button>
                </Link>
            </div>
        );
    }

    const stats = [
        {
            label: "Total Tasks",
            value: dashboard?.total_tasks || 0,
            icon: BarChart3,
            color: "bg-primary/10 text-primary",
        },
        {
            label: "Completed",
            value: dashboard?.completed_tasks || 0,
            icon: CheckCircle2,
            color: "bg-green-100 text-green-600",
        },
        {
            label: "In Progress",
            value: dashboard?.in_progress_tasks || 0,
            icon: Clock,
            color: "bg-amber-100 text-amber-600",
        },
        {
            label: "Blocked",
            value: dashboard?.blocked_tasks || 0,
            icon: AlertTriangle,
            color: "bg-red-100 text-red-600",
        },
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/pms/teams">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                    <p className="text-gray-500">{team.description}</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Card key={stat.label} className="py-4">
                        <CardContent className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{stat.label}</p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Progress Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Progress value={dashboard?.completion_rate || 0} className="flex-1" />
                        <span className="text-2xl font-bold text-primary">
                            {dashboard?.completion_rate || 0}%
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Team Members ({team.members?.length || 0})
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Leader First */}
                        {team.leader && (
                            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback className="bg-amber-100 text-amber-700 text-lg">
                                        {team.leader.full_name?.[0] || "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{team.leader.full_name}</span>
                                        <Crown className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <p className="text-sm text-amber-700">Team Leader</p>
                                </div>
                            </div>
                        )}

                        {/* Other Members */}
                        {team.members
                            ?.filter((m) => m.user.id !== team.leader_id)
                            .map((member) => (
                                <div
                                    key={member.user.id}
                                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                                >
                                    <Avatar className="h-12 w-12">
                                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                                            {member.user.full_name?.[0] || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <span className="font-semibold">{member.user.full_name}</span>
                                        <p className="text-sm text-gray-500 capitalize">{member.role}</p>
                                    </div>
                                </div>
                            ))}
                    </div>

                    {(!team.members || team.members.length === 0) && (
                        <p className="text-center text-gray-500 py-8">
                            No members in this team yet
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
