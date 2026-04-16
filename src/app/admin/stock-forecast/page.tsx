"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { 
    ArrowLeft, BarChart3, RefreshCw, Users, Flame, Calendar, 
    AlertTriangle, TrendingUp, ClipboardList, Package, CheckCircle2 
} from "lucide-react";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};
const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444"];

interface StockItem {
    itemId: string;
    itemName: string;
    currentStock: number;
    weeklyDemand: number;
    maxDailyDemand: number;
    suggestedMinStock: number;
    shortageRisk: boolean;
    dailyDemand: Record<string, number>;
}

interface ForecastData {
    demandByDay: Record<string, Record<string, number>>;
    weeklyTotals: Record<string, number>;
    stockComparison: StockItem[];
    summary: {
        totalActiveUsers: number;
        highestDemandItem: string;
        highestDemandQty: number;
        mostDemandingDay: string;
        mostDemandingDayQty: number;
        itemsAtRisk: number;
    };
    dayChartData: Array<{ day: string; total: number }>;
}

export default function StockForecastPage() {
    const [data, setData] = useState<ForecastData | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterDay, setFilterDay] = useState("all");
    const [filterItem, setFilterItem] = useState("");
    const [highDemandOnly, setHighDemandOnly] = useState(false);
    const [shortageOnly, setShortageOnly] = useState(false);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/admin/stock-forecast", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setData(json);
            } else {
                toast.error(json.error || "Failed to load forecast");
            }
        } catch {
            toast.error("Failed to load forecast data");
        }
        setLoading(false);
    };

    // All unique item names
    const allItems = data ? Object.keys(data.weeklyTotals).sort() : [];

    // Median demand for "high demand" threshold
    const demandValues = allItems.map((i) => data?.weeklyTotals[i] || 0).sort((a, b) => a - b);
    const medianDemand = demandValues.length > 0 ? demandValues[Math.floor(demandValues.length / 2)] : 0;

    // Apply filters to stock comparison
    const filteredStock = (data?.stockComparison || []).filter((s) => {
        if (filterItem && !s.itemName.toLowerCase().includes(filterItem.toLowerCase())) return false;
        if (shortageOnly && !s.shortageRisk) return false;
        if (highDemandOnly && s.weeklyDemand < medianDemand) return false;
        return true;
    });

    // Filter demandByDay for day view
    const displayDays = filterDay === "all" ? ALL_DAYS : [filterDay];

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                {/* Header */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors text-sm">
                                <ArrowLeft className="w-4 h-4" /> Dashboard
                            </Link>
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-xl text-purple-400">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">Stock Forecast</h1>
                                <p className="text-xs text-zayko-400">Demand analysis & stock planning</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setLoading(true); fetchData(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-gold-500/20 text-gold-400 rounded-xl text-sm font-semibold hover:bg-gold-500/30 transition-all"
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
                    ) : !data ? (
                        <div className="text-center py-20 text-zayko-400">Failed to load data</div>
                    ) : (
                        <>
                            {/* ─── Summary Cards ─── */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                                {[
                                    { label: "Active Demand Users", value: data.summary.totalActiveUsers, icon: <Users className="w-5 h-5 text-blue-400" />, color: "text-blue-400" },
                                    { label: "Highest Demand Item", value: data.summary.highestDemandItem, sub: `${data.summary.highestDemandQty} units/week`, icon: <Flame className="w-5 h-5 text-gold-400" />, color: "text-gold-400" },
                                    { label: "Most Demanding Day", value: data.summary.mostDemandingDay, sub: `${data.summary.mostDemandingDayQty} units`, icon: <Calendar className="w-5 h-5 text-purple-400" />, color: "text-purple-400" },
                                    { label: "Items at Risk", value: data.summary.itemsAtRisk, icon: <AlertTriangle className="w-5 h-5 text-red-400" />, color: data.summary.itemsAtRisk > 0 ? "text-red-400" : "text-emerald-400" },
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

                            {/* ─── Bar Chart: Day vs Demand ─── */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 mb-8 animate-slide-up">
                                <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-gold-400" /> Day-wise Total Demand
                                </h3>
                                {data.dayChartData.some((d) => d.total > 0) ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={data.dayChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fill: "#94a3b8", fontSize: 12 }}
                                                tickFormatter={(v: string) => DAY_SHORT[v] || v}
                                            />
                                            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }}
                                                labelFormatter={(v) => `${v}`}
                                                formatter={(value) => [`${value} units`, "Demand"]}
                                            />
                                            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                                {data.dayChartData.map((_, idx) => (
                                                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-zayko-500">No demand data yet</div>
                                )}
                            </div>

                            {/* ─── Filters ─── */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 mb-6 animate-slide-up">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs text-zayko-400 font-semibold">Filters:</span>

                                    <select
                                        value={filterDay}
                                        onChange={(e) => setFilterDay(e.target.value)}
                                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 appearance-none"
                                    >
                                        <option value="all" className="bg-zayko-800">All Days</option>
                                        {ALL_DAYS.map((d) => (
                                            <option key={d} value={d} className="bg-zayko-800">{d}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="text"
                                        placeholder="Search item…"
                                        value={filterItem}
                                        onChange={(e) => setFilterItem(e.target.value)}
                                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-zayko-500 focus:outline-none focus:ring-2 focus:ring-gold-400 w-44"
                                    />

                                    <button
                                        onClick={() => setHighDemandOnly(!highDemandOnly)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${highDemandOnly ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}
                                    >
                                        <Flame className="w-4 h-4" /> High Demand
                                    </button>

                                    <button
                                        onClick={() => setShortageOnly(!shortageOnly)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${shortageOnly ? "bg-red-500 text-white" : "bg-white/5 text-zayko-400 border border-white/10"}`}
                                    >
                                        <AlertTriangle className="w-4 h-4" /> Shortage Risk
                                    </button>
                                </div>
                            </div>

                            {/* ─── Day-wise Demand Breakdown ─── */}
                            <div className="space-y-4 mb-8">
                                <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                                        <ClipboardList className="w-4 h-4" />
                                    </div>
                                    Day-wise Demand
                                </h3>
                                {displayDays.map((day) => {
                                    const items = data.demandByDay[day] || {};
                                    let entries = Object.entries(items).sort((a, b) => b[1] - a[1]);

                                    // Apply item filter
                                    if (filterItem) {
                                        entries = entries.filter(([name]) =>
                                            name.toLowerCase().includes(filterItem.toLowerCase())
                                        );
                                    }

                                    return (
                                        <div key={day} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 animate-slide-up">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-white">{day}</h4>
                                                <span className="text-xs text-zayko-500">
                                                    {entries.reduce((s, [, v]) => s + v, 0)} total units
                                                </span>
                                            </div>
                                            {entries.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {entries.map(([name, qty]) => (
                                                        <div key={name} className="flex items-center justify-between py-1.5 px-3 bg-white/5 rounded-xl">
                                                            <span className="text-sm text-zayko-200">{name}</span>
                                                            <span className="text-sm font-bold text-gold-400">{qty} units</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zayko-500 italic">No demand</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ─── Stock Recommendation Table ─── */}
                            <div className="animate-slide-up">
                                <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
                                        <Package className="w-4 h-4" />
                                    </div>
                                    Stock Recommendations
                                </h3>

                                {filteredStock.length === 0 ? (
                                    <div className="bg-zayko-800/30 border border-zayko-700 rounded-2xl p-8 text-center">
                                        <p className="text-zayko-400">No items match your filters</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-zayko-700">
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold">Item</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Current Stock</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Max Daily Demand</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Weekly Demand</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Suggested Min Stock</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Risk</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStock.map((s) => (
                                                    <tr key={s.itemId} className="border-b border-zayko-700/50 hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-3 text-white font-medium">{s.itemName}</td>
                                                        <td className="px-4 py-3 text-center text-zayko-200">{s.currentStock}</td>
                                                        <td className="px-4 py-3 text-center text-gold-400 font-semibold">{s.maxDailyDemand}</td>
                                                        <td className="px-4 py-3 text-center text-blue-400">{s.weeklyDemand}</td>
                                                        <td className="px-4 py-3 text-center text-emerald-400 font-semibold">{s.suggestedMinStock}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {s.shortageRisk ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                                                                    <AlertTriangle className="w-3 h-3" /> Shortage
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                                                                    <CheckCircle2 className="w-3 h-3" /> OK
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
