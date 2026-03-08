"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const { itemCount } = useCart();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;
    if (pathname?.startsWith("/executive")) return null;

    const navLinks = [
        { href: "/", label: "Menu", icon: "🍽️" },
        { href: "/cart", label: "Cart", icon: "🛒", badge: itemCount },
        { href: "/orders", label: "Orders", icon: "📋" },
        { href: "/wallet", label: "Wallet", icon: "💰" },
    ];

    return (
        <nav className="sticky top-0 z-50 premium-navbar">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 sm:h-16">
                    {/* ── Logo ── */}
                    <Link href="/" className="flex items-center gap-2.5 group shrink-0">
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-zayko-900 font-bold text-sm sm:text-lg shadow-lg shadow-gold-400/20"
                        >
                            ⚡
                        </motion.div>
                        <div>
                            <h1 className="text-sm sm:text-lg font-display font-bold text-white tracking-tight">Zayko</h1>
                            <p className="text-[9px] sm:text-[10px] text-zayko-400 -mt-0.5 hidden sm:block font-medium">Order Smart. Eat Fresh.</p>
                        </div>
                    </Link>

                    {/* ── Desktop Nav ── */}
                    {user && (
                        <div className="hidden md:flex items-center gap-0.5">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 nav-link-premium ${isActive
                                                ? "text-gold-400 active"
                                                : "text-zayko-300 hover:text-white"
                                            }`}
                                    >
                                        <motion.span
                                            className="text-sm"
                                            whileHover={{ scale: 1.15 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                        >
                                            {link.icon}
                                        </motion.span>
                                        <span>{link.label}</span>

                                        {/* Active pill background */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="navbar-active-pill"
                                                className="absolute inset-0 rounded-xl bg-gold-400/10 border border-gold-400/15"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}

                                        {/* Cart badge */}
                                        <AnimatePresence>
                                            {link.badge ? (
                                                <motion.span
                                                    key={link.badge}
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    exit={{ scale: 0 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                                    className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-lg shadow-red-500/30 px-1"
                                                >
                                                    {link.badge}
                                                </motion.span>
                                            ) : null}
                                        </AnimatePresence>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Right Section ── */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Wallet Badge */}
                        {user && profile && (
                            <Link
                                href="/wallet"
                                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all duration-300 group"
                            >
                                <span className="text-xs sm:text-sm group-hover:scale-110 transition-transform duration-200">💰</span>
                                <span className="price-premium text-xs sm:text-sm">₹{profile.walletBalance || 0}</span>
                            </Link>
                        )}

                        {/* Desktop profile */}
                        {user && profile && (
                            <div className="hidden md:flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-white">{profile.name}</p>
                                    <p className="text-[10px] text-zayko-400">{profile.rollNumber}</p>
                                </div>
                                <motion.button
                                    onClick={signOut}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors duration-200"
                                >
                                    Logout
                                </motion.button>
                            </div>
                        )}

                        {/* Mobile hamburger */}
                        {user && (
                            <motion.button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                whileTap={{ scale: 0.9 }}
                                className="md:hidden p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-white"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {mobileOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </motion.button>
                        )}
                    </div>
                </div>

                {/* ── Mobile Dropdown ── */}
                <AnimatePresence>
                    {mobileOpen && user && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="md:hidden overflow-hidden"
                        >
                            <div className="pb-3 flex flex-col gap-1 border-t border-white/[0.05] pt-3">
                                <Link
                                    href="/cart"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zayko-300 hover:text-white hover:bg-white/[0.05] transition-all"
                                >
                                    <span className="text-lg">🛒</span>
                                    <span>Cart</span>
                                    {itemCount > 0 && (
                                        <span className="ml-auto w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                            {itemCount}
                                        </span>
                                    )}
                                </Link>
                                <Link
                                    href="/profile"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zayko-300 hover:text-white hover:bg-white/[0.05] transition-all"
                                >
                                    <span className="text-lg">👤</span>
                                    <span>Profile</span>
                                </Link>
                                {profile && (
                                    <div className="mt-1 pt-2 border-t border-white/[0.06]">
                                        <div className="px-4 py-1.5">
                                            <p className="text-sm font-semibold text-white">{profile.name}</p>
                                            <p className="text-xs text-zayko-400">{profile.rollNumber}</p>
                                        </div>
                                        <button
                                            onClick={signOut}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </nav>
    );
}
