import { useState, useEffect, useRef } from 'react';
import { Bell, Megaphone, Calendar, Settings } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL, SOCKET_URL } from '@/config/api.config';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow, format } from 'date-fns';

interface Notification {
    id: string;
    type: string;
    reference_id?: string;
    title: string;
    message?: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationDetail {
    id: string;
    title: string;
    content?: string;
    priority?: string;
    event_date?: string;
    event_time?: string;
    location?: string;
    created_by_name?: string;
    created_at: string;
}

export function NotificationBell() {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Detail modal state
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [notificationDetail, setNotificationDetail] = useState<NotificationDetail | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    // Fetch notifications on mount
    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
            fetchUnreadCount();
        }
    }, [isAuthenticated]);

    // WebSocket connection
    useEffect(() => {
        if (!isAuthenticated) return;

        const baseUrl = SOCKET_URL || 'http://localhost:3001';
        const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const socketUrl = `${cleanUrl}/notifications`;

        console.log('[NotificationBell] Connecting to:', socketUrl);

        const newSocket = io(socketUrl, {
            withCredentials: true,
            transports: ['polling', 'websocket'], // Start with polling for better success rate
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            path: '/socket.io/',
        });

        newSocket.on('connect', () => {
            console.log('[NotificationBell] WebSocket connected, id:', newSocket.id);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[NotificationBell] Connection error:', error.message);
        });

        newSocket.on('newNotification', (notification: Notification) => {
            console.log('[NotificationBell] New notification received:', notification);
            const safeNotification = {
                ...notification,
                created_at: notification.created_at || new Date().toISOString()
            };
            setNotifications(prev => [safeNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            showToast(safeNotification);
        });

        newSocket.on('disconnect', () => {
            console.log('[NotificationBell] WebSocket disconnected');
        });

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setNotifications(data);
            }
        } catch (error) {
            console.error('[NotificationBell] Error fetching notifications:', error);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.count);
            }
        } catch (error) {
            console.error('[NotificationBell] Error fetching unread count:', error);
        }
    };

    const fetchNotificationDetail = async (notification: Notification) => {
        // Handle simple types that don't need fetching
        const simpleTypes = ['overtime_generated', 'shift_assigned', 'schedule_update', 'profile_update', 'attendance_corrected'];
        if (simpleTypes.includes(notification.type) || !notification.reference_id) {
            setNotificationDetail({
                id: notification.id,
                title: notification.title,
                content: notification.message,
                created_at: notification.created_at,
                created_by_name: 'System'
            });
            return;
        }

        setIsLoadingDetail(true);
        try {
            let endpoint = '';
            if (notification.type === 'announcement') {
                endpoint = `${API_BASE_URL}/announcements/${notification.reference_id}`;
            } else if (notification.type === 'event') {
                endpoint = `${API_BASE_URL}/events/${notification.reference_id}`;
            } else {
                // Unknown type with reference_id, skip fetch
                setNotificationDetail({
                    id: notification.id,
                    title: notification.title,
                    content: notification.message,
                    created_at: notification.created_at
                });
                setIsLoadingDetail(false);
                return;
            }

            const response = await fetch(endpoint, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setNotificationDetail(data);
            } else {
                // Fallback if fetch fails
                setNotificationDetail({
                    id: notification.id,
                    title: notification.title,
                    content: notification.message,
                    created_at: notification.created_at
                });
            }
        } catch (error) {
            console.error('[NotificationBell] Error fetching detail:', error);
            // Fallback on error
            setNotificationDetail({
                id: notification.id,
                title: notification.title,
                content: notification.message,
                created_at: notification.created_at
            });
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        // Open detail modal
        setSelectedNotification(notification);
        setNotificationDetail(null);
        setIsOpen(false); // Close dropdown

        // Fetch full content
        await fetchNotificationDetail(notification);
    };

    const closeDetailModal = () => {
        setSelectedNotification(null);
        setNotificationDetail(null);
    };

    const markAsRead = async (id: string) => {
        try {
            await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
                method: 'POST',
                credentials: 'include',
            });

            setNotifications(prev =>
                prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('[NotificationBell] Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch(`${API_BASE_URL}/notifications/read-all`, {
                method: 'POST',
                credentials: 'include',
            });

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('[NotificationBell] Error marking all as read:', error);
        }
    };

    const showToast = (notification: Notification) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
            });
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'announcement':
                return 'bg-blue-100 text-blue-700';
            case 'event':
                return 'bg-purple-100 text-purple-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'announcement':
                return <Megaphone className="h-5 w-5" />;
            case 'event':
                return <Calendar className="h-5 w-5" />;
            default:
                return <Bell className="h-5 w-5" />;
        }
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Bell Icon with Badge */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <Bell className="h-5 w-5 text-gray-600 hover:text-blue-500" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <Card className="absolute right-0 top-12 w-80 z-50 shadow-lg border">
                        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                    onClick={markAllAsRead}
                                >
                                    Mark all read
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-80">
                                {notifications.length === 0 ? (
                                    <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
                                        No notifications yet
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-blue-50/50' : ''
                                                    }`}
                                                onClick={() => handleNotificationClick(notification)}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-[10px] ${getTypeColor(notification.type)}`}
                                                    >
                                                        {notification.type}
                                                    </Badge>
                                                    {!notification.is_read && (
                                                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                                                    )}
                                                </div>
                                                <p className="font-medium text-sm mt-1">{notification.title}</p>
                                                {notification.message && (
                                                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    {notification.created_at && formatDistanceToNow(new Date(notification.created_at.endsWith('Z') ? notification.created_at : notification.created_at + 'Z'), {
                                                        addSuffix: true,
                                                    })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                        <div className="border-t px-4 py-2 flex items-center justify-between">
                            <a
                                href="/notifications"
                                className="text-xs text-primary hover:underline"
                                onClick={() => setIsOpen(false)}
                            >
                                View all notifications
                            </a>
                            <a
                                href="/settings/notifications"
                                className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
                                onClick={() => setIsOpen(false)}
                            >
                                <Settings className="h-3 w-3" />
                                Preferences
                            </a>
                        </div>
                    </Card>
                )}
            </div>

            {/* Detail Modal */}
            <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && closeDetailModal()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selectedNotification?.type === 'announcement' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                {selectedNotification && getTypeIcon(selectedNotification.type)}
                            </div>
                            <div>
                                <Badge className={`text-[10px] mb-1 ${selectedNotification && getTypeColor(selectedNotification.type)}`}>
                                    {selectedNotification?.type}
                                </Badge>
                                <DialogTitle className="text-lg">
                                    {selectedNotification?.title}
                                </DialogTitle>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="mt-4">
                        {isLoadingDetail ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                            </div>
                        ) : notificationDetail ? (
                            <div className="space-y-4">
                                {/* Event-specific info */}
                                {selectedNotification?.type === 'event' && (
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                        {notificationDetail.event_date && (
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                <span>{format(new Date(notificationDetail.event_date), 'MMMM d, yyyy')}</span>
                                            </div>
                                        )}
                                        {notificationDetail.event_time && (
                                            <div className="flex items-center gap-1">
                                                <span>🕐</span>
                                                <span>{notificationDetail.event_time.slice(0, 5)}</span>
                                            </div>
                                        )}
                                        {notificationDetail.location && (
                                            <div className="flex items-center gap-1">
                                                <span>📍</span>
                                                <span>{notificationDetail.location}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Priority badge for announcements */}
                                {selectedNotification?.type === 'announcement' && notificationDetail.priority && notificationDetail.priority !== 'normal' && (
                                    <Badge className={`${notificationDetail.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {notificationDetail.priority}
                                    </Badge>
                                )}

                                {/* Content */}
                                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {notificationDetail.content || 'No additional content'}
                                </div>

                                {/* Meta info */}
                                <div className="pt-4 border-t text-xs text-gray-500 flex justify-between items-center">
                                    <span>By {notificationDetail.created_by_name || 'Unknown'}</span>
                                    <span>{notificationDetail?.created_at && format(new Date(notificationDetail.created_at.endsWith('Z') ? notificationDetail.created_at : notificationDetail.created_at + 'Z'), 'MMM d, yyyy h:mm a')}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center">Unable to load details</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
