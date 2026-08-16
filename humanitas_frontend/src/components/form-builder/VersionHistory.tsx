import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { History, Clock, RotateCcw, Loader2, GitCompare, Plus, Minus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { API_BASE_URL } from "@/config/api.config";

interface HistoryEntry {
    version: number;
    created_at: string;
    questions?: { id: string; label: string; type: string }[];
    sections?: { id: string; title: string }[];
}

interface DiffResult {
    added: { id: string; label: string; type: string }[];
    removed: { id: string; label: string; type: string }[];
    changed: { id: string; oldLabel: string; newLabel: string; type: string }[];
    questionCountA: number;
    questionCountB: number;
}

function computeDiff(a: HistoryEntry, b: HistoryEntry): DiffResult {
    const qA = a.questions || [];
    const qB = b.questions || [];

    const mapA = new Map(qA.map(q => [q.id, q]));
    const mapB = new Map(qB.map(q => [q.id, q]));

    const added = qB.filter(q => !mapA.has(q.id));
    const removed = qA.filter(q => !mapB.has(q.id));
    const changed = qA.filter(q => {
        const bQ = mapB.get(q.id);
        return bQ && (bQ.label !== q.label || bQ.type !== q.type);
    }).map(q => ({
        id: q.id,
        oldLabel: q.label,
        newLabel: mapB.get(q.id)!.label,
        type: mapB.get(q.id)!.type,
    }));

    return { added, removed, changed, questionCountA: qA.length, questionCountB: qB.length };
}

interface VersionHistoryProps {
    jobId: string;
    currentVersion: number;
    onRestore: (versionData: any) => void;
}

export function VersionHistory({ jobId, currentVersion, onRestore }: VersionHistoryProps) {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    // Diff state
    const [diffMode, setDiffMode] = useState(false);
    const [diffA, setDiffA] = useState<number | null>(null);
    const [diffB, setDiffB] = useState<number | null>(null);
    const [diffDataA, setDiffDataA] = useState<HistoryEntry | null>(null);
    const [diffDataB, setDiffDataB] = useState<HistoryEntry | null>(null);
    const [loadingDiff, setLoadingDiff] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/form/history`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data);
                } else {
                    toast.error("Failed to load version history");
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchHistory();
    }, [isOpen, jobId, currentVersion]);

    const handleRestore = async (version: number) => {
        toast.info(`Restoring version v${version}...`);
        try {
            const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/form/history/${version}`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                onRestore(data);
                toast.success(`Restored to version v${version}. Don't forget to save!`);
                setIsOpen(false);
            } else { toast.error("Failed to fetch version"); }
        } catch { toast.error("Error fetching version"); }
    };

    // Fetch two versions for diff comparison
    const handleCompare = async () => {
        if (diffA === null || diffB === null || diffA === diffB) {
            toast.error("Select two different versions to compare.");
            return;
        }
        setLoadingDiff(true);
        try {
            const [resA, resB] = await Promise.all([
                fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/form/history/${diffA}`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/form/history/${diffB}`, { credentials: "include" }),
            ]);
            if (resA.ok && resB.ok) {
                setDiffDataA(await resA.json());
                setDiffDataB(await resB.json());
            } else {
                toast.error("Failed to fetch one of the versions.");
            }
        } catch { toast.error("Error comparing versions"); }
        finally { setLoadingDiff(false); }
    };

    const diff = useMemo(() => {
        if (!diffDataA || !diffDataB) return null;
        return computeDiff(diffDataA, diffDataB);
    }, [diffDataA, diffDataB]);

    const resetDiff = () => {
        setDiffMode(false);
        setDiffA(null);
        setDiffB(null);
        setDiffDataA(null);
        setDiffDataB(null);
    };

    if (!isOpen) {
        return (
            <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(true)}>
                <History className="h-4 w-4 mr-2" />
                View Version History
            </Button>
        );
    }

    // All versions including current for the diff selectors
    // Deduplicate: current version first, then history entries that aren't the current
    const allVersions = [
        { version: currentVersion, label: `v${currentVersion} (Current)` },
        ...history
            .filter(h => h.version !== currentVersion)
            .map(h => ({ version: h.version, label: `v${h.version}` })),
    ];

    return (
        <div className="border rounded-lg bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-100 border-b px-4 py-2 flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-500" />
                    {diffMode ? "Compare Versions" : "Version History"}
                </h4>
                <div className="flex gap-1">
                    <Button
                        variant={diffMode ? "default" : "ghost"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => diffMode ? resetDiff() : setDiffMode(true)}
                    >
                        <GitCompare className="h-3 w-3 mr-1" />
                        {diffMode ? "Back" : "Diff"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setIsOpen(false); resetDiff(); }}>
                        Close
                    </Button>
                </div>
            </div>

            {/* ─── DIFF MODE ─── */}
            {diffMode ? (
                <div className="p-3">
                    {/* Version selectors */}
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">From</label>
                            <select
                                className="w-full mt-0.5 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                                value={diffA ?? ""}
                                onChange={e => { setDiffA(Number(e.target.value)); setDiffDataA(null); setDiffDataB(null); }}
                            >
                                <option value="">Select...</option>
                                {allVersions.map(v => (
                                    <option key={v.version} value={v.version} disabled={v.version === diffB}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end pb-1 text-muted-foreground text-xs">→</div>
                        <div className="flex-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">To</label>
                            <select
                                className="w-full mt-0.5 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                                value={diffB ?? ""}
                                onChange={e => { setDiffB(Number(e.target.value)); setDiffDataA(null); setDiffDataB(null); }}
                            >
                                <option value="">Select...</option>
                                {allVersions.map(v => (
                                    <option key={v.version} value={v.version} disabled={v.version === diffA}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={diffA === null || diffB === null || diffA === diffB || loadingDiff}
                        onClick={handleCompare}
                    >
                        {loadingDiff ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <GitCompare className="h-3 w-3 mr-1" />}
                        Compare
                    </Button>

                    {/* Diff Results */}
                    {diff && (
                        <div className="mt-3 space-y-2 text-xs">
                            {/* Summary */}
                            <div className="flex gap-2 text-center">
                                <div className="flex-1 bg-white rounded border p-2">
                                    <p className="text-muted-foreground">v{diffA}</p>
                                    <p className="font-bold text-lg">{diff.questionCountA}</p>
                                    <p className="text-muted-foreground">questions</p>
                                </div>
                                <div className="flex items-center text-muted-foreground">→</div>
                                <div className="flex-1 bg-white rounded border p-2">
                                    <p className="text-muted-foreground">v{diffB}</p>
                                    <p className="font-bold text-lg">{diff.questionCountB}</p>
                                    <p className="text-muted-foreground">questions</p>
                                </div>
                            </div>

                            {/* No changes */}
                            {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && (
                                <p className="text-center text-muted-foreground py-2">No differences in questions between these versions.</p>
                            )}

                            {/* Added */}
                            {diff.added.length > 0 && (
                                <div>
                                    <p className="font-semibold text-green-700 flex items-center gap-1 mb-1">
                                        <Plus className="h-3 w-3" /> Added ({diff.added.length})
                                    </p>
                                    {diff.added.map(q => (
                                        <div key={q.id} className="flex items-center gap-2 py-1 px-2 rounded bg-green-50 border border-green-100 mb-1">
                                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-mono">{q.type}</span>
                                            <span className="truncate">{q.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Removed */}
                            {diff.removed.length > 0 && (
                                <div>
                                    <p className="font-semibold text-red-700 flex items-center gap-1 mb-1">
                                        <Minus className="h-3 w-3" /> Removed ({diff.removed.length})
                                    </p>
                                    {diff.removed.map(q => (
                                        <div key={q.id} className="flex items-center gap-2 py-1 px-2 rounded bg-red-50 border border-red-100 mb-1">
                                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-mono">{q.type}</span>
                                            <span className="truncate line-through">{q.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Changed */}
                            {diff.changed.length > 0 && (
                                <div>
                                    <p className="font-semibold text-amber-700 flex items-center gap-1 mb-1">
                                        <Pencil className="h-3 w-3" /> Changed ({diff.changed.length})
                                    </p>
                                    {diff.changed.map(q => (
                                        <div key={q.id} className="py-1 px-2 rounded bg-amber-50 border border-amber-100 mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-mono">{q.type}</span>
                                                <span className="text-red-600 line-through truncate">{q.oldLabel}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 pl-[calc(0.375rem+var(--spacing)*3.5)]">
                                                <span className="text-green-700 truncate">→ {q.newLabel}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* ─── TIMELINE MODE ─── */
                <div className="p-3 max-h-60 overflow-y-auto">
                    <div className="flex items-start gap-3 mb-4 opacity-50 relative pb-4 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-slate-300">
                        <div className="bg-primary/20 p-1.5 rounded-full relative z-10 bg-white">
                            <div className="bg-primary h-2 w-2 rounded-full ring-4 ring-primary/20" />
                        </div>
                        <div className="pt-0.5">
                            <p className="text-sm font-semibold">v{currentVersion} (Current)</p>
                            <p className="text-xs text-muted-foreground">Active version in production</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : history.length > 0 ? (
                        history.map((item, i) => (
                            <div
                                key={item.version}
                                className={`flex items-start gap-3 relative pb-4 ${i !== history.length - 1 ? "before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-slate-300" : ""}`}
                            >
                                <div className="bg-slate-200 p-1.5 rounded-full relative z-10 bg-white">
                                    <div className="bg-slate-400 h-2 w-2 rounded-full ring-4 ring-slate-100" />
                                </div>
                                <div className="pt-0.5 w-full pr-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium">v{item.version}</p>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                <Clock className="h-3 w-3" />
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </div>
                                            {item.questions && (
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {item.questions.length} question{item.questions.length !== 1 ? "s" : ""}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs hover:bg-slate-200"
                                            onClick={() => handleRestore(item.version)}
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1" /> Restore
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-center text-muted-foreground pb-2">No previous versions available.</p>
                    )}
                </div>
            )}
        </div>
    );
}
