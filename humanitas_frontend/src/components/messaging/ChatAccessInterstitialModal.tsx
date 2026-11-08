import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShieldAlert, Sparkles, Send, Clock, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../config/api.config';
import { getAuthHeaders } from '../../context/AuthContext';

export interface ChatAccessCheckResult {
  canChat: boolean;
  isTargetRestricted?: boolean;
  targetRole?: string;
  targetName?: string;
  triagePrompt?: string;
  pendingRequest?: {
    id: string;
    status: string;
    reason: string;
    createdAt?: string;
  } | null;
}

interface ChatAccessInterstitialModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    fullName: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
  } | null;
  accessCheck: ChatAccessCheckResult | null;
  onAccessGranted?: () => void;
}

export function ChatAccessInterstitialModal({
  isOpen,
  onClose,
  targetUser,
  accessCheck,
  onAccessGranted,
}: ChatAccessInterstitialModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<any>(accessCheck?.pendingRequest || null);

  if (!targetUser) return null;

  const handleOpenAiHelp = () => {
    const roleLabel = (targetUser.role || 'HR / Leadership').replace('_', ' ');
    const triagePrompt = `I would like assistance regarding ${roleLabel} policies or procedures before reaching out directly to ${targetUser.fullName}. What does the company knowledge base say?`;
    window.dispatchEvent(new CustomEvent('open-ai-triage', { detail: { prompt: triagePrompt } }));
    onClose();
  };

  const handleRequestAccess = async () => {
    if (!reason.trim()) {
      toast.error('Please enter a brief reason for requesting direct chat');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/messaging/access-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: targetUser.id,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit request');
      }

      const data = await res.json();
      toast.success('Direct chat access request sent to ' + targetUser.fullName);
      setSubmittedRequest(data.grant || { status: 'pending', reason: reason.trim() });
      onAccessGranted?.();
      setReason('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit access request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPending = submittedRequest || accessCheck?.pendingRequest;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-amber-500/20 shadow-2xl bg-card">
        {/* Header with warning accent */}
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-5 border-b border-border">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-12 w-12 border-2 border-amber-500/40">
                <AvatarImage src={targetUser.avatarUrl} />
                <AvatarFallback className="bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  {targetUser.fullName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1 rounded-full shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  Role-Protected Direct Chat
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground mt-1 truncate">
                {targetUser.fullName}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">
                {targetUser.role ? targetUser.role.replace('_', ' ') : 'Restricted Role'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Triage Guidance Box */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
              <HelpCircle className="w-4 h-4" />
              <span>Department Communication Notice</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {accessCheck?.triagePrompt ||
                'Direct messaging to this role is restricted to maintain efficiency. Please check company policies with the AI Assistant first.'}
            </p>
          </div>

          {/* Option 1: AI Assistant First */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Step 1: Check with AI Assistant First
              </span>
              <span className="text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                Instant Answers
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The AI has full access to company guidelines, leave entitlements, employment contracts, and workplace proclamations.
            </p>
            <Button
              onClick={handleOpenAiHelp}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold text-xs h-9 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Ask AI Assistant About Policies
            </Button>
          </div>

          {/* Option 2: Request Direct Chat Access */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                Step 2: Request Direct Chat Permission
              </span>
            </div>

            {currentPending ? (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Access Request Pending</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Your request is awaiting review by {targetUser.fullName}. You will be able to message them as soon as access is permitted.
                </p>
                {currentPending.reason && (
                  <p className="text-[10px] italic text-muted-foreground mt-1">
                    "{currentPending.reason}"
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  If the AI cannot resolve your issue, please state your reason. {targetUser.fullName} can grant you timed or permanent direct chat access.
                </p>
                <Textarea
                  placeholder="State the reason or subject of your direct inquiry (e.g. urgent grievance, confidential contract question)..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
                <Button
                  onClick={handleRequestAccess}
                  disabled={isSubmitting || !reason.trim()}
                  variant="outline"
                  className="w-full text-xs h-9 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-600 font-semibold"
                >
                  <Send className="w-3.5 h-3.5 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit Direct Chat Request'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-muted/30 border-t border-border flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
