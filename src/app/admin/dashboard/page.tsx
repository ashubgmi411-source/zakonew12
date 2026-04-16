"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { 
    Zap, Clipboard, Soup, Wallet, Settings, Star, FileText, 
    Circle, Package, Clock, CheckCircle2, BarChart3, TrendingUp, Flame, 
    Calendar, Calculator, LogOut, ArrowRight, BrainCircuit, Activity,
    Smartphone, Lightbulb, Sun, Moon
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface Stats {
    summary: {
        totalRevenue: number;
        totalOrders: number;
        pendingOrders: number;
        completedOrders: number;
        averageOrderValue: number;
    };
    dailySales: Array<{ date: string; revenue: number; orders: number }>;
    monthlySales: Array<{ month: string; revenue: number; orders: number }>;
    topItems: Array<{ name: string; count: number }>;
    topStudent: { name: string; totalSpent: number } | null;
}

interface CustomRevenue {
    grossRevenue: number;
    totalOrders: number;
    refunds: number;
    netRevenue: number;
    walletTopups: number;
}

const CHART_COLORS = ["#1e3a5f", "#d4a017", "#0d9488", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminDashboard() {
    const { theme, setTheme } = useTheme();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [canteenOpen, setCanteenOpen] = useState(true);
    const [toggling, setToggling] = useState(false);

    // Custom Revenue Filter State
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [customRevenue, setCustomRevenue] = useState<CustomRevenue | null>(null);
    const [loadingRevenue, setLoadingRevenue] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem("adminToken");
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
    };

    useEffect(() => {
        fetchStats();
        fetchCanteenStatus();
    }, []);

    const fetchCanteenStatus = async () => {
        try {
            const res = await fetch("/api/admin/settings", { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setCanteenOpen(data.isOpen ?? true);
            }
        } catch { /* ignore */ }
    };

    const toggleCanteen = async () => {
        setToggling(true);
        try {
            const newState = !canteenOpen;
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ isOpen: newState }),
            });
            if (res.ok) {
                setCanteenOpen(newState);
                toast.success(newState ? "Canteen is now OPEN" : "Canteen is now CLOSED");
            } else {
                toast.error("Failed to update canteen status");
            }
        } catch {
            toast.error("Error toggling canteen");
        }
        setToggling(false);
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/admin/stats", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
        setLoading(false);
    };

    const fetchCustomRevenue = async () => {
        if (!startDate || !endDate) {
            toast.error("Please select both Start and End Dates");
            return;
        }
        setLoadingRevenue(true);
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`/api/admin/revenue?startDate=${startDate}&endDate=${endDate}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success) {
                setCustomRevenue(json.data);
                toast.success("Revenue Calculated!");
            } else {
                toast.error(json.error || "Failed to calculate revenue");
            }
        } catch (err) {
            toast.error("Error calculating revenue");
        }
        setLoadingRevenue(false);
    };

    const setQuickFilter = (days: number) => {
        const end = new Date();
        const start = new Date();

        if (days === 0) { // Today
            start.setHours(0, 0, 0, 0);
        } else if (days === 1) { // Yesterday
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
        } else if (days === 7) { // This Week (Last 7 days)
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
        } else if (days === 30) { // This Month (Last 30 days)
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
        }

        // Format to YYYY-MM-DD for input fields
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const adminLinks = [
        { href: "/admin/orders", label: "Orders", icon: <Clipboard className="w-5 h-5" />, color: "from-blue-500 to-blue-600" },
        { href: "/admin/menu", label: "Menu", icon: <Soup className="w-5 h-5" />, color: "from-teal-500 to-teal-600" },
        { href: "/admin/inventory", label: "Inventory", icon: <Package className="w-5 h-5" />, color: "from-emerald-500 to-emerald-600" },
        { href: "/admin/analytics", label: "BI Analytics", icon: <BrainCircuit className="w-5 h-5" />, color: "from-indigo-500 to-indigo-600" },
        { href: "/admin/ai-insights", label: "Ziva Brain", icon: <Zap className="w-5 h-5" />, color: "from-purple-500 to-purple-600" },
        { href: "/admin/demand-forecast", label: "Forecast", icon: <TrendingUp className="w-5 h-5" />, color: "from-orange-500 to-orange-600" },
        { href: "/admin/stock-monitoring", label: "Stock Monitor", icon: <Activity className="w-5 h-5" />, color: "from-blue-400 to-indigo-500" },
        { href: "/admin/food-feedback", label: "Food Feedback", icon: <Soup className="w-5 h-5" />, color: "from-emerald-500 to-emerald-600" },
        { href: "/admin/app-feedback", label: "App Feedback", icon: <Smartphone className="w-5 h-5" />, color: "from-blue-500 to-blue-600" },
        { href: "/admin/item-suggestions", label: "Suggestions", icon: <Lightbulb className="w-5 h-5" />, color: "from-amber-500 to-amber-600" },
        { href: "/admin/wallet", label: "Wallet", icon: <Wallet className="w-5 h-5" />, color: "from-pink-500 to-pink-600" },
        { href: "/admin/settings", label: "Settings", icon: <Settings className="w-5 h-5" />, color: "from-amber-400 to-amber-500" },
    ];

    return (
        <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : stats ? (
                        <>
                            {/* Canteen Toggle + Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8 animate-fade-in">
                                {/* Canteen Toggle Card */}
                                <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-3">
                                    <span className="text-xs text-zayko-400 font-semibold">Canteen</span>
                                    <button
                                        onClick={toggleCanteen}
                                        disabled={toggling}
                                        className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${canteenOpen ? "bg-emerald-500" : "bg-gray-500"}`}
                                    >
                                        <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform ${canteenOpen ? "translate-x-11" : "translate-x-1"}`} />
                                    </button>
                                    <span className={`flex items-center gap-1.5 text-xs font-bold ${canteenOpen ? "text-emerald-400" : "text-red-400"}`}>
                                        <Circle className={`w-2 h-2 fill-current`} />
                                        {canteenOpen ? "OPEN" : "CLOSED"}
                                    </span>
                                </div>

                                {[
                                    { label: "Total Revenue", value: `₹${stats.summary.totalRevenue.toLocaleString()}`, icon: <Wallet className="w-5 h-5" />, color: "text-gold-400" },
                                    { label: "Total Orders", value: stats.summary.totalOrders, icon: <Package className="w-5 h-5" />, color: "text-blue-400" },
                                    { label: "Pending", value: stats.summary.pendingOrders, icon: <Clock className="w-5 h-5" />, color: "text-yellow-400" },
                                    { label: "Completed", value: stats.summary.completedOrders, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-400" },
                                ].map((stat) => (
                                    <div key={stat.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">{stat.icon}</span>
                                            <span className="text-xs text-zayko-400">{stat.label}</span>
                                        </div>
                                        <p className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Avg Order Value & Insights Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-slide-up">
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-5 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="w-5 h-5 text-purple-400" />
                                        <span className="text-xs text-zayko-400">Avg Order Value (30 Days)</span>
                                    </div>
                                    <p className="text-3xl font-display font-bold text-purple-400">₹{stats.summary.averageOrderValue}</p>
                                </div>

                                {/* Quick Insights Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Link href="/admin/demand-forecast" className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 hover:bg-gold-500/10 hover:border-gold-500/30 transition-all group">
                                        <div className="flex items-center gap-2 mb-1">
                                            <TrendingUp className="w-4 h-4 text-gold-400" />
                                            <span className="text-[10px] text-zayko-400 uppercase font-bold">Daily Needs</span>
                                        </div>
                                        <p className="text-sm font-bold text-white group-hover:text-gold-400">Prep Forecast</p>
                                    </Link>
                                    <Link href="/admin/item-suggestions" className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Lightbulb className="w-4 h-4 text-blue-400" />
                                            <span className="text-[10px] text-zayko-400 uppercase font-bold">Suggestions</span>
                                        </div>
                                        <p className="text-sm font-bold text-white group-hover:text-blue-400">New Ideas</p>
                                    </Link>
                                    <Link href="/admin/food-feedback" className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Soup className="w-4 h-4 text-emerald-400" />
                                            <span className="text-[10px] text-zayko-400 uppercase font-bold">Food Reviews</span>
                                        </div>
                                        <p className="text-sm font-bold text-white group-hover:text-emerald-400">User Ratings</p>
                                    </Link>
                                    <Link href="/admin/app-feedback" className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Smartphone className="w-4 h-4 text-purple-400" />
                                            <span className="text-[10px] text-zayko-400 uppercase font-bold">App Support</span>
                                        </div>
                                        <p className="text-sm font-bold text-white group-hover:text-purple-400">Bugs & Improvements</p>
                                    </Link>
                                </div>
                            </div>

                            {/* ─── Custom Date Revenue Filter ─── */}
                            <div className="bg-zayko-800/80 border border-zayko-700 rounded-3xl p-6 mb-8 lg:mb-12 shadow-xl shadow-black/20 animate-slide-up">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center text-xl">
                                        <Calendar className="w-6 h-6 text-gold-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-display font-bold text-white tracking-tight">Custom Revenue Analysis</h2>
                                        <p className="text-xs text-zayko-400">Calculate net revenue, refunds, and top-ups between specific dates</p>
                                    </div>
                                </div>

                                <div className="flex flex-col lg:flex-row items-end gap-4 mb-6">
                                    <div className="w-full lg:w-auto flex-1">
                                        <label className="text-xs text-zayko-400 mb-1 block">Start Date</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full bg-zayko-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold-500 transition-colors"
                                        />
                                    </div>
                                    <div className="w-full lg:w-auto flex-1">
                                        <label className="text-xs text-zayko-400 mb-1 block">End Date</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full bg-zayko-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold-500 transition-colors"
                                        />
                                    </div>
                                    <button
                                        onClick={fetchCustomRevenue}
                                        disabled={loadingRevenue || !startDate || !endDate}
                                        className="w-full lg:w-auto btn-gold py-3 px-8 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loadingRevenue ? <div className="w-5 h-5 border-2 border-zayko-900 border-t-transparent rounded-full animate-spin"></div> : (
                                            <span className="flex items-center gap-2">Calculate <Calculator className="w-4 h-4" /></span>
                                        )}
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mb-6 p-4 rounded-xl bg-zayko-900/50 border border-white/5">
                                    <span className="text-xs text-zayko-400 mr-2">Quick Filters:</span>
                                    {[
                                        { label: "Today", days: 0 },
                                        { label: "Yesterday", days: 1 },
                                        { label: "This Week", days: 7 },
                                        { label: "This Month", days: 30 }
                                    ].map((f) => (
                                        <button
                                            key={f.label}
                                            onClick={() => { setQuickFilter(f.days); setTimeout(fetchCustomRevenue, 100); }}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zayko-300 hover:bg-white/10 hover:text-white transition-all border border-white/5"
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {customRevenue && (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-white/10 animate-fade-in">
                                        <div className="bg-zayko-900 rounded-2xl p-4 border border-white/5">
                                            <p className="text-xs text-zayko-400 mb-1">Gross Revenue</p>
                                            <p className="text-xl font-display font-bold text-blue-400">₹{customRevenue.grossRevenue.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-zayko-900 rounded-2xl p-4 border border-white/5 mt-0 md:mt-0">
                                            <p className="text-xs text-zayko-400 mb-1 flex items-center gap-1">Refunds <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded">-</span></p>
                                            <p className="text-xl font-display font-bold text-red-400">₹{customRevenue.refunds.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-zayko-900 rounded-2xl p-4 border border-gold-500/20 shadow-lg shadow-gold-500/5">
                                            <p className="text-xs text-zayko-400 mb-1 flex items-center gap-1">Net Revenue <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1 rounded">=</span></p>
                                            <p className="text-xl font-display font-bold text-gold-400">₹{customRevenue.netRevenue.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-zayko-900 rounded-2xl p-4 border border-white/5">
                                            <p className="text-xs text-zayko-400 mb-1">Wallet Top-ups</p>
                                            <p className="text-xl font-display font-bold text-purple-400">₹{customRevenue.walletTopups.toLocaleString()}</p>
                                        </div>
                                        <div className="col-span-2 md:col-span-1 bg-zayko-900 rounded-2xl p-4 border border-white/5 flex flex-col justify-center items-center">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-1">
                                                <Package className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <p className="text-sm font-bold text-white">{customRevenue.totalOrders} Orders</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                {/* Daily Revenue Chart */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-gold-400" /> Daily Revenue
                                    </h3>
                                           <div className="h-[200px] md:h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.dailySales.slice(-14)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={theme === "light" ? "#e2e8f0" : "#1e3a5f"} />
                                            <XAxis dataKey="date" tick={{ fill: theme === "light" ? "#64748b" : "#94a3b8", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                            <YAxis tick={{ fill: theme === "light" ? "#64748b" : "#94a3b8", fontSize: 11 }} />
                                            <Tooltip
                                                contentStyle={{ 
                                                    background: theme === "light" ? "#fff" : "#0f2035", 
                                                    border: `1px solid ${theme === "light" ? "#e2e8f0" : "#1e3a5f"}`, 
                                                    borderRadius: "12px", 
                                                    color: theme === "light" ? "#0f172a" : "#fff" 
                                                }}
                                                labelFormatter={(v) => `Date: ${v}`}
                                            />
                                            <Bar dataKey="revenue" fill={theme === "light" ? "#FF6B35" : "#d4a017"} radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                    </div>
                                </div>
 
                                {/* Daily Orders Chart */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-emerald-400" /> Daily Orders
                                    </h3>
                                    <div className="h-[200px] md:h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={stats.dailySales.slice(-14)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={theme === "light" ? "#e2e8f0" : "#1e3a5f"} />
                                            <XAxis dataKey="date" tick={{ fill: theme === "light" ? "#64748b" : "#94a3b8", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                            <YAxis tick={{ fill: theme === "light" ? "#64748b" : "#94a3b8", fontSize: 11 }} />
                                            <Tooltip
                                                contentStyle={{ 
                                                    background: theme === "light" ? "#fff" : "#0f2035", 
                                                    border: `1px solid ${theme === "light" ? "#e2e8f0" : "#1e3a5f"}`, 
                                                    borderRadius: "12px", 
                                                    color: theme === "light" ? "#0f172a" : "#fff" 
                                                }}
                                            />
                                            <Line type="monotone" dataKey="orders" stroke="#0d9488" strokeWidth={3} dot={{ fill: "#0d9488", r: 5 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    </div>
                                </div>
 
                                {/* Top Items Pie Chart */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <Flame className="w-5 h-5 text-orange-500" /> Popular Items
                                    </h3>
                                    {stats.topItems.length > 0 ? (
                                        <div className="h-[200px] md:h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                <Pie
                                                    data={stats.topItems.slice(0, 6)}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={100}
                                                    dataKey="count"
                                                    nameKey="name"
                                                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                                >
                                                    {stats.topItems.slice(0, 6).map((_, idx) => (
                                                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ 
                                                    background: theme === "light" ? "#fff" : "#0f2035", 
                                                    border: `1px solid ${theme === "light" ? "#e2e8f0" : "#1e3a5f"}`, 
                                                    borderRadius: "12px", 
                                                    color: theme === "light" ? "#0f172a" : "#fff" 
                                                }} />
                                                <Legend wrapperStyle={{ color: theme === "light" ? "#64748b" : "#94a3b8" }} />
                                            </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-[200px] md:h-[300px] text-zayko-500">No data yet</div>
                                    )}
                                </div>

                                {/* Monthly Revenue */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-400" /> Monthly Revenue
                                    </h3>
                                    <div className="h-[200px] md:h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.monthlySales}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                                <Tooltip contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }} />
                                                <Bar dataKey="revenue" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                                                <Bar dataKey="orders" fill="#d4a017" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-20 text-zayko-400">Failed to load stats</div>
                    )}
        </div>
    );
}
