/**
 * /api/executive/analytics — Financial & Order Analytics
 *
 * GET — Returns:
 * - Revenue breakdown (Razorpay vs Wallet)
 * - Daily/weekly/monthly revenue trends
 * - Order volume, avg value, hourly distribution
 * - Repeat customer rate
 * - Payment method split
 *
 * Protected by Super Admin JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/super-admin-auth";
import { verifyAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const isSuperAdmin = verifySuperAdmin(req);
    const isAdmin = verifyAdmin(req);
    
    if (!isSuperAdmin && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Fetch all orders (completed + confirmed for revenue)
        const ordersSnap = await adminDb
            .collection("orders")
            .orderBy("createdAt", "desc")
            .get();

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        const monthAgo = new Date(now.getTime() - 30 * 86400000);

        let totalRevenue = 0;
        let razorpayRevenue = 0;
        let walletRevenue = 0;
        let totalOrders = 0;
        let todayRevenue = 0;
        let todayOrders = 0;
        let weekRevenue = 0;
        let monthRevenue = 0;

        const dailyRevenue: Record<string, { razorpay: number; wallet: number; total: number; orders: number }> = {};
        const hourlyOrders: Record<number, number> = {};
        const userOrderCount: Record<string, number> = {};
        const itemRevenue: Record<string, { name: string; revenue: number; qty: number }> = {};

        // Initialize hourly slots
        for (let h = 0; h < 24; h++) hourlyOrders[h] = 0;

        ordersSnap.forEach((doc) => {
            const order = doc.data();
            const status = order.status;

            // Only count revenue from non-cancelled orders
            if (status === "cancelled") return;

            const total = order.total || 0;
            const payMode = (order.paymentMode || "").toLowerCase();
            const createdAt = order.createdAt ? new Date(order.createdAt) : now;
            const dateKey = createdAt.toISOString().slice(0, 10);
            const hour = createdAt.getHours();

            totalRevenue += total;
            totalOrders++;

            if (payMode.includes("razorpay") || payMode.includes("online")) {
                razorpayRevenue += total;
            } else {
                walletRevenue += total;
            }

            // Daily bucket
            if (!dailyRevenue[dateKey]) {
                dailyRevenue[dateKey] = { razorpay: 0, wallet: 0, total: 0, orders: 0 };
            }
            dailyRevenue[dateKey].total += total;
            dailyRevenue[dateKey].orders++;
            if (payMode.includes("razorpay") || payMode.includes("online")) {
                dailyRevenue[dateKey].razorpay += total;
            } else {
                dailyRevenue[dateKey].wallet += total;
            }

            // Today
            if (dateKey === todayStr) {
                todayRevenue += total;
                todayOrders++;
            }

            // Week/Month
            if (createdAt >= weekAgo) weekRevenue += total;
            if (createdAt >= monthAgo) monthRevenue += total;

            // Hourly
            hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;

            // User tracking for repeat rate
            if (order.userId) {
                userOrderCount[order.userId] = (userOrderCount[order.userId] || 0) + 1;
            }

            // Item revenue
            const items = order.items || [];
            for (const item of items) {
                const key = item.id || item.name;
                if (!itemRevenue[key]) {
                    itemRevenue[key] = { name: item.name, revenue: 0, qty: 0 };
                }
                itemRevenue[key].revenue += (item.price || 0) * (item.quantity || 1);
                itemRevenue[key].qty += item.quantity || 1;
            }
        });

        // Avg order value
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        // Repeat rate
        const totalUsers = Object.keys(userOrderCount).length;
        const repeatUsers = Object.values(userOrderCount).filter((c) => c > 1).length;
        const repeatRate = totalUsers > 0 ? Math.round((repeatUsers / totalUsers) * 100) : 0;

        // Daily trend (last 30 days)
        const dailyTrend = Object.entries(dailyRevenue)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-30)
            .map(([date, data]) => ({
                date,
                label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                ...data,
            }));

        // Monthly aggregation
        const monthlyRevMap: Record<string, number> = {};
        Object.entries(dailyRevenue).forEach(([date, data]) => {
            const monthKey = date.slice(0, 7);
            monthlyRevMap[monthKey] = (monthlyRevMap[monthKey] || 0) + data.total;
        });
        const monthlyTrend = Object.entries(monthlyRevMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, total]) => ({
                month,
                label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
                total: Math.round(total),
            }));

        // Hourly heatmap data
        const hourlyData = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            label: `${h.toString().padStart(2, "0")}:00`,
            orders: hourlyOrders[h] || 0,
        }));

        // Peak hour
        const peakHour = hourlyData.reduce((max, h) => (h.orders > max.orders ? h : max), hourlyData[0]);

        // Top items
        const sortedItems = Object.values(itemRevenue).sort((a, b) => b.revenue - a.revenue);
        const topItems = sortedItems.slice(0, 10);
        const bottomItems = sortedItems.slice(-5).reverse();

        // Payment split
        const razorpayPct = totalRevenue > 0 ? Math.round((razorpayRevenue / totalRevenue) * 100) : 0;
        const walletPct = 100 - razorpayPct;

        return NextResponse.json({
            success: true,
            financial: {
                totalRevenue: Math.round(totalRevenue),
                razorpayRevenue: Math.round(razorpayRevenue),
                walletRevenue: Math.round(walletRevenue),
                todayRevenue: Math.round(todayRevenue),
                weekRevenue: Math.round(weekRevenue),
                monthRevenue: Math.round(monthRevenue),
                razorpayPct,
                walletPct,
                dailyTrend,
                monthlyTrend,
            },
            orders: {
                totalOrders,
                todayOrders,
                avgOrderValue,
                repeatRate,
                totalUsers,
                repeatUsers,
                hourlyData,
                peakHour: peakHour.label,
                peakHourOrders: peakHour.orders,
            },
            menu: {
                topItems,
                bottomItems,
            },
        });
    } catch (err) {
        console.error("[Executive/Analytics] Error:", err);
        return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
    }
}
