"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ArrowLeft, BarChart3, RefreshCw, ClipboardList, Users, Flame, Calendar, TrendingUp } from "lucide-react";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444"];

interface ForecastItem { itemName: string; totalQty: number; uniqueUsers: number }
interface DayTotal { day: string; total: number }
interface Summary {
    totalDemands: number; uniqueUsers: number;
    topItem: string; topItemQty: number;
    peakDay: string; peakDayQty: number;
}

export default function DemandForecastPage() {
    const [forecast, setForecast] = useState<Record<string, ForecastItem[]>>({});
    const [dayTotals, setDayTotals] = useState<DayTotal[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterDay, setFilterDay] = useState("all");

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/admin/demand-forecast", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setForecast(json.forecast);
                setDayTotals(json.dayTotals);
                setSummary(json.summary);
            } else toast.error(json.error || "Failed to load");
        } catch { toast.error("Failed to load forecast"); }
        setLoading(false);
    };

    const displayDays = filterDay === "all" ? ALL_DAYS : [filterDay];

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
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">Demand Forecast</h1>
                                <p className="text-xs text-zayko-400">Day-wise demand analysis</p>
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
                            {/* Summary Cards */}
                             {summary && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                                    {[
                                        { label: "Total Demands", value: summary.totalDemands, icon: <ClipboardList className="w-5 h-5 text-blue-400" />, color: "text-blue-400" },
                                        { label: "Unique Users", value: summary.uniqueUsers, icon: <Users className="w-5 h-5 text-purple-400" />, color: "text-purple-400" },
                                        { label: "Top Item", value: summary.topItem, sub: `${summary.topItemQty} units/week`, icon: <Flame className="w-5 h-5 text-gold-400" />, color: "text-gold-400" },
                                        { label: "Peak Day", value: summary.peakDay, sub: `${summary.peakDayQty} units`, icon: <Calendar className="w-5 h-5 text-emerald-400" />, color: "text-emerald-400" },
                                    ].map((c) => (
                                        <div key={c.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                {c.icon}
                                                <span className="text-xs text-zayko-400">{c.label}</span>
                                            </div>
                                            <p className={`text-xl font-display font-bold ${c.color} truncate`}>{c.value}</p>
                                            {"sub" in c && c.sub && <p className="text-xs text-zayko-500 mt-0.5">{c.sub}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Bar Chart */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 mb-8 animate-slide-up">
                                <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-gold-400" /> Day-wise Total Demand
                                </h3>
                                {dayTotals.some((d) => d.total > 0) ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={dayTotals}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                            <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                            <Tooltip contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }}
                                                formatter={(value) => [`${value} units`, "Demand"]} />
                                            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                                {dayTotals.map((_, idx) => (<Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-zayko-500">No demand data yet</div>
                                )}
                            </div>

                            {/* Day Filter */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 mb-6 animate-slide-up">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-zayko-400 font-semibold">Filter:</span>
                                    <button onClick={() => setFilterDay("all")}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filterDay === "all" ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}>
                                        All Days
                                    </button>
                                    {ALL_DAYS.map((day) => (
                                        <button key={day} onClick={() => setFilterDay(day)}
                                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filterDay === day ? "bg-gold-500 text-zayko-900" : "bg-white/5 text-zayko-400 border border-white/10"}`}>
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Day-wise Breakdown */}
                            <div className="space-y-4">
                                {displayDays.map((day) => {
                                    const items = forecast[day] || [];
                                    return (
                                        <div key={day} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 animate-slide-up">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-white">{day}</h4>
                                                <span className="text-xs text-zayko-500">{items.reduce((s, i) => s + i.totalQty, 0)} total units</span>
                                            </div>
                                            {items.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {items.map((item) => (
                                                        <div key={item.itemName} className="flex items-center justify-between py-1.5 px-3 bg-white/5 rounded-xl">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm text-zayko-200">{item.itemName}</span>
                                                                <span className="text-xs text-zayko-500 flex items-center gap-1">
                                                                    <Users className="w-3 h-3" /> {item.uniqueUsers} user{item.uniqueUsers !== 1 ? "s" : ""}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-bold text-gold-400">{item.totalQty} units</span>
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
                        </>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
