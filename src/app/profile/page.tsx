/**
 * Profile Page — User Profile Management
 * Clean, modern dark UI for mobile.
 */

"use client";
import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ClipboardList, Lightbulb, Star, Package, Wallet, Mail, KeyRound, LogOut, Vote, UtensilsCrossed } from "lucide-react";

interface ProfileItem {
    label: string;
    icon: React.ReactNode;
    href?: string;
    detail?: string;
    value?: string;
    copyable?: boolean;
}

interface ProfileSection {
    title: string;
    items: ProfileItem[];
}

export default function ProfilePage() {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.push("/auth?redirect=/profile");
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
                <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user || !profile) return null;

    const sections: ProfileSection[] = [
        {
            title: "Quick Tools",
            items: [
                { label: "Daily Needs", icon: <ClipboardList className="w-5 h-5" />, href: "/dashboard/daily-needs", detail: "Browse daily essentials" },
                { label: "Suggestions", icon: <Vote className="w-5 h-5" />, href: "/suggestions", detail: "Vote for new items" },
                { label: "Share Feedback", icon: <Star className="w-5 h-5" />, href: "/dashboard/feedback", detail: "Help us improve" },
            ]
        },
        {
            title: "Shopping & Activity",
            items: [
                { label: "My Orders", icon: <Package className="w-5 h-5" />, href: "/orders", detail: "Track & manage orders" },
                { label: "Suggest an Item", icon: <Lightbulb className="w-5 h-5" />, href: "/dashboard/suggest-item", detail: "Request new menu items" },
                { label: "Wallet & Payments", icon: <Wallet className="w-5 h-5" />, href: "/wallet", detail: `Balance: ₹${profile.walletBalance}` },
            ]
        },

        {
            title: "Account Information",
            items: [
                { label: "Email Address", icon: <Mail className="w-5 h-5" />, value: user.email || "" },
                { label: "Unique Code", icon: <KeyRound className="w-5 h-5" />, value: profile.uniqueCode, copyable: true },
            ]
        }
    ];

    return (
        <div className="min-h-screen pb-32 md:pb-24" style={{ background: "var(--bg-primary)" }}>
            {/* Profile Hero */}
            <div className="border-b pt-16 pb-12 px-6 relative overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="absolute top-0 left-0 w-64 h-64 rounded-full -translate-y-1/2 -translate-x-1/2 blur-3xl opacity-50" style={{ background: "var(--accent-glow)" }}></div>
                <div className="max-w-xl mx-auto flex flex-col items-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-24 h-24 rounded-full p-1 mb-4 shadow-2xl"
                        style={{ background: "var(--btn-primary)" }}
                    >
                        <div className="w-full h-full rounded-full flex items-center justify-center text-4xl border-2 text-white" style={{ background: "var(--bg-primary)", borderColor: "var(--bg-primary)" }}>
                            {profile.name.charAt(0)}
                        </div>
                    </motion.div>
                    <motion.h2
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-2xl font-display font-bold mb-1"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {profile.name}
                    </motion.h2>
                    <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="font-bold uppercase tracking-widest text-[10px]"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Verified Student
                    </motion.p>
                </div>
            </div>

            {/* Menu Items */}
            <div className="px-4 py-8 max-w-xl mx-auto space-y-8">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>{section.title}</h3>
                        <div className="rounded-3xl overflow-hidden border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                            {section.items.map((item, iidx) => {
                                const isLink = !!item.href;

                                const innerContent = (
                                    <div className="px-5 py-4 flex items-center justify-between group active:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--accent)" }}>
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                                                {(item.detail || item.value) && (
                                                    <p className="text-[11px] font-medium whitespace-pre-wrap break-all" style={{ color: "var(--text-secondary)" }}>
                                                        {item.detail || item.value}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {isLink ? (
                                            <span style={{ color: "var(--text-secondary)" }} className="group-hover:translate-x-1 transition-transform">→</span>
                                        ) : (
                                            item.copyable && item.value && (
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.value || "");
                                                        toast.success("Copied to clipboard!");
                                                    }}
                                                    className="text-[10px] font-black px-2 py-1 rounded-md active:scale-90 transition-transform"
                                                    style={{ color: "var(--accent)", background: "var(--accent-glow)" }}
                                                >
                                                    COPY
                                                </button>
                                            )
                                        )}
                                    </div>
                                );

                                return isLink ? (
                                    <Link key={iidx} href={item.href!} className="block border-b last:border-none" style={{ borderColor: "var(--border)" }}>
                                        {innerContent}
                                    </Link>
                                ) : (
                                    <div key={iidx} className="border-b last:border-none" style={{ borderColor: "var(--border)" }}>
                                        {innerContent}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Logout Button */}
                <button
                    onClick={signOut}
                    className="w-full py-4 mt-8 rounded-2xl border border-red-500/20 text-red-400 font-bold hover:bg-red-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <LogOut className="w-5 h-5" /> Logout from Account
                </button>

                <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-8" style={{ color: "var(--text-secondary)" }}>
                    Zayko v2.0.0 • Made with ❤️
                </p>
            </div>
        </div>
    );
}
