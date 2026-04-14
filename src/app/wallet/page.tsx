/**
 * Wallet Page — View balance + transaction history
 * Refactored for Premium Mobile UI (Dark Theme)
 */

"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Send, Plus, CreditCard, RefreshCcw, Package, CheckCircle } from "lucide-react";

interface Transaction {
    id: string;
    type: "topup" | "transfer" | "payment" | "credit" | "debit" | "refund";
    amount: number;
    description: string;
    fromUserId?: string;
    toUserId?: string;
    referenceId?: string;
    createdAt: string;
}

export default function WalletPage() {
    const { user, profile, loading, getIdToken } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [txnLoading, setTxnLoading] = useState(true);
    const [topUpAmount, setTopUpAmount] = useState<string>("");
    const [processing, setProcessing] = useState(false);
    const [recipientCode, setRecipientCode] = useState("");
    const [recipientName, setRecipientName] = useState<string | null>(null);
    const [transferAmount, setTransferAmount] = useState("");
    const [lookupLoading, setLookupLoading] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [activeTab, setActiveTab] = useState<"history" | "transfer" | "add">("history");

    useEffect(() => {
        if (!loading && !user) router.push("/auth?redirect=/wallet");
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) {
            setTransactions([]);
            setTxnLoading(false);
            return;
        }

        const q = query(
            collection(db, "walletTransactions"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txnList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Transaction[];
            setTransactions(txnList);
            setTxnLoading(false);
        }, (error) => {
            console.error("Transaction listener error:", error);
            setTxnLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleTopUp = async (amount: number) => {
        if (!amount || amount < 1) {
            toast.error("Please enter a valid amount");
            return;
        }

        setProcessing(true);
        try {
            const token = await getIdToken();
            const orderRes = await fetch("/api/razorpay/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ amount }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error);

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Zayko",
                description: "Wallet Top-up",
                order_id: orderData.orderId,
                handler: async (response: any) => {
                    setProcessing(true);
                    try {
                        const verifyRes = await fetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok) {
                            toast.success("Wallet topped up successfully! 🎉");
                            setTopUpAmount("");
                            setActiveTab("history");
                        } else {
                            throw new Error(verifyData.error);
                        }
                    } catch (err: any) {
                        toast.error(err.message || "Payment verification failed");
                    } finally {
                        setProcessing(false);
                    }
                },
                prefill: {
                    name: profile?.name,
                    email: profile?.email,
                },
                theme: { color: "#fbbf24" },
                modal: { ondismiss: () => setProcessing(false) },
            };

            if (!(window as any).Razorpay) {
                throw new Error("Razorpay SDK not loaded. Please refresh.");
            }
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (err: any) {
            toast.error(err.message || "Failed to initiate payment");
            setProcessing(false);
        }
    };

    if (loading || txnLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const balance = profile?.walletBalance || 0;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] pb-28 md:pb-24 text-[var(--text-primary)]">
            {/* Header / Balance Card */}
            <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-primary)] border-b border-white/[0.06] pt-12 pb-12 px-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50"></div>
                <div className="max-w-xl mx-auto text-center relative z-10">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] text-zayko-500 font-black uppercase tracking-[0.2em] mb-2"
                    >
                        Current Balance
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-6xl font-display font-bold text-white drop-shadow-2xl"
                    >
                        ₹{balance.toLocaleString()}
                    </motion.h2>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-center gap-2 mt-4"
                    >
                        <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                            <span className="text-[10px] text-white font-bold tracking-wider">{profile?.name.toUpperCase()}</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-white/[0.06] px-4">
                <div className="max-w-xl mx-auto flex">
                    {[
                        { id: "history", label: "History", icon: <BarChart3 className="w-4 h-4" /> },
                        { id: "transfer", label: "Transfer", icon: <Send className="w-4 h-4" /> },
                        { id: "add", label: "Add Cash", icon: <Plus className="w-4 h-4" /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === tab.id ? "text-gold-400" : "text-zayko-500"}`}
                        >
                            <span className="mr-1.5">{tab.icon}</span> {tab.label}
                            {activeTab === tab.id && (
                                <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 py-8 max-w-xl mx-auto">
                <AnimatePresence mode="wait">
                    {/* ADD CASH TAB */}
                    {activeTab === "add" && (
                        <motion.div
                            key="add-cash"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="bg-[var(--bg-elevated)]/40 border border-white/[0.06] p-6 rounded-3xl">
                                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Quick Recharge</h3>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[100, 200, 500, 1000].map((amt) => (
                                        <button
                                            key={amt}
                                            onClick={() => handleTopUp(amt)}
                                            disabled={processing}
                                            className="py-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white font-bold hover:bg-gold-400/10 hover:border-gold-400/30 transition-all active:scale-95 text-lg"
                                        >
                                            ₹{amt}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-400 font-bold text-xl">₹</span>
                                    <input
                                        type="number"
                                        value={topUpAmount}
                                        onChange={(e) => setTopUpAmount(e.target.value)}
                                        placeholder="Enter other amount"
                                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-4 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-gold-400/30 font-bold text-lg"
                                        disabled={processing}
                                    />
                                </div>
                                <button
                                    onClick={() => handleTopUp(Number(topUpAmount))}
                                    disabled={processing || !topUpAmount || Number(topUpAmount) < 1}
                                    className="w-full mt-6 py-4 bg-gold-400 text-zayko-900 rounded-2xl font-display font-bold text-lg shadow-lg shadow-gold-400/10 active:scale-[0.98] disabled:opacity-50 transition-all"
                                >
                                    {processing ? "Processing..." : `Proceed to Pay ₹${topUpAmount || "0"}`}
                                </button>
                                <p className="text-[9px] text-center text-zayko-600 mt-4 uppercase tracking-[0.2em] font-black">Secure Checkout • Razorpay</p>
                            </div>
                        </motion.div>
                    )}

                    {/* TRANSFER TAB */}
                    {activeTab === "transfer" && (
                        <motion.div
                            key="transfer"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="bg-[var(--bg-elevated)]/40 border border-white/[0.06] p-6 rounded-3xl">
                                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Transfer to Student</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-zayko-500 font-black uppercase tracking-widest mb-2 block">Recipient Unique Code</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={recipientCode}
                                                onChange={(e) => {
                                                    setRecipientCode(e.target.value.toUpperCase());
                                                    setRecipientName(null);
                                                }}
                                                placeholder="e.g. XYZA12"
                                                className="flex-1 bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl text-white font-bold uppercase tracking-widest outline-none focus:border-gold-400/30 transition-all"
                                                maxLength={8}
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (recipientCode.length < 4) return;
                                                    setLookupLoading(true);
                                                    try {
                                                        const token = await getIdToken();
                                                        const res = await fetch(`/api/wallet/lookup?code=${recipientCode}`, {
                                                            headers: { Authorization: `Bearer ${token}` },
                                                        });
                                                        const data = await res.json();
                                                        if (res.ok) setRecipientName(data.name);
                                                        else toast.error("User not found");
                                                    } catch { toast.error("Lookup failed"); }
                                                    setLookupLoading(false);
                                                }}
                                                disabled={lookupLoading || recipientCode.length < 4}
                                                className="px-6 bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-30"
                                            >
                                                {lookupLoading ? "..." : "CHECK"}
                                            </button>
                                        </div>
                                        {recipientName && (
                                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2 ml-1"><CheckCircle className="w-3 h-3" /> {recipientName}</motion.p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zayko-500 font-black uppercase tracking-widest mb-2 block">Amount to Send</label>
                                        <input
                                            type="number"
                                            value={transferAmount}
                                            onChange={(e) => setTransferAmount(e.target.value)}
                                            placeholder="₹ 0"
                                            className="w-full bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl text-white font-bold text-xl outline-none focus:border-gold-400/30"
                                        />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!recipientName) return toast.error("Check recipient first");
                                            const amt = Number(transferAmount);
                                            if (!amt || amt < 1) return toast.error("Invalid amount");
                                            setTransferring(true);
                                            try {
                                                const token = await getIdToken();
                                                const res = await fetch("/api/wallet/transfer", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                    body: JSON.stringify({ recipientCode, amount: amt }),
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    toast.success("Sent successfully!");
                                                    setRecipientCode(""); setRecipientName(null); setTransferAmount("");
                                                    setActiveTab("history");
                                                } else toast.error(data.error || "Failed");
                                            } catch { toast.error("Transfer failed"); }
                                            setTransferring(false);
                                        }}
                                        disabled={transferring || !recipientName || !transferAmount}
                                        className="w-full py-4 bg-emerald-500 text-zayko-950 rounded-2xl font-bold active:scale-[0.98] disabled:opacity-30 transition-all font-display shadow-lg shadow-emerald-500/10 mt-4"
                                    >
                                        {transferring ? "Sending..." : <span className="flex items-center justify-center gap-2">Send ₹{transferAmount || '0'} to {recipientName?.split(' ')[0] || '...'} <Send className="w-4 h-4" /></span>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === "history" && (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-3"
                        >
                            {transactions.length === 0 ? (
                                <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-white/[0.05] flex flex-col items-center">
                                    <Package className="w-10 h-10 text-white/20 mb-4" />
                                    <p className="text-zayko-500 font-bold uppercase tracking-widest text-[10px]">No transaction history</p>
                                </div>
                            ) : (
                                transactions.map((txn) => (
                                    <div key={txn.id} className="bg-[var(--bg-elevated)]/40 border border-white/[0.06] p-4 rounded-2xl flex items-center justify-between hover:bg-[var(--bg-elevated)]/60 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white/[0.03] border border-white/[0.05]`}>
                                                {txn.type === "topup" || txn.type === "credit" ? <CreditCard className="w-5 h-5 text-gold-400" /> : txn.type === "refund" ? <RefreshCcw className="w-5 h-5 text-blue-400" /> : txn.type === "transfer" ? <Send className="w-5 h-5 text-emerald-400" /> : <Package className="w-5 h-5 text-zayko-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-white truncate max-w-[150px]">{txn.description}</p>
                                                <p className="text-[10px] text-zayko-500 font-bold uppercase tracking-tight mt-0.5">
                                                    {new Date(txn.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`font-display font-bold text-lg ${(txn.type === "topup" || txn.type === "credit" || txn.type === "refund" || (txn.type === "transfer" && txn.toUserId === user?.uid)) ? "text-emerald-400" : "text-white opacity-80"}`}>
                                                {(txn.type === "topup" || txn.type === "credit" || txn.type === "refund" || (txn.type === "transfer" && txn.toUserId === user?.uid)) ? "+" : "-"}₹{txn.amount}
                                            </p>
                                            <span className="text-[9px] font-black uppercase text-zayko-600 tracking-tighter">{txn.type}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
