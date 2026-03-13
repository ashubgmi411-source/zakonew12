/**
 * Next.js Instrumentation — Runs once when the server starts.
 *
 * Sets up node-cron jobs for background tasks on Railway deployment:
 * 1. Scheduled order execution — every minute (DIRECT call, no HTTP)
 * 2. Recurring auto-order execution — daily at midnight
 * 3. AI Cooking Plan generation — daily at 2 AM
 *
 * NOTE: Cron #1 calls the executor directly to avoid ECONNREFUSED on Railway.
 * Crons #2 and #3 still use HTTP but with a localhost fallback.
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const cron = await import("node-cron");

        // ── Scheduled Orders: Execute every minute (DIRECT — no HTTP) ──
        cron.default.schedule("* * * * *", async () => {
            try {
                const { executeScheduledOrders } = await import(
                    "@/services/scheduledOrderExecutor"
                );
                const result = await executeScheduledOrders();
                if (result.processed > 0) {
                    console.log(
                        `[Cron] Scheduled orders: ${result.processed} processed, results:`,
                        result.results
                    );
                }
            } catch (err) {
                console.error("[Cron] Scheduled order execution failed:", err);
            }
        });

        // For HTTP-based crons, use internal localhost
        const PORT = process.env.PORT || 3000;
        const BASE_URL = `http://localhost:${PORT}`;
        const CRON_SECRET = process.env.CRON_SECRET || "";

        // ── Auto Orders: Execute daily at midnight ──────────────
        cron.default.schedule("0 0 * * *", async () => {
            try {
                const res = await fetch(`${BASE_URL}/api/auto-orders/execute`, {
                    headers: CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log("[Cron] Auto orders:", data);
                } else {
                    console.error(`[Cron] Auto orders failed (HTTP ${res.status})`);
                }
            } catch (err) {
                console.error("[Cron] Auto order execution failed:", err);
            }
        });

        // ── AI Cooking Plan: Execute daily at 2:00 AM ───────────
        cron.default.schedule("0 2 * * *", async () => {
            try {
                const res = await fetch(`${BASE_URL}/api/ai/cooking-plan`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {}),
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log("[Cron] AI Cooking Plan:", data.success ? "✅ Success" : "❌ Failed");
                } else {
                    console.error(`[Cron] AI Cooking Plan failed (HTTP ${res.status})`);
                }
            } catch (err) {
                console.error("[Cron] AI Cooking Plan execution failed:", err);
            }
        });

        console.log("[Cron] ✅ Scheduled order cron (every min, direct) + Auto order cron (daily) + AI Plan cron (2AM) started");
    }
}
