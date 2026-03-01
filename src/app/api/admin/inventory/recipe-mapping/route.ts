/**
 * /api/admin/inventory/recipe-mapping — Menu Recipe Mappings
 *
 * GET  — List recipe mappings (optionally filtered by menuItemId)
 * POST — Set recipe mappings for a menu item (replaces existing)
 *
 * Protected by Admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import {
    getRecipeMappings,
    setRecipeMappings,
    deleteRecipeMapping,
} from "@/services/inventoryService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const menuItemId = searchParams.get("menuItemId") || undefined;

        const mappings = await getRecipeMappings(menuItemId);
        return NextResponse.json({ success: true, mappings });
    } catch (err) {
        console.error("[RecipeMapping] GET error:", err);
        return NextResponse.json(
            { error: "Failed to fetch recipe mappings" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { menuItemId, menuItemName, ingredients } = await req.json();

        if (!menuItemId) {
            return NextResponse.json({ error: "menuItemId is required" }, { status: 400 });
        }
        if (!menuItemName) {
            return NextResponse.json({ error: "menuItemName is required" }, { status: 400 });
        }
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: "ingredients array is required" },
                { status: 400 }
            );
        }

        // Validate each ingredient
        for (const ing of ingredients) {
            if (!ing.ingredientId || !ing.ingredientName || !ing.quantityRequired || !ing.unit) {
                return NextResponse.json(
                    { error: "Each ingredient needs: ingredientId, ingredientName, quantityRequired, unit" },
                    { status: 400 }
                );
            }
        }

        await setRecipeMappings(menuItemId, menuItemName, ingredients);

        return NextResponse.json({
            success: true,
            message: `Recipe mapping updated for ${menuItemName}`,
        });
    } catch (err) {
        console.error("[RecipeMapping] POST error:", err);
        return NextResponse.json(
            { error: "Failed to set recipe mappings" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const mappingId = searchParams.get("id");

        if (!mappingId) {
            return NextResponse.json({ error: "Mapping id is required" }, { status: 400 });
        }

        await deleteRecipeMapping(mappingId);
        return NextResponse.json({ success: true, message: "Mapping deleted" });
    } catch (err) {
        console.error("[RecipeMapping] DELETE error:", err);
        return NextResponse.json(
            { error: "Failed to delete mapping" },
            { status: 500 }
        );
    }
}
