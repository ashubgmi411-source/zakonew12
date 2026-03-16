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

interface ProfileItem {
    label: string;
    icon: string;
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
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zayko-900 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user || !profile) return null;

    const sections: ProfileSection[] = [
        {
            title: "Quick Tools",
            items: [
                { label: "Daily Needs", icon: "📋", href: "/dashboard/daily-needs", detail: "Browse daily essentials" },
                { label: "Suggestions", icon: "🗳️", href: "/suggestions", detail: "Vote for new items" },
                { label: "Suggest an Item", icon: "💡", href: "/dashboard/suggest-item", detail: "Request new menu items" },
                { label: "Share Feedback", icon: "⭐", href: "/dashboard/feedback", detail: "Help us improve" },
            ]
        },
        {
            title: "Shopping & Activity",
            items: [
                { label: "My Orders", icon: "📦", href: "/orders", detail: "Track & manage orders" },
                { label: "My Daily Needs", icon: "🍱", href: "/dashboard/my-daily-needs", detail: "Recurring meal plans" },
                { label: "Wallet & Payments", icon: "💰", href: "/wallet", detail: `Balance: ₹${profile.walletBalance}` },
            ]
        },
        {
            title: "Account Information",
            items: [
                { label: "Roll Number", icon: "🆔", value: profile.rollNumber || "Not set" },
                { label: "Email Address", icon: "📧", value: user.email || "" },
                { label: "Unique Code", icon: "🔑", value: profile.uniqueCode, copyable: true },
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-zayko-900 pb-32 md:pb-24">
            {/* Profile Hero */}
            <div className="bg-gradient-to-br from-zayko-800 to-zayko-900 border-b border-white/[0.06] pt-16 pb-12 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-gold-400/5 rounded-full -translate-y-1/2 -translate-x-1/2 blur-3xl opacity-50"></div>
                <div className="max-w-xl mx-auto flex flex-col items-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-24 h-24 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 p-1 mb-4 shadow-2xl shadow-gold-400/10"
                    >
                        <div className="w-full h-full rounded-full bg-zayko-900 flex items-center justify-center text-4xl border-2 border-zayko-900 text-white">
                            {profile.name.charAt(0)}
                        </div>
                    </motion.div>
                    <motion.h2
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-2xl font-display font-bold text-white mb-1"
                    >
                        {profile.name}
                    </motion.h2>
                    <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-zayko-500 font-bold uppercase tracking-widest text-[10px]"
                    >
                        Verified Student
                    </motion.p>
                </div>
            </div>

            {/* Menu Items */}
            <div className="px-4 py-8 max-w-xl mx-auto space-y-8">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        <h3 className="px-1 text-[10px] font-black uppercase text-zayko-600 tracking-[0.2em]">{section.title}</h3>
                        <div className="bg-zayko-800/40 border border-white/[0.06] rounded-3xl overflow-hidden">
                            {section.items.map((item, iidx) => {
                                const isLink = !!item.href;

                                const innerContent = (
                                    <div className="px-5 py-4 flex items-center justify-between group active:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-xl border border-white/[0.05]">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{item.label}</p>
                                                {(item.detail || item.value) && (
                                                    <p className="text-[11px] text-zayko-500 font-medium whitespace-pre-wrap break-all">
                                                        {item.detail || item.value}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {isLink ? (
                                            <span className="text-zayko-600 group-hover:translate-x-1 transition-transform">→</span>
                                        ) : (
                                            item.copyable && item.value && (
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.value || "");
                                                        toast.success("Copied to clipboard!");
                                                    }}
                                                    className="text-[10px] font-black text-gold-400 bg-gold-400/10 px-2 py-1 rounded-md active:scale-90 transition-transform"
                                                >
                                                    COPY
                                                </button>
                                            )
                                        )}
                                    </div>
                                );

                                return isLink ? (
                                    <Link key={iidx} href={item.href!} className="block border-b border-white/[0.03] last:border-none">
                                        {innerContent}
                                    </Link>
                                ) : (
                                    <div key={iidx} className="border-b border-white/[0.03] last:border-none">
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
                    🚪 Logout from Account
                </button>

                <p className="text-center text-[10px] text-zayko-700 font-bold uppercase tracking-widest mt-8">
                    Zayko v2.0.0 • Made with ❤️
                </p>
            </div>
        </div>
    );
}
