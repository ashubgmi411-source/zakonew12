"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";

import { 
    Star, ArrowLeft, RefreshCw, ClipboardList, Clock, 
    BarChart3, Inbox, CheckCircle2, MessageSquare, 
    Utensils, Handshake, Smartphone, Lightbulb 
} from "lucide-react";

const CAT_ICONS: Record<string, React.ReactNode> = {
    "Food Quality": <Utensils className="w-4 h-4" />, 
    "Service": <Handshake className="w-4 h-4" />, 
    "App Issue": <Smartphone className="w-4 h-4" />, 
    "Suggestion": <Lightbulb className="w-4 h-4" />, 
    "Other": <MessageSquare className="w-4 h-4" />,
};

interface FeedbackItem {
    id: string;
    userId: string;
    userName: string;
    rating: number;
    category: string;
    message: string;
    status: "new" | "reviewed";
    createdAt: string;
}

interface Analytics {
    total: number;
    avgRating: number;
    reviewed: number;
    pending: number;
    topCategory: string;
    topCategoryCount: number;
    ratingDistribution: Record<number, number>;
    categoryBreakdown: Record<string, number>;
}

type FilterRating = "all" | 1 | 2 | 3 | 4 | 5;
type FilterCategory = "all" | string;
type FilterStatus = "all" | "new" | "reviewed";

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    const [filterRating, setFilterRating] = useState<FilterRating>("all");
    const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [markingId, setMarkingId] = useState<string | null>(null);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/admin/feedback", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setFeedbacks(json.feedbacks);
                setAnalytics(json.analytics);
            } else toast.error(json.error || "Failed");
        } catch { toast.error("Failed to load feedbacks"); }
        setLoading(false);
    };

    const markReviewed = async (id: string) => {
        setMarkingId(id);
        try {
            const res = await fetch(`/api/admin/feedback?id=${id}`, {
                method: "PATCH",
                headers: getHeaders(),
            });
            const json = await res.json();
            if (json.success) {
                toast.success("Marked as reviewed ✅");
                fetchData();
            } else toast.error(json.error || "Failed");
        } catch { toast.error("Something went wrong"); }
        setMarkingId(null);
    };

    // Filter
    let displayed = [...feedbacks];
    if (filterRating !== "all") displayed = displayed.filter((f) => f.rating === filterRating);
    if (filterCategory !== "all") displayed = displayed.filter((f) => f.category === filterCategory);
    if (filterStatus !== "all") displayed = displayed.filter((f) => f.status === filterStatus);

    const categories = analytics ? Object.keys(analytics.categoryBreakdown) : [];

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors text-sm">
                                <ArrowLeft className="w-4 h-4" /> Dashboard
                            </Link>
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl text-blue-400">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">App Feedback</h1>
                                <p className="text-xs text-zayko-400">Bugs, suggestions & app issues</p>
                            </div>
                        </div>
                        <button onClick={() => { setLoading(true); fetchData(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-gold-500/20 text-gold-400 rounded-xl text-sm font-semibold hover:bg-gold-500/30 transition-all">
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* ─── Summary Cards ─── */}
                            {analytics && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                                    {[
                                        { label: "Avg Rating", value: `${analytics.avgRating} ★`, icon: <Star className="w-5 h-5 fill-current" />, color: analytics.avgRating >= 4 ? "text-emerald-400" : analytics.avgRating >= 3 ? "text-yellow-400" : "text-red-400" },
                                        { label: "Total Feedbacks", value: analytics.total, icon: <ClipboardList className="w-5 h-5" />, color: "text-blue-400" },
                                        { label: "Top Category", value: analytics.topCategory, sub: `${analytics.topCategoryCount} feedbacks`, icon: CAT_ICONS[analytics.topCategory] || <MessageSquare className="w-5 h-5" />, color: "text-gold-400" },
                                        { label: "Pending Review", value: analytics.pending, icon: <Clock className="w-5 h-5" />, color: analytics.pending > 0 ? "text-yellow-400" : "text-emerald-400" },
                                    ].map((c) => (
                                        <div key={c.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={c.color}>{c.icon}</span>
                                                <span className="text-xs text-zayko-400">{c.label}</span>
                                            </div>
                                            <p className={`text-xl font-display font-bold ${c.color} truncate`}>{c.value}</p>
                                            {"sub" in c && c.sub && <p className="text-xs text-zayko-500 mt-0.5">{c.sub}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ─── Rating Distribution ─── */}
                            {analytics && (
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-5 mb-8 animate-slide-up">
                                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-gold-400" /> Rating Distribution
                                    </h3>
                                    <div className="space-y-2">
                                        {[5, 4, 3, 2, 1].map((r) => {
                                            const count = analytics.ratingDistribution[r] || 0;
                                            const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                                            return (
                                                <div key={r} className="flex items-center gap-3">
                                                    <span className="text-sm text-gold-400 w-12">{r} ★</span>
                                                    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-700 ${r >= 4 ? "bg-emerald-500" : r === 3 ? "bg-yellow-500" : "bg-red-500"}`}
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-xs text-zayko-400 w-16 text-right">{count} ({pct}%)</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ─── Filters ─── */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 mb-6 animate-slide-up">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-zayko-400 font-semibold">Rating:</span>
                                    {(["all", 5, 4, 3, 2, 1] as FilterRating[]).map((r) => (
                                        <button key={String(r)} onClick={() => setFilterRating(r)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filterRating === r ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}>
                                            {r === "all" ? "All" : `${r}★`}
                                        </button>
                                    ))}

                                    <span className="text-xs text-zayko-400 font-semibold ml-2">Category:</span>
                                    <button onClick={() => setFilterCategory("all")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filterCategory === "all" ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}>
                                        All
                                    </button>
                                    {categories.map((cat) => (
                                        <button key={cat} onClick={() => setFilterCategory(cat)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filterCategory === cat ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}>
                                            {CAT_ICONS[cat] || "💬"} {cat}
                                        </button>
                                    ))}

                                    <span className="text-xs text-zayko-400 font-semibold ml-2">Status:</span>
                                    {(["all", "new", "reviewed"] as FilterStatus[]).map((s) => (
                                        <button key={s} onClick={() => setFilterStatus(s)}
                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                                            style={{
                                                backgroundColor: filterStatus === s ? "var(--gold-500)" : "rgba(255,255,255,0.05)",
                                                color: filterStatus === s ? "#0c1222" : "var(--zayko-400)",
                                                border: filterStatus === s ? "none" : "1px solid rgba(255,255,255,0.1)"
                                            }}>
                                            {s === "all" ? "All" : s === "new" ? <><Clock className="w-3 h-3" /> Pending</> : <><CheckCircle2 className="w-3 h-3" /> Reviewed</>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ─── Feedback List ─── */}
                             {displayed.length === 0 ? (
                                <div className="bg-zayko-800/30 border border-zayko-700 rounded-2xl p-8 text-center flex flex-col items-center">
                                    <Inbox className="w-12 h-12 text-zayko-700 mb-3" />
                                    <p className="text-zayko-400">No app feedback matches your filters</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayed.map((f) => (
                                        <div key={f.id} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-5 animate-slide-up">
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                        <div className="w-7 h-7 rounded-full bg-zayko-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                            {f.userName?.charAt(0) || "?"}
                                                        </div>
                                                        <span className="text-sm font-bold text-white">{f.userName}</span>
                                                         <div className="flex text-gold-400">
                                                            {Array.from({ length: 5 }).map((_, i) => (
                                                                <Star key={i} className={`w-3 h-3 ${i < f.rating ? "fill-current" : "opacity-20"}`} />
                                                            ))}
                                                        </div>
                                                        <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                                                            {CAT_ICONS[f.category] || <MessageSquare className="w-3 h-3" />} {f.category}
                                                        </span>
                                                        <span className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold border ${f.status === "reviewed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                                                            {f.status === "reviewed" ? <><CheckCircle2 className="w-3 h-3" /> Reviewed</> : <><Clock className="w-3 h-3" /> Pending</>}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-zayko-300 leading-relaxed">{f.message}</p>
                                                    <p className="text-xs text-zayko-500 mt-1.5">{new Date(f.createdAt).toLocaleString()}</p>
                                                </div>
                                                 {f.status === "new" && (
                                                    <button onClick={() => markReviewed(f.id)} disabled={markingId === f.id}
                                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold hover:bg-emerald-500/20 transition-all shrink-0 disabled:opacity-50">
                                                        {markingId === f.id ? "…" : <><CheckCircle2 className="w-4 h-4" /> Mark Reviewed</>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
