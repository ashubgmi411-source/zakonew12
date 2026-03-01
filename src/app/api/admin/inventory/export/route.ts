/**
 * /api/admin/inventory/export — CSV export
 *
 * GET — Download inventory data as CSV file
 *
 * Protected by Admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getInventoryCSVData } from "@/services/inventoryService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const csv = await getInventoryCSVData();

        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="zayko_inventory_${new Date().toISOString().split("T")[0]}.csv"`,
            },
        });
    } catch (err) {
        console.error("[Inventory] Export error:", err);
        return NextResponse.json(
            { error: "Failed to export inventory" },
            { status: 500 }
        );
    }
}
