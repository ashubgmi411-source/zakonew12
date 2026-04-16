"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { 
    Zap, Clipboard, Soup, Package, BrainCircuit, Activity, 
    Wallet, Settings, Smartphone, Lightbulb, Moon, Sun, LogOut,
    Menu as MenuIcon, X, BarChart3, TrendingUp
} from "lucide-react";

export default function AdminHeader() {
    const { theme, setTheme } = useTheme();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    if (pathname === "/admin") return null;

    const navLinks = [
        { href: "/admin/orders", label: "Orders", icon: <Clipboard className="w-4 h-4" /> },
        { href: "/admin/menu", label: "Menu", icon: <Soup className="w-4 h-4" /> },
        { href: "/admin/inventory", label: "Stock", icon: <Package className="w-4 h-4" /> },
        { href: "/admin/demand-forecast", label: "Daily Needs", icon: <TrendingUp className="w-4 h-4" /> },
        { href: "/admin/item-suggestions", label: "Suggestions", icon: <Lightbulb className="w-4 h-4" /> },
        { href: "/admin/ai-insights", label: "Ziva Brain", icon: <Zap className="w-4 h-4" /> },
        { href: "/admin/food-feedback", label: "Food Feedback", icon: <Soup className="w-4 h-4" /> },
        { href: "/admin/app-feedback", label: "App Feedback", icon: <Smartphone className="w-4 h-4" /> },
        { href: "/admin/wallet", label: "Wallet", icon: <Wallet className="w-4 h-4" /> },
        { href: "/admin/settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
    ];

    const logout = () => {
        localStorage.removeItem("adminToken");
        window.location.href = "/admin";
    };

    return (
        <nav className="bg-zayko-800 border-b border-zayko-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-3">
                        <Link href="/admin/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-gold-400" />
                            </div>
                            <span className="text-white font-display font-bold hidden sm:block">Zayko Admin</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-hide py-2 px-1">
                        {navLinks.map((link) => (
                            <Link 
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${
                                    pathname === link.href 
                                    ? "bg-gold-500/10 text-gold-400 font-bold" 
                                    : "text-zayko-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                {link.icon} {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-2">
                        {/* Theme Toggle */}
                        <button
                            onClick={() => setTheme(theme === "light" ? "midnight" : "light")}
                            className="p-2 text-zayko-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                            title="Toggle Theme"
                        >
                            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </button>

                        {/* Logout */}
                        <button
                            onClick={logout}
                            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                            <LogOut className="w-4 h-4" /> <span>Logout</span>
                        </button>

                        {/* Mobile Menu Toggle */}
                        <button 
                            className="lg:hidden p-2 text-zayko-400 hover:text-white hover:bg-white/5 rounded-xl"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            {isMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Dropdown */}
            {isMenuOpen && (
                <div className="lg:hidden bg-zayko-900 border-b border-zayko-700 animate-fade-in shadow-2xl">
                    <div className="px-4 pt-2 pb-6 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base ${
                                    pathname === link.href 
                                    ? "bg-gold-500/20 text-gold-400" 
                                    : "text-zayko-400"
                                }`}
                            >
                                {link.icon} {link.label}
                            </Link>
                        ))}
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-red-400"
                        >
                            <LogOut className="w-5 h-5" /> Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}
