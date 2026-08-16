import { useState, useEffect } from "react";
import { useMessaging } from "../../context/MessagingContext";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/api.config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface BasicUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role_name?: string;
}

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (conversationId: string) => void;
}

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
    const { createConversation } = useMessaging();
    const { user: currentUser } = useAuth();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<BasicUser[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsLoadingUsers(true);
            fetch(`${API_BASE_URL}/users/list`, { credentials: 'include' })
                .then(res => res.json())
                .then((data: BasicUser[]) => {
                    setUsers(data.filter(u => u.id !== currentUser?.id));
                })
                .catch(err => console.error("Failed to load users", err))
                .finally(() => setIsLoadingUsers(false));
        } else {
            setName("");
            setDescription("");
            setSearchQuery("");
            setSelectedUserIds([]);
        }
    }, [isOpen, currentUser?.id]);

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Group name is required");
            return;
        }
        if (selectedUserIds.length === 0) {
            toast.error("Please select at least one member");
            return;
        }

        setIsSubmitting(true);
        try {
            const newConv = await createConversation({
                type: 'group',
                name: name.trim(),
                description: description.trim() || undefined,
                participantIds: selectedUserIds,
            });
            toast.success("Group created successfully");
            onSuccess(newConv.id);
            onClose();
        } catch (err) {
            toast.error("Failed to create group");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Users className="w-5 h-5 text-primary" />
                        Create New Group
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Details</label>
                        <Input
                            placeholder="Group Name (e.g. Design Team)"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                        <Textarea
                            placeholder="Description (optional)"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            className="resize-none text-sm"
                        />
                    </div>

                    {/* Selected members chips */}
                    {selectedUserIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 border rounded-md bg-muted/20">
                            {selectedUserIds.map(id => {
                                const selectedUser = users.find(u => u.id === id);
                                return (
                                    <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                                        <span>{selectedUser?.full_name}</span>
                                        <X className="w-3 h-3 cursor-pointer hover:opacity-80" onClick={() => toggleUser(id)} />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Member selection */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Add Members ({selectedUserIds.length} selected)
                            </label>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search colleagues..."
                                className="pl-9 h-9 text-sm"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                            {isLoadingUsers ? (
                                <div className="p-4 flex items-center justify-center text-xs text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading users...
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">No users found</div>
                            ) : (
                                filteredUsers.map(u => {
                                    const isSelected = selectedUserIds.includes(u.id);
                                    return (
                                        <div
                                            key={u.id}
                                            className="p-2 flex items-center gap-3 hover:bg-accent cursor-pointer transition-colors"
                                            onClick={() => toggleUser(u.id)}
                                        >
                                            <Checkbox checked={isSelected} onCheckedChange={() => toggleUser(u.id)} />
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>{u.full_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="text-sm font-medium truncate">{u.full_name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Create Group
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
