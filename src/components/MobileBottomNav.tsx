/**
 * MobileBottomNav — Futuristic floating bottom navigation for mobile.
 * Shows: Menu | Orders | Wallet | Profile
 * Hidden on desktop (md+) and on admin/stock routes.
 */

"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { motion } from "framer-motion";

const navItems = [
    { href: "/", label: "Menu", icon: "🍽️", activeIcon: "🍽️" },
    { href: "/orders", label: "Orders", icon: "📋", activeIcon: "📋" },
    { href: "/wallet", label: "Wallet", icon: "💰", activeIcon: "💰" },
    { href: "/profile", label: "Profile", icon: "👤", activeIcon: "👤" },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { itemCount } = useCart();

    // Hide on admin, stock, and auth routes
    if (!user) return null;
    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;
    if (pathname?.startsWith("/auth")) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pb-2">
            {/* Floating glass container */}
            <div className="bg-zayko-900/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-4 px-2 py-1 relative">
                    {navItems.map((item) => {
                        const isActive = item.href === "/"
                            ? pathname === "/"
                            : pathname?.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl transition-all duration-200 relative ${isActive
                                    ? "text-gold-400"
                                    : "text-zayko-500 active:scale-90"
                                    }`}
                            >
                                {/* Active glow indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gold-400 shadow-[0_2px_10px_rgba(251,191,36,0.5)]"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                {/* Active background glow */}
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-bg"
                                        className="absolute inset-1 rounded-xl bg-gold-400/[0.06]"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                <span className={`text-lg relative z-10 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                                    {item.icon}
                                    {/* Cart badge on Menu */}
                                    {item.href === "/" && itemCount > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 w-4.5 h-4.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] rounded-full flex items-center justify-center font-bold shadow-lg shadow-red-500/30 badge-pop">
                                            {itemCount > 9 ? "9+" : itemCount}
                                        </span>
                                    )}
                                </span>
                                <span className={`text-[10px] font-semibold relative z-10 ${isActive ? "text-gold-400" : "text-zayko-500"}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Safe area for iPhones with notch */}
                <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
        </nav>
    );
}
