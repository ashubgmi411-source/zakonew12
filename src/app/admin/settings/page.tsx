"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
    ArrowLeft, Settings, Clock, Save, Circle, ShieldCheck, 
    Palette, Sun, Moon, Zap, Waves, TreePine, Sparkles 
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { useTheme, THEMES } from "@/context/ThemeContext";
import { usePathname } from "next/navigation";
import TimePickerAMPM from "@/components/ui/TimePickerAMPM";

interface CanteenConfig {
    isOpen: boolean;
    startTime: string;
    endTime: string;
}

export default function AdminSettingsPage() {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [config, setConfig] = useState<CanteenConfig>({ isOpen: true, startTime: "09:00", endTime: "17:00" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem("adminToken");
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
    };

    useEffect(() => {
        const token = localStorage.getItem("adminToken");
        if (!token) { router.push("/admin"); return; }

        fetch("/api/admin/settings", { headers: getHeaders() })
            .then((res) => res.json())
            .then((data) => {
                setConfig(data);
                setLoading(false);
            })
            .catch(() => {
                toast.error("Failed to load settings");
                setLoading(false);
            });
    }, [router]);

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(config),
            });
            if (res.ok) {
                toast.success("Settings saved!");
            } else {
                toast.error("Failed to save");
            }
        } catch {
            toast.error("Error saving settings");
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-20">
                <div className="max-w-2xl mx-auto px-6 pt-12">
                    <div className="flex items-center gap-3 mb-8">
                        <button 
                            onClick={() => router.push("/admin/dashboard")} 
                            className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Dashboard
                        </button>
                        <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-white">
                            <Settings className="w-6 h-6 text-gold-400" /> Canteen Settings
                        </h1>
                    </div>

                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-3xl p-8 space-y-8 animate-fade-in backdrop-blur-md">
                        {/* Open/Close Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-display font-bold text-lg text-white">Canteen Status</h3>
                                <p className="text-sm text-zayko-400">Toggle the canteen open or closed</p>
                            </div>
                            <button
                                onClick={() => setConfig({ ...config, isOpen: !config.isOpen })}
                                className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${config.isOpen ? "bg-emerald-500" : "bg-zayko-700"
                                    }`}
                            >
                                <span
                                    className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform ${config.isOpen ? "translate-x-11" : "translate-x-1"
                                        }`}
                                />
                            </button>
                        </div>

                        <div className={`text-center py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${config.isOpen ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}>
                            <Circle className={`w-3 h-3 fill-current ${config.isOpen ? "animate-pulse" : ""}`} />
                            {config.isOpen ? "Canteen is currently OPEN" : "Canteen is currently CLOSED"}
                        </div>

                        {/* Operating Hours */}
                        <div className="pt-4 border-t border-zayko-700">
                            <h3 className="font-display font-bold text-lg text-white mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gold-400" /> Operating Hours
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <TimePickerAMPM
                                    label="Opening Time"
                                    value={config.startTime}
                                    onChange={(val) => setConfig({ ...config, startTime: val })}
                                />
                                <TimePickerAMPM
                                    label="Closing Time"
                                    value={config.endTime}
                                    onChange={(val) => setConfig({ ...config, endTime: val })}
                                />
                            </div>
                        </div>

                        {/* AI Voice System Settings */}
                        <div className="pt-8 border-t border-zayko-700 space-y-6">
                            <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-gold-400" /> AI Voice & Intelligence
                            </h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* NVIDIA ASR Toggle */}
                                <div className="bg-zayko-900/40 p-5 rounded-2xl border border-zayko-700/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-zayko-300">NVIDIA ASR (Speech)</span>
                                        <button
                                            onClick={() => setConfig({ ...config, nvidiaAsrEnabled: !config.nvidiaAsrEnabled })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.nvidiaAsrEnabled ? "bg-emerald-500" : "bg-zayko-700"}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.nvidiaAsrEnabled ? "translate-x-6" : "translate-x-1"}`} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zayko-400">Uses Parakeet-CTC 0.6b for high accuracy speech transcription.</p>
                                </div>

                                {/* NVIDIA TTS Toggle */}
                                <div className="bg-zayko-900/40 p-5 rounded-2xl border border-zayko-700/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-zayko-300">NVIDIA TTS (Voice)</span>
                                        <button
                                            onClick={() => setConfig({ ...config, nvidiaTtsEnabled: !config.nvidiaTtsEnabled })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.nvidiaTtsEnabled ? "bg-gold-500" : "bg-zayko-700"}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.nvidiaTtsEnabled ? "translate-x-6" : "translate-x-1"}`} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zayko-400">Uses Magpie Multilingual for smooth, human-like voice synthesis.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <Waves className="w-4 h-4 text-blue-400 animate-pulse" />
                                <span className="text-[11px] text-blue-300 font-medium">Automatic Failover: Active (Browsers will take over if APIs fail)</span>
                            </div>
                        </div>

                        {/* Security Info */}
                        <div className="bg-zayko-900/50 rounded-2xl p-4 flex items-start gap-4">
                            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-zayko-400 leading-relaxed">
                                Settings are protected by administrator privileges. Changes made here affect availability for all students in real-time.
                            </p>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveConfig}
                            disabled={saving}
                            className="w-full py-4 text-lg font-display font-bold bg-gradient-to-r from-gold-600 to-gold-400 hover:from-gold-500 hover:to-gold-300 text-zayko-900 rounded-2xl shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="w-6 h-6 border-2 border-zayko-900 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <><Save className="w-5 h-5" /> Save Configuration</>
                            )}
                        </button>
                        <div className="pt-6 border-t border-white/10">
                            <h3 className="flex items-center gap-2 font-display font-bold text-lg text-white mb-4">
                                <Palette className="w-5 h-5 text-purple-400" /> Dashboard Personalization
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {THEMES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTheme(t.id)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                                            theme === t.id 
                                            ? "bg-gold-500/10 border-gold-500 text-gold-400 shadow-lg shadow-gold-500/10" 
                                            : "bg-zayko-700/30 border-white/5 text-zayko-400 hover:bg-white/5"
                                        }`}
                                    >
                                        <span className="text-2xl">{t.icon}</span>
                                        <span className="text-xs font-bold uppercase tracking-wider">{t.name}</span>
                                        {theme === t.id && <div className="w-1.5 h-1.5 rounded-full bg-gold-400" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminGuard>
    );
}
