import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Plus,
    Search,
    Users,
    Crown,
    Trash2,
    Edit,
    Loader2,
    BarChart3,
} from "lucide-react";
import { usePMS } from "@/hooks/usePMS";
import type { Team } from "@/hooks/usePMS";
import { TeamModal } from "@/components/pms/TeamModal";
import { Link } from "react-router-dom";

export default function PMSTeams() {
    const { useTeams, deleteTeam } = usePMS();
    const { data: teams = [], isLoading } = useTeams();

    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const filteredTeams = teams.filter((team) =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateTeam = () => {
        setSelectedTeam(null);
        setIsModalOpen(true);
    };

    const handleEditTeam = (team: Team) => {
        setSelectedTeam(team);
        setIsModalOpen(true);
    };

    const handleDeleteTeam = async (id: string) => {
        if (confirm("Are you sure you want to delete this team?")) {
            await deleteTeam.mutateAsync(id);
        }
    };

    return (
        <>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
                        <p className="text-gray-500 mt-1">
                            Manage your teams and team members
                        </p>
                    </div>
                    <Button
                        onClick={handleCreateTeam}
                        className="!bg-primary hover:!bg-primary/90 !text-primary-foreground"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Team
                    </Button>
                </div>

                {/* Search */}
                <Card>
                    <CardContent className="py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search teams..."
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Teams Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTeams.map((team) => (
                        <Card
                            key={team.id}
                            className="hover:shadow-lg transition-shadow group relative"
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80">
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{team.name}</CardTitle>
                                            <p className="text-sm text-gray-500">
                                                {team.members?.length || 0} members
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditTeam(team)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => handleDeleteTeam(team.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {team.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                        {team.description}
                                    </p>
                                )}

                                {/* Team Leader */}
                                {team.leader && (
                                    <div className="flex items-center gap-2 mb-4 p-2 bg-amber-50 rounded-lg">
                                        <Crown className="h-4 w-4 text-amber-600" />
                                        <span className="text-sm font-medium text-amber-800">
                                            {team.leader.full_name}
                                        </span>
                                    </div>
                                )}

                                {/* Members Preview */}
                                <div className="flex items-center -space-x-2">
                                    {team.members?.slice(0, 5).map((member) => (
                                        <Avatar
                                            key={member.user.id}
                                            className="h-8 w-8 border-2 border-white"
                                        >
                                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                {member.user.full_name?.[0] || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {(team.members?.length || 0) > 5 && (
                                        <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                                            <span className="text-xs text-gray-600">
                                                +{(team.members?.length || 0) - 5}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Dashboard Link */}
                                <Link
                                    to={`/pms/teams/${team.id}`}
                                    className="mt-4 flex items-center justify-center gap-2 w-full py-2 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    View Dashboard
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filteredTeams.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No teams found</p>
                        <Button
                            onClick={handleCreateTeam}
                            variant="outline"
                            className="mt-4"
                        >
                            Create your first team
                        </Button>
                    </div>
                )}
            </div>

            <TeamModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                team={selectedTeam}
            />
        </>
    );
}
