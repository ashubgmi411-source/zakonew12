"use client";
import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Utensils, Trash2, Sparkles, Wallet, ArrowRight } from "lucide-react";
import { GiCoffeeCup, GiDonut, GiMeal } from "react-icons/gi";

export default function CartPage() {
    const { user, profile, loading } = useAuth();
    const { items, updateQuantity, removeItem, clearCart, total, itemCount } = useCart();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zayko-900 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    const handlePlaceOrder = () => {
        if (!profile) {
            toast.error("Please complete your profile first");
            return;
        }
        if ((profile.walletBalance || 0) < total) {
            toast.error("Insufficient wallet balance. Please top up your wallet first!", {
                icon: <Wallet className="w-5 h-5 text-gold-400" />,
                style: { background: "#1e3a5f", color: "#fff" }
            });
            return;
        }
        // Navigate to chat with order intent
        router.push("/chat?action=place_order");
    };

    return (
        <div className="min-h-screen bg-zayko-900 pb-36 md:pb-24">
            {/* Header */}
            <div className="bg-zayko-800/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-4 sm:px-6 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-display font-bold text-white uppercase tracking-tight flex items-center justify-center gap-2">
                            Cart <ShoppingCart className="w-6 h-6" />
                        </h1>
                        <p className="text-[10px] text-zayko-400 font-bold tracking-widest uppercase mt-0.5">
                            {itemCount} {itemCount === 1 ? 'Item' : 'Items'} selected
                        </p>
                    </div>
                    {items.length > 0 && (
                        <button
                            onClick={() => { clearCart(); toast.success("Cart cleared"); }}
                            className="text-xs font-bold text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 active:scale-95 transition-all"
                        >
                            CLEAR ALL
                        </button>
                    )}
                </div>
            </div>

            <div className="px-4 sm:px-6 max-w-3xl mx-auto py-6">
                {items.length === 0 ? (
                    <div className="text-center py-20 bg-white/[0.03] rounded-3xl border border-white/[0.05]">
                        <div className="mx-auto w-16 h-16 text-zayko-600 mb-4 flex justify-center"><ShoppingCart className="w-full h-full" /></div>
                        <h3 className="text-xl font-display font-bold text-white mb-2">Your cart is empty</h3>
                        <p className="text-zayko-400 mb-8 max-w-[200px] mx-auto text-sm">Delicious food is just a few taps away!</p>
                        <Link href="/" className="px-8 py-3 bg-gold-400 text-zayko-900 rounded-xl font-bold shadow-lg shadow-gold-400/20 active:scale-95 transition-all inline-flex items-center gap-2 hover:bg-gold-500">
                            Browse Menu <Utensils className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Cart Items */}
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {items.map((item) => (
                                    <motion.div
                                        key={`${item.id}-${JSON.stringify(item.selectedOptions)}`}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                        className="bg-zayko-800/40 border border-white/[0.06] p-4 rounded-2xl flex items-center gap-4 group transition-all hover:bg-zayko-800/60"
                                    >
                                        {/* Item Image/Icon */}
                                        <div className="w-16 h-16 rounded-xl bg-white/[0.03] flex items-center justify-center text-3xl shrink-0 group-hover:scale-105 transition-transform overflow-hidden border border-white/[0.05]">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="opacity-40">
                                                    {item.category === "beverages" ? <GiCoffeeCup className="w-8 h-8" /> : item.category === "snacks" ? <GiDonut className="w-8 h-8" /> : item.category === "meals" ? <GiMeal className="w-8 h-8" /> : <Utensils className="w-8 h-8" />}
                                                </span>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-sm text-white truncate drop-shadow-sm">{item.name}</h3>
                                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.selectedOptions.map((opt, idx) => (
                                                        <span key={idx} className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-md border border-purple-500/20 uppercase font-black tracking-tighter">
                                                            {opt.optionName}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-sm font-bold text-gold-400">₹{item.price * item.quantity}</p>

                                                {/* Quantity Controls */}
                                                <div className="flex items-center bg-zayko-900 border border-white/[0.08] rounded-xl overflow-hidden shadow-inner">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedOptions)}
                                                        className="w-8 h-8 flex items-center justify-center text-zayko-400 hover:text-white transition-colors text-lg"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="w-6 text-center text-xs font-bold text-white tabular-nums">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedOptions)}
                                                        disabled={item.quantity >= item.maxQuantity}
                                                        className="w-8 h-8 flex items-center justify-center text-gold-400 hover:text-white transition-colors text-lg disabled:opacity-30"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Remove Icon */}
                                        <button
                                            onClick={() => { removeItem(item.id, item.selectedOptions); toast.success("Removed"); }}
                                            className="p-2 text-zayko-600 hover:text-red-400 transition-colors active:scale-75 shrink-0"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Summary Section */}
                        <div className="bg-zayko-800/20 border border-white/[0.04] p-6 rounded-3xl mt-4 space-y-4">
                            <h3 className="font-display font-bold text-sm text-zayko-400 uppercase tracking-widest mb-2">Order Summary</h3>

                            <div className="space-y-2.5">
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-zayko-500">Subtotal ({itemCount} items)</span>
                                    <span className="text-white font-medium">₹{total}</span>
                                </div>
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-zayko-500">Platform Fee</span>
                                    <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-md uppercase tracking-tighter text-[10px] flex items-center justify-center gap-1">FREE <Sparkles className="w-3 h-3" /></span>
                                </div>
                                <div className="h-px bg-white/[0.04] my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="font-display font-bold text-lg text-white">To Pay</span>
                                    <span className="font-display font-bold text-3xl text-gold-400 tabular-nums">₹{total}</span>
                                </div>
                            </div>

                            {/* Wallet Info Badge */}
                            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-8 h-8 rounded-full bg-gold-400/10 flex items-center justify-center text-gold-400"><Wallet className="w-4 h-4" /></span>
                                    <div className="text-left">
                                        <p className="text-[10px] text-zayko-500 font-bold uppercase tracking-widest leading-none mb-1">Wallet Balance</p>
                                        <p className={`text-sm font-bold ${(profile?.walletBalance || 0) >= total ? "text-emerald-400" : "text-red-400"}`}>
                                            ₹{profile?.walletBalance || 0}
                                        </p>
                                    </div>
                                </div>
                                {(profile?.walletBalance || 0) < total && (
                                    <Link href="/wallet" className="text-xs font-bold text-gold-400 bg-gold-400/10 px-3 py-1.5 rounded-xl border border-gold-400/20 active:scale-95">
                                        ADD CASH
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Bottom Actions (Mobile) */}
            {items.length > 0 && (
                <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-zayko-900/80 backdrop-blur-xl border-t border-white/[0.06] z-40 md:static md:bg-transparent md:border-none md:p-0 md:mt-6">
                    <div className="max-w-3xl mx-auto">
                        <motion.button
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={handlePlaceOrder}
                            disabled={(profile?.walletBalance || 0) < total}
                            className="w-full flex items-center justify-between bg-gradient-to-r from-gold-500 to-gold-400 text-zayko-900 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(251,191,36,0.3)] hover:shadow-[0_15px_50px_rgba(251,191,36,0.4)] transition-all font-display font-bold text-lg group active:scale-[0.98] disabled:from-zayko-700 disabled:to-zayko-700 disabled:text-zayko-500 disabled:shadow-none"
                        >
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[10px] text-zayko-950/60 uppercase tracking-widest mb-1 italic font-black">AI Powered Checkout</span>
                                <span>Place Order</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>₹{total}</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.button>

                        {(profile?.walletBalance || 0) < total && (
                            <p className="text-center text-[10px] text-red-400 font-bold mt-2 uppercase tracking-tight">Insufficient Balance. Please top up your wallet first.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
