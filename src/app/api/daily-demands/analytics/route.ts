/**
 * GET /api/daily-demands/analytics — Reservation analytics for stock manager
 *
 * Returns: { success: true, analytics: ReservationAnalytics }
 */

import { NextRequest, NextResponse } from "next/server";
import { getReservationAnalytics } from "@/services/dailyNeedsService";
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
        const analytics = await getReservationAnalytics();

        return NextResponse.json({ success: true, analytics });
    } catch (err) {
        console.error("[ReservationAnalytics] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
