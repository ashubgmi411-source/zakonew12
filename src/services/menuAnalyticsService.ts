/**
 * Menu Analytics Service — Client-side real-time analytics.
 *
 * Uses Firestore `onSnapshot` to listen to completed orders,
 * aggregates item sales data, and pushes updates via callback.
 * Includes debouncing to avoid excessive re-renders.
 */

import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// ─── Types ──────────────────────────────────────

export interface MenuPerformanceItem {
    name: string;
    revenue: number;
    qty: number;
}

export interface MenuPerformanceData {
    topPerformers: MenuPerformanceItem[];
    lowPerformers: MenuPerformanceItem[];
    performanceChartData: MenuPerformanceItem[];
    totalMenuRevenue: number;
    totalItemsSold: number;
    uniqueItems: number;
    avgRevenuePerItem: number;
}

// ─── Aggregation Logic ──────────────────────────

function aggregateOrders(docs: { data: () => Record<string, unknown> }[]): MenuPerformanceData {
    const itemMap: Record<string, { name: string; revenue: number; qty: number }> = {};

    for (const doc of docs) {
        const order = doc.data();

        // Only aggregate completed orders (double-check)
        if (order.status !== "completed") continue;

        const items = (order.items || []) as Array<{
            id?: string;
            name?: string;
            quantity?: number;
            price?: number;
        }>;

        for (const item of items) {
            const key = item.id || item.name || "Unknown";
            const name = item.name || "Unknown";
            const qty = item.quantity || 1;
            const price = item.price || 0;

            if (!itemMap[key]) {
                itemMap[key] = { name, revenue: 0, qty: 0 };
            }
            itemMap[key].revenue += price * qty;
            itemMap[key].qty += qty;
        }
    }

    // Sort by revenue descending
    const sortedItems = Object.values(itemMap)
        .map((item) => ({
            name: item.name,
            revenue: Math.round(item.revenue),
            qty: item.qty,
        }))
        .sort((a, b) => b.revenue - a.revenue);

    // Top 5 performers
    const topPerformers = sortedItems.slice(0, 5);

    // Bottom 5 performers
    const lowPerformers = sortedItems.length > 5
        ? sortedItems.slice(-5).reverse()
        : sortedItems.length > 0
            ? sortedItems.slice().reverse().slice(0, 5)
            : [];

    // Chart data (top 10)
    const performanceChartData = sortedItems.slice(0, 10);

    // Summary stats
    const totalMenuRevenue = sortedItems.reduce((sum, i) => sum + i.revenue, 0);
    const totalItemsSold = sortedItems.reduce((sum, i) => sum + i.qty, 0);
    const uniqueItems = sortedItems.length;
    const avgRevenuePerItem = uniqueItems > 0 ? Math.round(totalMenuRevenue / uniqueItems) : 0;

    return {
        topPerformers,
        lowPerformers,
        performanceChartData,
        totalMenuRevenue,
        totalItemsSold,
        uniqueItems,
        avgRevenuePerItem,
    };
}

// ─── Real-Time Subscription ─────────────────────

/**
 * Subscribe to real-time menu performance analytics.
 *
 * Listens to all completed orders via Firestore `onSnapshot`,
 * aggregates item sales, and calls `callback` with updated data.
 * Updates are debounced (300ms) to avoid excessive re-renders.
 *
 * @returns Unsubscribe function to clean up the listener.
 */
export function subscribeMenuPerformance(
    callback: (data: MenuPerformanceData) => void,
    onError?: (error: Error) => void
): () => void {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const q = query(
        collection(db, "orders"),
        where("status", "==", "completed")
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            // Debounce: wait 300ms after last change before recalculating
            if (debounceTimer) clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                const docs = snapshot.docs.map((doc) => ({
                    data: () => doc.data(),
                }));
                const result = aggregateOrders(docs);
                callback(result);
            }, 300);
        },
        (error) => {
            console.error("[MenuAnalytics] Listener error:", error);
            if (onError) onError(error);
        }
    );

    // Return cleanup function
    return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        unsubscribe();
    };
}
