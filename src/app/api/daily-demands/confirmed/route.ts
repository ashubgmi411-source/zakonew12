/**
 * GET /api/daily-demands/confirmed — Confirmed demand for stock manager
 *
 * Returns only status="confirmed" reservations, aggregated by item.
 * This is the ONLY demand the stock manager should act on.
 *
 * Query params:
 *   ?date=YYYY-MM-DD (optional, defaults to today)
 *
 * Returns: { success: true, items: ConfirmedDemandItem[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getConfirmedDemandForStockManager } from "@/services/dailyNeedsService";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
    // Auth: stock manager token OR admin token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const expectedStockToken = process.env.STOCK_MANAGER_TOKEN;

    const isAdmin = verifyAdmin(req);
    const isStockManager = expectedStockToken && token === expectedStockToken;

    if (!isAdmin && !isStockManager) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const date = req.nextUrl.searchParams.get("date") || undefined;
        const items = await getConfirmedDemandForStockManager(date);

        const totalQuantity = items.reduce((s, i) => s + i.totalQuantity, 0);

        return NextResponse.json({
            success: true,
            items,
            totalQuantity,
            itemCount: items.length,
        });
    } catch (err) {
        console.error("[ConfirmedDemand] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch confirmed demand" },
            { status: 500 }
        );
    }
}
