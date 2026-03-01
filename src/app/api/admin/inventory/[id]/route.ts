/**
 * /api/admin/inventory/[id] — Update / Delete inventory item
 *
 * PUT    — Update inventory item details (not stock — use stock-adjust for that)
 * DELETE — Soft-delete an inventory item
 *
 * Protected by Admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import {
    updateInventoryItem,
    deleteInventoryItem,
    getInventoryItem,
} from "@/services/inventoryService";

export const runtime = "nodejs";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await req.json();

        // Validate item exists
        const existing = await getInventoryItem(id);
        if (!existing) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        const allowedFields = ["name", "category", "unit", "reorderLevel", "supplierName", "costPerUnit"];
        const updates: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        await updateInventoryItem(id, updates as any);
        const updated = await getInventoryItem(id);

        return NextResponse.json({ success: true, item: updated });
    } catch (err) {
        console.error("[Inventory] PUT error:", err);
        return NextResponse.json(
            { error: "Failed to update inventory item" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        const existing = await getInventoryItem(id);
        if (!existing) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        await deleteInventoryItem(id);
        return NextResponse.json({ success: true, message: "Item deleted" });
    } catch (err) {
        console.error("[Inventory] DELETE error:", err);
        return NextResponse.json(
            { error: "Failed to delete inventory item" },
            { status: 500 }
        );
    }
}
