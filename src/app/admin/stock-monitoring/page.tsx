"use client";

import React, { useEffect, useState, useRef } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { 
    BarChart3, Users, Flame, Calendar, AlertTriangle, 
    Radio, ClipboardList, TrendingUp, CheckCircle2, 
    RefreshCw, ShoppingCart, FileText, Inbox,
    ArrowLeft, Activity, Target, Sparkles
} from "lucide-react";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

function getTodayDayName(): string {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

interface DashboardData {
    summary: {
        totalActiveUsers: number;
        highestDemandItem: string;
        highestDemandQty: number;
        mostDemandingDay: string;
        mostDemandingDayQty: number;
        itemsAtRisk: number;
        todayDay: string;
        tomorrowDay: string;
    };
    todayForecast: Record<string, number>;
    tomorrowForecast: Record<string, number>;
    demandByDay: Record<string, Record<string, number>>;
    weeklyTotals: Record<string, number>;
}

interface LiveDemandItem {
    itemId: string;
    itemName: string;
    totalDemand: number;
    activeUsers: number;
}

interface DayDemandItem {
    itemName: string;
    requiredQuantity: number;
}

interface ReservationAnalyticsData {
    todayStats: {
        reserved: number;
        confirmed: number;
        collected: number;
        expired: number;
        noShow: number;
        total: number;
    };
    noShowRate: number;
    topNoShowItems: Array<{ itemName: string; noShowCount: number }>;
    demandForecast: Record<string, number>;
}

interface ConfirmedDemandItem {
    itemName: string;
    itemId: string;
    totalQuantity: number;
    reservationCount: number;
}

export default function AdminStockMonitoringPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const reportRef = useRef<HTMLDivElement>(null);

    const [liveDemand, setLiveDemand] = useState<LiveDemandItem[]>([]);
    const [liveTotalStudents, setLiveTotalStudents] = useState(0);
    const [liveTotalNeeds, setLiveTotalNeeds] = useState(0);
    const [liveConnected, setLiveConnected] = useState(false);

    // ─── Raw Data for Client-Side Aggregation (Real-time) ───
    const [rawDailyDemands, setRawDailyDemands] = useState<any[]>([]);
    const [rawDemandPlans, setRawDemandPlans] = useState<any[]>([]);

    // ─── Day-wise Purchase Requirement ────
    const [selectedPurchaseDay, setSelectedPurchaseDay] = useState(getTodayDayName());
    const [dayDemandItems, setDayDemandItems] = useState<DayDemandItem[]>([]);
    const [dayTotalQuantity, setDayTotalQuantity] = useState(0);

    // ─── Reservation Analytics ────
    const [resAnalytics, setResAnalytics] = useState<ReservationAnalyticsData | null>(null);
    const [resLoading, setResLoading] = useState(false);

    // ─── Confirmed Demand (Stock Monitor View) ────
    const [confirmedItems, setConfirmedItems] = useState<ConfirmedDemandItem[]>([]);
    const [confirmedTotal, setConfirmedTotal] = useState(0);
    const [confirmedLoading, setConfirmedLoading] = useState(false);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    useEffect(() => {
        fetchData();
        fetchReservationAnalytics();
        fetchConfirmedDemand();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/stock/dashboard", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setData(json);
            } else {
                toast.error(json.error || "Failed to load data");
            }
        } catch {
            toast.error("Failed to load dashboard data");
        }
        setLoading(false);
    };

    const fetchReservationAnalytics = async () => {
        setResLoading(true);
        try {
            const res = await fetch("/api/daily-demands/analytics", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setResAnalytics(json.analytics);
            }
        } catch {
            // Analytics may not be available yet — silently fail
        }
        setResLoading(false);
    };

    const fetchConfirmedDemand = async () => {
        setConfirmedLoading(true);
        try {
            const res = await fetch("/api/daily-demands/confirmed", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setConfirmedItems(json.items);
                setConfirmedTotal(json.totalQuantity);
            }
        } catch {
            // Silently fail — data may not exist yet
        }
        setConfirmedLoading(false);
    };

    // ─── Real-time Firestore Listeners ──────────────
    useEffect(() => {
        const unsubDaily = onSnapshot(
            query(collection(db, "dailyDemands"), where("isActive", "==", true)),
            (snap) => {
                setRawDailyDemands(snap.docs.map((doc) => doc.data()));
                setLiveConnected(true);
            },
            (err) => {
                console.error("[LiveDemand] dailyDemands error:", err);
                setLiveConnected(false);
            }
        );

        const unsubPlans = onSnapshot(
            query(collection(db, "userDemandPlans"), where("isActive", "==", true)),
            (snap) => {
                setRawDemandPlans(snap.docs.map((doc) => doc.data()));
            },
            (err) => {
                console.error("[LiveDemand] userDemandPlans error:", err);
            }
        );

        return () => {
            unsubDaily();
            unsubPlans();
        };
    }, []);

    // ─── Compute Aggregated Data ──────────────
    useEffect(() => {
        const itemMap: Record<string, { itemId: string; itemName: string; totalDemand: number; users: Set<string> }> = {};
        const dayDemandMap: Record<string, number> = {};
        const allUsers = new Set<string>();

        const processDoc = (d: any, isDailyDemand: boolean) => {
            const key = d.itemId || "unknown-id";
            const itemName = d.itemName || "Unknown";
            const qty = d.quantity || 0;
            const userId = d.userId;
            const days: string[] = d.days || [];

            if (userId) allUsers.add(userId);

            if (!itemMap[key]) {
                itemMap[key] = { itemId: key, itemName, totalDemand: 0, users: new Set() };
            }
            itemMap[key].totalDemand += qty;
            if (userId) itemMap[key].users.add(userId);

            const targetDay = isDailyDemand ? DAY_SHORT[selectedPurchaseDay] : selectedPurchaseDay;

            if (days.includes(targetDay)) {
                dayDemandMap[itemName] = (dayDemandMap[itemName] || 0) + qty;
            }
        };

        rawDailyDemands.forEach((d) => processDoc(d, true));
        rawDemandPlans.forEach((d) => processDoc(d, false));

        const liveItems = Object.values(itemMap)
            .map((item) => ({
                itemId: item.itemId,
                itemName: item.itemName,
                totalDemand: item.totalDemand,
                activeUsers: item.users.size,
            }))
            .sort((a, b) => b.totalDemand - a.totalDemand);

        setLiveDemand(liveItems);
        setLiveTotalStudents(allUsers.size);
        setLiveTotalNeeds(rawDailyDemands.length + rawDemandPlans.length);

        const purchaseItems = Object.entries(dayDemandMap)
            .filter(([, qty]) => qty > 0)
            .map(([itemName, requiredQuantity]) => ({ itemName, requiredQuantity }))
            .sort((a, b) => b.requiredQuantity - a.requiredQuantity);

        setDayDemandItems(purchaseItems);
        setDayTotalQuantity(purchaseItems.reduce((s, i) => s + i.requiredQuantity, 0));
    }, [rawDailyDemands, rawDemandPlans, selectedPurchaseDay]);

    const handlePrintReport = () => {
        window.print();
    };

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12" ref={reportRef}>
                {/* Header */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4 sticky top-0 z-20 no-print">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-4 h-4" /> Dashboard
                            </Link>
                            <h1 className="flex items-center gap-2 text-lg font-display font-bold text-white">
                                <Activity className="w-5 h-5 text-indigo-400" /> Stock Monitoring
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrintReport}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-semibold hover:bg-indigo-500/20 transition-all"
                            >
                                <FileText className="w-4 h-4" /> Download Report
                            </button>
                            <button
                                onClick={() => { setLoading(true); fetchData(); fetchReservationAnalytics(); fetchConfirmedDemand(); }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-sm font-semibold hover:bg-indigo-500/30 transition-all"
                            >
                                <RefreshCw className="w-4 h-4" /> Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : !data ? (
                        <div className="text-center py-20 text-zayko-400">Failed to load data</div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                                {[
                                    { label: "Active Users", value: data.summary.totalActiveUsers, icon: <Users className="w-5 h-5" />, color: "text-blue-400" },
                                    { label: "Top Item", value: data.summary.highestDemandItem, sub: `${data.summary.highestDemandQty} units/week`, icon: <Flame className="w-5 h-5" />, color: "text-gold-400" },
                                    { label: "Peak Day", value: data.summary.mostDemandingDay, sub: `${data.summary.mostDemandingDayQty} units`, icon: <Calendar className="w-5 h-5" />, color: "text-purple-400" },
                                    { label: "Items at Risk", value: data.summary.itemsAtRisk, icon: <AlertTriangle className="w-5 h-5" />, color: data.summary.itemsAtRisk > 0 ? "text-red-400" : "text-emerald-400" },
                                ].map((card) => (
                                    <div key={card.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 transition-all hover:border-zayko-600">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={card.color}>{card.icon}</span>
                                            <span className="text-[10px] text-zayko-400 uppercase tracking-widest font-bold font-display">{card.label}</span>
                                        </div>
                                        <p className={`text-xl font-display font-bold ${card.color} truncate`}>{card.value}</p>
                                        {"sub" in card && card.sub && <p className="text-[10px] text-zayko-500 mt-1 font-medium">{card.sub}</p>}
                                    </div>
                                ))}
                            </div>

                            {/* 📡 Live Demand (Real-time) */}
                            <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 rounded-2xl p-6 mb-8 animate-slide-up">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">
                                            <Radio className="w-6 h-6 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Live Student Demand</h2>
                                            <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold">Real-time Feedback Integration</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${liveConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}></span>
                                        <span className="text-xs text-zayko-400 font-medium">{liveConnected ? "Live Sync Active" : "Sync Disabled"}</span>
                                    </div>
                                </div>

                                {/* Live Stats Row */}
                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                                        <p className="text-2xl font-display font-bold text-indigo-400">{liveTotalStudents}</p>
                                        <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Active Users</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                                        <p className="text-2xl font-display font-bold text-blue-400">{liveTotalNeeds}</p>
                                        <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Interactions</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                                        <p className="text-2xl font-display font-bold text-violet-400">{liveDemand.length}</p>
                                        <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Variety Requested</p>
                                    </div>
                                </div>

                                {/* Live Item-wise Demand */}
                                {liveDemand.length === 0 ? (
                                    <div className="text-center py-10 bg-white/5 rounded-xl border border-dashed border-white/10 text-zayko-500 text-sm italic">
                                        No active student demands in the current cycle
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {liveDemand.map((item) => (
                                            <div key={item.itemId} className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-sm font-semibold text-white truncate">{item.itemName}</span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold shrink-0">
                                                        {item.activeUsers} user{item.activeUsers !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-lg font-display font-bold text-indigo-400">{item.totalDemand}</span>
                                                    <span className="text-[10px] text-zayko-500 uppercase font-bold tracking-tight">qty</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 📋 Reservation Analytics */}
                            {resAnalytics && (
                                <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-500/20 rounded-2xl p-6 mb-8 animate-slide-up">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-xl">
                                            <ClipboardList className="w-6 h-6 text-violet-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Reservation Intelligence</h2>
                                            <p className="text-[10px] text-violet-400 uppercase tracking-wider font-bold">Conversion & Fulfillment Analytics</p>
                                        </div>
                                    </div>

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                                        {[
                                            { label: "Reserved", value: resAnalytics.todayStats.reserved, color: "text-amber-400" },
                                            { label: "Confirmed", value: resAnalytics.todayStats.confirmed, color: "text-blue-400" },
                                            { label: "Collected", value: resAnalytics.todayStats.collected, color: "text-emerald-400" },
                                            { label: "Expired", value: resAnalytics.todayStats.expired, color: "text-zinc-500" },
                                            { label: "No-Show", value: resAnalytics.todayStats.noShow, color: "text-red-400" },
                                        ].map((s) => (
                                            <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                                                <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
                                                <p className="text-[10px] text-zayko-400 uppercase tracking-widest font-bold mt-1">{s.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* No-show rate analytics */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs text-zayko-400 font-bold uppercase tracking-widest">7-Day No-Show Leakage</span>
                                                <span className={`text-xl font-display font-bold ${resAnalytics.noShowRate > 20 ? "text-red-400" : resAnalytics.noShowRate > 10 ? "text-amber-400" : "text-emerald-400"}`}>
                                                    {resAnalytics.noShowRate}%
                                                </span>
                                            </div>
                                            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 shadow-inner ${resAnalytics.noShowRate > 20 ? "bg-gradient-to-r from-red-600 to-red-400" : resAnalytics.noShowRate > 10 ? "bg-gradient-to-r from-amber-600 to-amber-400" : "bg-gradient-to-r from-emerald-600 to-emerald-400"}`}
                                                    style={{ width: `${Math.min(resAnalytics.noShowRate, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zayko-500 mt-3 italic leading-relaxed">
                                                *High no-show rates impact planning accuracy. Consider adjusting safety stock buffers.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {resAnalytics.topNoShowItems.length > 0 && (
                                                <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                                    <h3 className="text-xs text-zayko-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Target className="w-3.5 h-3.5 text-red-400" /> High-Waste Items
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {resAnalytics.topNoShowItems.slice(0, 3).map((item) => (
                                                            <div key={item.itemName} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl border border-white/5">
                                                                <span className="text-xs text-white font-medium">{item.itemName}</span>
                                                                <span className="text-xs font-bold text-red-400">{item.noShowCount} missed</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {Object.keys(resAnalytics.demandForecast).length > 0 && (
                                                <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                                    <h3 className="text-xs text-indigo-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Sparkles className="w-3.5 h-3.5" /> Tomorrow&apos;s Forecast
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {Object.entries(resAnalytics.demandForecast)
                                                            .sort(([, a], [, b]) => b - a)
                                                            .slice(0, 3)
                                                            .map(([name, qty]) => (
                                                                <div key={name} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl border border-white/5">
                                                                    <span className="text-xs text-white font-medium">{name}</span>
                                                                    <span className="text-xs font-bold text-indigo-400">≈ {qty} units</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ✅ Confirmed Demand Section */}
                            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-8 animate-slide-up">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-display font-bold text-white">Confirmed Procurement Guide</h2>
                                            <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Validated Daily Reservations</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchConfirmedDemand}
                                        disabled={confirmedLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                                    >
                                        {confirmedLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4" /> Sync Now</>}
                                    </button>
                                </div>

                                {/* Summary stats highlight */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                        <p className="text-3xl font-display font-bold text-emerald-400">{confirmedItems.length}</p>
                                        <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Stock Items</p>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                        <p className="text-3xl font-display font-bold text-emerald-400">{confirmedTotal}</p>
                                        <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Total Unit Vol.</p>
                                    </div>
                                </div>

                                {/* Confirmed items list */}
                                {confirmedItems.length === 0 ? (
                                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10 text-zayko-600 text-sm italic">
                                        No confirmed reservations recorded for the current cycle.
                                    </div>
                                ) : (
                                    <div className="bg-zayko-800/80 border border-zayko-700 rounded-2xl overflow-hidden backdrop-blur-md">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-zayko-700 bg-zayko-900/50">
                                                    <th className="px-6 py-4 text-zayko-500 font-bold text-[10px] uppercase tracking-widest">Index</th>
                                                    <th className="px-6 py-4 text-zayko-500 font-bold text-[10px] uppercase tracking-widest">Inventory Item</th>
                                                    <th className="px-6 py-4 text-zayko-500 font-bold text-[10px] uppercase tracking-widest text-center">Velocity</th>
                                                    <th className="px-6 py-4 text-zayko-500 font-bold text-[10px] uppercase tracking-widest text-right">Commitment</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {confirmedItems.map((item, idx) => (
                                                    <tr key={item.itemId} className="border-b border-zayko-700/50 hover:bg-white/5 transition-colors group">
                                                        <td className="px-6 py-3 text-zayko-600 font-mono text-xs">{String(idx + 1).padStart(2, '0')}</td>
                                                        <td className="px-6 py-3 text-white font-semibold flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-pulse"></div>
                                                            {item.itemName}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/10">
                                                                {item.reservationCount} confirmed
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <span className="text-lg font-display font-bold text-emerald-400">{item.totalQuantity}</span>
                                                            <span className="text-[10px] text-zayko-600 uppercase font-bold ml-1.5 tracking-tight">units</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-zayko-900/80 font-display">
                                                    <td className="px-6 py-4" colSpan={3}>
                                                        <span className="text-sm font-bold text-white uppercase tracking-widest">Total Procurement Target</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xl font-bold text-white">{confirmedTotal}</span>
                                                        <span className="text-[10px] text-zayko-500 uppercase font-bold ml-2">Units</span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                <div className="mt-4 flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest font-bold text-zayko-700">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Procurement data filtered for active state commitments only.</span>
                                </div>
                            </div>

                            {/* 🗓️ Day-wise Purchase Requirement */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-3xl p-8 mb-8 animate-slide-up">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">
                                            <ShoppingCart className="w-6 h-6 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-display font-bold text-white">Projected Procurement</h2>
                                            <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold">Planned Day-wise Stock Fulfillment</p>
                                        </div>
                                    </div>

                                    {/* Professional Day Selector */}
                                    <div className="flex flex-wrap gap-2">
                                        {ALL_DAYS.map((day) => (
                                            <button
                                                key={day}
                                                onClick={() => setSelectedPurchaseDay(day)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border ${selectedPurchaseDay === day
                                                    ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] scale-105"
                                                    : "bg-zayko-900/50 text-zayko-500 border-zayko-700 hover:text-white hover:border-zayko-600"
                                                    }`}
                                            >
                                                {DAY_SHORT[day]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Summary Stats for Day */}
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6">
                                            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1">{selectedPurchaseDay} Summary</h4>
                                            <p className="text-[10px] text-indigo-400 font-medium mb-6">User Demand Aggregation</p>
                                            
                                            <div className="space-y-6">
                                                <div>
                                                    <p className="text-3xl font-display font-bold text-white">{dayDemandItems.length}</p>
                                                    <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Line Items</p>
                                                </div>
                                                <div>
                                                    <p className="text-3xl font-display font-bold text-indigo-400">{dayTotalQuantity}</p>
                                                    <p className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold mt-1">Fulfillment Quantity</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                                            <p className="text-[10px] text-zayko-600 font-bold uppercase tracking-widest mb-1">Status</p>
                                            <p className="text-xs text-white font-semibold">
                                                {dayDemandItems.length > 0 ? "Targeting Active Demand" : "Pending User Selection"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Data Table for Day */}
                                    <div className="lg:col-span-2">
                                        {dayDemandItems.length === 0 ? (
                                            <div className="h-full bg-zayko-900/50 border border-dashed border-zayko-700 rounded-2xl flex flex-col items-center justify-center p-12 text-center">
                                                <Inbox className="w-12 h-12 text-zayko-800 mb-4" />
                                                <p className="text-zayko-500 text-sm font-medium italic">No scheduled demand for {selectedPurchaseDay}</p>
                                            </div>
                                        ) : (
                                            <div className="bg-zayko-900/50 border border-zayko-700 rounded-2xl overflow-hidden">
                                                <div className="max-h-[400px] overflow-y-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="sticky top-0 bg-zayko-800 text-zayko-500 text-[10px] uppercase font-bold tracking-widest border-b border-zayko-700">
                                                            <tr>
                                                                <th className="px-6 py-3">Item</th>
                                                                <th className="px-6 py-3 text-right">Fulfillment</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-zayko-800">
                                                            {dayDemandItems.map((item) => (
                                                                <tr key={item.itemName} className="hover:bg-white/5 transition-colors">
                                                                    <td className="px-6 py-4 text-white font-medium">{item.itemName}</td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <span className="text-lg font-display font-bold text-indigo-400">{item.requiredQuantity}</span>
                                                                        <span className="text-[10px] text-zayko-600 font-bold ml-1.5">units</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Today/Tomorrow Comparison Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6">
                                    <h3 className="text-sm font-display font-bold text-white mb-1 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-indigo-400" /> Today&apos;s Forecasted Flow
                                    </h3>
                                    <p className="text-[10px] text-zayko-500 font-medium mb-6 uppercase tracking-widest">{data.summary.todayDay}</p>
                                    
                                    {Object.keys(data.todayForecast).length > 0 ? (
                                        <div className="space-y-2">
                                            {Object.entries(data.todayForecast).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([name, qty]) => (
                                                <div key={name} className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-xl border border-white/5">
                                                    <span className="text-xs text-zayko-300">{name}</span>
                                                    <span className="text-xs font-bold text-indigo-400">{qty} qty</span>
                                                </div>
                                            ))}
                                            <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                                                <span className="text-[10px] text-zayko-600 font-bold uppercase tracking-widest">Aggregate</span>
                                                <span className="text-sm font-bold text-white">{Object.values(data.todayForecast).reduce((s, v) => s + v, 0)} Units</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-zayko-700 italic py-4">No planning data available</p>
                                    )}
                                </div>

                                <div className="bg-violet-500/5 border border-violet-500/10 rounded-3xl p-6">
                                    <h3 className="text-sm font-display font-bold text-white mb-1 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-violet-400" /> Tomorrow&apos;s Project Flow
                                    </h3>
                                    <p className="text-[10px] text-zayko-500 font-medium mb-6 uppercase tracking-widest">{data.summary.tomorrowDay}</p>
                                    
                                    {Object.keys(data.tomorrowForecast).length > 0 ? (
                                        <div className="space-y-2">
                                            {Object.entries(data.tomorrowForecast).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([name, qty]) => (
                                                <div key={name} className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-xl border border-white/5">
                                                    <span className="text-xs text-zayko-300">{name}</span>
                                                    <span className="text-xs font-bold text-violet-400">{qty} qty</span>
                                                </div>
                                            ))}
                                            <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                                                <span className="text-[10px] text-zayko-600 font-bold uppercase tracking-widest">Aggregate</span>
                                                <span className="text-sm font-bold text-white">{Object.values(data.tomorrowForecast).reduce((s, v) => s + v, 0)} Units</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-zayko-700 italic py-4">No data projected for the next cycle</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
