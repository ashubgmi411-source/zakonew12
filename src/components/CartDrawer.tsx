"use client";
import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Utensils, Trash2, Sparkles, Wallet, ArrowRight, X } from "lucide-react";
import { GiCoffeeCup, GiDonut, GiMeal } from "react-icons/gi";

export default function CartDrawer() {
    const { user, profile, loading } = useAuth();
    const { items, updateQuantity, removeItem, clearCart, total, itemCount, isCartOpen, setIsCartOpen } = useCart();
    const router = useRouter();

    if (!isCartOpen || !user) return null;

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
        setIsCartOpen(false);
        router.push("/chat?action=place_order");
    };

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCartOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[54]"
                    />

                    {/* Drawer Content */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 h-[85vh] md:h-screen md:top-0 md:left-auto md:w-96 rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none z-[55] flex flex-col shadow-2xl"
                        style={{ background: "var(--bg-primary)", borderLeft: "1px solid var(--border)" }}
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 p-4 sm:p-6 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
                            <div>
                                <h2 className="text-xl font-display font-bold uppercase tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                                    Cart <ShoppingCart className="w-5 h-5" />
                                </h2>
                                <p className="text-[10px] font-bold tracking-widest uppercase mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {items.length > 0 && (
                                    <button
                                        onClick={() => { clearCart(); toast.success("Cart cleared"); }}
                                        className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-full border border-red-500/20 active:scale-95 transition-all"
                                    >
                                        CLEAR
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsCartOpen(false)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/10 active:scale-95"
                                    style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar pb-32 md:pb-6">
                            {items.length === 0 ? (
                                <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-secondary)" }}>
                                    <div className="mx-auto w-12 h-12 mb-4 flex justify-center opacity-40"><ShoppingCart className="w-full h-full" style={{ color: "var(--text-primary)" }} /></div>
                                    <h3 className="text-lg font-display font-bold mb-2" style={{ color: "var(--text-primary)" }}>Cart is empty</h3>
                                    <p className="text-xs max-w-[200px] mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>Hungry? Let's add something delicious!</p>
                                    <button onClick={() => setIsCartOpen(false)} className="px-6 py-2 rounded-xl font-bold shadow-lg text-xs flex items-center gap-2 mx-auto transition-transform active:scale-95 hover:scale-105" style={{ background: "var(--btn-primary)", color: "#FFF", boxShadow: "0 4px 15px var(--accent-glow)" }}>
                                        Browse Menu
                                    </button>
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
                                                    className="p-3 rounded-2xl flex items-center gap-3 transition-all group"
                                                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                                                >
                                                    {/* Item Image/Icon */}
                                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner" style={{ background: "var(--bg-secondary)" }}>
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="opacity-40">
                                                                {item.category === "beverages" ? <GiCoffeeCup className="w-6 h-6" /> : item.category === "snacks" ? <GiDonut className="w-6 h-6" /> : item.category === "meals" ? <GiMeal className="w-6 h-6" /> : <Utensils className="w-6 h-6" />}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{item.name}</h3>
                                                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                                {item.selectedOptions.map((opt, idx) => (
                                                                    <span key={idx} className="text-[9px] bg-purple-500/10 text-purple-400 px-1 py-0.5 rounded uppercase font-black">
                                                                        {opt.optionName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between mt-1.5">
                                                            <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>₹{item.price * item.quantity}</p>

                                                            {/* Quantity Controls */}
                                                            <div className="flex items-center border rounded-lg overflow-hidden shadow-inner" style={{ background: "var(--bg-input)", borderColor: "var(--border)" }}>
                                                                <button
                                                                    onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedOptions)}
                                                                    className="w-7 h-7 flex items-center justify-center transition-colors text-lg active:bg-black/10"
                                                                    style={{ color: "var(--text-secondary)" }}
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="w-5 text-center text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                                                                    {item.quantity}
                                                                </span>
                                                                <button
                                                                    onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedOptions)}
                                                                    disabled={item.quantity >= item.maxQuantity}
                                                                    className="w-7 h-7 flex items-center justify-center transition-colors text-lg disabled:opacity-30 active:bg-black/10"
                                                                    style={{ color: "var(--accent)" }}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Remove Icon */}
                                                    <button
                                                        onClick={() => { removeItem(item.id, item.selectedOptions); toast.success("Removed"); }}
                                                        className="p-1.5 transition-colors active:scale-75 shrink-0 hover:bg-black/10 rounded-md"
                                                        style={{ color: "var(--text-secondary)" }}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
                                                <span className="font-medium" style={{ color: "var(--text-primary)" }}>₹{total}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span style={{ color: "var(--text-secondary)" }}>Platform Fee</span>
                                                <span className="text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded lowercase tracking-tighter text-[10px] flex items-center gap-1">free <Sparkles className="w-2.5 h-2.5" /></span>
                                            </div>
                                            <div className="h-px w-full my-1" style={{ background: "var(--border)" }} />
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>To Pay</span>
                                                <span className="font-display font-bold text-2xl tabular-nums" style={{ color: "var(--accent)" }}>₹{total}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sticky Action Footer */}
                        {items.length > 0 && (
                            <div className="flex-shrink-0 p-4 border-t z-50 bg-inherit" style={{ borderColor: "var(--border)" }}>
                                {/* Wallet Info Badge */}
                                <div className="mb-3 p-3 rounded-xl flex items-center justify-between" style={{ background: "var(--bg-elevated)" }}>
                                    <div className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} />
                                        <div className="text-left">
                                            <p className="text-xs font-bold uppercase" style={{ color: "var(--text-secondary)" }}>Wallet</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className={`text-sm font-bold ${(profile?.walletBalance || 0) >= total ? "text-emerald-400" : "text-red-400"}`}>
                                            ₹{profile?.walletBalance || 0}
                                        </p>
                                    </div>
                                </div>

                                <motion.button
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    onClick={handlePlaceOrder}
                                    disabled={(profile?.walletBalance || 0) < total}
                                    className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all font-display font-bold text-sm active:scale-95 disabled:opacity-50 disabled:shadow-none shadow-lg"
                                    style={{ background: "var(--btn-primary)", color: "#FFF", boxShadow: "0 4px 15px var(--accent-glow)" }}
                                >
                                    <div className="flex flex-col items-start leading-none">
                                        <span>Place Order</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>₹{total}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </motion.button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
