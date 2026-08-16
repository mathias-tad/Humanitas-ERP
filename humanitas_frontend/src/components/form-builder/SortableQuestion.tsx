"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPES, type FormQuestion } from "./question-types";

interface Props {
    question: FormQuestion;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    iconMap: Record<string, React.ComponentType<{ className?: string }>>;
}

export function SortableQuestion({ question, index, isSelected, onSelect, onRemove, iconMap }: Props) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: question.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const meta = QUESTION_TYPES.find(t => t.type === question.type);
    const IconComp = meta ? iconMap[meta.icon] : null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={`group rounded-lg border bg-card transition-all cursor-pointer ${isSelected
                    ? "border-primary ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/30 hover:shadow-sm"
                }`}
        >
            <div className="flex items-start gap-2 p-3">
                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="mt-0.5 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted"
                    onClick={e => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* Question content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
                        {IconComp && <IconComp className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {meta?.label}
                        </Badge>
                        {question.required && (
                            <span className="text-destructive text-xs font-medium">Required</span>
                        )}
                    </div>
                    <p className="text-sm font-medium truncate">{question.label}</p>
                    {question.helper_text && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{question.helper_text}</p>
                    )}
                    {question.options.length > 0 && meta?.hasOptions && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                            {question.options.slice(0, 4).map(o => (
                                <span key={o.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                    {o.label}
                                </span>
                            ))}
                            {question.options.length > 4 && (
                                <span className="text-[10px] text-muted-foreground">
                                    +{question.options.length - 4} more
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Delete */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive h-7 w-7 p-0"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
