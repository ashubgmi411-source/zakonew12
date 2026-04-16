"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { 
    BarChart3, TrendingUp, Users, ShoppingCart, 
    ArrowLeft, RefreshCw, BrainCircuit, Target, 
    Repeat, CreditCard, Wallet, Clock, Flame, Sparkles
} from "lucide-react";

interface FinancialData {
    totalRevenue: number; razorpayRevenue: number; walletRevenue: number;
    todayRevenue: number; weekRevenue: number; monthRevenue: number;
    razorpayPct: number; walletPct: number;
    dailyTrend: Array<{ date: string; label: string; total: number; razorpay: number; wallet: number; orders: number }>;
    monthlyTrend: Array<{ month: string; label: string; total: number }>;
}

interface OrderData {
    totalOrders: number; todayOrders: number; avgOrderValue: number;
    repeatRate: number; totalUsers: number; repeatUsers: number;
    hourlyData: Array<{ hour: number; label: string; orders: number }>;
    peakHour: string; peakHourOrders: number;
}

interface MenuItem { name: string; revenue: number; qty: number; }
interface Insight { icon: string; text: string; type: string; }

const PIE_COLORS = ["#6366f1", "#8b5cf6"];
const GRADIENT_COLORS = { start: "#6366f1", end: "#8b5cf6" };

export default function AdminAnalyticsPage() {
    const [financial, setFinancial] = useState<FinancialData | null>(null);
    const [orders, setOrders] = useState<OrderData | null>(null);
    const [topItems, setTopItems] = useState<MenuItem[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [analyticsRes, insightsRes] = await Promise.all([
                fetch("/api/executive/analytics", { headers: getHeaders() }),
                fetch("/api/executive/ai-insights", { headers: getHeaders() }),
            ]);

            const analytics = await analyticsRes.json();
            const insightsData = await insightsRes.json();

            if (analytics.success) {
                setFinancial(analytics.financial);
                setOrders(analytics.orders);
                setTopItems(analytics.menu?.topItems || []);
            } else {
                toast.error("Failed to load analytics");
            }

            if (insightsData.success) {
                setInsights(insightsData.insights || []);
            }
        } catch {
            toast.error("Failed to load dashboard");
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <AdminGuard>
                <div className="min-h-screen bg-zayko-900 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-zayko-400 text-sm">Gathering business intelligence...</p>
                    </div>
                </div>
            </AdminGuard>
        );
    }

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                {/* Header */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4 sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-4 h-4" /> Dashboard
                            </Link>
                            <h1 className="flex items-center gap-2 text-lg font-display font-bold text-white">
                                <BarChart3 className="w-5 h-5 text-indigo-400" /> Business Intelligence
                            </h1>
                        </div>
                        <button
                            onClick={() => { setLoading(true); fetchAll(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-semibold hover:bg-indigo-500/30 transition-all border border-indigo-500/30"
                        >
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {/* ─── KPI Cards ─── */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 animate-fade-in">
                        {[
                            { label: "Total Revenue", value: `₹${(financial?.totalRevenue || 0).toLocaleString()}`, icon: <Wallet className="w-5 h-5" />, color: "text-emerald-400" },
                            { label: "Today Revenue", value: `₹${(financial?.todayRevenue || 0).toLocaleString()}`, icon: <TrendingUp className="w-5 h-5" />, color: "text-blue-400" },
                            { label: "Total Orders", value: orders?.totalOrders?.toLocaleString() || "0", icon: <ShoppingCart className="w-5 h-5" />, color: "text-purple-400" },
                            { label: "Avg Order", value: `₹${orders?.avgOrderValue || 0}`, icon: <Target className="w-5 h-5" />, color: "text-gold-400" },
                            { label: "Repeat Rate", value: `${orders?.repeatRate || 0}%`, icon: <Repeat className="w-5 h-5" />, color: "text-indigo-400" },
                        ].map((card) => (
                            <div key={card.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={card.color}>{card.icon}</span>
                                    <span className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold">{card.label}</span>
                                </div>
                                <p className={`text-xl font-display font-bold ${card.color}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* ─── AI Insights ─── */}
                    {insights.length > 0 && (
                        <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 rounded-2xl p-6 mb-8 animate-slide-up">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">
                                    <BrainCircuit className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-base font-display font-bold text-white">AI Insights</h2>
                                    <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold">Smart Analysis</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {insights.map((insight, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-start gap-3 py-3 px-4 rounded-xl transition-all ${insight.type === "growth" ? "bg-emerald-500/10 border border-emerald-500/10" :
                                                insight.type === "warning" ? "bg-amber-500/10 border border-amber-500/10" :
                                                    insight.type === "trend" ? "bg-blue-500/10 border border-blue-500/10" :
                                                        "bg-white/5 border border-white/5"
                                            }`}
                                    >
                                        <span className="text-xl shrink-0"><Sparkles className="w-5 h-5 text-indigo-300" /></span>
                                        <p className="text-sm text-zayko-200">{insight.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── Revenue Trend + Payment Split ─── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Revenue Trend */}
                        <div className="lg:col-span-2 bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                            <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-400" /> Revenue Trend (30 Days)
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={financial?.dailyTrend || []}>
                                        <defs>
                                            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={GRADIENT_COLORS.start} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={GRADIENT_COLORS.end} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                                        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 12, fontSize: 12 }} />
                                        <Area type="monotone" dataKey="total" stroke="#6366f1" fillOpacity={1} fill="url(#revenueGrad)" strokeWidth={2} name="Revenue (₹)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Payment Split */}
                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                            <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-indigo-400" /> Payment Split
                            </h3>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: "Razorpay", value: financial?.razorpayPct || 0 },
                                                { name: "Wallet", value: financial?.walletPct || 0 },
                                            ]}
                                            cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                                            paddingAngle={5} dataKey="value"
                                        >
                                            {PIE_COLORS.map((color, i) => (
                                                <Cell key={i} fill={color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 12, fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-6 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                                    <span className="text-xs text-zayko-400">Razorpay {financial?.razorpayPct || 0}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-violet-500"></span>
                                    <span className="text-xs text-zayko-400">Wallet {financial?.walletPct || 0}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── Orders Heatmap + Top Items ─── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Hourly Order Distribution */}
                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                            <h3 className="text-sm font-display font-bold text-white mb-1 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" /> Hourly Distribution
                            </h3>
                            <p className="text-[10px] text-zayko-500 mb-4 ml-7">Peak: {orders?.peakHour} ({orders?.peakHourOrders} orders)</p>
                            <div className="h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={orders?.hourlyData || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 8 }} interval={2} />
                                        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 12, fontSize: 12 }} />
                                        <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} name="Orders" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Items */}
                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                            <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                                <Flame className="w-5 h-5 text-orange-400" /> Top Selling Items
                            </h3>
                            {topItems.length === 0 ? (
                                <div className="text-center py-8 text-zayko-500 text-sm">No order data yet</div>
                            ) : (
                                <div className="space-y-3">
                                    {topItems.slice(0, 7).map((item, i) => {
                                        const maxRev = topItems[0]?.revenue || 1;
                                        const pct = Math.round((item.revenue / maxRev) * 100);
                                        return (
                                            <div key={i}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-white font-semibold truncate mr-2">{item.name}</span>
                                                    <span className="text-xs text-indigo-400 font-bold shrink-0">₹{item.revenue.toLocaleString()}</span>
                                                </div>
                                                <div className="w-full bg-white/5 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Revenue Breakdown Row ─── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                        {[
                            { label: "Razorpay Revenue", value: `₹${(financial?.razorpayRevenue || 0).toLocaleString()}`, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", icon: <CreditCard className="w-4 h-4" /> },
                            { label: "Wallet Revenue", value: `₹${(financial?.walletRevenue || 0).toLocaleString()}`, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: <Wallet className="w-4 h-4" /> },
                            { label: "This Month", value: `₹${(financial?.monthRevenue || 0).toLocaleString()}`, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <TrendingUp className="w-4 h-4" /> },
                        ].map((card) => (
                            <div key={card.label} className={`rounded-2xl p-5 border ${card.bg}`}>
                                <p className="flex items-center gap-2 text-[10px] text-zayko-400 uppercase tracking-wider font-bold mb-1">
                                    {card.icon} {card.label}
                                </p>
                                <p className={`text-2xl font-display font-bold ${card.color}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AdminGuard>
    );
}
