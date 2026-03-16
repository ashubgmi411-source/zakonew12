"use client";
import React, { useState, useEffect } from "react";
import StockManagerGuard from "@/components/StockManagerGuard";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
    { href: "/stock/dashboard", label: "Dashboard", icon: "📊", exact: true },
    { href: "/stock/dashboard/inventory", label: "Inventory", icon: "📦" },
    { href: "/stock/dashboard/ai-demand", label: "AI Demand", icon: "🤖" },
    { href: "/stock/dashboard/suggestions", label: "Suggestions", icon: "💡" },
];

export default function StockDashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const isActive = (item: typeof NAV_ITEMS[0]) => {
        if (item.exact) return pathname === item.href;
        return pathname.startsWith(item.href);
    };

    const handleLogout = () => {
        localStorage.removeItem("stockManagerToken");
        router.push("/stock");
    };

    return (
        <StockManagerGuard>
            <div className="min-h-screen bg-zayko-900 flex">
                {/* ─── Sidebar (Desktop) ─── */}
                <aside className="hidden md:flex flex-col w-64 bg-zayko-800 border-r border-zayko-700 fixed h-full z-30">
                    {/* Logo */}
                    <div className="p-6 border-b border-zayko-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl border border-emerald-500/20">📦</div>
                            <div>
                                <h1 className="text-base font-display font-bold text-white">Stock Manager</h1>
                                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Zayko Inventory</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1">
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive(item)
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                                    : "text-zayko-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Bottom */}
                    <div className="p-4 border-t border-zayko-700 space-y-2">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                        >
                            <span className="text-lg">🚪</span>
                            Logout
                        </button>
                    </div>
                </aside>

                {/* ─── Mobile Header ─── */}
                <div className="md:hidden fixed top-0 left-0 right-0 bg-zayko-800 border-b border-zayko-700 z-40">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-white">
                                {sidebarOpen ? "✕" : "☰"}
                            </button>
                            <span className="text-sm font-display font-bold text-white">📦 Stock Manager</span>
                        </div>
                        <button onClick={handleLogout} className="text-xs text-red-400 font-semibold">Logout</button>
                    </div>

                    {/* Mobile Nav Drawer */}
                    {sidebarOpen && (
                        <div className="bg-zayko-800 border-t border-zayko-700 p-4 space-y-1 animate-slide-up">
                            {NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive(item)
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "text-zayko-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Main Content ─── */}
                <main className="flex-1 md:ml-64 mt-14 md:mt-0">
                    {children}
                </main>
            </div>
        </StockManagerGuard>
    );
}
