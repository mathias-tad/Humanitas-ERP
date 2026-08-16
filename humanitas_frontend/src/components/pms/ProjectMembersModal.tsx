import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, Plus, Search, Loader2 } from "lucide-react";
import { usePMS } from "@/hooks/usePMS";
import { toast } from "sonner";

// Local type definition to avoid import issues
interface Project {
    id: string;
    name: string;
    team_id?: string;
    team?: { id: string; name: string; leader_id: string };
    members?: { user: { id: string; full_name: string; email: string }; role: string; can_create_tasks: boolean }[];
}

interface ProjectMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
}

export function ProjectMembersModal({
    isOpen,
    onClose,
    project,
}: ProjectMembersModalProps) {
    const {
        useUsers,
        addProjectMember,
        removeProjectMember,
        updateProjectMember,
        useProject // To refresh project data
    } = usePMS();

    // Fetch latest project data to get up-to-date members
    const { data: freshProject, isLoading: loadingProject } = useProject(project.id, isOpen);
    const activeProject = freshProject || project;

    const { data: allUsers = [] } = useUsers();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    // Derived state
    const currentMemberIds = new Set(activeProject.members?.map(m => m.user.id) || []);
    const availableUsers = allUsers.filter(u => !currentMemberIds.has(u.id) &&
        (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleAddMember = async () => {
        if (!selectedUserId) return;
        try {
            await addProjectMember.mutateAsync({
                projectId: activeProject.id,
                userId: selectedUserId,
                data: {
                    role: 'member',
                    can_create_tasks: false // Default
                }
            });
            setSelectedUserId("");
            toast.success("Member added to project");
        } catch (error) {
            // Handled by hook error
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            await removeProjectMember.mutateAsync({
                projectId: activeProject.id,
                userId: userId
            });
            toast.success("Member removed");
        } catch (error) {
            // Handled by hook
        }
    };

    const handleToggleCreateTasks = async (memberUserId: string, currentValue: boolean) => {
        try {
            await updateProjectMember.mutateAsync({
                projectId: activeProject.id,
                userId: memberUserId,
                data: {
                    can_create_tasks: !currentValue
                }
            });
        } catch (error) {
            // Handled by hook
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Project Members</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Add Member Section */}
                    <div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-lg border">
                        <h4 className="font-medium text-sm text-gray-700">Add New Member</h4>
                        <div className="flex gap-2">
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select user..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <div className="p-2 sticky top-0 bg-white z-10 border-b mb-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
                                            <Input
                                                className="pl-8 h-8 text-sm"
                                                placeholder="Search users..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                onKeyDown={e => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                    {availableUsers.slice(0, 50).map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            <div className="flex flex-col text-left">
                                                <span>{user.full_name}</span>
                                                <span className="text-xs text-gray-500">{user.email}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {availableUsers.length === 0 && (
                                        <div className="p-2 text-sm text-gray-500 text-center">No users found</div>
                                    )}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAddMember} disabled={!selectedUserId || addProjectMember.isPending}>
                                {addProjectMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                <span className="ml-2">Add</span>
                            </Button>
                        </div>
                        {activeProject.team_id && (
                            <p className="text-xs text-amber-600 mt-1">
                                Note: This project belongs to a Team. You can only add members who are part of the "{activeProject.team?.name || 'Owning'}" Team.
                            </p>
                        )}
                    </div>

                    {/* Member List */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-gray-700">
                            Current Members ({activeProject.members?.length || 0})
                        </h4>

                        {loadingProject && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>}

                        <div className="space-y-2">
                            {activeProject.members?.map((member) => (
                                <div key={member.user.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border">
                                            <AvatarFallback className="text-xs bg-blue-50 text-blue-700">
                                                {member.user.full_name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">{member.user.full_name}</p>
                                            <p className="text-xs text-gray-500">{member.user.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Permission Toggle - Only for Team Projects */}
                                        {activeProject.team_id && (
                                            <div className="flex items-center gap-2 mr-2" title="Allow this member to create tasks in this restricted project">
                                                <Label htmlFor={`can-create-${member.user.id}`} className="text-xs text-gray-600 cursor-pointer">
                                                    Can Create Tasks
                                                </Label>
                                                <Switch
                                                    id={`can-create-${member.user.id}`}
                                                    checked={member.can_create_tasks}
                                                    onCheckedChange={() => handleToggleCreateTasks(member.user.id, member.can_create_tasks)}
                                                />
                                            </div>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemoveMember(member.user.id)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {(!activeProject.members || activeProject.members.length === 0) && (
                                <div className="text-center py-6 text-gray-500 text-sm italic">
                                    No members assigned yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
