"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import { 
    ArrowLeft, Lightbulb, RefreshCw, Flame, Clock, 
    TrendingUp, Inbox, Users, Wallet, CheckCircle2, 
    XCircle, CheckCircle, X
} from "lucide-react";

interface Suggestion {
    id: string;
    itemName: string;
    category: string | null;
    description: string | null;
    expectedPrice: number | null;
    totalRequests: number;
    uniqueUsers: number;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
}

interface Summary {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    conversionRate: number;
    mostRequested: string;
    mostRequestedCount: number;
}

type SortMode = "demand" | "newest";
type FilterStatus = "all" | "pending" | "approved" | "rejected";

export default function AdminItemSuggestionsPage() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [sortMode, setSortMode] = useState<SortMode>("demand");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/admin/item-suggestions", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setSuggestions(json.suggestions);
                setSummary(json.summary);
            } else {
                toast.error(json.error || "Failed to load");
            }
        } catch {
            toast.error("Failed to load suggestions");
        }
        setLoading(false);
    };

    const handleStatusUpdate = async (id: string, status: "approved" | "rejected") => {
        setUpdatingId(id);
        try {
            const res = await fetch(`/api/admin/item-suggestions?id=${id}`, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify({ status }),
            });
            const json = await res.json();
            if (json.success) {
                toast.success(
                    status === "approved"
                        ? `"${json.suggestion.itemName}" approved! Users notified.`
                        : `"${json.suggestion.itemName}" rejected`
                );

                // If approved, offer to add to menu
                if (status === "approved" && json.suggestion) {
                    const addToMenu = confirm(
                        `Would you like to add "${json.suggestion.itemName}" to the menu now?\n\nYou can also do this later from the Menu page.`
                    );
                    if (addToMenu) {
                        // Navigate to admin menu with pre-fill params
                        const params = new URLSearchParams({
                            prefillName: json.suggestion.itemName || "",
                            prefillCategory: json.suggestion.category || "",
                            prefillPrice: String(json.suggestion.expectedPrice || ""),
                        });
                        window.location.href = `/admin/menu?${params.toString()}`;
                        return;
                    }
                }

                fetchData();
            } else {
                toast.error(json.error || "Failed to update");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setUpdatingId(null);
    };

    // Sort & filter
    let displayed = [...suggestions];
    if (filterStatus !== "all") {
        displayed = displayed.filter((s) => s.status === filterStatus);
    }
    if (sortMode === "demand") {
        displayed.sort((a, b) => b.totalRequests - a.totalRequests);
    } else {
        displayed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                {/* Header */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors text-sm"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl text-amber-500"><Lightbulb className="w-6 h-6" /></div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">Item Suggestions</h1>
                                <p className="text-xs text-zayko-400">Demand-driven product discovery</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setLoading(true); fetchData(); }}
                            className="px-4 py-2 bg-gold-500/20 text-gold-400 rounded-xl text-sm font-semibold hover:bg-gold-500/30 transition-all flex items-center gap-2"
                        >
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
                            {summary && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                                    {[
                                        { label: "Total Suggestions", value: summary.total, icon: <Lightbulb className="w-5 h-5 text-blue-400" />, color: "text-blue-400" },
                                        { label: "Most Requested", value: summary.mostRequested, sub: `${summary.mostRequestedCount} requests`, icon: <Flame className="w-5 h-5 text-gold-400" />, color: "text-gold-400" },
                                        { label: "Pending", value: summary.pending, icon: <Clock className="w-5 h-5 text-yellow-500" />, color: "text-yellow-400" },
                                        { label: "Conversion Rate", value: `${summary.conversionRate}%`, icon: <TrendingUp className="w-5 h-5" />, color: summary.conversionRate > 0 ? "text-emerald-400" : "text-zayko-400" },
                                    ].map((card) => (
                                        <div key={card.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                {card.icon}
                                                <span className="text-xs text-zayko-400">{card.label}</span>
                                            </div>
                                            <p className={`text-xl font-display font-bold ${card.color} truncate`}>{card.value}</p>
                                            {"sub" in card && card.sub && <p className="text-xs text-zayko-500 mt-0.5">{card.sub}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ─── Sort & Filter Bar ─── */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 mb-6 animate-slide-up">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs text-zayko-400 font-semibold">Sort:</span>
                                    {(["demand", "newest"] as SortMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setSortMode(mode)}
                                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${sortMode === mode ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}
                                        >
                                            {mode === "demand" ? <><Flame className="w-3.5 h-3.5" /> Highest Demand</> : <><Clock className="w-3.5 h-3.5" /> Newest First</>}
                                        </button>
                                    ))}

                                    <span className="text-xs text-zayko-400 font-semibold ml-2">Filter:</span>
                                    {(["all", "pending", "approved", "rejected"] as FilterStatus[]).map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setFilterStatus(f)}
                                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filterStatus === f ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}
                                        >
                                            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ─── Suggestions List ─── */}
                            {displayed.length === 0 ? (
                                <div className="bg-zayko-800/30 border border-zayko-700 rounded-2xl p-8 text-center flex flex-col items-center">
                                    <Inbox className="w-12 h-12 text-zayko-700 mb-3" />
                                    <p className="text-zayko-400">No suggestions match your filters</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayed.map((s) => (
                                        <div key={s.id} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-5 animate-slide-up">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="font-bold text-white text-base">{s.itemName}</span>
                                                        {s.category && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{s.category}</span>
                                                        )}
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${s.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                                                                s.status === "rejected" ? "bg-red-500/20 text-red-400" :
                                                                    "bg-yellow-500/20 text-yellow-400"
                                                            }`}>
                                                            {s.status === "approved" ? <CheckCircle className="w-3 h-3" /> : s.status === "rejected" ? <X className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {s.status}
                                                        </span>
                                                    </div>

                                                    {s.description && (
                                                        <p className="text-xs text-zayko-400 mt-0.5">{s.description}</p>
                                                    )}

                                                    <div className="flex items-center gap-4 mt-2 text-xs text-zayko-500">
                                                        <span className="flex items-center gap-1.5">
                                                            <Users className="w-3.5 h-3.5" />
                                                            <strong className="text-gold-400">{s.totalRequests}</strong> request{s.totalRequests !== 1 ? "s" : ""} from <strong className="text-blue-400">{s.uniqueUsers}</strong> user{s.uniqueUsers !== 1 ? "s" : ""}
                                                        </span>
                                                        {s.expectedPrice && <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> ₹{s.expectedPrice}</span>}
                                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(s.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                {s.status === "pending" && (
                                                    <div className="flex gap-2 shrink-0">
                                                        <button
                                                            onClick={() => handleStatusUpdate(s.id, "approved")}
                                                            disabled={updatingId === s.id}
                                                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                                                        >
                                                            {updatingId === s.id ? "…" : <><CheckCircle2 className="w-4 h-4" /> Approve</>}
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(s.id, "rejected")}
                                                            disabled={updatingId === s.id}
                                                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                                                        >
                                                            {updatingId === s.id ? "…" : <><XCircle className="w-4 h-4" /> Reject</>}
                                                        </button>
                                                    </div>
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
