import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL, SOCKET_URL } from '../config/api.config';
import type { Conversation, Message, SendMessageDto, CreateConversationDto } from '../types/messaging';
import { toast } from 'sonner';

export interface MessagingContextType {
    socket: Socket | null;
    isConnected: boolean;
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: Message[];
    isLoadingConversations: boolean;
    isLoadingMessages: boolean;
    typingUsers: Map<string, Set<string>>; // conversationId -> Set of userIds typing

    // Actions
    setActiveConversationId: (id: string | null) => void;
    sendMessage: (dto: SendMessageDto) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string, forEveryone?: boolean) => Promise<void>;
    reactToMessage: (messageId: string, emoji: string) => Promise<void>;
    forwardMessage: (messageId: string, conversationIds: string[]) => Promise<void>;
    createConversation: (dto: CreateConversationDto) => Promise<Conversation>;
    refreshConversations: () => Promise<void>;
    markAsRead: (conversationId: string) => void;
    emitTyping: (conversationId: string, isTyping: boolean) => void;
    onlineUsers: Set<string>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    // Track online users
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    // Track typing users per conversation
    const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());

    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Use ref to track active conversation to avoid stale closure in socket listeners
    const activeConversationIdRef = useRef<string | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    // Derive active conversation object
    const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

    // --- Socket Connection ---
    useEffect(() => {
        if (!isAuthenticated || !user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
                setOnlineUsers(new Set());
            }
            return;
        }

        // Determine Socket URL (Base of API URL if SOCKET_URL not set)
        const url = SOCKET_URL || API_BASE_URL.replace('/api/v1', '');

        console.log('[Messaging] Connecting to', url, '/messaging');

        const newSocket = io(`${url}/messaging`, {
            withCredentials: true, // Important for HttpOnly cookies
            transports: ['websocket'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('[Messaging] Socket connected');
            setIsConnected(true);
            // Mark self as online immediately (though server will broadcast too, good for local)
            setOnlineUsers(prev => new Set(prev).add(user.id));
        });

        newSocket.on('disconnect', () => {
            console.log('[Messaging] Socket disconnected');
            setIsConnected(false);
            setOnlineUsers(new Set());
        });

        newSocket.on('connect_error', (err) => {
            console.error('[Messaging] Socket connection error:', err);
        });

        // Listeners
        newSocket.on('newMessage', (message: Message) => {
            console.log('[Messaging] Received newMessage event:', message);
            handleNewMessage(message);
        });

        // ── Real-time delete: fired by backend when any client deletes a message ──
        newSocket.on('messageDeleted', (payload: {
            messageId: string;
            conversationId: string;
            forEveryone: boolean;
            deletedForUserIds?: string[];
        }) => {
            console.log('[Messaging] messageDeleted:', payload.messageId, 'forEveryone:', payload.forEveryone);
            setMessages(prev => prev.map(m =>
                m.id === payload.messageId
                    ? { ...m, isDeleted: true, content: 'This message was deleted' }
                    : m
            ));
        });

        // ── Real-time edit ──
        newSocket.on('messageEdited', (message: Partial<Message> & { id: string }) => {
            console.log('[Messaging] messageEdited:', message.id);
            setMessages(prev => prev.map(m =>
                m.id === message.id
                    ? { ...m, content: message.content ?? m.content, isEdited: true }
                    : m
            ));
        });

        // ── Real-time reactions ──
        newSocket.on('reactionUpdated', (payload: { messageId: string; reactions: any[] }) => {
            console.log('[Messaging] reactionUpdated:', payload.messageId);
            setMessages(prev => prev.map(m =>
                m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
            ));
        });

        // Presence Listener
        newSocket.on('userStatus', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (isOnline) {
                    next.add(userId);
                } else {
                    next.delete(userId);
                }
                return next;
            });
        });

        newSocket.on('initialPresence', (userIds: string[]) => {
            console.log('[Messaging] Initial presence:', userIds);
            setOnlineUsers(new Set(userIds));
        });

        newSocket.on('messagesRead', ({ conversationId, readByUserId, readAt }: { conversationId: string; readByUserId: string; readAt: string }) => {
            console.log('[MessagingContext] Received messagesRead:', { conversationId, readByUserId });

            // Update messages if we are viewing this conversation
            if (activeConversationIdRef.current === conversationId) {
                setMessages(prev => prev.map(msg => {
                    // If message is sent by current user and doesn't have receipt from this user yet
                    if (msg.senderId === user?.id) {
                        const hasReceipt = msg.readReceipts?.some(r => r.userId === readByUserId);
                        if (!hasReceipt) {
                            return {
                                ...msg,
                                readReceipts: [
                                    ...(msg.readReceipts || []),
                                    { userId: readByUserId, readAt }
                                ]
                            };
                        }
                    }
                    return msg;
                }));
            }
        });

        // Typing indicator listener
        newSocket.on('typing', ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
            setTypingUsers(prev => {
                const next = new Map(prev);
                const typingSet = next.get(conversationId) || new Set();
                if (isTyping) {
                    typingSet.add(userId);
                } else {
                    typingSet.delete(userId);
                }
                if (typingSet.size > 0) {
                    next.set(conversationId, typingSet);
                } else {
                    next.delete(conversationId);
                }
                return next;
            });
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, user?.id]); // Added user.id dependency for initial online set

    // --- API Calls ---

    const refreshConversations = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingConversations(true);
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/conversations`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (err) {
            console.error('Failed to fetch conversations', err);
        } finally {
            setIsLoadingConversations(false);
        }
    }, [isAuthenticated]);

    const loadMessages = useCallback(async (conversationId: string) => {
        if (!isAuthenticated) return;
        setIsLoadingMessages(true);
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/messages`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error('Failed to fetch messages', err);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [isAuthenticated]);

    const sendMessage = async (dto: SendMessageDto) => {
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dto),
            });
            if (!res.ok) throw new Error('Failed to send message');
            // Optimistic update or wait for socket? 
            // Socket will broadcast back to us too usually, or we can append manually.
            // For now, let's rely on the response/socket.
            const sentMsg = await res.json();
            // Manually append if socket doesn't fire fast enough for own message (or dedupe in handleNewMessage)
            handleNewMessage(sentMsg);
        } catch (err) {
            toast.error('Failed to send message');
            throw err;
        }
    };

    const createConversation = async (dto: CreateConversationDto) => {
        console.log('[Messaging] Creating conversation:', dto);
        const res = await fetch(`${API_BASE_URL}/messaging/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(dto),
        });
        if (!res.ok) {
            console.error('[Messaging] Create conversation failed:', res.status, res.statusText);
            throw new Error('Failed to create conversation');
        }
        const newConv = await res.json();
        console.log('[Messaging] Conversation created:', newConv);
        setConversations(prev => {
            // Prevent duplicates
            if (prev.some(c => c.id === newConv.id)) return prev;
            return [newConv, ...prev];
        });
        return newConv;
    };

    const markAsRead = (conversationId: string) => {
        // Call backend to mark messages as read
        fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/read`, {
            method: 'POST',
            credentials: 'include',
        }).catch(err => console.error('Failed to mark as read:', err));
    };

    const editMessage = async (messageId: string, content: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/messages/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content }),
            });
            if (!res.ok) throw new Error('Failed to edit message');
            const updated = await res.json();
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updated, content, isEdited: true } : m));
        } catch (err) {
            toast.error('Failed to edit message');
            throw err;
        }
    };

    const deleteMessage = async (messageId: string, forEveryone: boolean = true) => {
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/messages/${messageId}?forEveryone=${forEveryone}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete message');
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m));
        } catch (err) {
            toast.error('Failed to delete message');
            throw err;
        }
    };

    const reactToMessage = async (messageId: string, emoji: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/messages/${messageId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) throw new Error('Failed to add reaction');
            const updatedReactions = await res.json();
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: Array.isArray(updatedReactions) ? updatedReactions : m.reactions } : m));
        } catch (err) {
            toast.error('Failed to react to message');
            throw err;
        }
    };

    const forwardMessage = async (messageId: string, conversationIds: string[]) => {
        try {
            const res = await fetch(`${API_BASE_URL}/messaging/messages/${messageId}/forward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ conversationIds }),
            });
            if (!res.ok) throw new Error('Failed to forward message');
            toast.success('Message forwarded');
            refreshConversations();
        } catch (err) {
            toast.error('Failed to forward message');
            throw err;
        }
    };

    const emitTyping = (conversationId: string, isTyping: boolean) => {
        if (socket && isConnected) {
            socket.emit('typing', { conversationId, isTyping });
        }
    };

    // --- Event Handlers ---

    const handleNewMessage = (message: Message) => {
        console.log('[MessagingContext] handleNewMessage called for conversation:', message.conversationId, 'current active:', activeConversationId);

        // Always update messages state - let the component filter by conversation
        setMessages(prev => {
            // Dedupe
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
        });

        // If we are currently viewing this conversation, mark it as read immediately
        if (activeConversationIdRef.current === message.conversationId) {
            markAsRead(message.conversationId);
        }

        // Update conversation list (last message, move to top)
        setConversations(prev => {
            const idx = prev.findIndex(c => c.id === message.conversationId);
            if (idx === -1) {
                // New conversation (e.g. someone started one with us)
                refreshConversations(); // Lazy reload for now
                return prev;
            }

            const updatedConv = {
                ...prev[idx],
                lastMessageAt: message.sentAt,
                lastMessage: {
                    id: message.id,
                    content: message.content,
                    senderId: message.senderId,
                    sender: message.sender,
                    sentAt: message.sentAt,
                },
            };

            // Move to top
            const newC = [...prev];
            newC.splice(idx, 1);
            return [updatedConv, ...newC];
        });
    };

    // --- Effects ---

    // Auto-load messages when active conversation changes
    useEffect(() => {
        if (activeConversationId) {
            loadMessages(activeConversationId);
            // Mark as read when opening
            markAsRead(activeConversationId);
        } else {
            setMessages([]);
        }
    }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load conversations on mount/auth
    useEffect(() => {
        if (isAuthenticated) {
            refreshConversations();
        }
    }, [isAuthenticated, refreshConversations]);

    // Load messages when active conversation changes
    useEffect(() => {
        if (activeConversationId) {
            loadMessages(activeConversationId);
        } else {
            setMessages([]);
        }
    }, [activeConversationId, loadMessages]);

    return (
        <MessagingContext.Provider
            value={{
                socket,
                isConnected,
                conversations,
                activeConversation,
                messages,
                isLoadingConversations,
                isLoadingMessages,
                typingUsers,
                setActiveConversationId,
                sendMessage,
                editMessage,
                deleteMessage,
                reactToMessage,
                forwardMessage,
                createConversation,
                refreshConversations,
                markAsRead,
                emitTyping,
                onlineUsers,
            }}
        >
            {children}
        </MessagingContext.Provider>
    );
}

export function useMessaging() {
    const context = useContext(MessagingContext);
    if (context === undefined) {
        throw new Error('useMessaging must be used within a MessagingProvider');
    }
    return context;
}
