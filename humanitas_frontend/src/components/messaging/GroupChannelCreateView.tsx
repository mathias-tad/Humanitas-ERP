import { useState, useEffect, useRef } from "react";
import { useMessaging } from "../../context/MessagingContext";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/api.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ArrowLeft, Users, Megaphone, Search, Loader2, X, ShieldAlert, Check, Camera
} from "lucide-react";
import { toast } from "sonner";

interface BasicUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role_name?: string;
}

interface GroupChannelCreateViewProps {
    type: 'group' | 'channel';
    onBack: () => void;
    onSuccess: (conversationId: string) => void;
}

export function GroupChannelCreateView({ type, onBack, onSuccess }: GroupChannelCreateViewProps) {
    const { createConversation } = useMessaging();
    const { user: currentUser } = useAuth();

    const isChannel = type === 'channel';

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [onlyAdminsCanPost, setOnlyAdminsCanPost] = useState(isChannel);
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<BasicUser[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Avatar
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    useEffect(() => {
        setIsLoadingUsers(true);
        fetch(`${API_BASE_URL}/users/list`, { credentials: 'include' })
            .then(res => res.json())
            .then((data: BasicUser[]) => {
                setUsers(data.filter(u => u.id !== currentUser?.id));
            })
            .catch(err => console.error("Failed to load users", err))
            .finally(() => setIsLoadingUsers(false));
    }, [currentUser?.id]);

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
        if (avatarInputRef.current) avatarInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error(isChannel ? "Channel name is required" : "Group name is required");
            return;
        }

        setIsSubmitting(true);
        try {
            const newConv = await createConversation({
                type: type,
                name: name.trim(),
                description: description.trim() || undefined,
                participantIds: selectedUserIds,
                onlyAdminsCanPost: isChannel ? onlyAdminsCanPost : undefined,
            });

            // Upload avatar if one was selected
            if (avatarFile) {
                try {
                    const formData = new FormData();
                    formData.append('file', avatarFile);
                    await fetch(`${API_BASE_URL}/messaging/conversations/${newConv.id}/avatar`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    });
                } catch {
                    // Avatar upload failure is non-fatal
                    toast.warning('Created, but profile picture upload failed');
                }
            }

            toast.success(isChannel ? "Channel created!" : "Group created!");
            onSuccess(newConv.id);
        } catch (err) {
            toast.error(isChannel ? "Failed to create channel" : "Failed to create group");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-background font-sans">
            {/* Hidden avatar file input */}
            <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
            />

            {/* Header Bar */}
            <div className="px-4 py-3 border-b bg-card flex items-center justify-between shrink-0 h-14">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 font-bold text-sm">
                        {isChannel ? <Megaphone className="w-4 h-4 text-purple-600" /> : <Users className="w-4 h-4 text-green-600" />}
                        <span>{isChannel ? 'New Channel' : 'New Group'}</span>
                    </div>
                </div>

                <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !name.trim()} className="h-8 text-xs gap-1">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Create
                </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
                <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
                    {/* Avatar picker */}
                    <div className="flex flex-col items-center gap-2 py-2">
                        <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                            <Avatar className="w-20 h-20 border-2 border-dashed border-primary/30 shadow-sm">
                                {avatarPreview && <AvatarImage src={avatarPreview} className="object-cover" />}
                                <AvatarFallback className={`text-2xl font-bold ${
                                    isChannel ? 'bg-purple-500/10 text-purple-500' : 'bg-green-500/10 text-green-600'
                                }`}>
                                    {name?.[0]?.toUpperCase() || (isChannel ? '📢' : '👥')}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <span className="text-[11px] text-primary/60 hover:text-primary cursor-pointer flex items-center gap-1 transition-colors"
                            onClick={() => avatarInputRef.current?.click()}>
                            <Camera className="w-3 h-3" />
                            {avatarPreview ? 'Change picture' : 'Add profile picture'}
                        </span>
                    </div>

                    {/* Basic details */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {isChannel ? 'Channel Details' : 'Group Details'}
                        </label>
                        <Input
                            placeholder={isChannel ? "Channel Name (e.g. Company News)" : "Group Name (e.g. Marketing Team)"}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                        <Textarea
                            placeholder="Description / Purpose (optional)..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            className="resize-none text-xs"
                        />
                    </div>

                    {/* Channel specific permission toggle */}
                    {isChannel && (
                        <div className="flex items-center space-x-2 border p-3 rounded-xl bg-purple-500/5 border-purple-500/20">
                            <Checkbox
                                id="onlyAdmins"
                                checked={onlyAdminsCanPost}
                                onCheckedChange={checked => setOnlyAdminsCanPost(!!checked)}
                            />
                            <label htmlFor="onlyAdmins" className="text-xs text-foreground cursor-pointer flex flex-col">
                                <span className="font-semibold flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                                    Only Admins Can Post
                                </span>
                                <span className="text-muted-foreground text-[11px]">Subscribers receive broadcast announcements</span>
                            </label>
                        </div>
                    )}

                    {/* Selected members chips */}
                    {selectedUserIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 border rounded-xl bg-muted/20">
                            {selectedUserIds.map(id => {
                                const selectedUser = users.find(u => u.id === id);
                                return (
                                    <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                                        <span>{selectedUser?.full_name}</span>
                                        <X className="w-3 h-3 cursor-pointer hover:opacity-80" onClick={() => toggleUser(id)} />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Add members search */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between">
                            <span>Add {isChannel ? 'Subscribers' : 'Members'}</span>
                            <span>{selectedUserIds.length} selected</span>
                        </label>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search colleagues..."
                                className="pl-9 h-9 text-xs"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="border rounded-xl divide-y max-h-56 overflow-y-auto bg-card">
                            {isLoadingUsers ? (
                                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading colleagues...
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">No matching users found</div>
                            ) : (
                                filteredUsers.map(u => {
                                    const isSelected = selectedUserIds.includes(u.id);
                                    return (
                                        <div
                                            key={u.id}
                                            className="p-2.5 flex items-center gap-3 hover:bg-accent cursor-pointer text-xs"
                                            onClick={() => toggleUser(u.id)}
                                        >
                                            <Checkbox checked={isSelected} onCheckedChange={() => toggleUser(u.id)} />
                                            <Avatar className="h-7 w-7">
                                                <AvatarFallback className="text-xs">{u.full_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-semibold truncate">{u.full_name}</div>
                                                <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </form>
            </ScrollArea>
        </div>
    );
}
