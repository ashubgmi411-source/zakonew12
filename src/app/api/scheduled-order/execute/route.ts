/**
 * GET /api/scheduled-order/execute — Cron-triggered scheduled order execution
 *
 * Called every minute by the internal cron OR an external cron service.
 * Delegates to the shared executeScheduledOrders() service function.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeScheduledOrders } from "@/services/scheduledOrderExecutor";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    // Optional: verify CRON_SECRET for security
    const cronSecret = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await executeScheduledOrders();
        return NextResponse.json(result);
    } catch (error) {
        console.error("[ScheduledOrder] Execution sweep failed:", error);
        return NextResponse.json({ error: "Execution failed" }, { status: 500 });
    }
}
