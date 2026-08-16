import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Crown } from "lucide-react";
import { usePMS } from "@/hooks/usePMS";
import type { Team } from "@/hooks/usePMS";

interface TeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    team?: Team | null;
}

export function TeamModal({ isOpen, onClose, team }: TeamModalProps) {
    const { useUsers, createTeam, updateTeam, addTeamMember, removeTeamMember } = usePMS();
    const { data: allUsers = [] } = useUsers();

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        leader_id: "",
    });
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    useEffect(() => {
        if (team) {
            setFormData({
                name: team.name,
                description: team.description || "",
                leader_id: team.leader_id || "",
            });
            setSelectedMembers(team.members?.map((m) => m.user.id) || []);
        } else {
            setFormData({ name: "", description: "", leader_id: "" });
            setSelectedMembers([]);
        }
    }, [team, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (team) {
                await updateTeam.mutateAsync({
                    id: team.id,
                    data: {
                        ...formData,
                        leader_id: formData.leader_id || undefined,
                    },
                });
                // Handle member changes
                const existingMemberIds = team.members?.map((m) => m.user.id) || [];
                const toAdd = selectedMembers.filter((id) => !existingMemberIds.includes(id));
                const toRemove = existingMemberIds.filter((id) => !selectedMembers.includes(id));

                for (const userId of toAdd) {
                    await addTeamMember.mutateAsync({ teamId: team.id, userId });
                }
                for (const userId of toRemove) {
                    await removeTeamMember.mutateAsync({ teamId: team.id, userId });
                }
            } else {
                await createTeam.mutateAsync({
                    ...formData,
                    leader_id: formData.leader_id || undefined,
                    member_ids: selectedMembers,
                });
            }
            onClose();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleMember = (userId: string) => {
        setSelectedMembers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const availableUsers = allUsers.filter((u) => !selectedMembers.includes(u.id));
    const selectedUsersList = allUsers.filter((u) => selectedMembers.includes(u.id));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{team ? "Edit Team" : "Create New Team"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Team Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Engineering Team"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Team purpose and responsibilities..."
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="leader">Team Leader</Label>
                        <Select
                            value={formData.leader_id}
                            onValueChange={(value) => setFormData({ ...formData, leader_id: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select leader (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {allUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Team Members</Label>

                        {/* Selected Members */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedUsersList.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm"
                                >
                                    {formData.leader_id === user.id && (
                                        <Crown className="h-3 w-3 text-amber-500" />
                                    )}
                                    <span>{user.full_name}</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleMember(user.id)}
                                        className="hover:bg-blue-100 rounded-full p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Members Dropdown */}
                        {availableUsers.length > 0 && (
                            <Select onValueChange={(value) => toggleMember(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Add member..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUsers.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarFallback className="text-xs">
                                                        {user.full_name?.[0] || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {user.full_name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="!bg-primary hover:!bg-primary/90 !text-primary-foreground"
                            disabled={createTeam.isPending || updateTeam.isPending}
                        >
                            {team ? "Save Changes" : "Create Team"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
