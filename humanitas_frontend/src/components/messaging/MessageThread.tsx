import { useRef, useEffect, useState, useCallback } from "react";
import type { Message } from "../../types/messaging";
import { useMessaging } from "../../context/MessagingContext";
import {
    Send, Building2, Check, CheckCheck, Reply, Edit2, Trash2, Copy,
    X, ShieldAlert, CornerUpLeft, Ban, MoreHorizontal, Smile, Mic, MicOff, StopCircle,
    Play, Pause, Paperclip, FileText, Film, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EmojiPicker, { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { API_BASE_URL } from "../../config/api.config";

interface MessageThreadProps {
    messages: Message[];
    activeConversationName: string;
    activeConversationId: string | null;
    isGroupOrChannel?: boolean;
    canSendMessages?: boolean;
    currentUser: any;
    onSend: (content: string, replyToId?: string) => void;
    isLoading: boolean;
    typingUserNames: string[];
    onTyping: (isTyping: boolean) => void;
}

interface VoiceMessagePlayerProps {
    src: string;
    isMe?: boolean;
    staticDuration?: string;
}

function VoiceMessagePlayer({ src, isMe = false, staticDuration }: VoiceMessagePlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState<number>(1);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const newTime = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const toggleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const speeds = [1, 1.5, 2];
        const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
        const nextSpeed = speeds[nextIdx];
        setPlaybackRate(nextSpeed);
        if (audioRef.current) {
            audioRef.current.playbackRate = nextSpeed;
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds === Infinity || seconds <= 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    const displayDuration = isPlaying || currentTime > 0
        ? `${formatTime(currentTime)} / ${formatTime(duration)}`
        : duration > 0
            ? formatTime(duration)
            : (staticDuration ?? '0:00');

    return (
        <div className="flex items-center gap-2.5 py-1 px-0.5 min-w-[210px] max-w-[260px] select-none" onClick={e => e.stopPropagation()}>
            <audio
                ref={audioRef}
                src={src}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                preload="metadata"
            />

            <button
                onClick={togglePlay}
                className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 shadow-sm cursor-pointer",
                    isMe
                        ? "bg-primary-foreground text-primary hover:bg-white"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current ml-0" />
                ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
            </button>

            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="relative flex items-center h-4 group cursor-pointer">
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/20 dark:bg-white/25 relative">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-75",
                                isMe ? "bg-primary-foreground" : "bg-primary"
                            )}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        value={currentTime}
                        onChange={handleScrub}
                        onClick={e => e.stopPropagation()}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>

                <div className={cn(
                    "flex items-center justify-between text-[10px] font-medium leading-none",
                    isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                    <span>{displayDuration}</span>

                    <button
                        onClick={toggleSpeed}
                        className={cn(
                            "px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-colors cursor-pointer",
                            isMe
                                ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                        )}
                        title="Change playback speed"
                    >
                        {playbackRate}x
                    </button>
                </div>
            </div>
        </div>
    );
}

const isOnlyEmoji = (text: string) => {
    const s = text.trim();
    if (!s) return false;
    const clean = s.replace(/\s+/g, '');
    if (!clean) return false;
    const regex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}]|[\u{2935}]|[\u{3297}]|[\u{3299}])+$/u;
    if (!regex.test(clean)) return false;
    return Array.from(clean).length <= 4;
};

export function MessageThread({
    messages,
    activeConversationName,
    activeConversationId,
    isGroupOrChannel = false,
    canSendMessages = true,
    currentUser,
    onSend,
    isLoading,
    typingUserNames,
    onTyping
}: MessageThreadProps) {
    const { editMessage, deleteMessage, reactToMessage, sendMessage } = useMessaging();

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [newMessage, setNewMessage] = useState("");
    const typingTimeoutRef = useRef<number | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const [deletingMsg, setDeletingMsg] = useState<Message | null>(null);
    const [deleteForEveryone, setDeleteForEveryone] = useState(true);

    const [pendingAttachment, setPendingAttachment] = useState<{ file: File; type: 'image' | 'video' | 'file'; previewUrl?: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const recordingTimerRef = useRef<number | null>(null);
    const recordingStartTimeRef = useRef<number>(0);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, typingUserNames]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmojiPicker]);

    const handleCancelCompose = () => {
        setReplyingTo(null);
        setEditingMessage(null);
        setNewMessage("");
        clearPendingAttachment();
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const mime = file.type;
        let type: 'image' | 'video' | 'file' = 'file';
        let previewUrl: string | undefined;
        if (mime.startsWith('image/')) {
            type = 'image';
            previewUrl = URL.createObjectURL(file);
        } else if (mime.startsWith('video/')) {
            type = 'video';
        }
        setPendingAttachment({ file, type, previewUrl });
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const clearPendingAttachment = () => {
        if (pendingAttachment?.previewUrl) {
            URL.revokeObjectURL(pendingAttachment.previewUrl);
        }
        setPendingAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleStartEdit = (msg: Message) => {
        setEditingMessage(msg);
        setReplyingTo(null);
        setNewMessage(msg.content);
        setActiveActionMsgId(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const handleStartReply = (msg: Message) => {
        setReplyingTo(msg);
        setEditingMessage(null);
        setActiveActionMsgId(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const handleConfirmDelete = async () => {
        if (!deletingMsg) return;
        try {
            await deleteMessage(deletingMsg.id, isGroupOrChannel ? true : deleteForEveryone);
            toast.success("Message deleted");
        } catch {
            toast.error("Failed to delete message");
        } finally {
            setDeletingMsg(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text && !pendingAttachment) return;

        if (editingMessage) {
            try {
                await editMessage(editingMessage.id, text);
                handleCancelCompose();
            } catch (err) {
                console.error("Failed to edit", err);
            }
            return;
        }

        if (pendingAttachment) {
            if (!activeConversationId) return;
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', pendingAttachment.file);
                const uploadRes = await fetch(`${API_BASE_URL}/messaging/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });
                if (!uploadRes.ok) throw new Error("Upload failed");
                const data = await uploadRes.json();
                const attachmentUrl = data.url;

                await sendMessage({
                    conversationId: activeConversationId,
                    content: text,
                    messageType: pendingAttachment.type,
                    attachmentUrl,
                    replyToId: replyingTo?.id,
                });
                handleCancelCompose();
            } catch (err) {
                toast.error("Failed to send attachment");
            } finally {
                setIsUploading(false);
            }
            return;
        }

        onSend(text, replyingTo?.id);
        handleCancelCompose();

        onTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    };

    const handleInputChange = useCallback((value: string) => {
        setNewMessage(value);

        if (value.trim().length > 0) {
            onTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                onTyping(false);
            }, 3000);
        } else {
            onTyping(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    }, [onTyping]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            onTyping(false);
        };
    }, [activeConversationId]); 

    const onEmojiClick = (emojiData: EmojiClickData) => {
        const cursor = textareaRef.current?.selectionStart ?? newMessage.length;
        const updated = newMessage.slice(0, cursor) + emojiData.emoji + newMessage.slice(cursor);
        setNewMessage(updated);
        setShowEmojiPicker(false);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const pos = cursor + emojiData.emoji.length;
                textareaRef.current.setSelectionRange(pos, pos);
            }
        }, 0);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                const durationSecs = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));
                await uploadAndSendVoice(blob, mimeType, durationSecs);
                setIsRecording(false);
                setRecordingSeconds(0);
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            };

            recorder.start(250);
            mediaRecorderRef.current = recorder;
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingSeconds(0);
            recordingTimerRef.current = window.setInterval(() => {
                setRecordingSeconds(s => s + 1);
            }, 1000);
        } catch (err) {
            toast.error("Microphone access denied");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.ondataavailable = null;
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        }
        setIsRecording(false);
        setRecordingSeconds(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };

    const uploadAndSendVoice = async (blob: Blob, mimeType: string, durationSecs: number = 0) => {
        if (!activeConversationId) return;
        try {
            const ext = mimeType.includes('webm') ? '.webm' : '.ogg';
            const formData = new FormData();
            formData.append('file', blob, `voice${ext}`);

            const uploadRes = await fetch(`${API_BASE_URL}/messaging/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            let attachmentUrl = '';
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                attachmentUrl = data.url || '';
            }

            const durMins = Math.floor(durationSecs / 60);
            const durSecs = String(durationSecs % 60).padStart(2, '0');
            const durStr = `${durMins}:${durSecs}`;

            const content = attachmentUrl ? `${attachmentUrl}::dur:${durStr}` : '🎤 Voice message';

            await sendMessage({
                conversationId: activeConversationId,
                content: content,
                messageType: 'voice',
                attachmentUrl: attachmentUrl || undefined,
                replyToId: replyingTo?.id,
            });
            if (replyingTo) setReplyingTo(null);
            toast.success('Voice message sent');
        } catch (err) {
            toast.error('Failed to send voice message');
        }
    };

    const formatRecordingTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const getDateLabel = (rawDate: string) => {
        try {
            const dt = new Date(rawDate);
            const now = new Date();
            const isToday = dt.toDateString() === now.toDateString();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const isYesterday = dt.toDateString() === yesterday.toDateString();

            if (isToday) return "Today";
            if (isYesterday) return "Yesterday";
            return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    return (
        <div className="w-full h-full flex flex-col bg-background font-sans overflow-hidden">
            {deletingMsg && (
                <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-card border rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                            <Trash2 className="w-4 h-4 text-destructive" />
                            <span>Delete Message</span>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Are you sure you want to delete this message?
                        </p>

                        {!isGroupOrChannel ? (
                            <label className="flex items-center gap-2 border p-2.5 rounded-lg bg-muted/30 cursor-pointer text-xs select-none">
                                <Checkbox
                                    checked={deleteForEveryone}
                                    onCheckedChange={(c) => setDeleteForEveryone(!!c)}
                                />
                                <span>Also delete for {activeConversationName}</span>
                            </label>
                        ) : (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                This message will be deleted for everyone in {activeConversationName}.
                            </p>
                        )}

                        <div className="flex gap-2 justify-end pt-1">
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeletingMsg(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleConfirmDelete}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10" ref={scrollRef}>
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading messages...</div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                        <Building2 className="h-8 w-8 opacity-10" />
                        <span>This is the start of your conversation with {activeConversationName}.</span>
                        <span>Say hello! 👋</span>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === currentUser?.id;
                        const dateLabel = getDateLabel(msg.sentAt);
                        const prevDateLabel = index > 0 ? getDateLabel(messages[index - 1].sentAt) : null;
                        const showDateSeparator = dateLabel && dateLabel !== prevDateLabel;
                        const isActionOpen = activeActionMsgId === msg.id;
                        const isVoice = msg.messageType === 'voice';

                        const canDelete = !msg.isDeleted && (!isGroupOrChannel || isMe || currentUser?.role === 'admin');

                        const reactionCounts: Record<string, number> = {};
                        if (msg.reactions) {
                            msg.reactions.forEach(r => {
                                reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
                            });
                        }

                        return (
                            <div key={msg.id} className="space-y-2">
                                {showDateSeparator && (
                                    <div className="flex justify-center my-3">
                                        <span className="text-[11px] font-medium bg-muted/60 text-muted-foreground px-3 py-1 rounded-full shadow-2xs">
                                            {dateLabel}
                                        </span>
                                    </div>
                                )}

                                <div className={cn("flex flex-col w-full group relative", isMe ? "items-end" : "items-start")}>
                                    <div className={cn(
                                        "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-background/95 border shadow-sm backdrop-blur-xs text-xs z-10",
                                        isMe ? "self-end mr-2" : "self-start ml-2"
                                    )}>
                                        {quickEmojis.slice(0, 3).map(emoji => (
                                            <button
                                                key={emoji}
                                                className="hover:scale-125 transition-transform text-sm px-0.5"
                                                onClick={() => reactToMessage(msg.id, emoji)}
                                                title={`React ${emoji}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                        <button
                                            className="p-1 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground"
                                            onClick={() => handleStartReply(msg)}
                                            title="Reply"
                                        >
                                            <Reply className="w-3 h-3" />
                                        </button>
                                        <button
                                            className="p-1 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground"
                                            onClick={() => setActiveActionMsgId(isActionOpen ? null : msg.id)}
                                            title="More options"
                                        >
                                            <MoreHorizontal className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div
                                        id={`msg-${msg.id}`}
                                        className={cn(
                                            "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-xs relative transition-all",
                                            isMe ? "bg-primary text-primary-foreground rounded-br-xs" : "bg-card border text-card-foreground rounded-bl-xs"
                                        )}
                                        onClick={() => setActiveActionMsgId(isActionOpen ? null : msg.id)}
                                    >
                                        {!isMe && isGroupOrChannel && msg.sender?.full_name && (
                                            <div className="text-[11px] font-bold text-primary mb-1">
                                                {msg.sender.full_name}
                                            </div>
                                        )}

                                        {msg.isForwarded && (
                                            <div className="text-[10px] italic flex items-center gap-1 opacity-75 mb-1">
                                                <CornerUpLeft className="w-3 h-3" /> Forwarded message
                                            </div>
                                        )}

                                        {msg.replyTo && (
                                            <div className={cn(
                                                "text-xs p-2 rounded-md mb-1.5 border-l-3 bg-black/5 dark:bg-white/5 cursor-pointer hover:opacity-80 transition-opacity",
                                                isMe ? "border-l-primary-foreground/50" : "border-l-primary"
                                            )} onClick={(e) => {
                                                e.stopPropagation();
                                                const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }}>
                                                <div className="font-semibold text-[11px]">{msg.replyTo.senderName || 'User'}</div>
                                                <div className="truncate opacity-90">
                                                    {(() => {
                                                        const c = msg.replyTo.content || '';
                                                        if (c.startsWith('/uploads/') || c.includes('::dur:') || c.includes('.m4a') || c.includes('.webm') || c.includes('.ogg')) {
                                                            return '🎤 Voice message';
                                                        }
                                                        return c;
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {msg.isDeleted ? (
                                            <div className="italic text-xs flex items-center gap-1 opacity-60">
                                                <Ban className="w-3 h-3" /> This message was deleted
                                            </div>
                                        ) : isVoice ? (() => {
                                            const baseUrl = API_BASE_URL.replace('/api/v1', '');
                                            let audioSrc = '';
                                            let staticDur: string | undefined;

                                            if (msg.attachmentUrl) {
                                                audioSrc = `${baseUrl}${msg.attachmentUrl}`;
                                            } else if (msg.content && msg.content.includes('::dur:')) {
                                                const [urlPart, durPart] = msg.content.split('::dur:');
                                                if (urlPart.startsWith('/uploads/') || urlPart.startsWith('http')) {
                                                    audioSrc = urlPart.startsWith('http') ? urlPart : `${baseUrl}${urlPart}`;
                                                }
                                                staticDur = durPart?.trim() || undefined;
                                            } else if (msg.content && msg.content.startsWith('/uploads/')) {
                                                audioSrc = `${baseUrl}${msg.content}`;
                                            }

                                            return audioSrc ? (
                                                <VoiceMessagePlayer
                                                    src={audioSrc}
                                                    isMe={isMe}
                                                    staticDuration={staticDur}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs italic opacity-75">
                                                    <Mic className="w-4 h-4 shrink-0" />
                                                    <span>Voice message</span>
                                                </div>
                                            );
                                        })() : msg.messageType === 'image' && msg.attachmentUrl ? (
                                            <div className="space-y-1.5">
                                                <img
                                                    src={msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : `${API_BASE_URL.replace('/api/v1', '')}${msg.attachmentUrl}`}
                                                    alt="Attachment"
                                                    className="max-w-xs max-h-60 rounded-lg object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const fullUrl = msg.attachmentUrl!.startsWith('http') ? msg.attachmentUrl! : `${API_BASE_URL.replace('/api/v1', '')}${msg.attachmentUrl}`;
                                                        setViewingImage(fullUrl);
                                                    }}
                                                />
                                                {msg.content && <div className="break-words leading-relaxed">{msg.content}</div>}
                                            </div>
                                        ) : msg.messageType === 'video' && msg.attachmentUrl ? (
                                            <div className="space-y-1.5">
                                                <video
                                                    src={msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : `${API_BASE_URL.replace('/api/v1', '')}${msg.attachmentUrl}`}
                                                    controls
                                                    className="max-w-xs max-h-60 rounded-lg"
                                                />
                                                {msg.content && <div className="break-words leading-relaxed">{msg.content}</div>}
                                            </div>
                                        ) : msg.messageType === 'file' && msg.attachmentUrl ? (() => {
                                            const fileUrl = msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : `${API_BASE_URL.replace('/api/v1', '')}${msg.attachmentUrl}`;
                                            const filename = msg.attachmentUrl.split('/').pop() || 'Document';
                                            return (
                                                <div className="space-y-1.5">
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={cn(
                                                            "flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer text-left",
                                                            isMe ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20 text-primary-foreground" : "bg-muted/50 border-border hover:bg-muted text-foreground"
                                                        )}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="p-2 rounded-md bg-primary/20 text-primary shrink-0">
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-semibold text-xs truncate">{filename}</div>
                                                            <div className="text-[10px] opacity-70">Click to view/download</div>
                                                        </div>
                                                        <Download className="w-4 h-4 shrink-0 opacity-70" />
                                                    </a>
                                                    {msg.content && <div className="break-words leading-relaxed">{msg.content}</div>}
                                                </div>
                                            );
                                        })() : isOnlyEmoji(msg.content) ? (
                                            <div className="text-4xl py-1 inline-block animate-pulse hover:scale-125 transition-transform duration-300 select-none">
                                                {msg.content.trim()}
                                            </div>
                                        ) : (
                                            <div className="break-words leading-relaxed">{msg.content}</div>
                                        )}

                                        <div className={cn(
                                            "text-[10px] mt-1 flex items-center justify-end gap-1 select-none",
                                            isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                                        )}>
                                            {msg.isEdited && <span className="italic">edited</span>}
                                            <span>{new Date(msg.sentAt ? (msg.sentAt.endsWith('Z') || msg.sentAt.includes('+') ? msg.sentAt : `${msg.sentAt}Z`) : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {isMe && (
                                                msg.readReceipts && msg.readReceipts.length > 0 ? (
                                                    <span title="Read"><CheckCheck className="w-3 h-3 text-blue-300" /></span>
                                                ) : (
                                                    <span title="Sent"><Check className="w-3 h-3" /></span>
                                                )
                                            )}
                                        </div>

                                        {/* Reactions Row */}
                                        {Object.keys(reactionCounts).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5 -mb-0.5">
                                                {Object.entries(reactionCounts).map(([emoji, count]) => (
                                                    <span key={emoji} className="bg-background border rounded-full px-1.5 py-0.5 text-[11px] shadow-2xs flex items-center gap-0.5">
                                                        <span>{emoji}</span>
                                                        <span className="text-[10px] font-semibold text-muted-foreground">{count}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Inline Options Panel */}
                                    {isActionOpen && (
                                        <div className={cn(
                                            "mt-1 p-2 rounded-xl border bg-card text-card-foreground shadow-lg text-xs space-y-2 animate-in fade-in duration-150 z-20 max-w-[240px]",
                                            isMe ? "self-end" : "self-start"
                                        )}>
                                            {/* Quick Reactions */}
                                            <div className="flex justify-between p-1 bg-muted/30 rounded-md">
                                                {quickEmojis.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        className="hover:scale-125 transition-transform text-base"
                                                        onClick={() => {
                                                            reactToMessage(msg.id, emoji);
                                                            setActiveActionMsgId(null);
                                                        }}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="border-t my-1" />
                                            {/* Action List */}
                                            <div className="space-y-1">
                                                <button
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-left"
                                                    onClick={() => handleStartReply(msg)}
                                                >
                                                    <Reply className="w-3.5 h-3.5 text-primary" /> Reply
                                                </button>
                                                <button
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-left"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(msg.content);
                                                        toast.success("Copied to clipboard");
                                                        setActiveActionMsgId(null);
                                                    }}
                                                >
                                                    <Copy className="w-3.5 h-3.5" /> Copy Text
                                                </button>
                                                {isMe && !msg.isDeleted && (
                                                    <button
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-left"
                                                        onClick={() => handleStartEdit(msg)}
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5 text-amber-600" /> Edit Message
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-destructive/10 text-destructive cursor-pointer text-left"
                                                        onClick={() => {
                                                            setDeletingMsg(msg);
                                                            setDeleteForEveryone(true);
                                                            setActiveActionMsgId(null);
                                                        }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete Message
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Typing Indicator */}
                {typingUserNames.length > 0 && (
                    <div className="flex justify-start animate-in fade-in duration-200">
                        <div className="bg-muted/60 rounded-2xl px-3.5 py-2 text-xs text-muted-foreground italic flex items-center gap-2">
                            <span className="flex gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-200"></span>
                            </span>
                            <span>{typingUserNames.join(', ')} typing...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area / Banners */}
            <div className="p-3 bg-background border-t shrink-0 space-y-2 relative">
                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-full right-3 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden border">
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme={"auto" as Theme}
                            width={300}
                            height={380}
                            searchPlaceHolder="Search emoji..."
                            lazyLoadEmojis
                        />
                    </div>
                )}

                {/* Image Lightbox Modal */}
                {viewingImage && (
                    <div
                        className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                        onClick={() => setViewingImage(null)}
                    >
                        <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
                            <button
                                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
                                onClick={() => setViewingImage(null)}
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <img src={viewingImage} alt="Full view" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
                        </div>
                    </div>
                )}

                {/* Upload Progress Bar */}
                {isUploading && (
                    <div className="w-full h-1 bg-muted overflow-hidden rounded-full">
                        <div className="h-full bg-primary animate-pulse w-full" />
                    </div>
                )}

                {/* Attachment Preview Bar */}
                {pendingAttachment && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/60 border text-xs">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            {pendingAttachment.type === 'image' && pendingAttachment.previewUrl ? (
                                <img src={pendingAttachment.previewUrl} alt="Preview" className="w-9 h-9 rounded object-cover shrink-0" />
                            ) : pendingAttachment.type === 'video' ? (
                                <div className="w-9 h-9 rounded bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                                    <Film className="w-5 h-5" />
                                </div>
                            ) : (
                                <div className="w-9 h-9 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5" />
                                </div>
                            )}
                            <div className="overflow-hidden">
                                <div className="font-semibold capitalize text-primary text-[11px]">{pendingAttachment.type} Attachment</div>
                                <div className="truncate text-muted-foreground text-xs">{pendingAttachment.file.name}</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearPendingAttachment}>
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}

                {/* Reply Banner */}
                {replyingTo && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-primary/10 border-l-3 border-l-primary text-xs">
                        <div className="overflow-hidden">
                            <div className="font-semibold text-primary">Replying to message</div>
                            <div className="truncate text-muted-foreground">{replyingTo.content}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelCompose}>
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}

                {/* Edit Banner */}
                {editingMessage && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/10 border-l-3 border-l-amber-500 text-xs">
                        <div className="overflow-hidden">
                            <div className="font-semibold text-amber-600">Editing message</div>
                            <div className="truncate text-muted-foreground">{editingMessage.content}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelCompose}>
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}

                {/* Channel restriction notice */}
                {!canSendMessages ? (
                    <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 border rounded-md flex items-center justify-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-purple-600" />
                        <span>Only channel admins can post messages here.</span>
                    </div>
                ) : isRecording ? (
                    /* Voice Recording Active UI */
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">Recording... {formatRecordingTime(recordingSeconds)}</span>
                            <div className="flex-1 flex gap-0.5 items-center overflow-hidden">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-0.5 bg-red-400 rounded-full animate-pulse"
                                        style={{ height: `${Math.random() * 16 + 4}px`, animationDelay: `${i * 50}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={cancelRecording}
                            title="Cancel recording"
                        >
                            <MicOff className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            className="h-10 w-10 shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-xs"
                            onClick={stopRecording}
                            title="Stop and send"
                        >
                            <StopCircle className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex gap-1.5 items-end">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Paperclip Attachment Button */}
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "h-10 w-10 shrink-0 transition-colors",
                                pendingAttachment ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-primary"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach photo, video or document"
                        >
                            <Paperclip className="w-5 h-5" />
                        </Button>

                        {/* Emoji Button */}
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-amber-500 transition-colors"
                            onClick={() => setShowEmojiPicker(p => !p)}
                            title="Emoji"
                        >
                            <Smile className="w-5 h-5" />
                        </Button>

                        <Textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={e => {
                                handleInputChange(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e as any);
                                }
                            }}
                            placeholder={pendingAttachment ? "Add a caption..." : editingMessage ? "Edit message..." : replyingTo ? "Reply..." : "Type a message..."}
                            className="flex-1 min-h-[40px] max-h-[120px] text-sm py-2.5 resize-none overflow-y-auto"
                            autoFocus
                            rows={1}
                        />

                        {/* Send or Mic button */}
                        {(newMessage.trim() || pendingAttachment) ? (
                            <Button
                                type="submit"
                                size="icon"
                                className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-xs transition-transform active:scale-95"
                                disabled={isUploading}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                onClick={startRecording}
                                title="Record voice message"
                            >
                                <Mic className="w-5 h-5" />
                            </Button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
