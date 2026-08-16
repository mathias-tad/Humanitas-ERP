import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Trophy, Lock, Crown, ChevronUp, ChevronDown, Download, 
  FolderArchive, RefreshCw, ArrowLeft, Star, Users, 
  TrendingUp, AlertTriangle, CheckCircle2, X, Settings, Activity 
} from "lucide-react";
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Legend 
} from "recharts";
import { API_BASE_URL } from "@/config/api.config";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
    rank: number;
    application_id: string | null;
    candidate_name: string;
    candidate_email: string | null;
    composite_score: number | null;
    score_label: string;
    top_strength: string | null;
    status: string;
    submitted_at: string | null;
    reference_id: string | null;
    is_visible: boolean;
    score_breakdown?: any;
}

interface LeaderboardData {
    job_id: string;
    total_count: number;
    visible_count: number | null;
    is_locked: boolean;
    lock_reason: string | null;
    plan: string;
    payg_invoice_id: string | null;
    leaderboard: LeaderboardEntry[];
}

// ── Score Badge ────────────────────────────────────────────────────────────────

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
    if (score === null || label === "Pending") {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Pending
            </span>
        );
    }
    if (label === "Locked") {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                <Lock className="w-3 h-3" />
                Locked
            </span>
        );
    }

    const configMap: Record<string, {bg: string, text: string, dot: string}> = {
        Excellent: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
        Good: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
        Fair: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
        "Below bar": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    };
    const config = configMap[label] ?? { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
            {score.toFixed(1)} · {label}
        </span>
    );
}

// ── Rank Medal ─────────────────────────────────────────────────────────────────

function RankDisplay({ rank }: { rank: number }) {
    if (rank === 1) return <span className="text-xl" title="1st">🥇</span>;
    if (rank === 2) return <span className="text-xl" title="2nd">🥈</span>;
    if (rank === 3) return <span className="text-xl" title="3rd">🥉</span>;
    return <span className="text-sm font-bold text-slate-500 tabular-nums">#{rank}</span>;
}

// ── Status Pill ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        received: { label: "New", cls: "bg-blue-50 text-blue-600" },
        under_review: { label: "Reviewing", cls: "bg-purple-50 text-purple-600" },
        accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700" },
        rejected: { label: "Rejected", cls: "bg-red-50 text-red-600" },
        locked: { label: "🔒 Locked", cls: "bg-slate-100 text-slate-400" },
    };
    const { label, cls } = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Main Leaderboard Page ──────────────────────────────────────────────────────

export default function Leaderboard() {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<LeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [cutoffScore, setCutoffScore] = useState("");
    const [isBulkShortlisting, setIsBulkShortlisting] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [modalErrorMessage, setModalErrorMessage] = useState("");

    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
    const [showCompareModal, setShowCompareModal] = useState(false);

    const [showWeightsPopover, setShowWeightsPopover] = useState(false);
    const [weights, setWeights] = useState({
        skills_matching: 0.3,
        experience_depth: 0.2,
        education: 0.1,
        form_answer_quality: 0.1,
        achievements: 0.05,
        soft_skills: 0.15,
        custom_criteria: 0.1,
    });
    const [isReranking, setIsReranking] = useState(false);

    const [showExportEstimateModal, setShowExportEstimateModal] = useState(false);
    const [isEstimating, setIsEstimating] = useState(false);
    const [exportEstimate, setExportEstimate] = useState<{ estimated_bytes: number, file_count: number, candidate_count: number } | null>(null);
    const [exportScope, setExportScope] = useState<{ type: string, value?: any }>({ type: 'all' });

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/leaderboard`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load leaderboard");
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        if (jobId) fetchLeaderboard();
    }, [jobId, fetchLeaderboard]);

    const handleStatusChange = async (applicationId: string, newStatus: string) => {
        setUpdatingId(applicationId);
        try {
            await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/applications/${applicationId}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            await fetchLeaderboard();
        } finally {
            setUpdatingId(null);
        }
    };

    const [exportingKey, setExportingKey] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBackendExport = async (format: "csv" | "xlsx" | "zip", scopeType: string = "all", scopeValue?: any) => {
        const key = scopeType === "status" ? `${scopeValue?.status}-${format}` : `all-${format}`;
        setExportingKey(key);
        setShowExportMenu(false);
        try {
            const req = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/exports`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format_type: format, scope_type: scopeType, scope_value: scopeValue }),
            });
            if (!req.ok) throw new Error("Failed to start export");
            const exportJob = await req.json();

            let pollCount = 0;
            const maxPolls = 40;
            const pollInterval = setInterval(async () => {
                pollCount++;
                try {
                    const statusReq = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/exports/${exportJob.id}`, {
                        credentials: "include",
                    });
                    if (!statusReq.ok) return;
                    const statusData = await statusReq.json();

                    if (statusData.status === "completed" && statusData.download_url) {
                        clearInterval(pollInterval);
                        setExportingKey(null);
                        window.location.href = statusData.download_url;
                    } else if (statusData.status === "failed") {
                        clearInterval(pollInterval);
                        setExportingKey(null);
                        setModalErrorMessage(statusData.error_message || "Export failed.");
                        setShowErrorModal(true);
                    } else if (pollCount >= maxPolls) {
                        clearInterval(pollInterval);
                        setExportingKey(null);
                        setModalErrorMessage("Export is taking too long. Please try again.");
                        setShowErrorModal(true);
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 3000);

        } catch (e: any) {
            setExportingKey(null);
            setModalErrorMessage(e.message || "Something went wrong.");
            setShowErrorModal(true);
        }
    };

    const handleBulkShortlist = () => {
        const score = parseFloat(cutoffScore);
        if (isNaN(score) || score < 0 || score > 100) {
            setModalErrorMessage("Please enter a valid score between 0 and 100.");
            setShowErrorModal(true);
            return;
        }
        setShowConfirmModal(true);
    };

    const toggleRow = (rank: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(rank)) newSet.delete(rank);
        else newSet.add(rank);
        setExpandedRows(newSet);
    };

    const toggleCandidate = (appId: string) => {
        const newSet = new Set(selectedCandidates);
        if (newSet.has(appId)) newSet.delete(appId);
        else newSet.add(appId);
        setSelectedCandidates(newSet);
    };

    const handleRerank = async () => {
        setIsReranking(true);
        setShowWeightsPopover(false);
        try {
            const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/rerank`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ weights }),
            });
            if (!res.ok) throw new Error("Failed to rerank candidates");
            await fetchLeaderboard();
        } catch (e: any) {
            setModalErrorMessage(e.message || "Failed to rerank.");
            setShowErrorModal(true);
        } finally {
            setIsReranking(false);
        }
    };

    const startZipExport = async (scopeType: string, scopeValue?: any) => {
        setShowExportMenu(false);
        setExportScope({ type: scopeType, value: scopeValue });
        setShowExportEstimateModal(true);
        setIsEstimating(true);
        
        try {
            const params = new URLSearchParams();
            params.append("scope_type", scopeType);
            if (scopeType === "status" && scopeValue?.status) {
                params.append("status_filter", scopeValue.status);
            }
            
            const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/exports/estimate?${params.toString()}`, {
                credentials: "include"
            });
            if (!res.ok) throw new Error("Failed to estimate export size");
            setExportEstimate(await res.json());
        } catch (e: any) {
            setShowExportEstimateModal(false);
            setModalErrorMessage(e.message || "Failed to estimate export size.");
            setShowErrorModal(true);
        } finally {
            setIsEstimating(false);
        }
    };

    const confirmZipExport = () => {
        setShowExportEstimateModal(false);
        handleBackendExport("zip", exportScope.type, exportScope.value);
    };

    const executeBulkShortlist = async () => {
        const score = parseFloat(cutoffScore);
        setShowConfirmModal(false);
        setIsBulkShortlisting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/bulk-shortlist`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cutoff_score: score }),
            });
            if (!res.ok) throw new Error("Failed to bulk shortlist candidates.");
            const result = await res.json();
            setSuccessCount(result.shortlisted_count || 0);
            setCutoffScore("");
            setShowSuccessModal(true);
            await fetchLeaderboard();
        } catch (e: any) {
            setModalErrorMessage(e.message || "Something went wrong.");
            setShowErrorModal(true);
        } finally {
            setIsBulkShortlisting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-slate-500">Loading leaderboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <button onClick={fetchLeaderboard} className="mt-4 text-sm underline text-slate-500">Retry</button>
            </div>
        );
    }

    if (!data) return null;

    const topScore = data.leaderboard.find((r) => r.is_visible && r.composite_score !== null)?.composite_score;
    const avgScore = (() => {
        const scored = data.leaderboard.filter((r) => r.is_visible && r.composite_score !== null);
        if (!scored.length) return null;
        return scored.reduce((s, r) => s + (r.composite_score ?? 0), 0) / scored.length;
    })();

    return (
        <div className="p-6 max-w-5xl mx-auto h-full overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/recruitment")}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border hover:bg-slate-50 transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-amber-500" />
                            Candidate Leaderboard
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Ranked by AI composite score · {data.plan?.charAt(0).toUpperCase() + data.plan?.slice(1)} plan
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedCandidates.size >= 1 && selectedCandidates.size <= 4 && (
                        <button
                            onClick={() => setShowCompareModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                        >
                            <Activity className="w-4 h-4" /> Compare ({selectedCandidates.size})
                        </button>
                    )}

                    <div className="relative">
                        <button
                            onClick={() => setShowWeightsPopover(!showWeightsPopover)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <Settings className="w-4 h-4 text-slate-600" /> Weights
                        </button>
                        {showWeightsPopover && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border rounded-xl shadow-xl z-50 p-4">
                                <h3 className="font-semibold text-slate-800 text-sm mb-3">Adjust AI Scoring Weights</h3>
                                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
                                    {Object.entries(weights).map(([key, value]) => (
                                        <div key={key}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-slate-600 font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                                                <span className="text-slate-400">{(value * 100).toFixed(0)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={value}
                                                onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleRerank}
                                    disabled={isReranking}
                                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    {isReranking ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    Re-rank Candidates
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={fetchLeaderboard}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>

                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => !exportingKey && setShowExportMenu(!showExportMenu)}
                            disabled={exportingKey !== null || data.leaderboard.filter((r) => r.is_visible).length === 0}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            {exportingKey ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Export
                                    <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                                </>
                            )}
                        </button>

                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border rounded-xl shadow-xl z-50 py-1.5">
                                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Spreadsheet (CSV)</p>
                                <button onClick={() => handleBackendExport("csv", "all")} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                    <Download className="w-4 h-4 text-slate-400" /> All Candidates
                                </button>
                                <button onClick={() => handleBackendExport("csv", "status", { status: "accepted" })} disabled={data.leaderboard.filter((r) => r.is_visible && r.status === "accepted").length === 0} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Download className="w-4 h-4 text-slate-400" /> Accepted Only
                                </button>
                                <div className="border-t my-1.5 mx-2"></div>
                                <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ZIP (Files + Answers)</p>
                                <button onClick={() => startZipExport("all")} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors">
                                    <FolderArchive className="w-4 h-4 text-slate-400" /> All Candidates
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Total Applicants</p>
                        <p className="text-xl font-bold">{data.total_count}</p>
                    </div>
                </div>
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Crown className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Top Score</p>
                        <p className="text-xl font-bold">{topScore != null ? `${topScore.toFixed(1)}` : "—"}</p>
                    </div>
                </div>
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Avg Score</p>
                        <p className="text-xl font-bold">{avgScore != null ? `${avgScore.toFixed(1)}` : "—"}</p>
                    </div>
                </div>
            </div>

            {/* Bulk Shortlist Action */}
            <div className="bg-white border rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Star className="w-4 h-4 text-emerald-500" />
                        Dynamic Shortlisting
                    </h3>
                    <p className="text-sm text-slate-500">Automatically accept all candidates scoring above a specific cut-off.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={cutoffScore}
                            onChange={(e) => setCutoffScore(e.target.value)}
                            placeholder="e.g. 70.0"
                            className="w-32 h-10 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">score</span>
                    </div>
                    <button
                        onClick={handleBulkShortlist}
                        disabled={isBulkShortlisting || !cutoffScore}
                        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        {isBulkShortlisting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Star className="w-4 h-4" />
                        )}
                        Bulk Shortlist
                    </button>
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Rankings</h2>
                <input
                    type="text"
                    placeholder="Search candidates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm w-64"
                />
            </div>
            <div className="bg-white border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b bg-slate-50">
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-10"></th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-16">Rank</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Candidate</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Score</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Top Strength</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Actions</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.leaderboard.filter(entry => {
                                const q = searchQuery.toLowerCase();
                                return (
                                    (entry.candidate_name || "").toLowerCase().includes(q) ||
                                    (entry.candidate_email || "").toLowerCase().includes(q)
                                );
                            }).map((entry) => (
                                <React.Fragment key={entry.rank}>
                                <tr className={`transition-colors relative ${entry.is_visible ? "hover:bg-slate-50/60" : "opacity-60"}`}>
                                    <td className="px-4 py-3.5 w-10 text-center">
                                        {entry.is_visible && entry.application_id && (
                                            <input
                                                type="checkbox"
                                                checked={selectedCandidates.has(entry.application_id)}
                                                onChange={() => toggleCandidate(entry.application_id!)}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3.5 w-16">
                                        <div className="flex items-center justify-center">
                                            <RankDisplay rank={entry.rank} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2">
                                            {!entry.is_visible && <Lock className="w-3 h-3 text-slate-400" />}
                                            <div style={{ filter: !entry.is_visible ? 'blur(8px)' : 'none' }}>
                                                <p className="font-semibold text-slate-800 text-sm">
                                                    {entry.candidate_name === "████████" ? "Hidden Candidate" : entry.candidate_name}
                                                </p>
                                                {(entry.candidate_email || !entry.is_visible) && (
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {entry.candidate_email || "hidden@candidate.com"}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div style={{ filter: !entry.is_visible ? 'blur(8px)' : 'none' }}>
                                            <ScoreBadge score={entry.composite_score ?? 85.5} label={entry.score_label === "Locked" ? "Excellent" : entry.score_label} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 hidden md:table-cell max-w-xs">
                                        <div style={{ filter: !entry.is_visible ? 'blur(8px)' : 'none' }}>
                                            <p className="text-xs text-slate-500 line-clamp-2">{entry.top_strength || "Strong alignment with required skills."}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div style={{ filter: !entry.is_visible ? 'blur(8px)' : 'none' }}>
                                            <StatusPill status={entry.status === "locked" ? "under_review" : entry.status} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div style={{ filter: !entry.is_visible ? 'blur(8px)' : 'none', pointerEvents: !entry.is_visible ? 'none' : 'auto' }}>
                                            <div className="flex items-center gap-1">
                                                {entry.status !== "accepted" && (
                                                    <button
                                                        onClick={() => entry.application_id && handleStatusChange(entry.application_id, "accepted")}
                                                        disabled={updatingId === entry.application_id}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                    >
                                                        ✓ Accept
                                                    </button>
                                                )}
                                                {entry.status !== "rejected" && (
                                                    <button
                                                        onClick={() => entry.application_id && handleStatusChange(entry.application_id, "rejected")}
                                                        disabled={updatingId === entry.application_id}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                                    >
                                                        ✕ Reject
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 w-10 text-center">
                                        {entry.is_visible && (
                                            <button onClick={() => toggleRow(entry.rank)} className="text-slate-400 hover:text-slate-700">
                                                {expandedRows.has(entry.rank) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedRows.has(entry.rank) && entry.is_visible && (
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <td colSpan={8} className="px-6 py-4">
                                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Score Breakdown</h4>
                                                {entry.score_breakdown && entry.score_breakdown.dimensions ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {Object.entries(entry.score_breakdown.dimensions).map(([dim, details]: [string, any]) => (
                                                            <div key={dim} className="flex flex-col gap-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-medium text-slate-700 capitalize">{dim.replace(/_/g, ' ')}</span>
                                                                    <span className="text-slate-500 font-medium">{details.weighted_score ?? details.raw_score} pt</span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (details.raw_score / (details.max_score || 100)) * 100))}%` }}></div>
                                                                </div>
                                                                {details.summary && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{details.summary}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500">No breakdown available.</p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Bulk Shortlist</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Are you sure you want to accept all candidates with a score of <strong className="text-slate-900">{cutoffScore}</strong> or above?
                        </p>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowConfirmModal(false)} className="flex-1 h-11 border rounded-xl text-sm font-semibold">Cancel</button>
                            <button onClick={executeBulkShortlist} className="flex-1 h-11 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showSuccessModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Success</h3>
                        <p className="text-sm text-slate-500 mb-6">Shortlisted {successCount} candidates successfully.</p>
                        <button onClick={() => setShowSuccessModal(false)} className="w-full h-11 bg-slate-900 text-white rounded-xl text-sm font-semibold">Done</button>
                    </div>
                </div>
            )}

            {showErrorModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center border border-slate-100">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <X className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Action Failed</h3>
                        <p className="text-sm text-slate-500 mb-6">{modalErrorMessage}</p>
                        <button onClick={() => setShowErrorModal(false)} className="w-full h-11 bg-slate-900 text-white rounded-xl text-sm font-semibold">Close</button>
                    </div>
                </div>
            )}

            {showExportEstimateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                            <FolderArchive className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Export Data</h3>
                        {isEstimating ? (
                            <p className="text-sm text-slate-500">Calculating export size...</p>
                        ) : exportEstimate ? (
                            <>
                                <p className="text-sm text-slate-600 mb-6">You are about to export {exportEstimate.candidate_count} candidates.</p>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowExportEstimateModal(false)} className="flex-1 h-11 border rounded-xl text-sm font-semibold">Cancel</button>
                                    <button onClick={confirmZipExport} className="flex-1 h-11 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Confirm Export</button>
                                </div>
                            </>
                        ) : <p className="text-sm text-red-500">Failed to load estimate.</p>}
                    </div>
                </div>
            )}

            {showCompareModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-4 border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> Compare Candidates</h3>
                            <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50 p-4 rounded-xl">
                            {(() => {
                                const candidates = Array.from(selectedCandidates).map(id => data.leaderboard.find(c => c.application_id === id)).filter(Boolean) as LeaderboardEntry[];
                                const dimensionsSet = new Set<string>();
                                candidates.forEach(c => {
                                    if (c.score_breakdown?.dimensions) Object.keys(c.score_breakdown.dimensions).forEach(k => dimensionsSet.add(k));
                                });
                                const chartData = Array.from(dimensionsSet).map(dim => {
                                    const point: any = { subject: dim.replace(/_/g, ' ') };
                                    candidates.forEach((c, idx) => { point[`candidate_${idx}`] = c.score_breakdown?.dimensions?.[dim]?.raw_score || 0; });
                                    return point;
                                });
                                const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
                                return (
                                    <div className="h-[500px] w-full bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                                                <PolarGrid stroke="#e2e8f0" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                                {candidates.map((c, idx) => (
                                                    <Radar key={idx} name={c.candidate_name} dataKey={`candidate_${idx}`} stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.3} />
                                                ))}
                                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
