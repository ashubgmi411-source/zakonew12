/**
 * /api/admin/inventory/logs — Stock history logs
 *
 * GET — Paginated stock logs, optionally filtered by itemId or type
 *
 * Protected by Admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getStockLogs } from "@/services/inventoryService";
import type { StockLogType } from "@/types/inventory";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const itemId = searchParams.get("itemId") || undefined;
        const type = searchParams.get("type") as StockLogType | null;
        const limit = Math.min(
            Number(searchParams.get("limit")) || 50,
            200
        );

        const logs = await getStockLogs({
            itemId,
            type: type || undefined,
            limit,
        });

        return NextResponse.json({ success: true, logs });
    } catch (err) {
        console.error("[Inventory] Logs error:", err);
        return NextResponse.json(
            { error: "Failed to fetch stock logs" },
            { status: 500 }
        );
    }
}
