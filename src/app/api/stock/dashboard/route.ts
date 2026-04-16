/**
 * /api/stock/dashboard — Stock Manager Dashboard Data API
 *
 * GET — Returns combined dashboard data:
 * - Today's demand forecast
 * - Tomorrow's demand forecast
 * - Weekly summary (all 7 days)
 * - Stock comparison with shortage alerts
 * - Purchase planning insights
 *
 * Protected by Stock Manager JWT verification.
 * Reuses aggregation logic from /api/admin/stock-forecast.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyStockManager } from "@/lib/stock-manager-auth";
import { verifyAdmin } from "@/lib/admin-auth";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getTodayDayName(): string {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function getTomorrowDayName(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString("en-US", { weekday: "long" });
}

export async function GET(req: NextRequest) {
    const manager = verifyStockManager(req);
    const isAdmin = verifyAdmin(req);

    if (!manager && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[StockDashboard] Starting demand aggregation...");

        // ── 1. Fetch all ACTIVE demand plans ──
        const [plansSnap, dailyDemandsSnap] = await Promise.all([
            adminDb
                .collection("userDemandPlans")
                .where("isActive", "==", true)
                .get(),
            adminDb
                .collection("dailyDemands")
                .where("isActive", "==", true)
                .get(),
        ]);

        console.log(`[StockDashboard] Found ${plansSnap.size} active demand plans, ${dailyDemandsSnap.size} active daily demands`);

        // ── 2. Single-pass aggregation (userDemandPlans) ──
        const demandByDay: Record<string, Record<string, number>> = {};
        const weeklyTotals: Record<string, number> = {};
        const activeUserIds = new Set<string>();
        const itemIdMap: Record<string, string> = {};

        for (const day of ALL_DAYS) {
            demandByDay[day] = {};
        }

        plansSnap.forEach((doc) => {
            const plan = doc.data();
            activeUserIds.add(plan.userId);

            const itemName: string = plan.itemName;
            const itemId: string = plan.itemId;
            const quantity: number = plan.quantity || 0;
            const days: string[] = plan.days || [];

            itemIdMap[itemName] = itemId;

            for (const day of days) {
                if (demandByDay[day]) {
                    demandByDay[day][itemName] = (demandByDay[day][itemName] || 0) + quantity;
                }
            }

            weeklyTotals[itemName] = (weeklyTotals[itemName] || 0) + quantity * days.length;
        });

        // ── 2b. Aggregate dailyDemands into same structures ──
        dailyDemandsSnap.forEach((doc) => {
            const dd = doc.data();
            activeUserIds.add(dd.userId);

            const itemName: string = dd.itemName || "Unknown";
            const itemId: string = dd.itemId;
            const quantity: number = dd.quantity || 0;
            const days: string[] = dd.days || [];

            itemIdMap[itemName] = itemId;

            for (const day of days) {
                if (demandByDay[day]) {
                    demandByDay[day][itemName] = (demandByDay[day][itemName] || 0) + quantity;
                }
            }

            weeklyTotals[itemName] = (weeklyTotals[itemName] || 0) + quantity * days.length;
        });

        // ── 2c. Build live demand summary from dailyDemands ──
        const liveDemandMap: Record<string, {
            itemId: string; itemName: string; totalDemand: number; activeUsers: Set<string>;
        }> = {};
        dailyDemandsSnap.forEach((doc) => {
            const dd = doc.data();
            const key = dd.itemId;
            if (!liveDemandMap[key]) {
                liveDemandMap[key] = {
                    itemId: dd.itemId,
                    itemName: dd.itemName || "Unknown",
                    totalDemand: 0,
                    activeUsers: new Set(),
                };
            }
            liveDemandMap[key].totalDemand += dd.quantity || 0;
            liveDemandMap[key].activeUsers.add(dd.userId);
        });
        const liveDemandSummary = Object.values(liveDemandMap)
            .map((item) => ({
                itemId: item.itemId,
                itemName: item.itemName,
                totalDemand: item.totalDemand,
                activeUsers: item.activeUsers.size,
            }))
            .sort((a, b) => b.totalDemand - a.totalDemand);

        // ── 3. Fetch current stock from menuItems ──
        const uniqueItemIds = [...new Set(Object.values(itemIdMap))];
        const stockMap: Record<string, number> = {};

        const BATCH_SIZE = 100;
        for (let i = 0; i < uniqueItemIds.length; i += BATCH_SIZE) {
            const batch = uniqueItemIds.slice(i, i + BATCH_SIZE);
            const refs = batch.map((id) => adminDb.collection("menuItems").doc(id));
            const docs = await adminDb.getAll(...refs);
            docs.forEach((d) => {
                if (d.exists) {
                    stockMap[d.id] = d.data()?.quantity ?? 0;
                }
            });
        }

        // ── 4. Build stock comparison ──
        const stockComparison = Object.entries(itemIdMap).map(([itemName, itemId]) => {
            const currentStock = stockMap[itemId] ?? 0;
            const totalWeeklyDemand = weeklyTotals[itemName] || 0;

            const dailyDemand: Record<string, number> = {};
            for (const day of ALL_DAYS) {
                const val = demandByDay[day][itemName];
                if (val) dailyDemand[day] = val;
            }

            const maxDailyDemand = Math.max(0, ...Object.values(dailyDemand));
            const shortageRisk = maxDailyDemand > currentStock;
            const suggestedMinStock = Math.ceil(maxDailyDemand * 1.2);

            return {
                itemId,
                itemName,
                currentStock,
                weeklyDemand: totalWeeklyDemand,
                maxDailyDemand,
                suggestedMinStock,
                shortageRisk,
                dailyDemand,
            };
        });

        // ── 5. Summary ──
        let highestDemandItem = "—";
        let highestDemandQty = 0;
        for (const [item, total] of Object.entries(weeklyTotals)) {
            if (total > highestDemandQty) {
                highestDemandQty = total;
                highestDemandItem = item;
            }
        }

        let mostDemandingDay = "—";
        let mostDemandingDayQty = 0;
        for (const day of ALL_DAYS) {
            const dayTotal = Object.values(demandByDay[day]).reduce((s, v) => s + v, 0);
            if (dayTotal > mostDemandingDayQty) {
                mostDemandingDayQty = dayTotal;
                mostDemandingDay = day;
            }
        }

        const itemsAtRisk = stockComparison.filter((s) => s.shortageRisk).length;

        // ── 6. Today & Tomorrow forecast ──
        const todayDay = getTodayDayName();
        const tomorrowDay = getTomorrowDayName();

        const todayForecast = demandByDay[todayDay] || {};
        const tomorrowForecast = demandByDay[tomorrowDay] || {};

        // ── 7. Purchase planning ──
        const purchasePlan = stockComparison
            .filter((s) => s.shortageRisk || s.currentStock < s.suggestedMinStock)
            .map((s) => ({
                itemName: s.itemName,
                currentStock: s.currentStock,
                requiredStock: s.suggestedMinStock,
                toBuy: Math.max(0, s.suggestedMinStock - s.currentStock),
                urgency: s.shortageRisk ? "high" : "medium",
            }))
            .sort((a, b) => b.toBuy - a.toBuy);

        // ── 8. Day chart data ──
        const dayChartData = ALL_DAYS.map((day) => ({
            day,
            total: Object.values(demandByDay[day]).reduce((s, v) => s + v, 0),
        }));

        const summary = {
            totalActiveUsers: activeUserIds.size,
            highestDemandItem,
            highestDemandQty,
            mostDemandingDay,
            mostDemandingDayQty,
            itemsAtRisk,
            todayDay,
            tomorrowDay,
        };

        console.log("[StockDashboard] Aggregation complete:", JSON.stringify(summary));

        return NextResponse.json({
            success: true,
            summary,
            todayForecast,
            tomorrowForecast,
            demandByDay,
            weeklyTotals,
            stockComparison,
            purchasePlan,
            dayChartData,
            liveDemandSummary,
            totalActiveDailyDemands: dailyDemandsSnap.size,
        });
    } catch (err) {
        console.error("[StockDashboard] Error:", err);
        return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
    }
}
