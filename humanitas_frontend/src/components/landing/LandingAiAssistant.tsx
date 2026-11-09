import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  BotOff,
  ArrowRight,
  Sparkles,
  Send,
  X,
  LifeBuoy,
  MessageSquare,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '@/config/api.config';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  draftTicket?: {
    subject: string;
    category: string;
    description: string;
    contact_email: string;
    contact_name?: string;
  };
  ticketCreated?: boolean;
  ticketNumber?: string;
}

interface KnowledgeArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
}

interface LandingAiAssistantProps {
  isHrmsOnly?: boolean;
  isOpenExternal?: boolean;
  onOpenExternal?: () => void;
  onCloseExternal?: () => void;
}

export default function LandingAiAssistant({
  isHrmsOnly = false,
  isOpenExternal,
  onOpenExternal,
  onCloseExternal,
}: LandingAiAssistantProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Sync with external control
  useEffect(() => {
    if (typeof isOpenExternal === 'boolean') {
      setInternalOpen(isOpenExternal);
    }
  }, [isOpenExternal]);

  // Global event listener so any button/link anywhere can open the assistant reliably
  useEffect(() => {
    const handleGlobalOpen = () => {
      setInternalOpen(true);
      onOpenExternal?.();
    };
    window.addEventListener('open-landing-ai', handleGlobalOpen);
    return () => window.removeEventListener('open-landing-ai', handleGlobalOpen);
  }, [onOpenExternal]);

  const isOpen = internalOpen || Boolean(isOpenExternal);

  const handleOpen = () => {
    setInternalOpen(true);
    onOpenExternal?.();
  };

  const handleClose = () => {
    setInternalOpen(false);
    onCloseExternal?.();
  };

  const [aiStatus, setAiStatus] = useState<{
    available: boolean;
    mode: string;
    message?: string;
  }>({
    available: true,
    mode: 'online',
  });

  // Verify AI status from backend
  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE_URL}/public/landing-ai/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setAiStatus({
            available: data.available === true,
            mode: data.mode || (data.available ? 'online' : 'unavailable'),
            message: data.message,
          });
        }
      })
      .catch(() => {
        // Backend API unreachable or down -> Mark AI as unavailable!
        if (isMounted) {
          setAiStatus({
            available: false,
            mode: 'unreachable',
            message: 'The AI Assistant service is currently unreachable. You can create a support ticket directly with our human specialists or browse our FAQs.',
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'chat' | 'tickets' | 'faqs'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: isHrmsOnly
        ? `👋 **Hello! Welcome to Humanitas.**

I am your **Humanitas Platform Assistant**. I have verified, in-depth knowledge of our **Human Capital Management (HRMS)** and **Performance Management (PMS)** operating systems.

Ask me anything about employee records, biometrics, shifts, automated payroll, or trial registration.

*(Note: Looking for full ERP modules like Multi-Warehouse Inventory, Sales, Purchasing, POS, or Accounting? Ask me and I will direct you to Humanitas ERP at [humanitas-erp.ziontech.tech](https://humanitas-erp.ziontech.tech)!)*`
        : `👋 **Hello! Welcome to Humanitas ERP.**

I am your **Enterprise Platform Assistant**. I have verified, deep knowledge of the complete Humanitas ERP ecosystem:
- **HRMS & Payroll**: Biometrics, shifts, leave, candidate ATS, Python payroll
- **Inventory & Warehouse**: Multi-warehouse stock quant, FIFO/AVCO costing
- **Purchasing & Vendors**: RFQs, purchase orders, 3-way matching
- **Sales & CRM**: Leads, quotations, delivery notes, ZATCA e-invoicing
- **Point of Sale (POS)**: Offline POS checkout, thermal receipts
- **Accounting**: Double-entry ledger, balance sheet, trial balance, P&L
- **AI Intelligence Suite**: Autonomous actions, document studio, policy RAG

How can I assist your business today?`,
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active Draft Ticket State (inside chat)
  const [activeDraft, setActiveDraft] = useState<{
    subject: string;
    category: string;
    description: string;
    contact_email: string;
    contact_name: string;
  } | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  // Direct Ticket Form State (in Help Center tab)
  const [directTicket, setDirectTicket] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    contact_email: '',
    contact_name: '',
    description: '',
  });
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [directSuccessNumber, setDirectSuccessNumber] = useState<string | null>(null);

  // Ticket Tracker State
  const [trackNumber, setTrackNumber] = useState('');
  const [trackEmail, setTrackEmail] = useState('');
  const [trackedTicket, setTrackedTicket] = useState<any | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // FAQs State
  const [faqs, setFaqs] = useState<KnowledgeArticle[]>([]);
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [loadingFaqs, setLoadingFaqs] = useState(false);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeDraft]);

  // Load published FAQs when opening FAQ tab
  useEffect(() => {
    if (activeTab === 'faqs' && faqs.length === 0) {
      fetchFaqs();
    }
  }, [activeTab]);

  const fetchFaqs = async () => {
    setLoadingFaqs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/public/platform-knowledge`);
      if (res.ok) {
        const data = await res.json();
        setFaqs(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFaqs(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    setInputMessage('');
    const userMsgId = `user-${Date.now()}`;
    const newMessages: Message[] = [...messages, { id: userMsgId, role: 'user', content: text }];
    setMessages(newMessages);
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/public/landing-ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Thank you for your message.',
        citations: data.citations || [],
        ticketCreated: data.ticketCreated,
        ticketNumber: data.ticketNumber,
        draftTicket: data.draftTicket,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.available === false) {
        setAiStatus((prev) => ({
          ...prev,
          available: false,
          mode: 'unavailable',
        }));
      }

      if (data.draftTicket) {
        setActiveDraft({
          subject: data.draftTicket.subject || 'Support Inquiry',
          category: data.draftTicket.category || 'general',
          description: data.draftTicket.description || text,
          contact_email: data.draftTicket.contact_email || '',
          contact_name: data.draftTicket.contact_name || '',
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ The AI Assistant is currently unreachable or offline. You can create a support ticket directly with our specialists in the **Help Center** tab or browse our **FAQs**.`,
          draftTicket: {
            subject: 'Support Inquiry',
            category: 'general',
            description: text,
            contact_email: '',
          },
        },
      ]);
      setAiStatus((prev) => ({
        ...prev,
        available: false,
        mode: 'unreachable',
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmDraftTicket = async () => {
    if (!activeDraft) return;
    if (!activeDraft.contact_email.trim()) {
      toast.error('Please enter your contact email address');
      return;
    }

    setIsSubmittingDraft(true);
    try {
      const res = await fetch(`${API_BASE_URL}/public/support-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activeDraft,
          created_by_type: 'ai_on_behalf',
          ai_conversation_summary: messages
            .slice(-4)
            .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n'),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to submit ticket');
      }

      const data = await res.json();
      const ticketNum = data.ticket_number || data.ticket?.ticket_number;

      setMessages((prev) => [
        ...prev,
        {
          id: `ticket-success-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Support Ticket Created Successfully on Your Behalf!**

- **Ticket Number**: \`${ticketNum}\`
- **Email**: ${activeDraft.contact_email}
- **Subject**: ${activeDraft.subject}

Our human support team has received your ticket and conversation context. A specialist will follow up with you via email promptly.`,
          ticketCreated: true,
          ticketNumber: ticketNum,
        },
      ]);

      setActiveDraft(null);
      toast.success(`Ticket #${ticketNum} submitted!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit support ticket');
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const handleDirectTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTicket.subject.trim() || !directTicket.description.trim() || !directTicket.contact_email.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmittingDirect(true);
    try {
      const res = await fetch(`${API_BASE_URL}/public/support-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...directTicket,
          created_by_type: 'tenant',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to submit ticket');
      }

      const data = await res.json();
      const ticketNum = data.ticket_number || data.ticket?.ticket_number;
      setDirectSuccessNumber(ticketNum);
      toast.success(`Support ticket #${ticketNum} created!`);
      setDirectTicket({
        subject: '',
        category: 'general',
        priority: 'medium',
        contact_email: '',
        contact_name: '',
        description: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit support ticket');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  const handleTrackTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNumber.trim()) {
      toast.error('Please enter ticket number');
      return;
    }

    setIsTracking(true);
    setTrackedTicket(null);
    try {
      const url = new URL(`${API_BASE_URL}/public/support-tickets/track/${encodeURIComponent(trackNumber.trim())}`);
      if (trackEmail.trim()) {
        url.searchParams.append('email', trackEmail.trim());
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Ticket not found');
      }

      const data = await res.json();
      setTrackedTicket(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to locate ticket');
    } finally {
      setIsTracking(false);
    }
  };

  const quickPrompts = isHrmsOnly
    ? [
        'Explore HRMS & Biometric Features',
        'Looking for ERP Modules?',
        'How does Python payroll work?',
        'Security & Tenant Isolation Standards',
        'Create a support ticket with a human',
      ]
    : [
        'What modules are included in ERP?',
        'How does Python payroll calculation work?',
        'SaaS Security & Database Isolation',
        'Subscription packages and 14-day free trial',
        'Create a support ticket with human support',
      ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.title.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.content.toLowerCase().includes(faqSearch.toLowerCase()) ||
      (f.tags || []).some((t) => t.toLowerCase().includes(faqSearch.toLowerCase()))
  );

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          id="landing-ai-floating-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          className="fixed bottom-6 right-6 z-[99999] cursor-pointer flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-300 font-medium text-sm group border border-white/20 select-none pointer-events-auto"
          aria-label="Open AI Help and Human Support"
        >
          <div className="relative pointer-events-none">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white animate-ping" />
          </div>
          <span className="pointer-events-none font-semibold">Need Help? Ask AI</span>
          <Badge className="bg-white/20 text-white text-[10px] uppercase font-bold py-0 px-1.5 border-none pointer-events-none">
            24/7
          </Badge>
        </button>
      )}

      {/* Floating Dialog / Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[99999] w-[95vw] sm:w-[480px] h-[640px] max-h-[85vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Bot className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm leading-tight text-white">
                    {isHrmsOnly ? 'Humanitas Assistant' : 'Humanitas ERP Copilot'}
                  </h3>
                  {aiStatus.available ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] py-0 px-1.5 font-bold uppercase tracking-wider">
                      Online
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[9px] py-0 px-1.5 font-bold uppercase tracking-wider">
                      Support Only
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-white/80 leading-none mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  Grounded Platform AI • Zero Guessing
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Bar between AI Chat, Direct Ticket, and FAQs */}
          <div className="grid grid-cols-3 bg-muted/60 border-b border-border text-xs font-medium">
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                activeTab === 'chat'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              AI Copilot
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                activeTab === 'tickets'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Help Center
            </button>
            <button
              onClick={() => setActiveTab('faqs')}
              className={`py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                activeTab === 'faqs'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              SaaS FAQs
            </button>
          </div>

          {/* Tab 1: AI Chat */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
              {!aiStatus.available ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-muted/15">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
                    <BotOff className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="font-semibold text-sm text-foreground">AI Assistant Currently Unavailable</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {aiStatus.message || "Our automated AI Assistant is currently offline or undergoing setup in this environment."}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Our human operations team and product specialists are available to answer all questions and assist with your organization.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs pt-2">
                    <Button
                      type="button"
                      onClick={() => setActiveTab('tickets')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 flex-1 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <LifeBuoy className="w-4 h-4" />
                      Create Support Ticket
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('faqs')}
                      className="text-xs h-9 flex-1 flex items-center justify-center gap-1.5 border-border hover:bg-muted cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      Browse FAQs
                    </Button>
                  </div>
                </div>
              ) : (
                <>
              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] text-xs rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-muted/70 text-foreground border border-border/60 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {/* Citations */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                          {m.citations.map((cite, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono"
                            >
                              ✓ {cite}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 1-Click Ticket Escalation Action when question is not answered */}
                      {m.draftTicket && (
                        <div className="mt-2.5 p-2 rounded-xl bg-background/90 border border-border flex items-center justify-between gap-2 shadow-xs">
                          <span className="text-[11px] text-muted-foreground">
                            Need human specialist assistance?
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setDirectTicket((prev) => ({
                                  ...prev,
                                  subject: m.draftTicket?.subject || 'Support Inquiry',
                                  description: m.draftTicket?.description || m.content,
                                  category: m.draftTicket?.category || 'general',
                                }));
                                setActiveTab('tickets');
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-7 px-2.5 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Create Ticket</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveTab('faqs')}
                              className="text-[11px] h-7 px-2 border-border hover:bg-muted cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>FAQs</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Interactive Ticket Draft Card */}
                {activeDraft && (
                  <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-indigo-500/10 border-2 border-purple-500/30 rounded-xl p-3.5 space-y-3 shadow-md animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                        <Bot className="w-4 h-4 text-purple-600" />
                        AI Prepared Support Ticket Draft
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-purple-50 dark:bg-purple-950/50">
                        Confirmation Required
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Please confirm or update your details. Once confirmed, the AI will create this ticket on your behalf with priority routing.
                    </p>

                    <div className="space-y-2 text-xs">
                      <div>
                        <Label className="text-[11px]">Subject</Label>
                        <Input
                          value={activeDraft.subject}
                          onChange={(e) => setActiveDraft({ ...activeDraft, subject: e.target.value })}
                          className="h-8 text-xs mt-0.5"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px]">Your Email *</Label>
                          <Input
                            type="email"
                            placeholder="name@company.com"
                            value={activeDraft.contact_email}
                            onChange={(e) => setActiveDraft({ ...activeDraft, contact_email: e.target.value })}
                            className="h-8 text-xs mt-0.5"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Your Name</Label>
                          <Input
                            placeholder="Full Name"
                            value={activeDraft.contact_name}
                            onChange={(e) => setActiveDraft({ ...activeDraft, contact_name: e.target.value })}
                            className="h-8 text-xs mt-0.5"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px]">Inquiry Summary</Label>
                        <textarea
                          rows={2}
                          value={activeDraft.description}
                          onChange={(e) => setActiveDraft({ ...activeDraft, description: e.target.value })}
                          className="w-full text-xs p-2 rounded-md border border-input bg-background mt-0.5"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleConfirmDraftTicket}
                        disabled={isSubmittingDraft}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 flex-1"
                      >
                        {isSubmittingDraft ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        Confirm & Create Ticket
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveDraft(null)}
                        className="text-xs h-8 text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {isSending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Analyzing platform documentation...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Suggestions */}
              {messages.length <= 3 && !activeDraft && (
                <div className="px-3 py-1.5 bg-muted/30 border-t border-border flex gap-1.5 overflow-x-auto text-[11px]">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(prompt)}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-background border border-border hover:border-blue-500 hover:text-blue-600 transition-colors text-muted-foreground shadow-xs shrink-0"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Form */}
              <div className="p-2.5 border-t border-border bg-background">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder="Ask about features, pricing, architecture..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={isSending}
                    className="text-xs h-9"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !inputMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 h-9 w-9"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Help Center & Direct Ticket */}
          {activeTab === 'tickets' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-background text-xs">
              {/* Direct Ticket Creation */}
              <div>
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-1">
                  <LifeBuoy className="w-4 h-4 text-blue-600" />
                  Submit Support Ticket to Operations
                </h4>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Inquiries requiring customized migrations, technical escalations, or human assistance are routed directly to our operations engineers.
                </p>

                {directSuccessNumber ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      Ticket #{directSuccessNumber} Created
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Our human support team will respond to your email. You can track this ticket below.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDirectSuccessNumber(null)}
                      className="mt-2 text-xs"
                    >
                      Submit Another Ticket
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleDirectTicketSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Your Name</Label>
                        <Input
                          placeholder="John Doe"
                          value={directTicket.contact_name}
                          onChange={(e) => setDirectTicket({ ...directTicket, contact_name: e.target.value })}
                          className="h-8 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Email *</Label>
                        <Input
                          type="email"
                          placeholder="john@company.com"
                          value={directTicket.contact_email}
                          onChange={(e) => setDirectTicket({ ...directTicket, contact_email: e.target.value })}
                          className="h-8 text-xs mt-0.5"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Category</Label>
                        <select
                          value={directTicket.category}
                          onChange={(e) => setDirectTicket({ ...directTicket, category: e.target.value })}
                          className="w-full h-8 text-xs mt-0.5 rounded-md border border-input bg-background px-2"
                        >
                          <option value="general">General Inquiry</option>
                          <option value="billing">Pricing & Billing</option>
                          <option value="technical">Technical Support</option>
                          <option value="onboarding">Tenant Registration</option>
                          <option value="compliance">Security & SLA</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px]">Priority</Label>
                        <select
                          value={directTicket.priority}
                          onChange={(e) => setDirectTicket({ ...directTicket, priority: e.target.value })}
                          className="w-full h-8 text-xs mt-0.5 rounded-md border border-input bg-background px-2"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px]">Subject *</Label>
                      <Input
                        placeholder="e.g., Enterprise Custom Onboarding Inquiry"
                        value={directTicket.subject}
                        onChange={(e) => setDirectTicket({ ...directTicket, subject: e.target.value })}
                        className="h-8 text-xs mt-0.5"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-[11px]">Description *</Label>
                      <textarea
                        rows={3}
                        placeholder="Describe your inquiry or technical requirement in detail..."
                        value={directTicket.description}
                        onChange={(e) => setDirectTicket({ ...directTicket, description: e.target.value })}
                        className="w-full text-xs p-2 rounded-md border border-input bg-background mt-0.5"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmittingDirect}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                    >
                      {isSubmittingDirect ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                      Submit Direct Ticket
                    </Button>
                  </form>
                )}
              </div>

              {/* Track Ticket Status */}
              <div className="pt-3 border-t border-border">
                <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5 mb-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  Track Existing Ticket
                </h4>
                <form onSubmit={handleTrackTicket} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Ticket # (e.g. TICK-2026-0001)"
                      value={trackNumber}
                      onChange={(e) => setTrackNumber(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Your email (optional)"
                      value={trackEmail}
                      onChange={(e) => setTrackEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline" disabled={isTracking} className="w-full text-xs h-7">
                    {isTracking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : 'Check Ticket Status'}
                  </Button>
                </form>

                {trackedTicket && (
                  <div className="mt-3 p-3 bg-muted/60 border border-border rounded-lg space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-600">{trackedTicket.ticket_number}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        {trackedTicket.status}
                      </Badge>
                    </div>
                    <div className="font-medium text-foreground">{trackedTicket.subject}</div>
                    {trackedTicket.resolution_notes && (
                      <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 text-emerald-900 dark:text-emerald-300 text-[11px]">
                        <strong>Admin Response:</strong> {trackedTicket.resolution_notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Official FAQs & Knowledge Base */}
          {activeTab === 'faqs' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search verified knowledge base..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {loadingFaqs ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading published documentation...
                </div>
              ) : filteredFaqs.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-xs">
                  No FAQs matching your search query.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFaqs.map((faq) => {
                    const isExpanded = expandedFaqId === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className="border border-border rounded-lg p-2.5 hover:border-blue-400 transition-colors"
                      >
                        <button
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="w-full flex items-center justify-between text-left font-semibold text-xs text-foreground"
                        >
                          <span>{faq.title}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
                            {faq.content}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
