import { useState, useEffect, useRef } from "react";
import type { Conversation } from "../../types/messaging";
import { useMessaging } from "../../context/MessagingContext";
import { API_BASE_URL } from "../../config/api.config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ArrowLeft, Users, Megaphone, User, Edit2, Check, X, UserPlus,
    Trash2, ShieldCheck, ShieldOff, Loader2, Mail, Building, Camera
} from "lucide-react";
import { toast } from "sonner";

interface BasicUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role_name?: string;
}

interface ChatDetailViewProps {
    conversation: Conversation;
    currentUserId: string;
    onBack: () => void;
}

export function ChatDetailView({ conversation, currentUserId, onBack }: ChatDetailViewProps) {
    const { refreshConversations } = useMessaging();

    const isDirect = conversation.type === 'direct';
    const isGroup = conversation.type === 'group';
    const isChannel = conversation.type === 'channel' || conversation.type === 'broadcast';

    // Current user admin check
    const currentParticipant = conversation.participants?.find(p => p.userId === currentUserId);
    const isAdmin = !!currentParticipant?.isAdmin;

    // Editing states
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(conversation.name || "");
    const [description, setDescription] = useState(conversation.description || "");
    const [onlyAdminsCanPost, setOnlyAdminsCanPost] = useState(conversation.onlyAdminsCanPost ?? true);
    const [isSaving, setIsSaving] = useState(false);

    // Avatar upload states
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(conversation.avatarUrl || null);

    // Add Member states
    const [isAddingMembers, setIsAddingMembers] = useState(false);
    const [allUsers, setAllUsers] = useState<BasicUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Direct User info
    const otherParticipant = isDirect
        ? conversation.participants?.find(p => p.userId !== currentUserId)
        : null;

    useEffect(() => {
        setName(conversation.name || "");
        setDescription(conversation.description || "");
        setOnlyAdminsCanPost(conversation.onlyAdminsCanPost ?? true);
        setLocalAvatarUrl(conversation.avatarUrl || null);
    }, [conversation]);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type & size
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be smaller than 5MB');
            return;
        }

        // Optimistic preview
        const objectUrl = URL.createObjectURL(file);
        setLocalAvatarUrl(objectUrl);

        setIsUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversation.id}/avatar`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const updated = await res.json();
            setLocalAvatarUrl(updated.avatarUrl || null);
            toast.success('Profile picture updated');
            refreshConversations();
        } catch (err) {
            toast.error('Failed to upload picture');
            setLocalAvatarUrl(conversation.avatarUrl || null);
        } finally {
            setIsUploadingAvatar(false);
            // Reset input so same file can be re-selected
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    const handleSaveInfo = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversation.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    onlyAdminsCanPost: isChannel ? onlyAdminsCanPost : undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed to update");
            toast.success("Details updated successfully");
            setIsEditing(false);
            refreshConversations();
        } catch (err) {
            toast.error("Failed to update details");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const res = await fetch(`${API_BASE_URL}/users/list`, { credentials: 'include' });
            const data: BasicUser[] = await res.json();
            const existingMemberIds = new Set(conversation.participants?.map(p => p.userId));
            setAllUsers(data.filter(u => !existingMemberIds.has(u.id)));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleOpenAddMembers = () => {
        setIsAddingMembers(true);
        handleLoadUsers();
    };

    const handleAddSelectedMembers = async () => {
        if (selectedUserIds.length === 0) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversation.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userIds: selectedUserIds }),
            });
            if (!res.ok) throw new Error("Failed to add members");
            toast.success("Members added");
            setIsAddingMembers(false);
            setSelectedUserIds([]);
            refreshConversations();
        } catch (err) {
            toast.error("Failed to add members");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveMember = async (targetUserId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversation.id}/members/${targetUserId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error("Failed to remove member");
            toast.success("Member removed");
            refreshConversations();
        } catch (err) {
            toast.error("Failed to remove member");
        }
    };

    const handleToggleAdminRole = async (targetUserId: string, currentIsAdmin: boolean) => {
        const newRole = currentIsAdmin ? 'member' : 'admin';
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversation.id}/members/${targetUserId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) throw new Error("Failed to update member role");
            toast.success(currentIsAdmin ? "Admin role revoked" : "Promoted to Admin");
            refreshConversations();
        } catch (err) {
            toast.error("Failed to update role");
        }
    };

    // Full-screen avatar lightbox state
    const [showFullAvatarPreview, setShowFullAvatarPreview] = useState(false);

    // Resolve avatar URL for display (handle relative /uploads/ paths)
    const resolvedAvatarUrl = (() => {
        let url = localAvatarUrl;
        if (!url && isDirect && otherParticipant?.user?.avatar_url) {
            url = otherParticipant.user.avatar_url;
        }
        if (!url) return undefined;
        if (url.startsWith('blob:') || url.startsWith('http')) return url;
        return `${API_BASE_URL.replace('/api/v1', '')}${url}`;
    })();

    return (
        <div className="w-full h-full flex flex-col bg-background font-sans relative overflow-hidden">
            {/* Picture viewer overlay (contained strictly within the chat area!) */}
            {showFullAvatarPreview && (
                <div
                    className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200"
                    onClick={() => setShowFullAvatarPreview(false)}
                >
                    <button
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
                        onClick={() => setShowFullAvatarPreview(false)}
                        title="Close preview"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center gap-3 w-full max-h-full" onClick={e => e.stopPropagation()}>
                        <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-black/40 flex items-center justify-center max-h-[400px] max-w-[90%]">
                            {resolvedAvatarUrl ? (
                                <img
                                    src={resolvedAvatarUrl}
                                    alt={conversation.name || 'Profile Picture'}
                                    className="max-h-[360px] max-w-full object-contain rounded-xl"
                                />
                            ) : (
                                <div className="w-44 h-44 flex items-center justify-center bg-primary/20 text-primary font-bold text-5xl rounded-xl">
                                    {conversation.name?.[0] || 'C'}
                                </div>
                            )}
                        </div>
                        <div className="text-center text-white font-semibold text-sm drop-shadow-md px-2 truncate max-w-[280px]">
                            {conversation.name}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
            />

            {/* Header */}
            <div className="px-4 py-3 border-b bg-card flex items-center justify-between shrink-0 h-14">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-bold text-sm">
                        {isDirect ? 'Contact Info' : isChannel ? 'Channel Details' : 'Group Details'}
                    </span>
                </div>

                {!isDirect && isAdmin && !isEditing && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setIsEditing(true)}>
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="p-5 space-y-6 max-w-md mx-auto">
                    {/* Centered Avatar Banner */}
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="relative group">
                            {/* Click avatar to open Telegram-style full-screen picture preview! */}
                            <div
                                className="cursor-pointer transition-transform active:scale-95 group-hover:opacity-90"
                                onClick={() => setShowFullAvatarPreview(true)}
                                title="Click to view full profile picture"
                            >
                                <Avatar className="w-20 h-20 border-2 border-primary/20 shadow-md">
                                    {resolvedAvatarUrl && <AvatarImage src={resolvedAvatarUrl} alt={conversation.name || 'avatar'} className="object-cover" />}
                                    <AvatarFallback className={`text-2xl font-bold ${
                                        isChannel ? 'bg-purple-500/10 text-purple-600' :
                                        isGroup ? 'bg-green-500/10 text-green-600' :
                                        'bg-primary/10 text-primary'
                                    }`}>
                                        {conversation.name?.[0] || 'C'}
                                    </AvatarFallback>
                                </Avatar>
                            </div>

                            {/* Admin Camera Badge for changing picture */}
                            {!isDirect && isAdmin ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        avatarInputRef.current?.click();
                                    }}
                                    disabled={isUploadingAvatar}
                                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground border-2 border-background shadow-md hover:scale-110 transition-transform cursor-pointer"
                                    title="Change profile picture"
                                >
                                    {isUploadingAvatar
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Camera className="w-3.5 h-3.5" />
                                    }
                                </button>
                            ) : (
                                <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-background border shadow-xs pointer-events-none">
                                    {isChannel ? <Megaphone className="w-3.5 h-3.5 text-purple-600" /> :
                                     isGroup ? <Users className="w-3.5 h-3.5 text-green-600" /> :
                                     <User className="w-3.5 h-3.5 text-primary" />}
                                </span>
                            )}
                        </div>

                        {/* Upload hint for admins */}
                        {!isDirect && isAdmin && (
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={isUploadingAvatar}
                                className="text-[11px] text-primary/70 hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            >
                                <Camera className="w-3 h-3" />
                                {isUploadingAvatar ? 'Uploading...' : 'Change picture'}
                            </button>
                        )}

                        {/* Title / Edit view */}
                        {isEditing ? (
                            <div className="w-full space-y-3 pt-2">
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Name"
                                    className="text-center font-bold"
                                />
                                <Textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Description..."
                                    rows={2}
                                    className="text-xs resize-none"
                                />
                                {isChannel && (
                                    <div className="flex items-center space-x-2 border p-2.5 rounded-md bg-purple-500/5 text-left">
                                        <Checkbox
                                            id="editOnlyAdmins"
                                            checked={onlyAdminsCanPost}
                                            onCheckedChange={checked => setOnlyAdminsCanPost(!!checked)}
                                        />
                                        <label htmlFor="editOnlyAdmins" className="text-xs font-medium cursor-pointer">
                                            Only Admins Can Post
                                        </label>
                                    </div>
                                )}
                                <div className="flex gap-2 justify-center pt-1">
                                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleSaveInfo} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-lg font-bold">{conversation.name}</h2>
                                {conversation.description && (
                                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">{conversation.description}</p>
                                )}
                                {!isDirect && (
                                    <p className="text-xs font-medium text-primary mt-1">
                                        {conversation.participants?.length || 0} members
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Direct Contact Profile Details */}
                    {isDirect && (
                        <div className="bg-card border rounded-xl p-4 space-y-3 shadow-2xs">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">User Details</h3>
                            <div className="flex items-center gap-3 text-xs">
                                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-foreground">{otherParticipant?.user?.email || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-foreground">Humanitas Employee</span>
                            </div>
                        </div>
                    )}

                    {/* Group/Channel Members List */}
                    {!isDirect && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Members ({conversation.participants?.length || 0})
                                </h3>
                                {isAdmin && !isAddingMembers && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1" onClick={handleOpenAddMembers}>
                                        <UserPlus className="w-3.5 h-3.5" /> Add Members
                                    </Button>
                                )}
                            </div>

                            {/* Add Members Inline Panel */}
                            {isAddingMembers && (
                                <div className="p-3 border rounded-xl bg-card space-y-3">
                                    <div className="flex items-center justify-between text-xs font-semibold">
                                        <span>Select colleagues to add</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIsAddingMembers(false)}>
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                    <Input
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                    <div className="max-h-36 overflow-y-auto divide-y border rounded-md">
                                        {isLoadingUsers ? (
                                            <div className="p-3 text-center text-xs text-muted-foreground">Loading...</div>
                                        ) : allUsers.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-muted-foreground">No available users</div>
                                        ) : (
                                            allUsers
                                                .filter(u => u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .map(u => {
                                                    const isSel = selectedUserIds.includes(u.id);
                                                    return (
                                                        <div
                                                            key={u.id}
                                                            className="p-2 flex items-center gap-2 text-xs hover:bg-accent cursor-pointer"
                                                            onClick={() => setSelectedUserIds(prev => isSel ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                                        >
                                                            <Checkbox checked={isSel} />
                                                            <span className="font-medium truncate">{u.full_name}</span>
                                                        </div>
                                                    );
                                                })
                                        )}
                                    </div>
                                    <Button size="sm" className="w-full h-8 text-xs" onClick={handleAddSelectedMembers} disabled={selectedUserIds.length === 0}>
                                        Add Selected ({selectedUserIds.length})
                                    </Button>
                                </div>
                            )}

                            {/* Participants List */}
                            <div className="bg-card border rounded-xl divide-y overflow-hidden shadow-2xs">
                                {conversation.participants?.map(p => {
                                    const isSelf = p.userId === currentUserId;
                                    return (
                                        <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs bg-muted">
                                                        {p.user?.full_name?.[0] || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="overflow-hidden">
                                                    <div className="font-semibold truncate flex items-center gap-1">
                                                        {p.user?.full_name || 'Member'}
                                                        {isSelf && <span className="text-[10px] text-muted-foreground font-normal">(You)</span>}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground truncate">{p.user?.email}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {p.isAdmin && (
                                                    <span className="bg-primary/10 text-primary font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                                {isAdmin && !isSelf && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`h-7 w-7 ${p.isAdmin ? 'text-amber-600 hover:text-amber-700' : 'text-muted-foreground hover:text-primary'}`}
                                                            onClick={() => handleToggleAdminRole(p.userId, !!p.isAdmin)}
                                                            title={p.isAdmin ? "Dismiss as Admin" : "Make Admin"}
                                                        >
                                                            {p.isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleRemoveMember(p.userId)}
                                                            title="Remove member"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
