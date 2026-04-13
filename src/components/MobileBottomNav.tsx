/**
 * MobileBottomNav — Premium floating bottom navigation.
 * Shows: Menu | Orders | Wallet | Profile
 * Hidden on desktop (md+) and admin/stock routes.
 */

"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, ClipboardList, Wallet, User, Bot } from "lucide-react";

export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const { itemCount } = useCart();
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    const navItems = [
        { href: "/", label: "Menu", icon: <Utensils className="w-5 h-5 md:w-6 md:h-6" /> },
        { href: "/orders", label: "Orders", icon: <ClipboardList className="w-5 h-5 md:w-6 md:h-6" /> },
        { href: "/wallet", label: "Wallet", icon: <Wallet className="w-5 h-5 md:w-6 md:h-6" /> },
        { href: "/profile", label: "Profile", icon: <User className="w-5 h-5 md:w-6 md:h-6" /> },
    ];

    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;
    if (pathname?.startsWith("/executive")) return null;
    if (pathname?.startsWith("/auth")) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 md:hidden px-3 pb-2">
            {/* Premium glass container */}
            <div className="overflow-hidden rounded-2xl backdrop-blur-3xl shadow-xl border" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                <div className="grid grid-cols-5 px-2 py-1 relative">
                    {navItems.map((item) => {
                        const isActive = item.href === "/"
                            ? pathname === "/"
                            : pathname?.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={(e) => {
                                    if (!user && item.href !== "/") {
                                        e.preventDefault();
                                        setShowLoginPrompt(true);
                                    }
                                }}
                                className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl transition-all duration-300 relative active:scale-90"
                                style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}
                            >
                                {/* Active indicator bar */}
                                {isActive && (
                                    <motion.div
                                        layoutId="mobile-nav-indicator"
                                        className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full shadow-[0_2px_12px_var(--accent-glow)]"
                                        style={{ background: "var(--btn-primary)" }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                {/* Active glow bg */}
                                {isActive && (
                                    <motion.div
                                        layoutId="mobile-nav-bg"
                                        className="absolute inset-1 rounded-xl"
                                        style={{ background: "var(--accent-glow)" }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                <motion.span
                                    className={`text-lg relative z-10`}
                                    animate={isActive ? { scale: 1.15 } : { scale: 1 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                    {item.icon}
                                    {/* Cart badge */}
                                    <AnimatePresence>
                                        {item.href === "/" && itemCount > 0 && (
                                            <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                                className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 bg-gradient-to-br from-red-500 to-red-600 text-white text-[8px] rounded-full flex items-center justify-center font-bold shadow-lg shadow-red-500/30 px-0.5"
                                            >
                                                {itemCount > 9 ? "9+" : itemCount}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.span>

                                <span className={`text-[10px] font-semibold relative z-10 transition-colors duration-200 ${isActive ? "text-gold-400" : "text-zayko-500"
                                    }`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* Jarvis AI Assistant Button */}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                            if (!user) {
                                setShowLoginPrompt(true);
                                return;
                            }
                            window.dispatchEvent(new Event('open-jarvis'));
                        }}
                        className="flex flex-col items-center gap-1 py-1"
                    >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center relative shadow-lg"
                            style={{ background: "var(--btn-primary)", boxShadow: "0 4px 15px var(--accent-glow)" }}>
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
                            Jarvis
                        </span>
                    </motion.button>
                </div>

                {/* iPhone safe area */}
                <div className="h-[env(safe-area-inset-bottom)]" />
            </div>

            {/* Login Prompt Modal */}
            <AnimatePresence>
                {showLoginPrompt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end justify-center pb-24"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        onClick={() => setShowLoginPrompt(false)}
                    >
                        <motion.div
                            initial={{ y: 200, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 200, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full max-w-sm mx-4 rounded-3xl p-6 shadow-2xl"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
                                    style={{ background: "var(--btn-primary)" }}>
                                    <span className="text-3xl font-black text-white">Z</span>
                                </div>
                                <h3 className="text-xl font-display font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                                    Login zaroori hai!
                                </h3>
                                <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                                    Aage badhne ke liye sign in karein 😊
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    setShowLoginPrompt(false);
                                    router.push("/auth?redirect=/");
                                }}
                                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md"
                                style={{ background: "#4285F4", color: "#FFF" }}
                            >
                                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Sign in with Google
                            </button>

                            <button
                                onClick={() => setShowLoginPrompt(false)}
                                className="w-full py-3 mt-3 rounded-2xl text-sm font-semibold transition-colors hover:bg-white/[0.05]"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Nahi, sirf menu dekhna hai
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
