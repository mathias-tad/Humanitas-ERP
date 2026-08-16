import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  MoreVertical,
  Mail,
  Users,
  UserCheck,
  Clock,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { usePMS, TaskStatus } from "@/hooks/usePMS";
import { AddMemberModal } from "@/components/pms/AddMemberModal";

interface MemberFormData {
  id?: string;
  full_name: string;
  email: string;
  role: string;
  password?: string;
}

export default function PMSTeam() {
  const { useUsers, useTasks, useProjects, createUser, updateUser } = usePMS();

  const { data: users = [], isLoading: loadingUsers } = useUsers();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks({});
  const { data: projects = [] } = useProjects();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberFormData | null>(null);

  if (loadingUsers || loadingTasks) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Derive enhanced team member data
  const teamMembers = users.map(user => {
    const userTasks = tasks.filter(t => t.assignee_id === user.id);
    const tasksCompleted = userTasks.filter(t => t.status === TaskStatus.DONE).length;
    const tasksInProgress = userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;

    const userProjectIds = new Set(userTasks.map(t => t.project_id));
    projects.forEach(p => {
      if (p.members?.some(m => m.user.id === user.id)) {
        userProjectIds.add(p.id);
      }
    });

    // Handle full_name splitting for initials
    const nameParts = (user.full_name || 'Unknown').split(' ');
    const initials = nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : (nameParts[0]?.[0] || '?');

    return {
      id: user.id,
      name: user.full_name || 'Unnamed',
      initials: initials.toUpperCase(),
      email: user.email,
      role: user.role || "employee",
      projects: userProjectIds.size,
      tasksCompleted,
      tasksInProgress,
      status: "Active",
    };
  });

  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleAddMember = () => {
    setSelectedMember(null);
    setIsModalOpen(true);
  };

  const handleEditMember = (member: any) => {
    setSelectedMember({
      id: member.id,
      full_name: member.name,
      email: member.email,
      role: member.role,
    });
    setIsModalOpen(true);
  };

  const handleSaveMember = async (data: MemberFormData) => {
    try {
      if (selectedMember && selectedMember.id) {
        await updateUser.mutateAsync({ id: selectedMember.id, data: { full_name: data.full_name, email: data.email } });
      } else {
        await createUser.mutateAsync({
          full_name: data.full_name,
          email: data.email,
          password: data.password,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const teamStats = {
    total: teamMembers.length,
    active: teamMembers.length,
    away: 0,
    offline: 0,
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-gray-500 mt-1">
              Manage your team members and resources
            </p>
          </div>
          <button
            onClick={handleAddMember}
            className="px-4 py-2 !bg-primary !text-primary-foreground rounded-lg hover:!bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Members</p>
                <p className="text-2xl font-bold">{teamStats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold">{teamStats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Away</p>
                <p className="text-2xl font-bold">{teamStats.away}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gray-100">
                <Users className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Offline</p>
                <p className="text-2xl font-bold">{teamStats.offline}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="text-xl bg-blue-100 text-blue-700">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500`} />
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900">
                    {member.name}
                  </h3>
                  <p className="text-sm text-gray-500 capitalize">{member.role}</p>
                </div>

                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="truncate" title={member.email}>{member.email}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{member.projects}</p>
                      <p className="text-xs text-gray-500">Projects</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">{member.tasksCompleted}</p>
                      <p className="text-xs text-gray-500">Done</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600">{member.tasksInProgress}</p>
                      <p className="text-xs text-gray-500">WIP</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => handleEditMember(member)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No team members found matching your criteria.
          </div>
        )}
      </div>

      <AddMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMember}
        member={selectedMember}
      />
    </>
  );
}
