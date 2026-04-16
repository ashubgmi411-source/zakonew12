"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Star, Soup, User, Calendar, MessageSquare, RefreshCw } from "lucide-react";
import type { Feedback } from "@/types";

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/feedbacks", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data);
            } else {
                toast.error("Failed to fetch feedbacks");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error loading feedbacks");
        } finally {
            setLoading(false);
        }
    };

    const avgRating = feedbacks.length > 0
        ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
        : "0";

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                {/* ─── Header ─── */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="flex items-center gap-1 text-zayko-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-4 h-4" /> Dashboard
                            </Link>
                            <h1 className="flex items-center gap-2 text-lg font-display font-bold text-white">
                                <Soup className="w-5 h-5 text-emerald-400" /> Food Feedback
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 bg-gold-500/10 border border-gold-500/20 px-4 py-1.5 rounded-full">
                            <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />
                            <span className="text-xs text-gold-400 font-bold uppercase tracking-wider">Avg Rating: {avgRating}</span>
                        </div>
                        <button onClick={() => { setLoading(true); fetchFeedbacks(); }}
                            className="bg-white/5 border border-white/10 p-2 rounded-xl text-zayko-400 hover:text-white transition-all">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : feedbacks.length === 0 ? (
                        <div className="text-center py-20 bg-zayko-800/30 border border-zayko-700 border-dashed rounded-3xl flex flex-col items-center">
                            <MessageSquare className="w-12 h-12 text-zayko-700 mb-4" />
                            <h3 className="text-white font-bold text-xl">No food feedback yet</h3>
                            <p className="text-zayko-400">Order-related reviews will appear here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {feedbacks.map((f) => (
                                <div key={f.id} className="bg-zayko-800/50 border border-zayko-700 p-6 rounded-3xl animate-fade-in">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zayko-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                {f.userName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{f.userName}</p>
                                                <p className="text-[10px] text-zayko-500">{new Date(f.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star 
                                                    key={i} 
                                                    className={`w-3.5 h-3.5 ${i < f.rating ? "text-gold-400 fill-gold-400" : "text-zayko-700 fill-zayko-700/50"}`} 
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-sm text-zayko-300 leading-relaxed italic">
                                        "{f.comment || "No comment provided."}"
                                    </p>

                                    <div className="mt-4 pt-4 border-t border-zayko-700/50 flex items-center justify-between">
                                        <span className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold">Order #{f.orderId.slice(-6).toUpperCase()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
