export interface Conversation {
    id: string;
    tenantId: string;
    type: 'direct' | 'group' | 'channel' | 'broadcast';
    lastMessageAt: string;
    isArchived: boolean;
    participants: ConversationParticipant[];
    messages?: Message[];
    unreadCount?: number;
    description?: string;
    avatarUrl?: string;
    onlyAdminsCanPost?: boolean;
    // Computed
    name?: string;
    avatar?: string;
    lastMessage?: {
        id: string;
        content: string;
        senderId: string;
        sender?: { id: string; full_name: string; avatar_url?: string };
        sentAt: string;
    };
}

export interface ConversationParticipant {
    id: string;
    conversationId: string;
    userId: string;
    joinedAt: string;
    lastReadAt?: string;
    isAdmin: boolean;
    user?: {
        id: string;
        full_name: string;
        avatar_url?: string;
        email: string;
    };
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string; // Decrypted content
    messageType: 'text' | 'image' | 'file' | 'voice' | 'video' | 'sticker' | 'system';
    sentAt: string;
    updatedAt: string;
    replyToId?: string;
    replyTo?: {
        id: string;
        content: string;
        senderId: string;
        senderName?: string;
    };
    isDeleted: boolean;
    isEdited?: boolean;
    isForwarded?: boolean;
    forwardedFromId?: string;
    attachmentUrl?: string;
    sender?: {
        id: string;
        full_name: string;
        avatar_url?: string;
    };
    attachments?: MessageAttachment[];
    reactions?: MessageReaction[];
    readReceipts?: MessageReadReceipt[]; // Optional for list views
}

export interface MessageAttachment {
    id: string;
    fileUrl: string;
    fileType: string;
    fileName: string;
    fileSize: number;
}

export interface MessageReaction {
    id: string;
    userId: string;
    emoji: string;
}

export interface MessageReadReceipt {
    userId: string;
    readAt: string;
}

export interface SendMessageDto {
    conversationId: string;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'voice' | 'video' | 'sticker' | 'system';
    attachmentUrl?: string;
    replyToId?: string;
    forwardedFromId?: string;
}

export interface CreateConversationDto {
    type: 'direct' | 'group' | 'channel' | 'broadcast';
    participantIds?: string[];
    name?: string;
    description?: string;
    avatarUrl?: string;
    onlyAdminsCanPost?: boolean;
    initialMessage?: string;
}
