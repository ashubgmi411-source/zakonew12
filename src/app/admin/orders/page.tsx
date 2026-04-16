"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import toast from "react-hot-toast";
import { useCountdown } from "@/hooks/useCountdown";

import ThermalReceipt from "@/components/ThermalReceipt";
import { 
    ClipboardList, Search, User, Mail, Clock, 
    FileText, Inbox, CheckCircle2, 
    AlarmClock, ArrowLeft, X 
} from "lucide-react";

interface OrderItem {
    name: string;
    price: number;
    quantity: number;
}

interface AdminOrder {
    id: string;
    orderId: string;
    userName: string;
    userEmail: string;
    userPhone?: string;
    userRollNumber?: string;
    items: OrderItem[];
    total: number;
    paymentMode?: string;
    status: string;
    prepTime?: number;
    estimatedReadyAt?: string;
    readyAt?: string;
    createdAt: string;
}

const STATUS_OPTIONS = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
const PREP_TIMES = [5, 10, 15, 20, 30];

const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    preparing: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    ready: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

/* ─── Admin Countdown Display ────────────────────────────── */
function AdminCountdown({ readyAt }: { readyAt?: string }) {
    const { formatted, isExpired, totalSeconds } = useCountdown(readyAt);
    if (!readyAt) return null;
    if (!readyAt) return null;
    if (isExpired) return <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold"><AlarmClock className="w-3.5 h-3.5" /> Time up</span>;
    return (
        <span className={`flex items-center gap-1 text-xs font-mono font-bold ${totalSeconds <= 60 ? "text-red-400 animate-pulse" : "text-orange-400"}`}>
            <Clock className="w-3.5 h-3.5" /> {formatted}
        </span>
    );
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [customPrepTimes, setCustomPrepTimes] = useState<Record<string, string>>({});

    const [receiptOrder, setReceiptOrder] = useState<AdminOrder | null>(null);

    // Search state
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Real-time subscription
    useEffect(() => {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const orderList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as AdminOrder[];
                setOrders(orderList);
                setLoading(false);
            },
            (error) => {
                console.error("Admin orders listener error:", error);
                toast.error("Failed to sync orders in real-time. Check connectivity.");
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const updateOrder = async (orderId: string, data: Record<string, any>) => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/admin/orders", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ orderId, ...data }),
            });

            const result = await res.json();
            if (res.ok && result.success) {
                toast.success(result.refunded ? "Order cancelled & Refunded!" : "Order updated!");
            } else {
                toast.error(result.error || "Update failed");
            }
        } catch (err) {
            console.error("Update error:", err);
            toast.error("Network error or server down");
        }
    };

    // Filter orders by status and search term
    const filteredOrders = orders.filter((o) => {
        const matchesStatus = filter === "all" || o.status === filter;
        const matchesSearch = !debouncedSearch ||
            o.orderId.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            o.userName.toLowerCase().includes(debouncedSearch.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const pendingCount = orders.filter((o) => o.status === "pending").length;
    const preparingCount = orders.filter((o) => o.status === "preparing").length;

    // Auto-scroll to highlighted order when search changes
    useEffect(() => {
        if (debouncedSearch && filteredOrders.length > 0) {
            const topMatch = filteredOrders[0];
            setHighlightOrderId(topMatch.orderId);
            setTimeout(() => {
                const el = document.getElementById(`order-${topMatch.orderId}`);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 100);
        } else {
            setHighlightOrderId(null);
        }
    }, [debouncedSearch, filteredOrders]);

    return (
        <>
            <div className="max-w-7xl mx-auto p-6">
                    {/* Search Bar */}
                    <div className="mb-6 bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 animate-fade-in">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2">
                                <Search className="w-5 h-5 text-zayko-400 font-bold" />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by Order ID or Customer Name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-12 py-3 bg-zayko-800 border border-zayko-600 rounded-xl text-white placeholder-zayko-400 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-all font-mono"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zayko-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
                        {["all", ...STATUS_OPTIONS].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap capitalize transition-all ${filter === s
                                    ? "bg-gold-500 text-zayko-900"
                                    : "bg-zayko-800 text-zayko-400 hover:bg-zayko-700"
                                    }`}
                            >
                                {s} {s !== "all" && `(${orders.filter((o) => o.status === s).length})`}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-20 text-zayko-500">
                            <div className="flex justify-center mb-4">
                                <Inbox className="w-16 h-16 text-zayko-700" />
                            </div>
                            {debouncedSearch ? (
                                <p>Order <strong className="text-white">"{debouncedSearch}"</strong> not found.</p>
                            ) : (
                                <p>No orders found</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredOrders.map((order) => (
                                <div
                                    key={order.id}
                                    id={`order-${order.orderId}`}
                                    className={`bg-zayko-800/50 border-2 rounded-2xl overflow-hidden transition-all duration-500 animate-slide-up ${highlightOrderId === order.orderId
                                        ? "border-gold-400 shadow-[0_0_30px_rgba(255,215,0,0.15)] ring-2 ring-gold-400/50"
                                        : "border-zayko-700 hover:border-zayko-600"
                                        }`}
                                >
                                    {/* Order Header */}
                                    <div className="p-5 border-b border-zayko-700">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-display font-bold text-white">#{order.orderId}</h3>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${statusColors[order.status] || ""}`}>
                                                        {order.status}
                                                    </span>
                                                    {/* Live countdown for confirmed/preparing orders */}
                                                    {(order.status === "preparing" || order.status === "confirmed") && (
                                                        <AdminCountdown readyAt={order.readyAt || order.estimatedReadyAt} />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-sm text-zayko-400">
                                                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {order.userName}</span>
                                                    <span className="hidden sm:flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {order.userEmail}</span>
                                                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(order.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <span className="text-2xl font-display font-bold text-gold-400">₹{order.total}</span>
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <div className="p-5 border-b border-zayko-700 bg-zayko-800/30">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between py-1 text-sm">
                                                <span className="text-zayko-300">{item.name} × {item.quantity}</span>
                                                <span className="text-zayko-400">₹{item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Controls */}
                                    <div className="p-5 space-y-3">
                                        {/* Status Update */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-zayko-500">Status:</span>
                                            {STATUS_OPTIONS.map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => updateOrder(order.id, { status: s })}
                                                    disabled={order.status === s}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${order.status === s
                                                        ? "bg-gold-500 text-zayko-900"
                                                        : "bg-zayko-700 text-zayko-300 hover:bg-zayko-600"
                                                        }`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Prep Time + Mark Ready */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-zayko-500">Prep:</span>
                                            {PREP_TIMES.map((t) => (
                                                <button
                                                    key={t}
                                                    onClick={() => updateOrder(order.id, { status: "preparing", prepTime: t })}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${order.prepTime === t && order.status === "preparing"
                                                        ? "bg-teal-500 text-white"
                                                        : "bg-zayko-700 text-zayko-300 hover:bg-zayko-600"
                                                        }`}
                                                >
                                                    +{t}m
                                                </button>
                                            ))}

                                            {/* Custom input */}
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={120}
                                                    placeholder="min"
                                                    value={customPrepTimes[order.id] || ""}
                                                    onChange={(e) => setCustomPrepTimes((prev) => ({ ...prev, [order.id]: e.target.value }))}
                                                    className="w-16 px-2 py-1.5 rounded-lg bg-zayko-700 text-white text-xs border border-zayko-600 focus:border-teal-500 focus:outline-none placeholder:text-zayko-500"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const mins = Number(customPrepTimes[order.id]);
                                                        if (mins >= 1 && mins <= 120) {
                                                            updateOrder(order.id, { status: "preparing", prepTime: mins });
                                                            setCustomPrepTimes((prev) => ({ ...prev, [order.id]: "" }));
                                                        } else {
                                                            toast.error("Enter 1-120 minutes");
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-500 transition-all"
                                                >
                                                    Set
                                                </button>
                                            </div>

                                            {/* Mark Ready button */}
                                            {(order.status === "preparing" || order.status === "confirmed") && (
                                                <button
                                                    onClick={() => updateOrder(order.id, { status: "ready" })}
                                                    className="ml-auto px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" /> Mark Ready
                                                </button>
                                            )}



                                            {/* Thermal Receipt */}
                                            <button
                                                onClick={() => setReceiptOrder(order)}
                                                className="px-4 py-2 rounded-xl text-sm font-bold bg-gold-600 text-white hover:bg-gold-500 transition-all flex items-center gap-2"
                                            >
                                                <FileText className="w-4 h-4" /> Receipt
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>




            {/* Thermal Receipt Modal */}
            {receiptOrder && (
                <ThermalReceipt order={receiptOrder} onClose={() => setReceiptOrder(null)} />
            )}
        </>
    );
}
