"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Parser } from "@json2csv/plainjs";
import { 
    ArrowLeft, Wallet, Download, TrendingUp, 
    Clock, BarChart3, History, ArrowRight 
} from "lucide-react";

interface CanteenWallet {
    totalBalance: number;
    pendingAmount: number;
    todayCollection: number;
    todayDate: string;
    lastUpdated: string;
}

interface WalletTransaction {
    id: string;
    amount: number;
    type: "credit" | "withdrawal" | "refund_deduction";
    orderId?: string;
    description: string;
    createdAt: string;
}

export default function AdminWalletPage() {
    const [wallet, setWallet] = useState<CanteenWallet | null>(null);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [withdrawing, setWithdrawing] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);

    // ─── Real-time Listeners ───
    useEffect(() => {
        // Listen to Wallet Document
        const walletUnsub = onSnapshot(doc(db, "wallets", "canteen_owner"), (docSnap) => {
            if (docSnap.exists()) {
                setWallet(docSnap.data() as CanteenWallet);
            }
            setLoading(false);
        });

        // Listen to Recent Transactions (limit to 100 for performance)
        const q = query(collection(db, "canteenTransactions"), orderBy("createdAt", "desc"), limit(100));
        const txUnsub = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WalletTransaction));
            setTransactions(txs);
        });

        return () => {
            walletUnsub();
            txUnsub();
        };
    }, []);

    // ─── Chart Data Aggregation ───
    const chartData = useMemo(() => {
        // Group credits by date for the area chart
        const dailyTotals: Record<string, number> = {};
        const now = new Date();

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dailyTotals[d.toLocaleDateString("en-US", { month: "short", day: "numeric" })] = 0;
        }

        transactions.forEach((tx) => {
            if (tx.type === "credit") {
                const dateKey = new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                if (dailyTotals[dateKey] !== undefined) {
                    dailyTotals[dateKey] += tx.amount;
                }
            } else if (tx.type === "refund_deduction") {
                const dateKey = new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                if (dailyTotals[dateKey] !== undefined) {
                    dailyTotals[dateKey] -= tx.amount; // Reduce that day's earnings
                }
            }
        });

        return Object.entries(dailyTotals).map(([date, amount]) => ({ date, amount }));
    }, [transactions]);

    // ─── Withdrawal Handler ───
    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(withdrawAmount);

        if (!amount || amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        if (amount > (wallet?.totalBalance || 0)) {
            toast.error("Insufficient balance");
            return;
        }

        setWithdrawing(true);
        try {
            const res = await fetch("/api/admin/wallet/withdraw", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
                },
                body: JSON.stringify({ amount }),
            });
            const data = await res.json();

            if (res.ok) {
                toast.success("Withdrawal successful!");
                setShowWithdraw(false);
                setWithdrawAmount("");
            } else {
                toast.error(data.error || "Withdrawal failed");
            }
        } catch {
            toast.error("Network error processing withdrawal");
        } finally {
            setWithdrawing(false);
        }
    };

    // ─── CSV Export ───
    const exportCSV = () => {
        try {
            const parser = new Parser({
                fields: ["createdAt", "type", "amount", "description", "orderId"],
            });
            const csv = parser.parse(transactions);
            const blob = new Blob([csv], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `zayko-earnings-${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            toast.error("Failed to export CSV");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Top Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total Balance Card */}
                    <div className="bg-gradient-to-br from-gold-500/20 to-purple-600/20 border border-gold-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-400/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
                        <h3 className="text-gold-200 font-medium tracking-wide text-sm uppercase">Total Available Balance</h3>
                        <div className="mt-4 text-5xl font-display font-bold text-white tracking-tight">
                            ₹{wallet?.totalBalance?.toFixed(2) || "0.00"}
                        </div>
                        <button
                            onClick={() => setShowWithdraw(true)}
                            className="mt-6 w-full btn-gold py-3 shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                        >
                            Withdraw Funds
                        </button>
                    </div>

                    {/* Today Collection */}
                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-3xl p-6 backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <h3 className="text-zayko-300 font-medium tracking-wide text-sm uppercase">Today's Collection</h3>
                        </div>
                        <div className="text-4xl font-display font-bold text-white">
                            ₹{wallet?.todayCollection?.toFixed(2) || "0.00"}
                        </div>
                        <p className="mt-2 text-sm text-zayko-500">Auto-resets at midnight</p>
                    </div>

                    {/* Pending Escrow */}
                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-3xl p-6 backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                                <Clock className="w-6 h-6" />
                            </div>
                            <h3 className="text-zayko-300 font-medium tracking-wide text-sm uppercase">Pending in Escrow</h3>
                        </div>
                        <div className="text-4xl font-display font-bold text-white">
                            ₹{wallet?.pendingAmount?.toFixed(2) || "0.00"}
                        </div>
                        <p className="mt-2 text-sm text-zayko-500">From confirmed/preparing orders</p>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-zayko-800/50 border border-zayko-700 rounded-3xl p-6 backdrop-blur-md">
                    <h3 className="text-white font-display font-bold text-lg mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-gold-400" /> 7-Day Revenue Trend
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#888"
                                    tick={{ fill: "#888", fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888"
                                    tick={{ fill: "#888", fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `₹${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", borderRadius: "8px" }}
                                    itemStyle={{ color: "#FFD700" }}
                                    formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, "Revenue"] as any}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#FFD700"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAmount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Transactions Log Section */}
                <div className="bg-zayko-800/50 border border-zayko-700 rounded-3xl p-6 backdrop-blur-md">
                    <h3 className="text-white font-display font-bold text-lg mb-6 flex items-center gap-2">
                        <History className="w-5 h-5 text-purple-400" /> Recent Transactions
                    </h3>

                    {transactions.length === 0 ? (
                        <div className="text-center py-10 text-zayko-500">No transactions recorded yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zayko-700 text-zayko-400 text-sm">
                                        <th className="pb-3 font-medium">Date & Time</th>
                                        <th className="pb-3 font-medium">Type</th>
                                        <th className="pb-3 font-medium">Description</th>
                                        <th className="pb-3 font-medium text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className="border-b border-zayko-700/50 last:border-0 hover:bg-zayko-700/20 transition-colors">
                                            <td className="py-4 text-sm text-zayko-300">
                                                {new Date(tx.createdAt).toLocaleString()}
                                            </td>
                                            <td className="py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${tx.type === "credit" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                                    tx.type === "withdrawal" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                                                        "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    }`}>
                                                    {tx.type.replace("_", " ").toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-4 text-sm text-zayko-300">
                                                {tx.description}
                                                {tx.orderId && <span className="text-zayko-500 ml-2">#{tx.orderId}</span>}
                                            </td>
                                            <td className={`py-4 text-right font-medium ${tx.type === "credit" ? "text-emerald-400" : "text-white"}`}>
                                                {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Withdrawal Modal */}
            {showWithdraw && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zayko-800 border border-zayko-700 rounded-3xl p-6 w-full max-w-sm animate-scale-in">
                        <h3 className="text-xl font-display font-bold text-white mb-2">Withdraw Funds</h3>
                        <p className="text-zayko-400 text-sm mb-6">
                            Available Balance: <strong className="text-gold-400">₹{wallet?.totalBalance?.toFixed(2)}</strong>
                        </p>

                        <form onSubmit={handleWithdraw}>
                            <div className="relative mb-6">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zayko-400 font-medium">₹</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    max={wallet?.totalBalance || 0}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 bg-zayko-900 border border-zayko-600 rounded-xl text-white focus:ring-2 focus:ring-gold-400 focus:outline-none font-medium"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowWithdraw(false)}
                                    className="flex-1 py-3 bg-zayko-700 text-zayko-300 rounded-xl font-medium hover:bg-zayko-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={withdrawing || !withdrawAmount}
                                    className="flex-1 btn-gold py-3 font-medium disabled:opacity-50"
                                >
                                    {withdrawing ? "Processing..." : "Confirm"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
