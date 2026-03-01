/**
 * /api/admin/inventory/analytics — Inventory analytics
 *
 * GET — Returns:
 *   - Total inventory value
 *   - Most used ingredients (last 7 days)
 *   - Waste tracking
 *   - Purchase suggestions
 *
 * Protected by Admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getInventoryAnalytics } from "@/services/inventoryService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const analytics = await getInventoryAnalytics();
        return NextResponse.json({ success: true, analytics });
    } catch (err) {
        console.error("[Inventory] Analytics error:", err);
        return NextResponse.json(
            { error: "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
