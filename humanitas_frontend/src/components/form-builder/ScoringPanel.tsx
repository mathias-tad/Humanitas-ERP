import type { FormQuestion } from "./question-types";
import { Badge } from "@/components/ui/badge";
import { Calculator, AlertCircle } from "lucide-react";

interface ScoringPanelProps {
    questions: FormQuestion[];
}

export function ScoringPanel({ questions }: ScoringPanelProps) {
    const scoredQuestions = questions.filter(
        (q) => q.rubric && q.rubric.scoring_type !== "manual" && q.rubric.max_score > 0
    );

    const totalMaxScore = scoredQuestions.reduce(
        (acc, q) => acc + (q.rubric?.max_score || 0),
        0
    );

    if (scoredQuestions.length === 0) {
        return (
            <div className="p-4 border rounded-md bg-muted/20 text-sm text-center">
                <Calculator className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="font-medium text-slate-700">No Auto-Scoring Configured</p>
                <p className="text-muted-foreground mt-1">
                    Add Multi-Choice or Dropdown questions and enable auto-scoring to see a summary here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-indigo-600" />
                        Total Possible Score
                    </h3>
                    <p className="text-xs text-indigo-700 mt-1">Based on {scoredQuestions.length} auto-scored question{scoredQuestions.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-3xl font-black text-indigo-600">
                    {totalMaxScore} <span className="text-sm font-semibold text-indigo-400">pts</span>
                </div>
            </div>

            <div className="border rounded-md divide-y divide-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 flex justify-between">
                    <span>Question</span>
                    <span>Max Score</span>
                </div>
                {scoredQuestions.map((q) => (
                    <div key={q.id} className="p-3 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{q.label || "Untitled Question"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{q.type.replace('_', ' ')}</p>
                        </div>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 font-semibold shrink-0">
                            +{q.rubric?.max_score}
                        </Badge>
                    </div>
                ))}
            </div>

            <div className="flex bg-amber-50 rounded-md p-3 text-sm text-amber-800 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                <p>Manual-scored questions (like paragraphs or file uploads) are not included in this automatic total and must be graded by recruiters later.</p>
            </div>
        </div>
    );
}
