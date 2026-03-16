/**
 * /api/stock/ai-demand — AI Demand Prediction API
 *
 * GET — Returns AI-powered demand predictions, waste insights,
 *       production plan, and inventory alerts.
 *
 * Protected by Stock Manager JWT verification.
 * Results cached for 6 hours.
 *
 * Query params:
 *   ?refresh=true — Force cache refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyStockManager } from "@/lib/stock-manager-auth";
import { getDemandPredictions } from "@/services/demandPredictionService";

export async function GET(req: NextRequest) {
    const manager = verifyStockManager(req);
    if (!manager) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
        const result = await getDemandPredictions(forceRefresh);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error("[AI-Demand API] Error:", err);
        return NextResponse.json(
            { error: "Failed to generate demand predictions" },
            { status: 500 }
        );
    }
}
