import { useState, useEffect } from "react";
import { useMessaging } from "../../context/MessagingContext";
import { useAuth } from "../../context/AuthContext";
import {
    MessageCircle, X, Minimize2, Maximize2, Search, ArrowLeft,
    Users, Megaphone, MessageSquare, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { API_BASE_URL } from "../../config/api.config";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { ChatDetailView } from "./ChatDetailView";
import { GroupChannelCreateView } from "./GroupChannelCreateView";
import type { Conversation } from "../../types/messaging";

interface BasicUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role_name?: string;
}

type InternalViewMode = 'chat' | 'create_group' | 'create_channel' | 'detail';

export function ChatWidget() {
    const {
        isConnected,
        conversations,
        activeConversation,
        setActiveConversationId,
        messages,
        sendMessage,
        createConversation,
        isLoadingMessages,
        onlineUsers,
        typingUsers,
        emitTyping
    } = useMessaging();
    const { user } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // Side-by-side expanded mode
    const [viewMode, setViewMode] = useState<InternalViewMode>('chat');

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BasicUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Total unread count
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    // Search Users Effect
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            setIsSearching(true);
            fetch(`${API_BASE_URL}/users/list`, { credentials: 'include' })
                .then(res => res.json())
                .then((data: BasicUser[]) => {
                    const filtered = data.filter(u =>
                        u.id !== user?.id &&
                        (u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    );
                    setSearchResults(filtered);
                })
                .catch(console.error)
                .finally(() => setIsSearching(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, user?.id]);

    // Reset view mode when active conversation changes
    useEffect(() => {
        setViewMode('chat');
    }, [activeConversation?.id]);

    const handleSend = async (content: string, replyToId?: string) => {
        if (!activeConversation) return;
        try {
            await sendMessage({
                conversationId: activeConversation.id,
                content: content,
                messageType: 'text',
                replyToId: replyToId,
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleTyping = (isTyping: boolean) => {
        if (activeConversation) {
            emitTyping(activeConversation.id, isTyping);
        }
    };

    // Typing names calculation
    const typingUserNames: string[] = [];
    if (activeConversation && typingUsers.has(activeConversation.id)) {
        const typingUserIds = typingUsers.get(activeConversation.id) || new Set();
        typingUserIds.forEach(userId => {
            const participant = activeConversation.participants.find(p => p.userId === userId);
            if (participant && participant.user && userId !== user?.id) {
                typingUserNames.push(participant.user.full_name);
            }
        });
    }

    const handleStartChat = async (targetUserId: string) => {
        const existing = conversations.find(c =>
            c.type === 'direct' &&
            c.participants.some(p => p.userId === targetUserId)
        );

        if (existing) {
            setActiveConversationId(existing.id);
            setSearchQuery("");
            setViewMode('chat');
            return;
        }

        try {
            const newConv = await createConversation({
                type: 'direct',
                participantIds: [targetUserId]
            });
            setActiveConversationId(newConv.id);
            setSearchQuery("");
            setViewMode('chat');
        } catch (err) {
            console.error("Failed to start chat", err);
        }
    };

    const handleCreationSuccess = (newConvId: string) => {
        setActiveConversationId(newConvId);
        setViewMode('chat');
    };

    // Check if user can send messages in current conversation
    const isChannel = activeConversation?.type === 'channel' || activeConversation?.type === 'broadcast';
    const isChannelAdmin = activeConversation?.participants?.some(p => p.userId === user?.id && p.isAdmin);
    const canSendMessages = !isChannel || isChannelAdmin || !activeConversation?.onlyAdminsCanPost;

    const resolveAvatar = (conv?: Conversation | null) => {
        if (!conv) return undefined;
        let url = conv.avatarUrl;
        if (!url && conv.type === 'direct' && user?.id) {
            const other = conv.participants?.find(p => p.userId !== user.id);
            url = other?.user?.avatar_url;
        }
        if (!url) return undefined;
        if (url.startsWith('http') || url.startsWith('blob:')) return url;
        return `${API_BASE_URL.replace('/api/v1', '')}${url}`;
    };

    if (!user) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end space-y-4 font-sans">
            {/* Chat Panel Window */}
            {isOpen && (
                <div
                    className={`bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200 ring-1 ring-border/60 transition-all ${
                        isExpanded
                            ? "w-[840px] max-w-[calc(100vw-32px)] h-[660px] max-h-[calc(100vh-100px)]"
                            : "w-[400px] max-w-[calc(100vw-32px)] h-[580px] max-h-[calc(100vh-100px)]"
                    }`}
                >
                    {/* Header Bar */}
                    <div className="px-4 py-3 border-b bg-card flex items-center justify-between shrink-0 h-14 shadow-2xs relative z-10">
                        {/* Header View: Detail / Create Mode OR Active Conversation OR Default List */}
                        {viewMode === 'detail' && activeConversation ? (
                            <div className="flex items-center justify-between w-full">
                                <span className="font-bold text-sm">Info & Details</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMode('chat')}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (viewMode === 'create_group' || viewMode === 'create_channel') ? (
                            <div className="flex items-center justify-between w-full">
                                <span className="font-bold text-sm">
                                    {viewMode === 'create_group' ? 'New Group' : 'New Channel'}
                                </span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMode('chat')}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (!isExpanded && activeConversation) ? (
                            /* Compact mode with active chat selected: Clicking header opens Detail Info View! */
                            <div className="flex items-center gap-3 w-full">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => setActiveConversationId(null)}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>

                                <div
                                    className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setViewMode('detail')}
                                    title="Click to view details & profile"
                                >
                                    <Avatar className="w-8 h-8 border shrink-0 overflow-hidden">
                                        {resolveAvatar(activeConversation) && (
                                            <AvatarImage src={resolveAvatar(activeConversation)} alt={activeConversation.name || ''} className="object-cover" />
                                        )}
                                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                            {activeConversation.name?.[0] || 'C'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="overflow-hidden">
                                        <div className="font-semibold text-sm truncate leading-snug flex items-center gap-1">
                                            <span>{activeConversation.name || 'Chat'}</span>
                                            <Info className="w-3 h-3 text-muted-foreground shrink-0" />
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            {isChannel ? (
                                                <span className="flex items-center gap-1 text-purple-600 font-medium">
                                                    <Megaphone className="w-2.5 h-2.5" /> Channel
                                                </span>
                                            ) : activeConversation.type === 'group' ? (
                                                <span className="flex items-center gap-1 text-green-600 font-medium">
                                                    <Users className="w-2.5 h-2.5" /> {activeConversation.participants?.length || 0} members
                                                </span>
                                            ) : (
                                                <span className="text-green-600 flex items-center gap-1 font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsExpanded(true)}
                                        title="Expand side-by-side view"
                                    >
                                        <Maximize2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* Side-by-side header OR default list header */
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-primary" />
                                    <h3 className="font-bold text-base flex items-center gap-2">
                                        Messages & Teams
                                        {isConnected && (
                                            <span className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
                                        )}
                                    </h3>
                                </div>

                                {isExpanded && activeConversation && (
                                    <div
                                        className="flex items-center gap-2 cursor-pointer hover:bg-accent px-2 py-1 rounded-md transition-colors"
                                        onClick={() => setViewMode('detail')}
                                        title="Click to view details & profile"
                                    >
                                        <Avatar className="w-6 h-6 border shrink-0 overflow-hidden">
                                            {resolveAvatar(activeConversation) && (
                                                <AvatarImage src={resolveAvatar(activeConversation)} alt={activeConversation.name || ''} className="object-cover" />
                                            )}
                                            <AvatarFallback className="text-[10px]">{activeConversation.name?.[0] || 'C'}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-semibold text-xs max-w-[140px] truncate">{activeConversation.name}</span>
                                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                )}

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        title={isExpanded ? "Compact view" : "Expand side-by-side"}
                                    >
                                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Body Area */}
                    <div className="flex-1 flex overflow-hidden bg-background">
                        {/* View Switcher: Detail View / In-interface Create View / Normal Chat Panel */}
                        {viewMode === 'detail' && activeConversation ? (
                            <ChatDetailView
                                conversation={activeConversation}
                                currentUserId={user.id}
                                onBack={() => setViewMode('chat')}
                            />
                        ) : viewMode === 'create_group' ? (
                            <GroupChannelCreateView
                                type="group"
                                onBack={() => setViewMode('chat')}
                                onSuccess={handleCreationSuccess}
                            />
                        ) : viewMode === 'create_channel' ? (
                            <GroupChannelCreateView
                                type="channel"
                                onBack={() => setViewMode('chat')}
                                onSuccess={handleCreationSuccess}
                            />
                        ) : isExpanded ? (
                            /* Expanded Side-by-Side Mode */
                            <div className="flex w-full h-full divide-x">
                                {/* Left Pane */}
                                <div className="w-[320px] shrink-0 flex flex-col h-full bg-card/30">
                                    <div className="p-3 bg-background border-b">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search messages or people..."
                                                className="pl-9 h-9 bg-muted/40 text-sm"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <ConversationList
                                        conversations={conversations}
                                        searchQuery={searchQuery}
                                        isSearching={isSearching}
                                        searchResults={searchResults}
                                        activeConversationId={activeConversation?.id || null}
                                        onSelectConversation={setActiveConversationId}
                                        onStartChat={handleStartChat}
                                        onOpenCreateGroup={() => setViewMode('create_group')}
                                        onOpenCreateChannel={() => setViewMode('create_channel')}
                                        onlineUsers={onlineUsers}
                                        currentUserId={user?.id}
                                    />
                                </div>

                                {/* Right Pane */}
                                <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
                                    {activeConversation ? (
                                        <MessageThread
                                            messages={messages}
                                            activeConversationName={activeConversation.name || 'Chat'}
                                            activeConversationId={activeConversation.id}
                                            isGroupOrChannel={activeConversation.type === 'group' || activeConversation.type === 'channel'}
                                            canSendMessages={canSendMessages}
                                            currentUser={user}
                                            onSend={handleSend}
                                            isLoading={isLoadingMessages}
                                            typingUserNames={typingUserNames}
                                            onTyping={handleTyping}
                                        />
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
                                            <div className="p-4 rounded-full bg-primary/10 text-primary">
                                                <MessageSquare className="w-8 h-8" />
                                            </div>
                                            <div className="font-semibold text-base text-foreground">Select a conversation</div>
                                            <p className="text-xs max-w-[240px]">Choose a chat from the left panel or start a new group or channel</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Compact Mode */
                            activeConversation ? (
                                <MessageThread
                                    messages={messages}
                                    activeConversationName={activeConversation.name || 'Chat'}
                                    activeConversationId={activeConversation.id}
                                    isGroupOrChannel={activeConversation.type === 'group' || activeConversation.type === 'channel'}
                                    canSendMessages={canSendMessages}
                                    currentUser={user}
                                    onSend={handleSend}
                                    isLoading={isLoadingMessages}
                                    typingUserNames={typingUserNames}
                                    onTyping={handleTyping}
                                />
                            ) : (
                                <div className="flex flex-col w-full h-full">
                                    <div className="p-3 bg-background border-b">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search messages or people..."
                                                className="pl-9 h-9 bg-muted/40 text-sm"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <ConversationList
                                        conversations={conversations}
                                        searchQuery={searchQuery}
                                        isSearching={isSearching}
                                        searchResults={searchResults}
                                        activeConversationId={null}
                                        onSelectConversation={setActiveConversationId}
                                        onStartChat={handleStartChat}
                                        onOpenCreateGroup={() => setViewMode('create_group')}
                                        onOpenCreateChannel={() => setViewMode('create_channel')}
                                        onlineUsers={onlineUsers}
                                        currentUserId={user?.id}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Ultra-Stunning Floating Chat Button (FAB) with Ambient Glow & Micro-Animations */}
            <div className="relative group">
                {/* Ambient Multi-Color Glow Ring */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-600 to-amber-500 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse"></div>

                {/* FAB Button */}
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    size="lg"
                    className="relative h-14 w-14 rounded-full shadow-2xl p-0 transition-all duration-300 transform active:scale-95 group-hover:scale-105 bg-gradient-to-br from-primary via-amber-500 to-yellow-500 text-slate-950 font-bold border-2 border-white/40 overflow-hidden flex items-center justify-center"
                >
                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
                        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                    </div>

                    {/* Unread Count Pill */}
                    {!isOpen && totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white font-black text-[10px] rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 border-2 border-background shadow-md animate-bounce">
                            {totalUnread > 99 ? '99+' : totalUnread}
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );
}
