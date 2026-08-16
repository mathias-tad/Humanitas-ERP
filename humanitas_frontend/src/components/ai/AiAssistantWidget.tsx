import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, X, Sparkles, MessageSquarePlus, History, Loader2, Paperclip, FileText, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { aiChatService, type AiConversation, type AiMessage } from "@/lib/api/aiChatService";

export interface AiAssistantWidgetHandle {
  open: () => void;
}

export const AiAssistantWidget = forwardRef<AiAssistantWidgetHandle>(
  function AiAssistantWidget(_props, ref) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string | undefined>();
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const loadHistory = async () => {
    try {
      const history = await aiChatService.getConversations();
      setConversations(history);
    } catch (error) {
      console.error("Failed to load AI history", error);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      setLoading(true);
      const convo = await aiChatService.getConversation(id);
      setMessages(convo.messages || []);
      setCurrentConvoId(id);
      setView('chat');
    } catch (error) {
      console.error("Failed to load conversation", error);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentConvoId(undefined);
    setSelectedFile(null);
    setView('chat');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 20 * 1024 * 1024) {
        alert("File must be less than 20MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedFile) return;

    const userMessage = input.trim();
    const fileToUpload = selectedFile;
    setInput("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    const newUserMsg: AiMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      attachmentName: fileToUpload?.name,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      let result;
      if (fileToUpload) {
        result = await aiChatService.sendMessageWithFile(userMessage, fileToUpload, currentConvoId);
      } else {
        result = await aiChatService.sendMessage(userMessage, currentConvoId);
      }
      
      const newAiMsg: AiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: result.response,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, newAiMsg]);
      
      if (!currentConvoId && result.conversationId) {
        setCurrentConvoId(result.conversationId);
        loadHistory();
      }
    } catch (error: any) {
      const errorMsg: AiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: error.message || "Failed to process request. Please try again.",
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const handleDownloadDoc = async (format: 'pdf'|'docx'|'excel', prompt: string, docId: string) => {
    if (downloadingDocId) return;
    setDownloadingDocId(docId);
    try {
      await aiChatService.generateDocument(prompt, format);
    } catch (e: any) {
      alert("Failed to download document: " + e.message);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const renderAiMessage = (content: string) => {
    // Look for special [DOCUMENT:pdf:prompt] tags
    const docRegex = /\[DOCUMENT:(pdf|docx|excel):([\s\S]*?)\]/g;
    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = docRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      const format = match[1] as 'pdf'|'docx'|'excel';
      const prompt = match[2];
      const docId = `doc-${match.index}`;
      const isDownloading = downloadingDocId === docId;
      const icon = format === 'pdf' ? '📄' : format === 'docx' ? '📝' : '📊';

      // Extract a short human-readable title from the prompt
      // Take up to 6 meaningful words, capitalise first letter
      const titleWords = prompt
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 6)
        .join(' ');
      const docTitle = titleWords.charAt(0).toUpperCase() + titleWords.slice(1);

      parts.push(
        <div key={match.index} className="my-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">{icon}</div>
            <div>
              <div className="text-sm font-semibold truncate max-w-[160px]" title={docTitle}>{docTitle}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{format} · Ready to download</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 min-w-[100px]"
            disabled={isDownloading}
            onClick={() => handleDownloadDoc(format === 'excel' ? 'excel' : format, prompt, docId)}
          >
            {isDownloading ? (
              <><svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Generating...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Download</>
            )}
          </Button>
        </div>
      );
      lastIndex = docRegex.lastIndex;
    }
    
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.map((part, i) => {
      if (typeof part === 'string') {
        return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>;
      }
      return part;
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 border-l border-white/10 bg-background/80 backdrop-blur-xl flex flex-col h-full shadow-2xl z-[1001]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-inner">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold tracking-tight text-foreground">Humanitas AI</SheetTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Ready to assist
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setView(view === 'history' ? 'chat' : 'history')} title="History" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <History className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={startNewChat} title="New Chat" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {view === 'history' ? (
              <ScrollArea className="flex-1 p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Conversation History</h3>
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground mt-10">No history found.</p>
                  ) : (
                    conversations.map(convo => (
                      <button
                        key={convo.id}
                        onClick={() => loadConversation(convo.id)}
                        className="w-full text-left p-3 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-all flex flex-col gap-1"
                      >
                        <span className="text-sm font-medium line-clamp-1">{convo.title}</span>
                        <span className="text-xs text-muted-foreground">{new Date(convo.updated_at).toLocaleDateString()}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground opacity-60 animate-in fade-in duration-700">
                    <Sparkles className="h-12 w-12 text-blue-500/50" />
                    <div className="max-w-[250px]">
                      <p className="text-sm font-medium">How can I help you today?</p>
                      <p className="text-xs mt-2">I can query ERP data, generate documents, or summarize performance reviews. Attach files using the paperclip icon.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    let mainContent = msg.content || '';
                    let signature = null;
                    if (msg.role === 'ai') {
                      const signatureMatch = mainContent.match(/\*\((Answered by AI:.*?)\)\*[\s]*$/);
                      if (signatureMatch) {
                        signature = signatureMatch[1];
                        mainContent = mainContent.substring(0, signatureMatch.index).trim();
                      }
                    }

                    return (
                    <div key={msg.id} className={`flex gap-3 max-w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role !== 'user' && (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      
                      <div className={`
                        flex flex-col gap-1 max-w-[85%]
                        ${msg.role === 'user' ? 'items-end' : 'items-start'}
                      `}>
                        {msg.attachmentName && (
                          <div className="flex items-center gap-1.5 text-[11px] bg-white/10 px-2 py-1 rounded-md mb-1 border border-white/5">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{msg.attachmentName}</span>
                          </div>
                        )}
                        <div className={`
                          px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words
                          ${msg.role === 'user' 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none' 
                            : msg.role === 'system'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20 rounded-tl-none'
                              : 'bg-muted border border-white/5 rounded-tl-none text-foreground prose prose-sm prose-invert max-w-none'
                          }
                        `}>
                          {msg.role === 'ai' ? (
                            <>
                              {renderAiMessage(mainContent)}
                              {signature && (
                                <div className="text-[10px] text-muted-foreground/60 mt-3 pt-2 border-t border-white/10 italic">
                                  {signature}
                                </div>
                              )}
                            </>
                          ) : (
                            msg.content
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )})
                )}
                {loading && (
                  <div className="flex gap-3 max-w-full justify-start animate-pulse">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-blue-600/50 to-indigo-600/50 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-muted/50 w-24 h-10 border border-white/5"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div className="p-3 bg-background/90 backdrop-blur-md border-t border-white/5 flex flex-col gap-2">
            {selectedFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md self-start text-xs text-blue-400">
                <FileText className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} className="ml-1 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="relative flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0 rounded-full bg-muted/50 hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || view === 'history'}
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={loading ? "AI is thinking..." : "Ask Humanitas AI..."}
                disabled={loading || view === 'history'}
                className="py-6 rounded-full bg-muted/50 border-white/10 focus-visible:ring-blue-500/50"
              />
              <Button 
                size="icon" 
                disabled={(!input.trim() && !selectedFile) || loading || view === 'history'}
                onClick={handleSend}
                className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-transform active:scale-95"
              >
                <Send className="h-4 w-4 text-white ml-0.5" />
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground opacity-60 mt-1">
              AI can make mistakes. Consider verifying important information.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});
