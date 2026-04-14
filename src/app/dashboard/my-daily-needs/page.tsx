"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import {
    getDemandPlans,
    createDemandPlan,
    updateDemandPlan,
    deleteDemandPlan,
} from "@/services/demandPlanService";
import toast from "react-hot-toast";
import Link from "next/link";
import { MenuItem } from "@/types";
import { ClipboardList, Plus, Package, MessageSquare, Edit, Trash2, ChevronLeft, Info, Play, Pause, Send, Check } from "lucide-react";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

interface DemandPlanLocal {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    days: string[];
    isActive: boolean;
    createdAt: string;
}

export default function MyDailyNeedsPage() {
    const { user, profile, loading, getIdToken } = useAuth();
    const router = useRouter();

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [plans, setPlans] = useState<DemandPlanLocal[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    // Form state
    const [selectedItem, setSelectedItem] = useState("");
    const [qty, setQty] = useState(1);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Edit state
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState(1);
    const [editDays, setEditDays] = useState<string[]>([]);
    const [editSaving, setEditSaving] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    // Fetch menu items (real-time)
    useEffect(() => {
        const q = query(collection(db, "menuItems"));
        const unsub = onSnapshot(q, (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];
            setMenuItems(items.filter((i) => i.available));
        });
        return () => unsub();
    }, []);

    // Fetch user's demand plans
    const fetchPlans = useCallback(async () => {
        const token = await getIdToken();
        if (!token) return;
        setPlansLoading(true);
        try {
            const res = await getDemandPlans(token);
            if (res.success) setPlans(res.plans as DemandPlanLocal[]);
        } catch {
            toast.error("Failed to load demand plans");
        }
        setPlansLoading(false);
    }, [getIdToken]);

    useEffect(() => {
        if (user) fetchPlans();
    }, [user, fetchPlans]);

    const toggleDay = (day: string) => {
        setSelectedDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleCreate = async () => {
        if (!selectedItem) return toast.error("Select a menu item");
        if (selectedDays.length === 0) return toast.error("Select at least one day");

        setSaving(true);
        const token = await getIdToken();
        if (!token) { setSaving(false); return; }

        try {
            const res = await createDemandPlan(token, {
                itemId: selectedItem,
                quantity: qty,
                days: selectedDays,
            });
            if (res.success) {
                toast.success("Demand plan added!");
                setSelectedItem("");
                setQty(1);
                setSelectedDays([]);
                fetchPlans();
            } else {
                toast.error(res.error || "Failed to create plan");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setSaving(false);
    };

    const handleToggle = async (plan: DemandPlanLocal) => {
        const token = await getIdToken();
        if (!token) return;
        try {
            const res = await updateDemandPlan(token, plan.id, { isActive: !plan.isActive });
            if (res.success) {
                toast.success(plan.isActive ? "Plan paused" : "Plan activated");
                fetchPlans();
            }
        } catch {
            toast.error("Failed to update plan");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this demand plan?")) return;
        const token = await getIdToken();
        if (!token) return;
        try {
            const res = await deleteDemandPlan(token, id);
            if (res.success) {
                toast.success("Plan deleted");
                fetchPlans();
            }
        } catch {
            toast.error("Failed to delete plan");
        }
    };

    const startEdit = (plan: DemandPlanLocal) => {
        setEditId(plan.id);
        setEditQty(plan.quantity);
        setEditDays([...plan.days]);
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditQty(1);
        setEditDays([]);
    };

    const saveEdit = async () => {
        if (!editId) return;
        if (editDays.length === 0) return toast.error("Select at least one day");

        setEditSaving(true);
        const token = await getIdToken();
        if (!token) { setEditSaving(false); return; }

        try {
            const res = await updateDemandPlan(token, editId, {
                quantity: editQty,
                days: editDays,
            });
            if (res.success) {
                toast.success("Plan updated");
                cancelEdit();
                fetchPlans();
            } else {
                toast.error(res.error || "Failed to update");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setEditSaving(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zayko-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zayko-900 pb-24">
            {/* Header */}
            <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <Link href="/" className="text-zayko-400 hover:text-white transition-colors flex items-center justify-center w-8 h-8 bg-white/5 rounded-full hover:bg-white/10">
                        <ChevronLeft className="w-4 h-4" />
                    </Link>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-blue-500" /></div>
                    <div>
                        <h1 className="text-lg font-display font-bold text-white">My Daily Needs</h1>
                        <p className="text-xs text-zayko-400">Declare your recurring demand (no orders created)</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 space-y-8">
                {/* ─── Create New Plan ─── */}
                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-fade-in">
                    <h2 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-sm"><Plus className="w-4 h-4 text-emerald-500" /></span>
                        Add Demand Plan
                    </h2>

                    {/* Item Selector */}
                    <div className="mb-4">
                        <label className="text-xs text-zayko-400 block mb-1">Menu Item</label>
                        <select
                            value={selectedItem}
                            onChange={(e) => setSelectedItem(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold-400 appearance-none"
                        >
                            <option value="" className="bg-zayko-800">Select an item…</option>
                            {menuItems.map((item) => (
                                <option key={item.id} value={item.id} className="bg-zayko-800">
                                    {item.name} — ₹{item.price}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Quantity */}
                    <div className="mb-4">
                        <label className="text-xs text-zayko-400 block mb-1">Quantity</label>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={qty}
                            onChange={(e) => setQty(Math.max(1, Math.min(100, Number(e.target.value))))}
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                        />
                    </div>

                    {/* Day Checkboxes */}
                    <div className="mb-5">
                        <label className="text-xs text-zayko-400 block mb-2">Days</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_DAYS.map((day) => (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedDays.includes(day)
                                            ? "bg-gold-500 text-zayko-900 shadow-lg shadow-gold-500/20"
                                            : "bg-white/5 text-zayko-400 border border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {DAY_SHORT[day]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={saving}
                        className="btn-gold w-full py-3 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-zayko-900 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>Save Demand Plan <Send className="w-4 h-4" /></>
                        )}
                    </button>
                </div>

                {/* ─── Existing Plans ─── */}
                <div>
                    <h2 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center text-sm"><Package className="w-4 h-4 text-purple-400" /></span>
                        Your Demand Plans
                    </h2>

                    {plansLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="bg-zayko-800/30 border border-zayko-700 rounded-2xl p-8 text-center flex flex-col items-center">
                            <MessageSquare className="w-10 h-10 text-zayko-500 mb-3" />
                            <p className="text-zayko-400">No demand plans yet. Add one above!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`bg-zayko-800/50 border rounded-2xl p-4 transition-all animate-slide-up ${plan.isActive ? "border-zayko-700" : "border-zayko-700/50 opacity-60"
                                        }`}
                                >
                                    {editId === plan.id ? (
                                        /* Edit Mode */
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white font-bold">{plan.itemName}</span>
                                                <span className="text-xs text-zayko-500">editing</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zayko-400 block mb-1">Quantity</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    value={editQty}
                                                    onChange={(e) => setEditQty(Math.max(1, Math.min(100, Number(e.target.value))))}
                                                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-zayko-400 block mb-1">Days</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {ALL_DAYS.map((day) => (
                                                        <button
                                                            key={day}
                                                            onClick={() =>
                                                                setEditDays((prev) =>
                                                                    prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                                                                )
                                                            }
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${editDays.includes(day)
                                                                    ? "bg-gold-500 text-zayko-900"
                                                                    : "bg-white/5 text-zayko-400 border border-white/10"
                                                                }`}
                                                        >
                                                            {DAY_SHORT[day]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={saveEdit}
                                                    disabled={editSaving}
                                                    className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all"
                                                >
                                                    {editSaving ? "Saving…" : <span className="flex items-center gap-2 justify-center"><Check className="w-4 h-4" /> Save</span>}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="flex-1 py-2 bg-white/5 text-zayko-400 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* View Mode */
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-white truncate">{plan.itemName}</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                                                        ×{plan.quantity}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${plan.isActive
                                                            ? "bg-emerald-500/20 text-emerald-400"
                                                            : "bg-red-500/20 text-red-400"
                                                        }`}>
                                                        {plan.isActive ? "Active" : "Paused"}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {plan.days.map((day) => (
                                                        <span
                                                            key={day}
                                                            className="text-xs bg-white/5 text-zayko-300 px-2 py-0.5 rounded-md"
                                                        >
                                                            {DAY_SHORT[day]}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => handleToggle(plan)}
                                                    className={`p-2 rounded-xl text-sm transition-all ${plan.isActive
                                                            ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                                                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                                        }`}
                                                    title={plan.isActive ? "Pause" : "Activate"}
                                                >
                                                    {plan.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => startEdit(plan)}
                                                    className="p-2 rounded-xl text-sm bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(plan.id)}
                                                    className="p-2 rounded-xl text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Banner */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <span className="flex shrink-0"><Info className="w-5 h-5 text-blue-400 mt-0.5" /></span>
                    <div>
                        <p className="text-blue-300 text-sm font-semibold">This is for demand forecasting only</p>
                        <p className="text-blue-400/70 text-xs mt-0.5">
                            No orders will be created. The canteen uses this data to plan stock better.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
