import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, Megaphone, User, Plus, Pin, PinOff } from "lucide-react";
import type { Conversation } from "../../types/messaging";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "../../config/api.config";

interface BasicUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role_name?: string;
}

interface ConversationListProps {
    conversations: Conversation[];
    searchQuery: string;
    isSearching: boolean;
    searchResults: BasicUser[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onStartChat: (userId: string) => void;
    onOpenCreateGroup?: () => void;
    onOpenCreateChannel?: () => void;
    onlineUsers?: Set<string>;
    currentUserId?: string;
}

type TabType = 'all' | 'direct' | 'group' | 'channel';

const PINNED_KEY = 'humanitas_pinned_convs';

function getPinned(): Set<string> {
    try {
        const raw = localStorage.getItem(PINNED_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
}

function savePinned(pinned: Set<string>) {
    localStorage.setItem(PINNED_KEY, JSON.stringify([...pinned]));
}

export function ConversationList({
    conversations,
    searchQuery,
    isSearching,
    searchResults,
    activeConversationId,
    onSelectConversation,
    onStartChat,
    onOpenCreateGroup,
    onOpenCreateChannel,
    onlineUsers,
    currentUserId
}: ConversationListProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(getPinned);
    const [contextMenuId, setContextMenuId] = useState<string | null>(null);

    const togglePin = (convId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPinnedIds(prev => {
            const next = new Set(prev);
            if (next.has(convId)) next.delete(convId);
            else next.add(convId);
            savePinned(next);
            return next;
        });
        setContextMenuId(null);
    };

    // Tab filtering
    const filterByTab = (list: Conversation[]) => {
        switch (activeTab) {
            case 'direct': return list.filter(c => c.type === 'direct');
            case 'group': return list.filter(c => c.type === 'group');
            case 'channel': return list.filter(c => c.type === 'channel' || c.type === 'broadcast');
            default: return list;
        }
    };

    const getUnreadForTab = (tab: TabType) => {
        let subset = conversations;
        if (tab === 'direct') subset = conversations.filter(c => c.type === 'direct');
        if (tab === 'group') subset = conversations.filter(c => c.type === 'group');
        if (tab === 'channel') subset = conversations.filter(c => c.type === 'channel' || c.type === 'broadcast');
        return subset.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    };

    const filtered = filterByTab(
        conversations.filter(c =>
            c.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    // Split pinned vs unpinned, maintaining recency order within each group
    const { pinned, unpinned } = useMemo(() => {
        const p = filtered.filter(c => pinnedIds.has(c.id));
        const u = filtered.filter(c => !pinnedIds.has(c.id));
        return { pinned: p, unpinned: u };
    }, [filtered, pinnedIds]);

    const allSorted = [...pinned, ...unpinned];

    const isOnline = (userId: string) => onlineUsers?.has(userId);

    const formatTime = (raw?: string) => {
        if (!raw) return '';
        try {
            const dt = new Date(raw);
            const now = new Date();
            const isToday = dt.toDateString() === now.toDateString();
            if (isToday) return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch { return ''; }
    };

    const resolveAvatar = (conv: Conversation) => {
        let url = conv.avatarUrl;
        if (!url && conv.type === 'direct' && currentUserId) {
            const other = conv.participants?.find(p => p.userId !== currentUserId);
            url = other?.user?.avatar_url;
        }
        if (!url) return undefined;
        if (url.startsWith('http') || url.startsWith('blob:')) return url;
        return `${API_BASE_URL.replace('/api/v1', '')}${url}`;
    };

    const renderConversation = (conv: Conversation) => {
        const isDirect = conv.type === 'direct';
        const isGroup = conv.type === 'group';
        const isChannel = conv.type === 'channel' || conv.type === 'broadcast';
        const isPinned = pinnedIds.has(conv.id);

        const otherParticipant = isDirect && currentUserId
            ? conv.participants?.find(p => p.userId !== currentUserId)
            : null;
        const showOnline = otherParticipant ? isOnline(otherParticipant.userId) : false;
        const hasUnread = (conv.unreadCount || 0) > 0;
        const avatarSrc = resolveAvatar(conv);

        return (
            <div
                key={conv.id}
                className={`p-3 border-b cursor-pointer transition-all flex gap-3 items-center relative group ${
                    activeConversationId === conv.id ? 'bg-accent/80 border-l-4 border-l-primary' : 'hover:bg-accent/40'
                } ${isPinned ? 'bg-primary/3' : ''}`}
                onClick={() => {
                    onSelectConversation(conv.id);
                    setContextMenuId(null);
                }}
                onContextMenu={e => {
                    e.preventDefault();
                    setContextMenuId(contextMenuId === conv.id ? null : conv.id);
                }}
            >
                {/* Pin indicator stripe */}
                {isPinned && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400" />
                )}

                <div className="relative shrink-0">
                    <Avatar className="w-10 h-10 border bg-background">
                        {avatarSrc && <AvatarImage src={avatarSrc} alt={conv.name || ''} className="object-cover" />}
                        <AvatarFallback className={`font-semibold ${
                            isChannel ? 'bg-purple-500/10 text-purple-600' :
                            isGroup ? 'bg-green-500/10 text-green-600' :
                            'bg-primary/10 text-primary'
                        }`}>
                            {conv.name?.[0] || 'C'}
                        </AvatarFallback>
                    </Avatar>
                    {showOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 border-2 border-background rounded-full bg-green-500" />
                    )}
                    {isChannel && (
                        <span className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-0.5">
                            <Megaphone className="w-2.5 h-2.5" />
                        </span>
                    )}
                    {isGroup && (
                        <span className="absolute -bottom-1 -right-1 bg-green-600 text-white rounded-full p-0.5">
                            <Users className="w-2.5 h-2.5" />
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <span className={`text-sm truncate flex items-center gap-1 ${hasUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'}`}>
                            {isPinned && <Pin className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                            {conv.name || 'Conversation'}
                        </span>
                        <span className={`text-[10px] whitespace-nowrap ml-2 ${hasUnread ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                            {formatTime(conv.lastMessageAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {conv.lastMessage
                                ? (conv.lastMessage.senderId === currentUserId ? 'You: ' : '') + conv.lastMessage.content
                                : 'No messages yet'
                            }
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                            {hasUnread && (
                                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                    {conv.unreadCount! > 99 ? '99+' : conv.unreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pin/Unpin button on hover */}
                <button
                    className={`absolute right-2 top-2 p-1 rounded-full transition-all ${
                        isPinned
                            ? 'opacity-100 bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                            : 'opacity-0 group-hover:opacity-100 bg-muted text-muted-foreground hover:text-amber-600'
                    }`}
                    onClick={(e) => togglePin(conv.id, e)}
                    title={isPinned ? 'Unpin chat' : 'Pin chat'}
                >
                    {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>

                {/* Right-click context menu */}
                {contextMenuId === conv.id && (
                    <div
                        className="absolute right-2 top-8 z-50 bg-card border rounded-lg shadow-lg text-xs py-1 min-w-[140px] animate-in fade-in duration-100"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                            onClick={(e) => togglePin(conv.id, e)}
                        >
                            {isPinned ? <PinOff className="w-3.5 h-3.5 text-amber-500" /> : <Pin className="w-3.5 h-3.5 text-amber-500" />}
                            {isPinned ? 'Unpin chat' : 'Pin chat'}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className="flex flex-col h-full overflow-hidden"
            onClick={() => setContextMenuId(null)}
        >
            {/* Filter Pill Tabs */}
            {!searchQuery && (
                <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/20 shrink-0 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'all' as TabType, label: 'All', icon: null },
                        { id: 'direct' as TabType, label: 'Personal', icon: User },
                        { id: 'group' as TabType, label: 'Groups', icon: Users },
                        { id: 'channel' as TabType, label: 'Channels', icon: Megaphone },
                    ].map(tab => {
                        const unread = getUnreadForTab(tab.id);
                        const isSelected = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                    isSelected
                                        ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                                        : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                                }`}
                            >
                                {Icon && <Icon className="w-3 h-3" />}
                                <span>{tab.label}</span>
                                {unread > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${
                                        isSelected ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                                    }`}>
                                        {unread > 99 ? '99+' : unread}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Actions for Creating Group/Channel */}
            {!searchQuery && (onOpenCreateGroup || onOpenCreateChannel) && (
                <div className="flex gap-2 p-2 border-b bg-background">
                    {onOpenCreateGroup && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={onOpenCreateGroup}
                        >
                            <Plus className="w-3 h-3" /> New Group
                        </Button>
                    )}
                    {onOpenCreateChannel && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={onOpenCreateChannel}
                        >
                            <Plus className="w-3 h-3" /> New Channel
                        </Button>
                    )}
                </div>
            )}

            <ScrollArea className="flex-1">
                {/* Search Results (People) */}
                {searchQuery && (
                    <div className="p-2">
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            People & Colleagues
                        </div>
                        {isSearching ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : searchResults.length > 0 ? (
                            searchResults.map(u => (
                                <div
                                    key={u.id}
                                    className="p-2 rounded-md hover:bg-accent cursor-pointer flex gap-3 items-center group transition-colors"
                                    onClick={() => onStartChat(u.id)}
                                >
                                    <div className="relative">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                {u.full_name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        {isOnline(u.id) && (
                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-background rounded-full bg-green-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-medium text-sm truncate">{u.full_name}</div>
                                        <div className="text-xs text-muted-foreground truncate">{u.role_name || u.email}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-2 text-sm text-center text-muted-foreground">No matching users found</div>
                        )}
                        <div className="my-2 border-t" />
                    </div>
                )}

                {/* Conversation List */}
                {allSorted.length === 0 && !searchQuery ? (
                    <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
                        <div className="p-3 rounded-full bg-muted/30 text-muted-foreground">
                            {activeTab === 'group' ? <Users className="w-6 h-6" /> :
                             activeTab === 'channel' ? <Megaphone className="w-6 h-6" /> :
                             <User className="w-6 h-6" />}
                        </div>
                        <span className="font-medium">No {activeTab === 'all' ? '' : activeTab} conversations yet</span>
                        <span className="text-xs max-w-[200px]">Search colleagues or create a group/channel to start messaging</span>
                    </div>
                ) : (
                    <>
                        {/* Pinned section label */}
                        {pinned.length > 0 && (
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 bg-muted/10 border-b">
                                <Pin className="w-2.5 h-2.5 text-amber-500" /> Pinned
                            </div>
                        )}
                        {pinned.map(renderConversation)}

                        {/* All/Recent section label */}
                        {pinned.length > 0 && unpinned.length > 0 && (
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10 border-b">
                                Recent
                            </div>
                        )}
                        {unpinned.map(renderConversation)}
                    </>
                )}
            </ScrollArea>
        </div>
    );
}
