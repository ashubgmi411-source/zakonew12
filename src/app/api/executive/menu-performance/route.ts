/**
 * /api/executive/menu-performance — Menu Performance Analytics (REST fallback)
 *
 * GET — Returns top/low performing menu items from completed orders.
 * Protected by Super Admin JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/super-admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const admin = verifySuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const ordersSnap = await adminDb
            .collection("orders")
            .where("status", "==", "completed")
            .get();

        const itemMap: Record<string, { name: string; revenue: number; qty: number }> = {};

        ordersSnap.forEach((doc) => {
            const order = doc.data();
            const items = order.items || [];
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
        });

        const sortedItems = Object.values(itemMap)
            .map((i) => ({ name: i.name, revenue: Math.round(i.revenue), qty: i.qty }))
            .sort((a, b) => b.revenue - a.revenue);

        const topPerformers = sortedItems.slice(0, 5);
        const lowPerformers = sortedItems.length > 5
            ? sortedItems.slice(-5).reverse()
            : sortedItems.slice().reverse().slice(0, 5);

        return NextResponse.json({
            success: true,
            topPerformers,
            lowPerformers,
            performanceChartData: sortedItems.slice(0, 10),
            totalMenuRevenue: sortedItems.reduce((s, i) => s + i.revenue, 0),
            totalItemsSold: sortedItems.reduce((s, i) => s + i.qty, 0),
            uniqueItems: sortedItems.length,
            avgRevenuePerItem: sortedItems.length > 0
                ? Math.round(sortedItems.reduce((s, i) => s + i.revenue, 0) / sortedItems.length)
                : 0,
        });
    } catch (err) {
        console.error("[Executive/MenuPerformance] Error:", err);
        return NextResponse.json({ error: "Failed to load menu performance" }, { status: 500 });
    }
}
