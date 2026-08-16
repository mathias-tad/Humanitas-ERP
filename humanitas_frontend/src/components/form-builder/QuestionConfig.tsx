"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    QUESTION_TYPES, generateId,
    type FormQuestion, type LogicRule,
} from "./question-types";

interface Props {
    question: FormQuestion;
    allQuestions: FormQuestion[];
    logicRules: LogicRule[];
    onUpdate: (updates: Partial<FormQuestion>) => void;
    onUpdateLogicRules: (rules: LogicRule[]) => void;
    iconMap: Record<string, React.ComponentType<{ className?: string }>>;
}

export function QuestionConfig({ question, allQuestions, logicRules, onUpdate, onUpdateLogicRules, iconMap }: Props) {
    const meta = QUESTION_TYPES.find(t => t.type === question.type);
    const IconComp = meta ? iconMap[meta.icon] : null;
    const [activeTab, setActiveTab] = useState<"settings" | "logic" | "rubric">("settings");

    // Rules that target this question
    const questionRules = logicRules.filter(
        r => r.target_question_id === question.id
    );

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-2">
                    {IconComp && <IconComp className="h-4 w-4 text-primary" />}
                    <Badge variant="secondary" className="text-xs">{meta?.label}</Badge>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                    {(["settings", "logic", "rubric"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${activeTab === tab
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === "settings" && (
                    <div className="space-y-4">
                        {/* Label */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Question Label</label>
                            <input
                                value={question.label}
                                onChange={e => onUpdate({ label: e.target.value })}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                placeholder="Enter question text"
                            />
                        </div>

                        {/* Helper Text */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Helper Text</label>
                            <input
                                value={question.helper_text}
                                onChange={e => onUpdate({ helper_text: e.target.value })}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                placeholder="Additional instructions"
                            />
                        </div>

                        {/* Required Toggle */}
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Required</label>
                            <button
                                onClick={() => onUpdate({ required: !question.required })}
                                className={`relative w-10 h-5 rounded-full transition-colors ${question.required ? "bg-primary" : "bg-muted"
                                    }`}
                            >
                                <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${question.required ? "translate-x-5" : "translate-x-0.5"
                                    }`} />
                            </button>
                        </div>

                        {/* Options (for choice types) */}
                        {meta?.hasOptions && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-2 block">Options</label>
                                <div className="space-y-1.5">
                                    {question.options.map((opt, i) => (
                                        <div key={opt.id} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}</span>
                                            <input
                                                value={opt.label}
                                                onChange={e => {
                                                    const updated = question.options.map(o =>
                                                        o.id === opt.id ? { ...o, label: e.target.value } : o
                                                    );
                                                    onUpdate({ options: updated });
                                                }}
                                                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                            />
                                            <button
                                                onClick={() => onUpdate({
                                                    options: question.options.filter(o => o.id !== opt.id)
                                                })}
                                                className="text-destructive/60 hover:text-destructive p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => onUpdate({
                                            options: [...question.options, { id: generateId(), label: `Option ${question.options.length + 1}` }]
                                        })}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Add Option
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Linear Scale Config */}
                        {question.type === "linear_scale" && (
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs text-muted-foreground">Min</label>
                                    <input
                                        type="number"
                                        value={question.config?.min ?? 1}
                                        onChange={e => onUpdate({ config: { ...question.config, min: parseInt(e.target.value) || 1 } })}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Max</label>
                                    <input
                                        type="number"
                                        value={question.config?.max ?? 5}
                                        onChange={e => onUpdate({ config: { ...question.config, max: parseInt(e.target.value) || 5 } })}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Step</label>
                                    <input
                                        type="number"
                                        value={question.config?.step ?? 1}
                                        onChange={e => onUpdate({ config: { ...question.config, step: parseInt(e.target.value) || 1 } })}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Validation */}
                        {["short_text", "paragraph"].includes(question.type) && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-muted-foreground">Min Length</label>
                                    <input
                                        type="number"
                                        value={question.validation?.min_length ?? ""}
                                        onChange={e => onUpdate({
                                            validation: { ...question.validation, min_length: parseInt(e.target.value) || undefined }
                                        })}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        placeholder="–"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Max Length</label>
                                    <input
                                        type="number"
                                        value={question.validation?.max_length ?? ""}
                                        onChange={e => onUpdate({
                                            validation: { ...question.validation, max_length: parseInt(e.target.value) || undefined }
                                        })}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        placeholder="–"
                                    />
                                </div>
                            </div>
                        )}

                        {/* File Upload Config */}
                        {["file_upload", "image_upload"].includes(question.type) && (
                            <div>
                                <label className="text-xs text-muted-foreground">Max File Size (MB)</label>
                                <input
                                    type="number"
                                    value={question.config?.max_file_size_mb ?? 10}
                                    onChange={e => onUpdate({ config: { ...question.config, max_file_size_mb: parseInt(e.target.value) || 10 } })}
                                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "logic" && (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Show or hide this question based on answers to other questions.
                        </p>
                        {questionRules.map(rule => (
                            <div key={rule.id} className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[10px]">{rule.type.toUpperCase()}</Badge>
                                    <button
                                        onClick={() => onUpdateLogicRules(logicRules.filter(r => r.id !== rule.id))}
                                        className="text-destructive/60 hover:text-destructive"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    <select
                                        value={rule.condition.question_id}
                                        onChange={e => {
                                            const updated = logicRules.map(r =>
                                                r.id === rule.id
                                                    ? { ...r, condition: { ...r.condition, question_id: e.target.value } }
                                                    : r
                                            );
                                            onUpdateLogicRules(updated);
                                        }}
                                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                                    >
                                        <option value="">When question...</option>
                                        {allQuestions.filter(q => q.id !== question.id && q.type !== "section_header" && q.type !== "descriptive_text").map(q => (
                                            <option key={q.id} value={q.id}>{q.label}</option>
                                        ))}
                                    </select>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <select
                                            value={rule.condition.operator}
                                            onChange={e => {
                                                const updated = logicRules.map(r =>
                                                    r.id === rule.id
                                                        ? { ...r, condition: { ...r.condition, operator: e.target.value } }
                                                        : r
                                                );
                                                onUpdateLogicRules(updated);
                                            }}
                                            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                                        >
                                            <option value="equals">Equals</option>
                                            <option value="not_equals">Not equals</option>
                                            <option value="contains">Contains</option>
                                            <option value="is_empty">Is empty</option>
                                            <option value="not_empty">Not empty</option>
                                            <option value="gt">Greater than</option>
                                            <option value="lt">Less than</option>
                                        </select>
                                        <input
                                            value={rule.condition.value || ""}
                                            onChange={e => {
                                                const updated = logicRules.map(r =>
                                                    r.id === rule.id
                                                        ? { ...r, condition: { ...r.condition, value: e.target.value } }
                                                        : r
                                                );
                                                onUpdateLogicRules(updated);
                                            }}
                                            placeholder="Value"
                                            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-1 flex-wrap">
                            {(["show", "hide", "required", "disqualify"] as const).map(ruleType => (
                                <Button
                                    key={ruleType}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                        const newRule: LogicRule = {
                                            id: generateId(),
                                            type: ruleType,
                                            condition: { question_id: "", operator: "equals", value: "" },
                                            target_question_id: question.id,
                                        };
                                        onUpdateLogicRules([...logicRules, newRule]);
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> {ruleType.charAt(0).toUpperCase() + ruleType.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "rubric" && (
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Configure scoring for this question. MCQ questions can be auto-scored.
                        </p>

                        {/* Scoring Type */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Scoring Type</label>
                            <select
                                value={question.rubric?.scoring_type ?? "manual"}
                                onChange={e => onUpdate({
                                    rubric: {
                                        max_score: question.rubric?.max_score ?? 0,
                                        scoring_type: e.target.value as "manual" | "auto_mcq",
                                    }
                                })}
                                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            >
                                <option value="manual">Manual Review</option>
                                {meta?.hasOptions && <option value="auto_mcq">Auto-Score (MCQ)</option>}
                            </select>
                        </div>

                        {/* Max Score */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Max Score</label>
                            <input
                                type="number"
                                value={question.rubric?.max_score ?? 0}
                                onChange={e => onUpdate({
                                    rubric: {
                                        scoring_type: question.rubric?.scoring_type ?? "manual",
                                        max_score: parseFloat(e.target.value) || 0,
                                    }
                                })}
                                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            />
                        </div>

                        {/* Option Scores (for auto_mcq) */}
                        {question.rubric?.scoring_type === "auto_mcq" && meta?.hasOptions && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-2 block">Option Scores</label>
                                <div className="space-y-1.5">
                                    {question.options.map(opt => (
                                        <div key={opt.id} className="flex items-center gap-2">
                                            <span className="text-xs truncate flex-1">{opt.label}</span>
                                            <input
                                                type="number"
                                                value={opt.score ?? 0}
                                                onChange={e => {
                                                    const updated = question.options.map(o =>
                                                        o.id === opt.id
                                                            ? { ...o, score: parseFloat(e.target.value) || 0 }
                                                            : o
                                                    );
                                                    onUpdate({ options: updated });
                                                }}
                                                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-center"
                                                placeholder="0"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
