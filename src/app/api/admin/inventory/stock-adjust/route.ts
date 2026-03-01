/**
 * /api/admin/inventory/stock-adjust — Manual stock adjustment
 *
 * POST — Add, Deduct, or record Waste for an inventory item
 *        Uses Firestore transactions to prevent race conditions.
 *
 * Protected by Admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { adjustStock } from "@/services/inventoryService";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { itemId, type, quantity, reason } = await req.json();

        // Validation
        if (!itemId) {
            return NextResponse.json({ error: "itemId is required" }, { status: 400 });
        }
        if (!["ADD", "DEDUCT", "WASTE"].includes(type)) {
            return NextResponse.json(
                { error: "type must be ADD, DEDUCT, or WASTE" },
                { status: 400 }
            );
        }
        if (!quantity || quantity <= 0) {
            return NextResponse.json(
                { error: "quantity must be a positive number" },
                { status: 400 }
            );
        }
        if (!reason?.trim()) {
            return NextResponse.json({ error: "reason is required" }, { status: 400 });
        }

        const result = await adjustStock(
            { itemId, type, quantity: Number(quantity), reason: reason.trim() },
            admin.username
        );

        return NextResponse.json({
            success: true,
            newStock: result.newStock,
            message: `Stock ${type === "ADD" ? "added" : "deducted"} successfully`,
        });
    } catch (err) {
        console.error("[Inventory] Stock adjust error:", err);
        const message = err instanceof Error ? err.message : "Failed to adjust stock";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
