"use client";
import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────

interface PredictionItem {
    itemName: string;
    predictedQuantity: number;
    confidence: number;
    trend: "up" | "down" | "stable";
    avgDaily7: number;
    avgDaily30: number;
}

interface WasteInsight {
    message: string;
    type: "increase" | "decrease" | "pattern" | "warning";
    itemName?: string;
}

interface ProductionSlot {
    slot: string;
    items: { itemName: string; quantity: number }[];
}

interface InventoryAlert {
    itemName: string;
    predictedDemand: number;
    currentStock: number;
    status: "ok" | "low" | "critical";
    deficit: number;
}

interface DemandData {
    predictions: PredictionItem[];
    insights: WasteInsight[];
    productionPlan: ProductionSlot[];
    inventoryAlerts: InventoryAlert[];
    todaySales: { itemName: string; quantity: number }[];
    dailyTrend: { date: string; total: number }[];
    weeklyPattern: { day: string; total: number }[];
    generatedAt: string;
    aiProvider: string;
}

// ─── Animated Counter ─────────────────────────────

function AnimatedCounter({ value, duration = 1500 }: { value: number; duration?: number }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const increment = value / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= value) {
                setCount(value);
                clearInterval(timer);
            } else {
                setCount(Math.round(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [value, duration]);
    return <>{count}</>;
}

// ─── Chart Colors ─────────────────────────────────

const CHART_COLORS = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#f87171", "#2dd4bf", "#f472b6", "#818cf8"];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-zayko-800 border border-zayko-700 rounded-xl px-3 py-2 shadow-xl">
            <p className="text-xs text-zayko-400 mb-1">{label}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="text-sm font-bold" style={{ color: entry.color }}>
                    {entry.value} units
                </p>
            ))}
        </div>
    );
};

// ─── Main Component ───────────────────────────────

export default function AIDemandPage() {
    const [data, setData] = useState<DemandData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSection, setActiveSection] = useState<string>("all");

    const getHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("stockManagerToken")}`,
    }), []);

    const fetchData = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true);
        try {
            const url = `/api/stock/ai-demand${refresh ? "?refresh=true" : ""}`;
            const res = await fetch(url, { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setData(json);
                if (refresh) toast.success("Predictions refreshed! 🧠");
            } else {
                toast.error(json.error || "Failed to load predictions");
            }
        } catch {
            toast.error("Failed to fetch AI predictions");
        }
        setLoading(false);
        setRefreshing(false);
    }, [getHeaders]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const getTrendIcon = (trend: string) => {
        if (trend === "up") return "📈";
        if (trend === "down") return "📉";
        return "➡️";
    };

    const getInsightIcon = (type: string) => {
        if (type === "increase") return "🔺";
        if (type === "decrease") return "🔻";
        if (type === "warning") return "⚠️";
        return "💡";
    };

    const getStatusColor = (status: string) => {
        if (status === "critical") return "text-red-400 bg-red-500/15 border-red-500/30";
        if (status === "low") return "text-amber-400 bg-amber-500/15 border-amber-500/30";
        return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    };

    const getStatusLabel = (status: string) => {
        if (status === "critical") return "CRITICAL";
        if (status === "low") return "LOW STOCK";
        return "OK";
    };

    // ─── Sections ─────────────────────────────────

    const sections = [
        { key: "all", label: "All Sections", icon: "🏠" },
        { key: "live", label: "Live Demand", icon: "📡" },
        { key: "predict", label: "AI Prediction", icon: "🧠" },
        { key: "waste", label: "Waste Insights", icon: "♻️" },
        { key: "production", label: "Production Plan", icon: "🏭" },
        { key: "inventory", label: "Inventory Check", icon: "📦" },
    ];

    const show = (key: string) => activeSection === "all" || activeSection === key;

    return (
        <div className="min-h-screen bg-zayko-900 pb-12">
            {/* ─── Header ─── */}
            <div className="bg-gradient-to-br from-violet-500/10 via-zayko-800 to-cyan-500/5 border-b border-zayko-700 px-6 py-5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center text-2xl border border-violet-500/20 shadow-lg shadow-violet-500/10">
                                🤖
                            </div>
                            <div>
                                <h1 className="text-xl font-display font-bold text-white">AI Demand Intelligence</h1>
                                <p className="text-xs text-violet-400">Powered by Multi-LLM AI Engine</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {data && (
                                <span className="text-[10px] text-zayko-500">
                                    Last updated: {new Date(data.generatedAt).toLocaleTimeString()} • via {data.aiProvider}
                                </span>
                            )}
                            <button
                                onClick={() => fetchData(true)}
                                disabled={refreshing}
                                className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-xl text-sm font-bold hover:from-violet-500 hover:to-cyan-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {refreshing ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
                                ) : (
                                    <>🔄 Refresh AI</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                        {sections.map((s) => (
                            <button
                                key={s.key}
                                onClick={() => setActiveSection(s.key)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border ${
                                    activeSection === s.key
                                        ? "bg-violet-500/20 text-violet-300 border-violet-500/30 shadow-lg shadow-violet-500/10"
                                        : "bg-white/5 text-zayko-400 border-white/5 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                <span>{s.icon}</span>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-violet-400 text-sm font-semibold animate-pulse">AI is analyzing demand patterns...</p>
                    </div>
                ) : !data ? (
                    <div className="text-center py-20 text-zayko-400">
                        <p className="text-4xl mb-4">🤖</p>
                        <p className="text-lg font-semibold">Failed to load AI predictions</p>
                        <button onClick={() => { setLoading(true); fetchData(); }} className="mt-4 px-6 py-2 bg-violet-500/20 text-violet-400 rounded-xl text-sm font-bold hover:bg-violet-500/30 transition-all">
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ═══════════════════════════════════════
                            SECTION 1 — LIVE DEMAND TRACKER
                        ═══════════════════════════════════════ */}
                        {show("live") && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-5 sm:p-6">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">📡</div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Live Demand Tracker</h2>
                                            <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Today's real-time sales</p>
                                        </div>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                        <div className="bg-white/5 rounded-xl p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-emerald-400">
                                                <AnimatedCounter value={data.todaySales.reduce((s, i) => s + i.quantity, 0)} />
                                            </p>
                                            <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mt-1">Units Sold</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-blue-400">
                                                <AnimatedCounter value={data.todaySales.length} />
                                            </p>
                                            <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mt-1">Items Selling</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-purple-400">
                                                <AnimatedCounter value={data.todaySales.length > 0 ? data.todaySales[0].quantity : 0} />
                                            </p>
                                            <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mt-1">Top Item Qty</p>
                                        </div>
                                    </div>

                                    {/* Top Selling Bar Chart */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <h3 className="text-xs text-zayko-400 font-semibold uppercase tracking-wider mb-3">🔥 Top Selling Items Today</h3>
                                            {data.todaySales.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <BarChart data={data.todaySales.slice(0, 8)} layout="vertical" margin={{ left: 5, right: 15 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                        <XAxis type="number" stroke="#666" tick={{ fontSize: 10 }} />
                                                        <YAxis dataKey="itemName" type="category" width={90} stroke="#666" tick={{ fontSize: 10 }} />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="quantity" radius={[0, 6, 6, 0]}>
                                                            {data.todaySales.slice(0, 8).map((_, i) => (
                                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <p className="text-sm text-zayko-500 text-center py-8">No sales yet today</p>
                                            )}
                                        </div>

                                        {/* Top Items List */}
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <h3 className="text-xs text-zayko-400 font-semibold uppercase tracking-wider mb-3">📋 Sales Breakdown</h3>
                                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                                                {data.todaySales.slice(0, 10).map((item, idx) => (
                                                    <div key={item.itemName} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-zayko-500 w-5">{idx + 1}</span>
                                                            <span className="text-sm font-semibold text-white">{item.itemName}</span>
                                                        </div>
                                                        <span className="text-lg font-display font-bold text-emerald-400">{item.quantity}</span>
                                                    </div>
                                                ))}
                                                {data.todaySales.length === 0 && <p className="text-sm text-zayko-500 text-center py-6">No orders today yet</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.section>
                        )}

                        {/* ═══════════════════════════════════════
                            SECTION 2 — TOMORROW DEMAND PREDICTION
                        ═══════════════════════════════════════ */}
                        {show("predict") && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                            >
                                <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-500/20 rounded-2xl p-5 sm:p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-xl">🧠</div>
                                            <div>
                                                <h2 className="text-base font-display font-bold text-white">Tomorrow&apos;s Demand Prediction</h2>
                                                <p className="text-[10px] text-violet-400 uppercase tracking-wider font-bold">AI-Powered • {data.predictions.length} items analyzed</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 font-bold">
                                            🤖 {data.aiProvider}
                                        </span>
                                    </div>

                                    {/* 7-day Demand Trend */}
                                    <div className="bg-white/5 rounded-xl p-4 mb-5">
                                        <h3 className="text-xs text-zayko-400 font-semibold uppercase tracking-wider mb-3">📈 7-Day Demand Trend</h3>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <AreaChart data={data.dailyTrend} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                                <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="total" stroke="#8b5cf6" fill="url(#trendGradient)" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Weekly Pattern */}
                                    <div className="bg-white/5 rounded-xl p-4 mb-5">
                                        <h3 className="text-xs text-zayko-400 font-semibold uppercase tracking-wider mb-3">📅 Weekly Demand Pattern (30 days)</h3>
                                        <ResponsiveContainer width="100%" height={150}>
                                            <BarChart data={data.weeklyPattern} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis dataKey="day" stroke="#666" tick={{ fontSize: 10 }} />
                                                <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                                    {data.weeklyPattern.map((_, i) => (
                                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Predictions Table */}
                                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead>
                                                    <tr className="border-b border-zayko-700 bg-zayko-800/50">
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider">Item</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-center">Predicted</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-center">Confidence</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-center">Trend</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-right">7d Avg</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.predictions.map((p) => (
                                                        <tr key={p.itemName} className="border-b border-zayko-700/50 hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-3 text-white font-semibold">{p.itemName}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="text-lg font-display font-bold text-violet-400">{p.predictedQuantity}</span>
                                                                <span className="text-xs text-zayko-500 ml-1">units</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                                p.confidence >= 80 ? "bg-emerald-500" : p.confidence >= 60 ? "bg-amber-500" : "bg-red-500"
                                                                            }`}
                                                                            style={{ width: `${p.confidence}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`text-xs font-bold ${
                                                                        p.confidence >= 80 ? "text-emerald-400" : p.confidence >= 60 ? "text-amber-400" : "text-red-400"
                                                                    }`}>
                                                                        {p.confidence}%
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-lg">{getTrendIcon(p.trend)}</td>
                                                            <td className="px-4 py-3 text-right text-zayko-300 font-mono">{p.avgDaily7}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </motion.section>
                        )}

                        {/* ═══════════════════════════════════════
                            SECTION 3 — FOOD WASTE REDUCTION INSIGHTS
                        ═══════════════════════════════════════ */}
                        {show("waste") && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.2 }}
                            >
                                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-5 sm:p-6">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-xl">♻️</div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Food Waste Reduction Insights</h2>
                                            <p className="text-[10px] text-green-400 uppercase tracking-wider font-bold">AI-Generated actionable insights</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {data.insights.map((insight, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className={`p-4 rounded-xl border transition-all hover:scale-[1.01] ${
                                                    insight.type === "warning"
                                                        ? "bg-amber-500/10 border-amber-500/20"
                                                        : insight.type === "increase"
                                                        ? "bg-red-500/10 border-red-500/20"
                                                        : insight.type === "decrease"
                                                        ? "bg-blue-500/10 border-blue-500/20"
                                                        : "bg-green-500/10 border-green-500/20"
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="text-2xl shrink-0">{getInsightIcon(insight.type)}</span>
                                                    <div>
                                                        <p className="text-sm text-white leading-relaxed">{insight.message}</p>
                                                        {insight.itemName && (
                                                            <span className="text-[10px] px-2 py-0.5 mt-2 inline-block rounded-full bg-white/10 text-zayko-300 font-semibold">
                                                                📍 {insight.itemName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {data.insights.length === 0 && (
                                            <p className="text-sm text-zayko-500 col-span-2 text-center py-8">No waste insights available yet</p>
                                        )}
                                    </div>
                                </div>
                            </motion.section>
                        )}

                        {/* ═══════════════════════════════════════
                            SECTION 4 — PRODUCTION PLAN GENERATOR
                        ═══════════════════════════════════════ */}
                        {show("production") && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.3 }}
                            >
                                <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-2xl p-5 sm:p-6">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-xl">🏭</div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Production Plan Generator</h2>
                                            <p className="text-[10px] text-orange-400 uppercase tracking-wider font-bold">Tomorrow&apos;s recommended preparation schedule</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {data.productionPlan.map((slot, slotIdx) => (
                                            <motion.div
                                                key={slot.slot}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: slotIdx * 0.15 }}
                                                className="bg-white/5 border border-white/5 rounded-xl p-4"
                                            >
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className="text-lg">{slotIdx === 0 ? "🌅" : "☀️"}</span>
                                                    <h3 className="text-sm font-display font-bold text-white">{slot.slot}</h3>
                                                </div>
                                                <div className="space-y-2">
                                                    {slot.items.map((item) => (
                                                        <div key={item.itemName} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl">
                                                            <span className="text-sm text-zayko-200">Prepare {item.itemName}</span>
                                                            <span className="text-sm font-bold text-orange-400">{item.quantity} units</span>
                                                        </div>
                                                    ))}
                                                    {slot.items.length === 0 && (
                                                        <p className="text-xs text-zayko-500 text-center py-4">No items for this slot</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-zayko-700/50">
                                                    <span className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold">Total</span>
                                                    <span className="text-sm font-bold text-white">
                                                        {slot.items.reduce((s, i) => s + i.quantity, 0)} units
                                                    </span>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {data.productionPlan.length === 0 && (
                                            <p className="text-sm text-zayko-500 col-span-2 text-center py-8">No production plan available</p>
                                        )}
                                    </div>
                                </div>
                            </motion.section>
                        )}

                        {/* ═══════════════════════════════════════
                            SECTION 5 — INVENTORY CROSS-CHECK
                        ═══════════════════════════════════════ */}
                        {show("inventory") && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.4 }}
                            >
                                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-2xl p-5 sm:p-6">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-xl">📦</div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Inventory Cross-Check</h2>
                                            <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold">Predicted demand vs current stock</p>
                                        </div>
                                    </div>

                                    {/* Alert Summary */}
                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-emerald-400">
                                                <AnimatedCounter value={data.inventoryAlerts.filter((a) => a.status === "ok").length} />
                                            </p>
                                            <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mt-1">Stock OK</p>
                                        </div>
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-amber-400">
                                                <AnimatedCounter value={data.inventoryAlerts.filter((a) => a.status === "low").length} />
                                            </p>
                                            <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mt-1">Low Stock</p>
                                        </div>
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-red-400">
                                                <AnimatedCounter value={data.inventoryAlerts.filter((a) => a.status === "critical").length} />
                                            </p>
                                            <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mt-1">Critical</p>
                                        </div>
                                    </div>

                                    {/* Alerts Table */}
                                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead>
                                                    <tr className="border-b border-zayko-700 bg-zayko-800/50">
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider">Item</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-right">Predicted</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-right">Current Stock</th>
                                                        <th className="px-4 py-3 text-zayko-400 font-semibold text-xs uppercase tracking-wider text-right">Deficit</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.inventoryAlerts.map((alert) => (
                                                        <tr key={alert.itemName} className="border-b border-zayko-700/50 hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-3 text-white font-semibold">{alert.itemName}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(alert.status)}`}>
                                                                    {getStatusLabel(alert.status)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-violet-400 font-mono">{alert.predictedDemand}</td>
                                                            <td className="px-4 py-3 text-right text-zayko-300 font-mono">{alert.currentStock}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                {alert.deficit > 0 ? (
                                                                    <span className="text-red-400 font-bold">-{alert.deficit}</span>
                                                                ) : (
                                                                    <span className="text-emerald-400">✓</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {data.inventoryAlerts.filter((a) => a.status !== "ok").length > 0 && (
                                        <p className="text-[10px] text-cyan-400/60 mt-3 text-center">
                                            ⚠️ {data.inventoryAlerts.filter((a) => a.status !== "ok").length} items need restocking before tomorrow&apos;s predicted demand.
                                        </p>
                                    )}
                                </div>
                            </motion.section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
