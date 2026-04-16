"use client";

import React, { useEffect, useState, useCallback } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import { 
    Package, CircleDollarSign, AlertTriangle, Circle, 
    ClipboardList, BarChart3, Soup, Utensils, 
    Edit2, Trash2, Flame, ShoppingCart, 
    Download, ArrowLeft, Plus, Minus, 
    X, Save, RefreshCw, Activity, Search, Filter 
} from "lucide-react";

// ─── Types ───────────────────────────────────────

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    unit: string;
    reorderLevel: number;
    supplierName: string;
    costPerUnit: number;
    lastRestockedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface StockLog {
    id: string;
    itemId: string;
    itemName: string;
    type: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string;
    performedBy: string;
    orderId?: string;
    createdAt: string;
}

interface Analytics {
    totalValue: number;
    totalItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    mostUsedIngredients: Array<{ itemName: string; totalDeducted: number; unit: string }>;
    wasteReport: Array<{ itemName: string; totalWasted: number; unit: string }>;
    purchaseSuggestions: Array<{
        itemName: string; currentStock: number; reorderLevel: number;
        suggestedQuantity: number; estimatedCost: number; unit: string; supplierName: string;
    }>;
}

interface MenuItem {
    id: string;
    name: string;
}

interface RecipeMapping {
    id: string;
    menuItemId: string;
    menuItemName: string;
    ingredientId: string;
    ingredientName: string;
    quantityRequired: number;
    unit: string;
}

const CATEGORIES = ["veg", "non-veg", "beverage", "snack", "dairy", "grain", "spice", "condiment", "packaging", "other"];
const UNITS = ["kg", "g", "liter", "ml", "pieces", "packets", "dozen"];

// ─── Component ───────────────────────────────────

export default function InventoryPage() {
    // ─── State ───────────────────────────────────
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [summary, setSummary] = useState({ totalItems: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 });

    // Dialogs
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editItem, setEditItem] = useState<InventoryItem | null>(null);
    const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
    const [logsItem, setLogsItem] = useState<InventoryItem | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showRecipeMapping, setShowRecipeMapping] = useState(false);

    // Form state
    const [form, setForm] = useState({ name: "", category: "other", currentStock: 0, unit: "pieces", reorderLevel: 5, supplierName: "", costPerUnit: 0 });
    const [adjustForm, setAdjustForm] = useState({ type: "ADD" as string, quantity: 0, reason: "" });
    const [logs, setLogs] = useState<StockLog[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [saving, setSaving] = useState(false);

    // Recipe mapping state
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
    const [recipeMappings, setRecipeMappings] = useState<RecipeMapping[]>([]);
    const [recipeIngredients, setRecipeIngredients] = useState<Array<{ ingredientId: string; ingredientName: string; quantityRequired: number; unit: string }>>([]);

    // Tab state
    const [activeTab, setActiveTab] = useState<"inventory" | "analytics" | "recipes">("inventory");

    const getHeaders = useCallback(() => {
        const token = localStorage.getItem("adminToken");
        return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    }, []);

    // ─── Data Fetching ───────────────────────────

    const fetchInventory = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (categoryFilter) params.set("category", categoryFilter);
            if (lowStockOnly) params.set("lowStock", "true");
            const res = await fetch(`/api/admin/inventory?${params}`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setItems(data.items);
                setSummary(data.summary);
            }
        } catch (err) {
            toast.error("Failed to load inventory");
        }
        setLoading(false);
    }, [search, categoryFilter, lowStockOnly, getHeaders]);

    useEffect(() => { fetchInventory(); }, [fetchInventory]);

    const fetchLogs = async (itemId: string) => {
        try {
            const res = await fetch(`/api/admin/inventory/logs?itemId=${itemId}&limit=30`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) setLogs(data.logs);
        } catch { toast.error("Failed to load logs"); }
    };

    const fetchAnalytics = async () => {
        try {
            const res = await fetch("/api/admin/inventory/analytics", { headers: getHeaders() });
            const data = await res.json();
            if (data.success) setAnalytics(data.analytics);
        } catch { toast.error("Failed to load analytics"); }
    };

    const fetchMenuItems = async () => {
        try {
            const res = await fetch("/api/menu");
            const data = await res.json();
            setMenuItems((data.items || data).map((i: any) => ({ id: i.id, name: i.name })));
        } catch { toast.error("Failed to load menu items"); }
    };

    const fetchRecipeMappings = async (menuItemId: string) => {
        try {
            const res = await fetch(`/api/admin/inventory/recipe-mapping?menuItemId=${menuItemId}`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setRecipeMappings(data.mappings);
                setRecipeIngredients(data.mappings.map((m: RecipeMapping) => ({
                    ingredientId: m.ingredientId, ingredientName: m.ingredientName, quantityRequired: m.quantityRequired, unit: m.unit,
                })));
            }
        } catch { toast.error("Failed to load recipe mappings"); }
    };

    // ─── Actions ─────────────────────────────────

    const handleAddItem = async () => {
        if (!form.name.trim()) { toast.error("Name is required"); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/inventory", {
                method: "POST", headers: getHeaders(), body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Item added!");
                setShowAddDialog(false);
                resetForm();
                fetchInventory();
            } else toast.error(data.error);
        } catch { toast.error("Failed to add item"); }
        setSaving(false);
    };

    const handleEditItem = async () => {
        if (!editItem) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/inventory/${editItem.id}`, {
                method: "PUT", headers: getHeaders(), body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Item updated!");
                setEditItem(null);
                resetForm();
                fetchInventory();
            } else toast.error(data.error);
        } catch { toast.error("Failed to update item"); }
        setSaving(false);
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm("Delete this inventory item?")) return;
        try {
            const res = await fetch(`/api/admin/inventory/${id}`, { method: "DELETE", headers: getHeaders() });
            const data = await res.json();
            if (data.success) { toast.success("Item deleted"); fetchInventory(); }
            else toast.error(data.error);
        } catch { toast.error("Failed to delete"); }
    };

    const handleStockAdjust = async () => {
        if (!adjustItem) return;
        if (adjustForm.quantity <= 0) { toast.error("Quantity must be positive"); return; }
        if (!adjustForm.reason.trim()) { toast.error("Reason is required"); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/inventory/stock-adjust", {
                method: "POST", headers: getHeaders(),
                body: JSON.stringify({ itemId: adjustItem.id, ...adjustForm, quantity: Number(adjustForm.quantity) }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Stock updated! New: ${data.newStock}`);
                setAdjustItem(null);
                setAdjustForm({ type: "ADD", quantity: 0, reason: "" });
                fetchInventory();
            } else toast.error(data.error);
        } catch { toast.error("Failed to adjust stock"); }
        setSaving(false);
    };

    const handleSaveRecipeMapping = async () => {
        if (!selectedMenuItemId) { toast.error("Select a menu item"); return; }
        const menuItem = menuItems.find(m => m.id === selectedMenuItemId);
        if (!menuItem) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/inventory/recipe-mapping", {
                method: "POST", headers: getHeaders(),
                body: JSON.stringify({ menuItemId: selectedMenuItemId, menuItemName: menuItem.name, ingredients: recipeIngredients }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Recipe mapping saved!");
                fetchRecipeMappings(selectedMenuItemId);
            } else toast.error(data.error);
        } catch { toast.error("Failed to save recipe mapping"); }
        setSaving(false);
    };

    const handleExportCSV = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/admin/inventory/export", { headers: { Authorization: `Bearer ${token}` } });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `zayko_inventory_${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV downloaded!");
        } catch { toast.error("Failed to export"); }
    };

    const resetForm = () => setForm({ name: "", category: "other", currentStock: 0, unit: "pieces", reorderLevel: 5, supplierName: "", costPerUnit: 0 });

    const getStatusBadge = (item: InventoryItem) => {
        if (item.currentStock <= 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">OUT OF STOCK</span>;
        if (item.currentStock <= item.reorderLevel) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">LOW STOCK</span>;
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">HEALTHY</span>;
    };

    const getLogTypeBadge = (type: string) => {
        const map: Record<string, string> = {
            ADD: "bg-emerald-500/20 text-emerald-400",
            DEDUCT: "bg-amber-500/20 text-amber-400",
            AUTO_DEDUCT: "bg-blue-500/20 text-blue-400",
            WASTE: "bg-red-500/20 text-red-400",
        };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[type] || "bg-gray-500/20 text-gray-400"}`}>{type}</span>;
    };

    // ─── Render ──────────────────────────────────

    return (
        <>
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                    {/* ─── Summary Cards ─── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                        {[
                            { label: "Total Items", value: summary.totalItems, icon: <Package className="w-5 h-5 text-blue-400" />, color: "text-blue-400" },
                            { label: "Total Value", value: `₹${summary.totalValue.toLocaleString()}`, icon: <CircleDollarSign className="w-5 h-5 text-gold-400" />, color: "text-gold-400" },
                            { label: "Low Stock", value: summary.lowStockCount, icon: <AlertTriangle className="w-5 h-5 text-amber-400" />, color: "text-amber-400" },
                            { label: "Out of Stock", value: summary.outOfStockCount, icon: <Circle className="w-5 h-5 text-red-500 fill-red-500/20" />, color: "text-red-400" },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    {stat.icon}
                                    <span className="text-xs text-zayko-400">{stat.label}</span>
                                </div>
                                <p className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* ─── Tabs ─── */}
                    <div className="flex gap-2 border-b border-zayko-700 pb-0">
                        {[
                            { key: "inventory" as const, label: "Inventory", icon: <ClipboardList className="w-4 h-4" />, onClick: () => setActiveTab("inventory") },
                            { key: "analytics" as const, label: "Analytics", icon: <BarChart3 className="w-4 h-4" />, onClick: () => { setActiveTab("analytics"); fetchAnalytics(); } },
                            { key: "recipes" as const, label: "Recipes", icon: <Utensils className="w-4 h-4" />, onClick: () => { setActiveTab("recipes"); fetchMenuItems(); } },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={tab.onClick}
                                className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all flex items-center gap-2 ${activeTab === tab.key
                                    ? "bg-zayko-800 text-white border border-zayko-700 border-b-zayko-800 -mb-[1px]"
                                    : "text-zayko-400 hover:text-white hover:bg-zayko-800/50"}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ━━━ INVENTORY TAB ━━━ */}
                    {activeTab === "inventory" && (
                        <>
                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
                                <input
                                    type="text" placeholder="Search items..." value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex-1 bg-zayko-800 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500 transition-colors"
                                />
                                <select
                                    value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="bg-zayko-800 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500"
                                >
                                    <option value="">All Categories</option>
                                    {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                                </select>
                                <button
                                    onClick={() => setLowStockOnly(!lowStockOnly)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border flex items-center gap-2 ${lowStockOnly ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-zayko-800 text-zayko-400 border-zayko-700 hover:text-white"}`}
                                >
                                    {lowStockOnly ? <><Circle className="w-3 h-3 fill-current" /> Low Stock Only</> : <><Filter className="w-4 h-4" /> Filter Low Stock</>}
                                </button>
                            </div>

                            {/* Table */}
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-20 text-zayko-400 flex flex-col items-center">
                                    <Package className="w-12 h-12 text-zayko-700 mb-4" />
                                    <p className="text-lg font-semibold">No inventory items found</p>
                                    <p className="text-sm mt-2">Click &quot;Add Item&quot; to add your first ingredient</p>
                                </div>
                            ) : (
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl overflow-hidden animate-slide-up">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-zayko-700 text-zayko-400">
                                                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                                                    <th className="text-left px-4 py-3 font-semibold">Category</th>
                                                    <th className="text-right px-4 py-3 font-semibold">Stock</th>
                                                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                                                    <th className="text-right px-4 py-3 font-semibold">Cost/Unit</th>
                                                    <th className="text-right px-4 py-3 font-semibold">Value</th>
                                                    <th className="text-left px-4 py-3 font-semibold">Supplier</th>
                                                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.id} className="border-b border-zayko-700/50 hover:bg-zayko-800/80 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                                                        <td className="px-4 py-3 text-zayko-300 capitalize">{item.category}</td>
                                                        <td className="px-4 py-3 text-right text-white font-mono">{item.currentStock} <span className="text-zayko-500 text-xs">{item.unit}</span></td>
                                                        <td className="px-4 py-3 text-center">{getStatusBadge(item)}</td>
                                                        <td className="px-4 py-3 text-right text-zayko-300">₹{item.costPerUnit}</td>
                                                        <td className="px-4 py-3 text-right text-white font-mono">₹{(item.currentStock * item.costPerUnit).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-zayko-300">{item.supplierName}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => { setAdjustItem(item); setAdjustForm({ type: "ADD", quantity: 0, reason: "" }); }} className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all" title="Adjust Stock">
                                                                    <Activity className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => { setEditItem(item); setForm({ name: item.name, category: item.category, currentStock: item.currentStock, unit: item.unit, reorderLevel: item.reorderLevel, supplierName: item.supplierName, costPerUnit: item.costPerUnit }); }} className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all" title="Edit">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => { setLogsItem(item); fetchLogs(item.id); }} className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all" title="View Logs">
                                                                    <ClipboardList className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all" title="Delete">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ━━━ ANALYTICS TAB ━━━ */}
                    {activeTab === "analytics" && (
                        <div className="space-y-6 animate-fade-in">
                            {!analytics ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Value Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <p className="text-xs text-zayko-400 mb-1">Inventory Value</p>
                                            <p className="text-2xl font-display font-bold text-gold-400">₹{analytics.totalValue.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <p className="text-xs text-zayko-400 mb-1">Total Items</p>
                                            <p className="text-2xl font-display font-bold text-blue-400">{analytics.totalItems}</p>
                                        </div>
                                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <p className="text-xs text-zayko-400 mb-1">Low Stock</p>
                                            <p className="text-2xl font-display font-bold text-amber-400">{analytics.lowStockItems}</p>
                                        </div>
                                        <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                            <p className="text-xs text-zayko-400 mb-1">Out of Stock</p>
                                            <p className="text-2xl font-display font-bold text-red-400">{analytics.outOfStockItems}</p>
                                        </div>
                                    </div>

                                    {/* Most Used Ingredients */}
                                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                        <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                            <Flame className="w-5 h-5 text-orange-500" /> Most Used Ingredients (7 Days)
                                        </h3>
                                        {analytics.mostUsedIngredients.length === 0 ? (
                                            <p className="text-zayko-400 text-sm">No usage data yet</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {analytics.mostUsedIngredients.map((ing, i) => (
                                                    <div key={i} className="flex items-center justify-between py-2 border-b border-zayko-700/50 last:border-0">
                                                        <span className="text-white font-semibold">{ing.itemName}</span>
                                                        <span className="text-gold-400 font-mono">{ing.totalDeducted} {ing.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Waste Report */}
                                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                        <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                            <Trash2 className="w-5 h-5 text-red-400" /> Waste Report (7 Days)
                                        </h3>
                                        {analytics.wasteReport.length === 0 ? (
                                            <p className="text-zayko-400 text-sm">No waste recorded</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {analytics.wasteReport.map((w, i) => (
                                                    <div key={i} className="flex items-center justify-between py-2 border-b border-zayko-700/50 last:border-0">
                                                        <span className="text-white">{w.itemName}</span>
                                                        <span className="text-red-400 font-mono">{w.totalWasted} {w.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Purchase Suggestions */}
                                    <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                        <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                            <ShoppingCart className="w-5 h-5 text-emerald-400" /> Purchase Suggestions
                                        </h3>
                                        {analytics.purchaseSuggestions.length === 0 ? (
                                            <p className="text-zayko-400 text-sm flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All stock levels are healthy!
                                            </p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-zayko-400 border-b border-zayko-700">
                                                            <th className="text-left py-2 px-3">Item</th>
                                                            <th className="text-right py-2 px-3">Current</th>
                                                            <th className="text-right py-2 px-3">Reorder Level</th>
                                                            <th className="text-right py-2 px-3">Suggested Qty</th>
                                                            <th className="text-right py-2 px-3">Est. Cost</th>
                                                            <th className="text-left py-2 px-3">Supplier</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {analytics.purchaseSuggestions.map((s, i) => (
                                                            <tr key={i} className="border-b border-zayko-700/50">
                                                                <td className="py-2 px-3 text-white font-semibold">{s.itemName}</td>
                                                                <td className="py-2 px-3 text-right text-red-400 font-mono">{s.currentStock} {s.unit}</td>
                                                                <td className="py-2 px-3 text-right text-zayko-400">{s.reorderLevel}</td>
                                                                <td className="py-2 px-3 text-right text-emerald-400 font-bold">{s.suggestedQuantity} {s.unit}</td>
                                                                <td className="py-2 px-3 text-right text-gold-400">₹{s.estimatedCost.toLocaleString()}</td>
                                                                <td className="py-2 px-3 text-zayko-400">{s.supplierName}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ━━━ RECIPE MAPPINGS TAB ━━━ */}
                    {activeTab === "recipes" && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6">
                                <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                    <Utensils className="w-5 h-5 text-gold-400" /> Menu → Ingredient Recipe Mapping
                                </h3>
                                <p className="text-xs text-zayko-400 mb-4">Link menu items to raw ingredients so stock is auto-deducted when orders are placed.</p>

                                <select
                                    value={selectedMenuItemId}
                                    onChange={(e) => { setSelectedMenuItemId(e.target.value); if (e.target.value) fetchRecipeMappings(e.target.value); else { setRecipeMappings([]); setRecipeIngredients([]); } }}
                                    className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold-500 mb-4"
                                >
                                    <option value="">Select a menu item...</option>
                                    {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>

                                {selectedMenuItemId && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-white">Ingredients Required:</h4>
                                            <button
                                                onClick={() => setRecipeIngredients([...recipeIngredients, { ingredientId: "", ingredientName: "", quantityRequired: 0, unit: "pieces" }])}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add Ingredient
                                            </button>
                                        </div>

                                        {recipeIngredients.map((ing, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-3 bg-zayko-900/50 rounded-xl border border-zayko-700">
                                                <select
                                                    value={ing.ingredientId}
                                                    onChange={(e) => {
                                                        const inv = items.find(i => i.id === e.target.value);
                                                        const updated = [...recipeIngredients];
                                                        updated[idx] = { ...updated[idx], ingredientId: e.target.value, ingredientName: inv?.name || "", unit: inv?.unit || "pieces" };
                                                        setRecipeIngredients(updated);
                                                    }}
                                                    className="flex-1 bg-zayko-800 border border-zayko-700 rounded-lg px-3 py-2 text-sm text-white"
                                                >
                                                    <option value="">Select Ingredient</option>
                                                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                </select>
                                                <input
                                                    type="number" min="0" step="0.1" placeholder="Qty" value={ing.quantityRequired || ""}
                                                    onChange={(e) => { const updated = [...recipeIngredients]; updated[idx] = { ...updated[idx], quantityRequired: Number(e.target.value) }; setRecipeIngredients(updated); }}
                                                    className="w-24 bg-zayko-800 border border-zayko-700 rounded-lg px-3 py-2 text-sm text-white text-center"
                                                />
                                                <span className="text-xs text-zayko-400 w-14">{ing.unit}</span>
                                                <button onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}

                                        {recipeIngredients.length > 0 && (
                                            <button onClick={handleSaveRecipeMapping} disabled={saving} className="btn-gold py-2.5 px-6 text-sm w-full mt-2">
                                                {saving ? "Saving..." : "Save Recipe Mapping"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                
                {/* ━━━ DIALOGS ━━━ */}

                {/* Add / Edit Item Dialog */}
                {(showAddDialog || editItem) && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-zayko-800 border border-zayko-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
                            <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
                                {editItem ? <Edit2 className="w-5 h-5 text-blue-400" /> : <Plus className="w-5 h-5 text-gold-400" />} 
                                {editItem ? "Edit Item" : "Add Inventory Item"}
                            </h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zayko-400 mb-1 block">Name *</label>
                                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500" placeholder="e.g., Buns" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-zayko-400 mb-1 block">Category</label>
                                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white">
                                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zayko-400 mb-1 block">Unit</label>
                                        <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white">
                                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {!editItem && (
                                    <div>
                                        <label className="text-xs text-zayko-400 mb-1 block">Initial Stock</label>
                                        <input type="number" min="0" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white" />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-zayko-400 mb-1 block">Reorder Level</label>
                                        <input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zayko-400 mb-1 block">Cost/Unit (₹)</label>
                                        <input type="number" min="0" step="0.5" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: Number(e.target.value) })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-zayko-400 mb-1 block">Supplier</label>
                                    <input type="text" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white" placeholder="Supplier name" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => { setShowAddDialog(false); setEditItem(null); resetForm(); }} className="flex-1 py-2.5 px-4 rounded-xl border border-zayko-700 text-zayko-300 hover:bg-zayko-700 text-sm transition-all">Cancel</button>
                                <button onClick={editItem ? handleEditItem : handleAddItem} disabled={saving} className="flex-1 btn-gold py-2.5 text-sm">{saving ? "Saving..." : editItem ? "Update" : "Add Item"}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stock Adjust Dialog */}
                {adjustItem && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-zayko-800 border border-zayko-700 rounded-2xl p-6 w-full max-w-md animate-scale-in">
                            <h2 className="text-lg font-display font-bold text-white mb-2">Adjust Stock</h2>
                            <p className="text-sm text-zayko-400 mb-4">{adjustItem.name} — Current: <span className="text-white font-mono">{adjustItem.currentStock} {adjustItem.unit}</span></p>
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    {(["ADD", "DEDUCT", "WASTE"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setAdjustForm({ ...adjustForm, type: t })}
                                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${adjustForm.type === t
                                                ? t === "ADD" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                                    : t === "DEDUCT" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                        : "bg-red-500/20 text-red-400 border-red-500/30"
                                                : "bg-zayko-900 text-zayko-400 border-zayko-700"}`}
                                        >
                                            {t === "ADD" ? <Plus className="w-3 h-3" /> : t === "DEDUCT" ? <Minus className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                                            {t === "ADD" ? "Add" : t === "DEDUCT" ? "Deduct" : "Waste"}
                                        </button>
                                    ))}
                                </div>
                                <input type="number" min="0.1" step="0.1" placeholder="Quantity" value={adjustForm.quantity || ""} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white" />
                                <input type="text" placeholder="Reason (e.g., New delivery, Expired batch)" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="w-full bg-zayko-900 border border-zayko-700 rounded-xl px-4 py-2.5 text-sm text-white" />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setAdjustItem(null)} className="flex-1 py-2.5 px-4 rounded-xl border border-zayko-700 text-zayko-300 hover:bg-zayko-700 text-sm transition-all">Cancel</button>
                                <button onClick={handleStockAdjust} disabled={saving} className="flex-1 btn-gold py-2.5 text-sm">{saving ? "Saving..." : "Confirm"}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stock Logs Dialog */}
                {logsItem && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-zayko-800 border border-zayko-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto animate-scale-in">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-purple-400" /> Stock History — {logsItem.name}
                                </h2>
                                <button onClick={() => setLogsItem(null)} className="text-zayko-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {logs.length === 0 ? (
                                <p className="text-zayko-400 text-sm text-center py-8">No stock logs yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {logs.map((log) => (
                                        <div key={log.id} className="p-3 bg-zayko-900/50 rounded-xl border border-zayko-700/50">
                                            <div className="flex items-center justify-between mb-1">
                                                {getLogTypeBadge(log.type)}
                                                <span className="text-[10px] text-zayko-500">{new Date(log.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-white">
                                                {log.type === "ADD" ? "+" : "−"}{log.quantity} → <span className="font-mono text-gold-400">{log.newStock}</span>
                                            </p>
                                            <p className="text-xs text-zayko-400 mt-1">{log.reason}</p>
                                            <p className="text-[10px] text-zayko-500 mt-1">By: {log.performedBy}{log.orderId ? ` | Order: ${log.orderId}` : ""}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
