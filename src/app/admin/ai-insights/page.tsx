"use client";

import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { 
    Brain, RefreshCw, Sparkles, Calendar, 
    BarChart3, Flame, AlertTriangle, TrendingDown, 
    CheckCircle2, ShoppingCart, ArrowLeft 
} from "lucide-react";
import type { DailyCookingPlan } from "@/types";

const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444"];

export default function AIInsightsPage() {
    const [plan, setPlan] = useState<DailyCookingPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    });

    const fetchPlan = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ai/cooking-plan", { headers: getHeaders() });
            const json = await res.json();
            if (json.success && json.plan) {
                setPlan(json.plan);
            } else if (!json.success && json.error !== "Unauthorized") {
                toast.error(json.error || "Failed to load cooking plan");
            }
        } catch (err) {
            toast.error("Network error fetching cooking plan");
        } finally {
            setLoading(false);
        }
    };

    const regeneratePlan = async () => {
        setGenerating(true);
        const toastId = toast.loading("Ziva is generating a new cooking plan...");
        try {
            const res = await fetch("/api/ai/cooking-plan", {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({}),
            });
            const json = await res.json();
            if (json.success && json.plan) {
                setPlan(json.plan);
                toast.success("Cooking plan regenerated successfully!", { id: toastId });
            } else {
                toast.error(json.error || "Failed to regenerate", { id: toastId });
            }
        } catch (err) {
            toast.error("Network error regenerating plan", { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    useEffect(() => {
        fetchPlan();
    }, []);

    const totalPredictedQuantity = plan?.items.reduce((s, i) => s + i.predictedQuantity, 0) || 0;
    const sortedItems = [...(plan?.items || [])].sort((a, b) => b.predictedQuantity - a.predictedQuantity);

    return (
        <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : !plan ? (
                        <div className="text-center py-20 bg-zayko-800/50 rounded-2xl border border-zayko-700 flex flex-col items-center">
                            <Sparkles className="w-16 h-16 text-purple-500/40 mb-4" />
                            <h2 className="text-lg font-bold text-white mb-2">No Cooking Plan Found</h2>
                            <p className="text-sm text-zayko-400 mb-6">Ziva hasn't generated a plan for today.</p>
                            <button
                                onClick={regeneratePlan}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all"
                            >
                                Generate First Plan
                            </button>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {/* Summary Headers */}
                            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-purple-400" /> Plan for {plan.date}
                                        <span className="text-[10px] font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded uppercase">
                                            {plan.provider}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-zayko-400 mt-1">
                                        Generated at: {new Date(plan.generatedAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <p className="text-xs text-zayko-400">Total Items to Cook</p>
                                        <p className="text-2xl font-bold text-gold-400">{totalPredictedQuantity}</p>
                                    </div>
                                    <div className="text-right border-l border-white/10 pl-4">
                                        <p className="text-xs text-zayko-400">Alerts</p>
                                        <p className="text-2xl font-bold text-red-400">{plan.lowStockAlerts.length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Chart Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                {/* Bar Chart */}
                                <div className="lg:col-span-2 bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-purple-400" /> Predicted Demand
                                    </h3>
                                    {sortedItems.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={sortedItems}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                                <Tooltip
                                                    contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }}
                                                    formatter={(value) => [`${value} units`, "Predicted"]}
                                                />
                                                <Bar dataKey="predictedQuantity" radius={[6, 6, 0, 0]}>
                                                    {sortedItems.map((_, idx) => (
                                                        <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-[300px] text-zayko-500">No predictions</div>
                                    )}
                                </div>

                                {/* Trending List */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <Flame className="w-5 h-5 text-orange-500" /> Trending Items
                                    </h3>
                                    {plan.trendingItems.length > 0 ? (
                                        <div className="space-y-3">
                                            {plan.trendingItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center text-xs font-bold">
                                                        #{idx + 1}
                                                    </div>
                                                    <span className="text-sm text-zayko-200 font-medium">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-zayko-500 italic">No trending items detected.</p>
                                    )}
                                </div>
                            </div>

                            {/* Inventory Alerts & Purchasing */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Low Stock Alerts */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-400" /> Low Stock Alerts
                                    </h3>
                                    {plan.lowStockAlerts.length > 0 ? (
                                        <div className="space-y-3">
                                            {plan.lowStockAlerts.map((alert, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-bold text-red-400">{alert.itemName}</p>
                                                        <p className="text-xs text-red-400/70">Remaining: {alert.currentStock} {alert.unit}</p>
                                                    </div>
                                                    <TrendingDown className="w-6 h-6 text-red-400/50" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center flex flex-col items-center">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                                            <p className="text-sm text-emerald-400 font-bold">Stock levels are healthy</p>
                                        </div>
                                    )}
                                </div>

                                {/* Purchase Recommendations */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                    <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <ShoppingCart className="w-5 h-5 text-blue-400" /> Purchase Plan
                                    </h3>
                                    {plan.purchaseRecommendations.length > 0 ? (
                                        <div className="space-y-3">
                                            {plan.purchaseRecommendations.map((rec, idx) => (
                                                <div key={idx} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-sm font-bold text-blue-400">{rec.itemName}</p>
                                                        <span className="text-xs bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded">
                                                            Buy {rec.suggestedQty} {rec.unit}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-blue-400/70">{rec.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                                            <p className="text-sm text-zayko-400">No purchases needed today.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
}
