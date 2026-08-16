import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import {
    Save, Eye, ArrowLeft, GripVertical, Plus, Settings2,
    Type, AlignLeft, CircleDot, CheckSquare, ChevronDown, Sliders,
    ArrowUpDown, ToggleLeft, Calendar, Hash, Mail, Phone, Link,
    Paperclip, Image, Video, Heading, FileText, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/api.config";
import {
    QUESTION_TYPES, createDefaultQuestion,
    type FormQuestion, type FormSection, type LogicRule, type QuestionType
} from "@/components/form-builder/question-types";
import { SortableQuestion } from "@/components/form-builder/SortableQuestion";
import { QuestionConfig } from "@/components/form-builder/QuestionConfig";
import { VersionHistory } from "@/components/form-builder/VersionHistory";
import { ScoringPanel } from "@/components/form-builder/ScoringPanel";
import { toast } from "sonner";

// Icon component map
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Type, AlignLeft, CircleDot, CheckSquare, ChevronDown, Sliders,
    ArrowUpDown, ToggleLeft, Calendar, Hash, Mail, Phone, Link,
    Paperclip, Image, Video, Heading, FileText,
};

export default function FormBuilderPage() {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();

    const [questions, setQuestions] = useState<FormQuestion[]>([]);
    const [sections, setSections] = useState<FormSection[]>([]);
    const [logicRules, setLogicRules] = useState<LogicRule[]>([]);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [version, setVersion] = useState(1);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [jobTitle, setJobTitle] = useState("Untitled Job");

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor),
    );

    // Load form
    useEffect(() => {
        if (!jobId) return;
        const load = async () => {
            try {
                // Fetch job title
                const jobRes = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}`, { credentials: "include" });
                if (jobRes.ok) {
                    const job = await jobRes.json();
                    setJobTitle(job.title || "Untitled Job");
                }

                // Fetch form definition
                const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/form`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    setQuestions(data.questions || []);
                    setSections(data.sections || []);
                    setLogicRules(data.logic_rules || []);
                    setVersion(data.version || 1);
                }
            } catch (err) { 
                console.error("Failed to load form", err);
            }
            setLoading(false);
        };
        load();
    }, [jobId]);

    // Save form
    const saveForm = useCallback(async () => {
        setSaving(true);
        try {
            const numbered = questions.map((q, i) => ({ ...q, order: i }));
            const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/form`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sections, questions: numbered, logic_rules: logicRules }),
            });
            if (res.ok) {
                const data = await res.json();
                setVersion(data.version || version + 1);
                toast.success("Form saved successfully.");
            } else {
                toast.error("Failed to save form. Check console.");
                console.error("Save failed:", await res.text());
            }
        } catch (e) {
            toast.error("Failed to connect to server.");
            console.error("Save error:", e);
        }
        setSaving(false);
    }, [questions, sections, logicRules, jobId, version]);

    // DnD handlers
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setQuestions((prev) => {
            const oldIndex = prev.findIndex(q => q.id === active.id);
            const newIndex = prev.findIndex(q => q.id === over.id);
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    // Add question
    const addQuestion = (type: QuestionType) => {
        const q = createDefaultQuestion(type);
        q.order = questions.length;
        setQuestions(prev => [...prev, q]);
        setSelectedQuestionId(q.id);
    };

    // Remove question
    const removeQuestion = (id: string) => {
        setQuestions(prev => prev.filter(q => q.id !== id));
        if (selectedQuestionId === id) setSelectedQuestionId(null);
    };

    // Update question
    const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

    const categories = [
        { key: "text", label: "Text" },
        { key: "choice", label: "Choice" },
        { key: "input", label: "Input" },
        { key: "media", label: "Media" },
        { key: "layout", label: "Layout" },
    ] as const;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/recruitment")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-semibold">{jobTitle}</h1>
                        <p className="text-xs text-muted-foreground">
                            Form Builder · v{version} · {questions.length} question{questions.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-64 z-50">
                        <VersionHistory
                            jobId={jobId!}
                            currentVersion={version}
                            onRestore={(data) => {
                                setQuestions(data.questions || []);
                                setSections(data.sections || []);
                                setLogicRules(data.logic_rules || []);
                            }}
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                        <Eye className="h-4 w-4 mr-1" /> Preview
                    </Button>
                    <Button size="sm" onClick={saveForm} disabled={saving}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                    >
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                    </Button>
                </div>
            </div>

            {/* ── 3-Panel Layout ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Question Palette */}
                <div className="w-64 border-r overflow-y-auto p-4 bg-muted/20 flex-shrink-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Question Types
                    </p>
                    <div className="space-y-4">
                        {categories.map(cat => (
                            <div key={cat.key}>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                                    {cat.label}
                                </p>
                                <div className="space-y-1">
                                    {QUESTION_TYPES.filter(t => t.category === cat.key).map(t => {
                                        const IconComp = ICON_MAP[t.icon];
                                        return (
                                            <button
                                                key={t.type}
                                                onClick={() => addQuestion(t.type)}
                                                className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left
                                                    hover:bg-primary/5 hover:text-primary transition-colors border border-transparent
                                                    hover:border-primary/20 group"
                                            >
                                                {IconComp && <IconComp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />}
                                                <span className="truncate">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center: Canvas */}
                <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
                    <div className="max-w-2xl mx-auto mb-6 bg-blue-50 text-blue-800 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                        <div className="mt-0.5">ℹ️</div>
                        <div className="text-sm">
                            <p className="font-semibold mb-1">Personal Information is collected automatically</p>
                            <p>Candidate Name, Email, and Phone Number are automatically collected at the beginning of every application for duplicate-checking and notifications. You do <strong>not</strong> need to add questions for them here.</p>
                        </div>
                    </div>

                    {questions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10 flex items-center justify-center mb-4">
                                <Plus className="h-8 w-8 text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">Start building your form</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Click a question type from the left panel to add it to your form,
                                then configure it in the right panel.
                            </p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={questions.map(q => q.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2 max-w-2xl mx-auto pb-12">
                                    {questions.map((q, index) => (
                                        <SortableQuestion
                                            key={q.id}
                                            question={q}
                                            index={index}
                                            isSelected={q.id === selectedQuestionId}
                                            onSelect={() => setSelectedQuestionId(q.id)}
                                            onRemove={() => removeQuestion(q.id)}
                                            iconMap={ICON_MAP}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {/* Right: Config Panel */}
                <div className="w-80 border-l overflow-y-auto flex-shrink-0 bg-background flex flex-col">
                    <div className="flex-1 p-0">
                        {selectedQuestion ? (
                            <QuestionConfig
                                question={selectedQuestion}
                                allQuestions={questions}
                                logicRules={logicRules}
                                onUpdate={(updates: Partial<FormQuestion>) => updateQuestion(selectedQuestion.id, updates)}
                                onUpdateLogicRules={setLogicRules}
                                iconMap={ICON_MAP}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <Settings2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    Select a question to configure its properties
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Scoring Summary at bottom of right panel */}
                    <div className="p-4 border-t bg-slate-50 mt-auto">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                            Form Scoring Summary
                        </h4>
                        <ScoringPanel questions={questions} />
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Preview as Candidate</h2>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>✕</Button>
                        </div>
                        <div className="p-6 space-y-6">
                            {questions.filter(q => q.type !== "section_header" || q.label).map(q => {
                                const meta = QUESTION_TYPES.find(t => t.type === q.type);
                                return (
                                    <div key={q.id} className="space-y-2">
                                        {q.type === "section_header" ? (
                                            <div className="pt-4">
                                                <h3 className="text-lg font-semibold">{q.label}</h3>
                                                {q.helper_text && <p className="text-sm text-muted-foreground">{q.helper_text}</p>}
                                            </div>
                                        ) : q.type === "descriptive_text" ? (
                                            <p className="text-sm text-muted-foreground">{q.label}</p>
                                        ) : (
                                            <div>
                                                <label className="text-sm font-medium">
                                                    {q.label}
                                                    {q.required && <span className="text-destructive ml-1">*</span>}
                                                </label>
                                                {q.helper_text && <p className="text-xs text-muted-foreground mt-0.5">{q.helper_text}</p>}
                                                <div className="mt-1.5">
                                                    {["short_text", "email", "phone", "url", "number"].includes(q.type) && (
                                                        <input type="text" placeholder={`Enter ${meta?.label?.toLowerCase()}`}
                                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" disabled />
                                                    )}
                                                    {q.type === "paragraph" && (
                                                        <textarea placeholder="Enter your answer" rows={3}
                                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" disabled />
                                                    )}
                                                    {q.type === "date" && (
                                                        <input type="date"
                                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" disabled />
                                                    )}
                                                    {["mcq_single", "yes_no"].includes(q.type) && (
                                                        <div className="space-y-1.5">
                                                            {q.options.map(o => (
                                                                <label key={o.id} className="flex items-center gap-2 text-sm">
                                                                    <input type="radio" name={q.id} disabled />
                                                                    {o.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {q.type === "mcq_multi" && (
                                                        <div className="space-y-1.5">
                                                            {q.options.map(o => (
                                                                <label key={o.id} className="flex items-center gap-2 text-sm">
                                                                    <input type="checkbox" disabled />
                                                                    {o.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {q.type === "dropdown" && (
                                                        <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" disabled>
                                                            <option>Select an option</option>
                                                            {q.options.map(o => <option key={o.id}>{o.label}</option>)}
                                                        </select>
                                                    )}
                                                    {q.type === "linear_scale" && (
                                                        <div className="flex gap-3 items-center">
                                                            {Array.from({ length: (q.config?.max || 5) - (q.config?.min || 1) + 1 }, (_, i) => (
                                                                <label key={i} className="flex flex-col items-center gap-1 text-xs">
                                                                    <input type="radio" name={q.id} disabled />
                                                                    {(q.config?.min || 1) + i}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {["file_upload", "image_upload"].includes(q.type) && (
                                                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/10">
                                                            <Paperclip className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                                                            <p className="text-xs text-muted-foreground">
                                                                Drag & drop or click to upload
                                                            </p>
                                                        </div>
                                                    )}
                                                    {q.type === "ranking" && (
                                                        <div className="space-y-1.5">
                                                            {q.options.map((o, i) => (
                                                                <div key={o.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-muted/30">
                                                                    <span className="text-muted-foreground text-xs font-mono">{i + 1}</span>
                                                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    {o.label}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {q.type === "video_url" && (
                                                        <input type="url" placeholder="Paste video URL (YouTube, Vimeo)"
                                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" disabled />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {questions.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-8">No questions added yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
