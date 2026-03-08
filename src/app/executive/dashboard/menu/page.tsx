"use client";
import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { subscribeMenuPerformance, MenuPerformanceData, MenuPerformanceItem } from "@/services/menuAnalyticsService";

export default function MenuPerformancePage() {
    const [data, setData] = useState<MenuPerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // Subscribe to real-time menu performance analytics
        unsubRef.current = subscribeMenuPerformance(
            (newData) => {
                setData(newData);
                setLoading(false);
            },
            (error) => {
                console.error("Menu analytics error:", error);
                toast.error("Failed to load menu performance");
                setLoading(false);
            }
        );

        return () => {
            // Cleanup listener on unmount
            if (unsubRef.current) unsubRef.current();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-zayko-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const topItems = data?.topPerformers || [];
    const bottomItems = data?.lowPerformers || [];
    const chartData = data?.performanceChartData || [];
    const totalRevenue = data?.totalMenuRevenue || 0;
    const totalQty = data?.totalItemsSold || 0;
    const uniqueItems = data?.uniqueItems || 0;
    const avgRevenue = data?.avgRevenuePerItem || 0;

    return (
        <div className="min-h-screen bg-zayko-900 pb-12">
            <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">🍽️</div>
                    <div>
                        <h1 className="text-lg font-display font-bold text-white">Menu Performance</h1>
                        <p className="text-xs text-indigo-400">Real-time · Completed Orders Analytics</p>
                    </div>
                    {/* Live indicator */}
                    <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                        <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mb-1">Total Menu Revenue</p>
                        <p className="text-xl font-display font-bold text-indigo-400">₹{totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                        <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mb-1">Total Items Sold</p>
                        <p className="text-xl font-display font-bold text-emerald-400">{totalQty.toLocaleString()}</p>
                    </div>
                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                        <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mb-1">Unique Items</p>
                        <p className="text-xl font-display font-bold text-violet-400">{uniqueItems}</p>
                    </div>
                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                        <p className="text-[10px] text-zayko-400 uppercase tracking-wider font-bold mb-1">Avg Revenue / Item</p>
                        <p className="text-xl font-display font-bold text-amber-400">₹{avgRevenue.toLocaleString()}</p>
                    </div>
                </div>

                {/* Top Items Chart */}
                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 mb-8 animate-slide-up">
                    <h3 className="text-sm font-display font-bold text-white mb-4">🔥 Top Selling Items (by Revenue)</h3>
                    {chartData.length > 0 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 10 }} width={120} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 12, fontSize: 12 }}
                                        formatter={(value: number | string | undefined) => {
                                            const v = typeof value === "number" ? value : 0;
                                            return [`₹${v.toLocaleString()}`, "Revenue"];
                                        }}
                                    />
                                    <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} name="revenue" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-zayko-500 text-sm">No completed orders yet</div>
                    )}
                </div>

                {/* Top / Low Performers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Performers */}
                    <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-2xl p-6 animate-slide-up">
                        <h3 className="text-sm font-display font-bold text-white mb-4">🏆 Top Performers</h3>
                        {topItems.length === 0 ? (
                            <div className="text-center py-8 text-zayko-500 text-sm">No data yet</div>
                        ) : (
                            <div className="space-y-3">
                                {topItems.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-lg">{["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i]}</span>
                                            <span className="text-sm text-white font-semibold truncate">{item.name}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-emerald-400">₹{item.revenue.toLocaleString()}</p>
                                            <p className="text-[10px] text-zayko-500">{item.qty} sold</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Low Performers */}
                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-6 animate-slide-up">
                        <h3 className="text-sm font-display font-bold text-white mb-4">⚠️ Low Performers</h3>
                        {bottomItems.length === 0 ? (
                            <div className="text-center py-8 text-zayko-500 text-sm">Not enough data</div>
                        ) : (
                            <div className="space-y-3">
                                {bottomItems.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl">
                                        <span className="text-sm text-white font-semibold truncate">{item.name}</span>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-amber-400">₹{item.revenue.toLocaleString()}</p>
                                            <p className="text-[10px] text-zayko-500">{item.qty} sold</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
