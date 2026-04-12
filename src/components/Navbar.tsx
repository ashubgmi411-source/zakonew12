"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, ShoppingCart, ClipboardList, Wallet, User, Zap } from "lucide-react";

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const { itemCount, isCartOpen, setIsCartOpen } = useCart();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;
    if (pathname?.startsWith("/executive")) return null;

    const navLinks = [
        { href: "/", label: "Menu", icon: <Utensils className="w-5 h-5" /> },
        { href: "#cart", isCartToggle: true, label: "Cart", icon: <ShoppingCart className="w-5 h-5" />, badge: itemCount },
        { href: "/orders", label: "Orders", icon: <ClipboardList className="w-5 h-5" /> },
        { href: "/wallet", label: "Wallet", icon: <Wallet className="w-5 h-5" /> },
        { href: "/profile", label: "Profile", icon: <User className="w-5 h-5" /> },
    ];

    return (
        <nav className="sticky top-0 z-50" style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 sm:h-16">
                    {/* ── Logo ── */}
                    <Link href="/" className="flex items-center gap-2.5 group shrink-0">
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ background: "var(--btn-primary)" }}
                        >
                            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current" />
                        </motion.div>
                        <div>
                            <h1 className="text-sm sm:text-lg font-display font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Zayko</h1>
                            <p className="text-[9px] sm:text-[10px] -mt-0.5 hidden sm:block font-medium" style={{ color: "var(--text-secondary)" }}>Order Smart. Eat Fresh.</p>
                        </div>
                    </Link>

                    {/* ── Desktop Nav ── */}
                    {user && (
                        <div className="hidden md:flex items-center gap-0.5">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return link.isCartToggle ? (
                                    <button
                                        key={link.href}
                                        onClick={() => setIsCartOpen(true)}
                                        className="relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        <motion.span
                                            className="text-sm"
                                            whileHover={{ scale: 1.15 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                        >
                                            {link.icon}
                                        </motion.span>
                                        <span>{link.label}</span>

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
                                    </button>
                                ) : (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300"
                                        style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                                    >
                                        <motion.span
                                            className="text-sm"
                                            style={{ color: isActive ? "var(--accent)" : "inherit" }}
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
                                                className="absolute inset-0 rounded-xl"
                                                style={{ background: "var(--accent-glow)" }}
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
                                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border transition-all duration-300 group"
                                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                            >
                                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-200" style={{ color: "var(--accent)" }} />
                                <span className="font-bold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>₹{profile.walletBalance || 0}</span>
                            </Link>
                        )}

                        {/* Desktop profile */}
                        {user && profile && (
                            <div className="hidden md:flex items-center gap-3">
                                <Link href="/profile" className="flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all duration-200 group">
                                    <div className="text-right">
                                        <p className="text-sm font-semibold transition-colors" style={{ color: "var(--text-primary)" }}>{profile.name}</p>
                                        <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{profile.rollNumber}</p>
                                    </div>
                                    <div 
                                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                                        style={{ background: "var(--btn-primary)", color: "#FFF" }}
                                    >
                                        {profile.name.charAt(0)}
                                    </div>
                                </Link>
                                <motion.button
                                    onClick={signOut}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors duration-200"
                                >
                                    Logout
                                </motion.button>
                            </div>
                        )}

                        {/* Mobile Cart Button */}
                        {user && (
                            <button
                                onClick={() => setIsCartOpen(true)}
                                className="md:hidden relative p-2 rounded-xl transition-transform active:scale-95"
                                style={{ color: "var(--text-primary)" }}
                            >
                                <ShoppingCart className="w-5 h-5" />
                                <AnimatePresence>
                                    {itemCount > 0 && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                            className="absolute top-0 right-0 min-w-[16px] h-4 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] rounded-full flex items-center justify-center font-bold px-1"
                                        >
                                            {itemCount}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        )}

                        {/* Mobile hamburger */}
                        {user && (
                            <motion.button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                whileTap={{ scale: 0.9 }}
                                className="md:hidden p-2 rounded-xl transition-colors"
                                style={{ color: "var(--text-primary)" }}
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
                                <button
                                    onClick={() => { setMobileOpen(false); setIsCartOpen(true); }}
                                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zayko-300 hover:text-white hover:bg-white/[0.05] transition-all"
                                >
                                    <ShoppingCart className="w-5 h-5" />
                                    <span>Cart</span>
                                    {itemCount > 0 && (
                                        <span className="ml-auto w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                            {itemCount}
                                        </span>
                                    )}
                                </button>
                                <Link
                                    href="/profile"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zayko-300 hover:text-white hover:bg-white/[0.05] transition-all"
                                >
                                    <User className="w-5 h-5" />
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
