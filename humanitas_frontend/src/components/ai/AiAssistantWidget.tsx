import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Send,
  X,
  Sparkles,
  MessageSquarePlus,
  History,
  Loader2,
  Paperclip,
  FileText,
  Download,
  Lock,
  ChevronRight,
  UploadCloud,
  FileCheck,
  Layers,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useModules } from "@/context/ModuleContext";
import {
  aiChatService,
  type AiConversation,
  type AiMessage,
  type AiDocumentTemplate,
} from "@/lib/api/aiChatService";

export interface AiAssistantWidgetHandle {
  open: () => void;
}

export const AiAssistantWidget = forwardRef<AiAssistantWidgetHandle>(
  function AiAssistantWidget(_props, ref) {
    const { isAiFeatureEnabled } = useModules();
    const canPerformActions = isAiFeatureEnabled("actions");
    const canGenerateDocs = isAiFeatureEnabled("documents");

    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [conversations, setConversations] = useState<AiConversation[]>([]);
    const [currentConvoId, setCurrentConvoId] = useState<string | undefined>();
    const [view, setView] = useState<"chat" | "templates" | "history">("chat");

    // Templates state
    const [templates, setTemplates] = useState<AiDocumentTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<AiDocumentTemplate | null>(null);
    const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
    const [customNotes, setCustomNotes] = useState("");
    const [templateFormat, setTemplateFormat] = useState<"pdf" | "docx" | "excel">("pdf");
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
    const [templateTab, setTemplateTab] = useState<"builtin" | "custom">("builtin");

    // Custom template upload state
    const [customTemplateFile, setCustomTemplateFile] = useState<File | null>(null);
    const [customPrompt, setCustomPrompt] = useState("");
    const [customFormat, setCustomFormat] = useState<"pdf" | "docx" | "excel">("pdf");

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const customTemplateInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }));

    useEffect(() => {
      if (open) {
        loadHistory();
        if (canGenerateDocs && templates.length === 0) {
          loadTemplates();
        }
      }
    }, [open, canGenerateDocs]);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages, loading]);

    const loadHistory = async () => {
      try {
        const history = await aiChatService.getConversations();
        setConversations(history || []);
      } catch (error) {
        console.error("Failed to load AI history", error);
      }
    };

    const loadTemplates = async () => {
      try {
        const list = await aiChatService.getTemplates();
        setTemplates(list || []);
      } catch (error) {
        console.error("Failed to load AI templates", error);
      }
    };

    const loadConversation = async (id: string) => {
      try {
        setLoading(true);
        const convo = await aiChatService.getConversation(id);
        setMessages(convo.messages || []);
        setCurrentConvoId(id);
        setView("chat");
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
      setView("chat");
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
        role: "user",
        content: userMessage,
        attachmentName: fileToUpload?.name,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newUserMsg]);
      setLoading(true);

      try {
        let result;
        if (fileToUpload) {
          result = await aiChatService.sendMessageWithFile(
            userMessage,
            fileToUpload,
            currentConvoId,
          );
        } else {
          result = await aiChatService.sendMessage(userMessage, currentConvoId);
        }

        const newAiMsg: AiMessage = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: result.response,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, newAiMsg]);

        if (!currentConvoId && result.conversationId) {
          setCurrentConvoId(result.conversationId);
          loadHistory();
        }
      } catch (error: any) {
        const errorMsg: AiMessage = {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: error.message || "Failed to process request. Please try again.",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

    const handleDownloadDoc = async (
      format: "pdf" | "docx" | "excel",
      prompt: string,
      docId: string,
    ) => {
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

    const handleGenerateBuiltinTemplate = async () => {
      if (!selectedTemplate) return;
      setIsGeneratingDoc(true);
      try {
        await aiChatService.generateFromTemplate(
          selectedTemplate.id,
          templateFormat,
          templateParams,
          customNotes,
        );
        setSelectedTemplate(null);
        setTemplateParams({});
        setCustomNotes("");
      } catch (e: any) {
        alert("Failed to generate document: " + e.message);
      } finally {
        setIsGeneratingDoc(false);
      }
    };

    const handleGenerateCustomTemplate = async () => {
      if (!customTemplateFile) {
        alert("Please select a template file first.");
        return;
      }
      setIsGeneratingDoc(true);
      try {
        await aiChatService.generateWithReferenceFile(
          customTemplateFile,
          customPrompt || "Generate document strictly conforming to the uploaded reference template structure.",
          customFormat,
        );
        setCustomTemplateFile(null);
        setCustomPrompt("");
        if (customTemplateInputRef.current) customTemplateInputRef.current.value = "";
      } catch (e: any) {
        alert("Failed to generate custom template document: " + e.message);
      } finally {
        setIsGeneratingDoc(false);
      }
    };

    const renderAiMessage = (content: string) => {
      const docRegex = /\[DOCUMENT:(pdf|docx|excel):([\s\S]*?)\]/g;
      let parts = [];
      let lastIndex = 0;
      let match;

      while ((match = docRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        const format = match[1] as "pdf" | "docx" | "excel";
        const prompt = match[2];
        const docId = `doc-${match.index}`;
        const isDownloading = downloadingDocId === docId;
        const icon = format === "pdf" ? "📄" : format === "docx" ? "📝" : "📊";

        const titleWords = prompt
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .slice(0, 6)
          .join(" ");
        const docTitle = titleWords.charAt(0).toUpperCase() + titleWords.slice(1);

        parts.push(
          <div
            key={match.index}
            className="my-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl">
                {icon}
              </div>
              <div>
                <div
                  className="text-sm font-semibold truncate max-w-[160px]"
                  title={docTitle}
                >
                  {docTitle}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {format} · Ready to download
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 min-w-[100px] gold-glow"
              disabled={isDownloading}
              onClick={() =>
                handleDownloadDoc(
                  format === "excel" ? "excel" : format,
                  prompt,
                  docId,
                )
              }
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </div>,
        );
        lastIndex = docRegex.lastIndex;
      }

      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      return parts.map((part, i) => {
        if (typeof part === "string") {
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
              {part}
            </ReactMarkdown>
          );
        }
        return part;
      });
    };

    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 border-l border-border bg-card/95 backdrop-blur-xl flex flex-col h-full shadow-2xl z-[1001]">
          {/* Header */}
          <div className="p-4 border-b border-border bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg text-white font-bold">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-base font-bold text-foreground">
                      Humanitas AI
                    </SheetTitle>
                    {canPerformActions ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <Sparkles className="h-2.5 w-2.5" /> Full Copilot
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        <Bot className="h-2.5 w-2.5" /> Chat Help Only
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Operational AI Assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startNewChat}
                  title="New Chat"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Navigation Switcher Tabs */}
            <div className="flex items-center gap-1 mt-3 bg-muted/50 p-1 rounded-lg border border-border/60">
              <button
                onClick={() => setView("chat")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  view === "chat"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>

              <button
                onClick={() => setView("templates")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  view === "templates"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Doc Studio</span>
                {!canGenerateDocs && <Lock className="h-2.5 w-2.5 text-muted-foreground/80 ml-0.5" />}
              </button>

              <button
                onClick={() => setView("history")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  view === "history"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>History</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {/* VIEW 1: HISTORY */}
            {view === "history" && (
              <ScrollArea className="flex-1 p-4">
                <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Past Conversations
                </h3>
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground mt-10">
                      No conversation history yet.
                    </p>
                  ) : (
                    conversations.map((convo) => (
                      <button
                        key={convo.id}
                        onClick={() => loadConversation(convo.id)}
                        className="w-full text-left p-3 rounded-xl bg-muted/40 hover:bg-muted border border-border/50 hover:border-border transition-all flex flex-col gap-1"
                      >
                        <span className="text-sm font-medium line-clamp-1 text-foreground">
                          {convo.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(convo.updated_at).toLocaleDateString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            {/* VIEW 2: DOCUMENT STUDIO */}
            {view === "templates" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!canGenerateDocs ? (
                  <div className="p-6 rounded-2xl bg-muted/40 border border-border flex flex-col items-center text-center space-y-3 mt-6">
                    <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Lock className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      Document Generation Locked
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Your organization's current subscription package is set to{" "}
                      <strong>AI Chat Help Only</strong>. Autonomous document generation from
                      live database tables is available with the{" "}
                      <code className="text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                        ai.documents
                      </code>{" "}
                      or{" "}
                      <code className="text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                        ai.full
                      </code>{" "}
                      tier. Contact your administrator to upgrade.
                    </p>
                  </div>
                ) : selectedTemplate ? (
                  /* Single Template Detail & Generation Form */
                  <div className="space-y-4">
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
                    </button>

                    <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                          {selectedTemplate.category}
                        </span>
                        <div className="flex items-center gap-1">
                          {selectedTemplate.supportedFormats.map((f) => (
                            <span
                              key={f}
                              className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-foreground">
                        {selectedTemplate.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplate.description}
                      </p>
                    </div>

                    {/* Parameters Form */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Template Parameters
                      </h4>
                      {selectedTemplate.parameters.map((param) => (
                        <div key={param.key} className="space-y-1">
                          <label className="text-xs font-medium text-foreground">
                            {param.label}
                            {param.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          <Input
                            type={param.type === "number" ? "number" : "text"}
                            placeholder={param.description || `Enter ${param.label.toLowerCase()}`}
                            value={templateParams[param.key] || ""}
                            onChange={(e) =>
                              setTemplateParams({
                                ...templateParams,
                                [param.key]: e.target.value,
                              })
                            }
                            className="bg-muted/40 border-border text-xs"
                          />
                        </div>
                      ))}

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          Additional Custom Instructions (Optional)
                        </label>
                        <Textarea
                          placeholder="e.g. Include official company header, emphasize 3 years of service, and format in USD."
                          value={customNotes}
                          onChange={(e) => setCustomNotes(e.target.value)}
                          rows={2}
                          className="bg-muted/40 border-border text-xs"
                        />
                      </div>

                      {/* Format selector */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          Output Format
                        </label>
                        <div className="flex gap-2">
                          {selectedTemplate.supportedFormats.map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setTemplateFormat(f as any)}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold uppercase transition-all ${
                                templateFormat === f
                                  ? "bg-amber-500 text-black shadow-md"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleGenerateBuiltinTemplate}
                        disabled={isGeneratingDoc}
                        className="w-full gold-gradient gold-glow text-black font-bold h-10 mt-2"
                      >
                        {isGeneratingDoc ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Fetching Data & Generating...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Generate & Download Document
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Template Selector Hub */
                  <div className="space-y-4">
                    {/* Sub-tabs: Built-in vs Custom Upload */}
                    <div className="flex gap-2 border-b border-border pb-2">
                      <button
                        onClick={() => setTemplateTab("builtin")}
                        className={`text-xs font-bold pb-1 transition-all ${
                          templateTab === "builtin"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        AI Enterprise Templates ({templates.length})
                      </button>
                      <button
                        onClick={() => setTemplateTab("custom")}
                        className={`text-xs font-bold pb-1 transition-all ${
                          templateTab === "custom"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Upload Custom Template
                      </button>
                    </div>

                    {templateTab === "builtin" ? (
                      <div className="space-y-2.5">
                        <p className="text-xs text-muted-foreground">
                          Choose an AI-designed enterprise template. Live data will be automatically
                          fetched from your database:
                        </p>
                        {templates.map((tpl) => (
                          <div
                            key={tpl.id}
                            onClick={() => {
                              setSelectedTemplate(tpl);
                              setTemplateFormat(tpl.supportedFormats[0] || "pdf");
                            }}
                            className="p-3.5 rounded-xl bg-muted/40 hover:bg-muted border border-border hover:border-amber-500/50 transition-all cursor-pointer group flex items-center justify-between"
                          >
                            <div className="space-y-1 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-amber-500 uppercase">
                                  {tpl.category}
                                </span>
                                <span className="text-xs font-semibold text-foreground group-hover:text-amber-500 transition-colors">
                                  {tpl.name}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {tpl.description}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Custom Template Upload Flow */
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                          Upload your organization's existing document template (.docx, .pdf, or .txt).
                          AI will mirror its layout and fill placeholders with live database data.
                        </p>

                        <div
                          onClick={() => customTemplateInputRef.current?.click()}
                          className="border-2 border-dashed border-border hover:border-amber-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center space-y-2"
                        >
                          <input
                            type="file"
                            ref={customTemplateInputRef}
                            className="hidden"
                            accept=".docx,.pdf,.txt"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setCustomTemplateFile(e.target.files[0]);
                              }
                            }}
                          />
                          {customTemplateFile ? (
                            <>
                              <FileCheck className="h-8 w-8 text-emerald-500" />
                              <div className="text-xs font-bold text-foreground">
                                {customTemplateFile.name}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Click to change file ({(customTemplateFile.size / 1024).toFixed(1)} KB)
                              </p>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="h-8 w-8 text-muted-foreground" />
                              <div className="text-xs font-semibold text-foreground">
                                Click to select template file (.docx, .pdf)
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Supports Word templates and PDF reference forms up to 20MB
                              </p>
                            </>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">
                            Data Retrieval & Fill Instructions
                          </label>
                          <Textarea
                            placeholder="e.g. Fill this contract for employee John Doe. Replace {{salary}} with current monthly pay from payroll, and {{manager}} with department head name."
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            rows={3}
                            className="bg-muted/40 border-border text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">
                            Output Format
                          </label>
                          <div className="flex gap-2">
                            {(["pdf", "docx", "excel"] as const).map((fmt) => (
                              <button
                                key={fmt}
                                type="button"
                                onClick={() => setCustomFormat(fmt)}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold uppercase transition-all ${
                                  customFormat === fmt
                                    ? "bg-amber-500 text-black shadow-md"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button
                          onClick={handleGenerateCustomTemplate}
                          disabled={!customTemplateFile || isGeneratingDoc}
                          className="w-full gold-gradient gold-glow text-black font-bold h-10 mt-2"
                        >
                          {isGeneratingDoc ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Cloning Template & Filling Data...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Document from Template
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: CHAT VIEW */}
            {view === "chat" && (
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground opacity-70 animate-in fade-in duration-700">
                    <Sparkles className="h-12 w-12 text-amber-500/50" />
                    <div className="max-w-[280px]">
                      <p className="text-sm font-semibold text-foreground">
                        How can I help you today?
                      </p>
                      <p className="text-xs mt-2 text-muted-foreground">
                        {canPerformActions
                          ? "I can query ERP records, execute system tasks on your behalf, or generate enterprise documents."
                          : "I can answer questions, guide you through any page or button, and query system data."}
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    let mainContent = msg.content || "";
                    let signature = null;
                    if (msg.role === "ai") {
                      const signatureMatch = mainContent.match(
                        /\*\((Answered by AI:.*?)\)\*[\s]*$/,
                      );
                      if (signatureMatch) {
                        signature = signatureMatch[1];
                        mainContent = mainContent.substring(0, signatureMatch.index).trim();
                      }
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-full ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role !== "user" && (
                          <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}

                        <div
                          className={`
                          flex flex-col gap-1 max-w-[85%]
                          ${msg.role === "user" ? "items-end" : "items-start"}
                        `}
                        >
                          {msg.attachmentName && (
                            <div className="flex items-center gap-1.5 text-[11px] bg-muted px-2 py-1 rounded-md mb-1 border border-border">
                              <FileText className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">
                                {msg.attachmentName}
                              </span>
                            </div>
                          )}
                          <div
                            className={`
                            px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words
                            ${
                              msg.role === "user"
                                ? "bg-amber-500 text-black font-medium rounded-tr-none"
                                : msg.role === "system"
                                  ? "bg-red-500/10 text-red-500 border border-red-500/20 rounded-tl-none"
                                  : "bg-muted border border-border rounded-tl-none text-foreground prose prose-sm prose-invert max-w-none"
                            }
                          `}
                          >
                            {msg.role === "ai" ? (
                              <>
                                {renderAiMessage(mainContent)}
                                {signature && (
                                  <div className="text-[10px] text-muted-foreground/60 mt-3 pt-2 border-t border-border/40 italic">
                                    {signature}
                                  </div>
                                )}
                              </>
                            ) : (
                              msg.content
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 px-1">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                {loading && (
                  <div className="flex gap-3 max-w-full justify-start animate-pulse">
                    <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-amber-500/50 to-amber-700/50 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-muted/50 w-24 h-10 border border-border/50"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Input (Only visible in Chat view) */}
          {view === "chat" && (
            <div className="p-3 bg-card/90 backdrop-blur-md border-t border-border flex flex-col gap-2">
              {selectedFile && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md self-start text-xs text-amber-500">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">
                    {selectedFile.name}
                  </span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="ml-1 hover:text-foreground"
                  >
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
                  disabled={loading}
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    loading
                      ? "AI is thinking..."
                      : canPerformActions
                        ? "Ask anything, or ask me to perform actions..."
                        : "Ask Humanitas AI for assistance or guidance..."
                  }
                  disabled={loading}
                  className="py-6 rounded-full bg-muted/50 border-border focus-visible:ring-amber-500/50 text-xs sm:text-sm"
                />
                <Button
                  size="icon"
                  disabled={(!input.trim() && !selectedFile) || loading}
                  onClick={handleSend}
                  className="h-10 w-10 shrink-0 rounded-full gold-gradient text-black hover:opacity-90 shadow-md transition-transform active:scale-95"
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </Button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground/70">
                AI can make mistakes. Please verify important financial or contractual data.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  },
);
