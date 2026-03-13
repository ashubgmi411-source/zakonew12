/**
 * Next.js Instrumentation — Runs once when the server starts.
 *
 * Sets up node-cron jobs for background tasks on Railway deployment:
 * 1. Scheduled order execution — every minute
 * 2. Recurring auto-order execution — daily at midnight
 */

export async function register() {
    // Only run cron jobs on the server (Node.js runtime), not during build
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const cron = await import("node-cron");

        // Use localhost for internal cron calls to avoid DNS/SSL and self-reachability issues on Railway
        const PORT = process.env.PORT || 3000;
        const BASE_URL = `http://localhost:${PORT}`;

        const CRON_SECRET = process.env.CRON_SECRET || "";
        console.log(`[Cron] Internal BASE_URL: ${BASE_URL} (for internal API calls)`);

        // ── Scheduled Orders: Execute every minute ──────────────
        cron.default.schedule("* * * * *", async () => {
            const url = `${BASE_URL}/api/scheduled-order/execute`;
            try {
                const res = await fetch(url, {
                    headers: CRON_SECRET
                        ? { "x-cron-secret": CRON_SECRET }
                        : {},
                });
                
                if (!res.ok) {
                    const text = await res.text();
                    console.error(`[Cron] Scheduled order execution failed (HTTP ${res.status}):`, text);
                    return;
                }

                const data = await res.json();
                if (data.processed > 0) {
                    console.log(
                        `[Cron] Scheduled orders: ${data.processed} processed, results:`,
                        data.results
                    );
                }
            } catch (err) {
                console.error(`[Cron] Scheduled order execution failed for ${url}:`, err);
            }
        });

        // ── Auto Orders: Execute daily at midnight ──────────────
        cron.default.schedule("0 0 * * *", async () => {
            const url = `${BASE_URL}/api/auto-orders/execute`;
            try {
                const res = await fetch(url, {
                    headers: CRON_SECRET
                        ? { "x-cron-secret": CRON_SECRET }
                        : {},
                });

                if (!res.ok) {
                    const text = await res.text();
                    console.error(`[Cron] Auto order execution failed (HTTP ${res.status}):`, text);
                    return;
                }

                const data = await res.json();
                console.log("[Cron] Auto orders:", data);
            } catch (err) {
                console.error(`[Cron] Auto order execution failed for ${url}:`, err);
            }
        });

        // ── AI Cooking Plan: Execute daily at 2:00 AM ───────────
        cron.default.schedule("0 2 * * *", async () => {
            const url = `${BASE_URL}/api/ai/cooking-plan`;
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: CRON_SECRET
                        ? { "x-cron-secret": CRON_SECRET, "Content-Type": "application/json" }
                        : { "Content-Type": "application/json" },
                });

                if (!res.ok) {
                    const text = await res.text();
                    console.error(`[Cron] AI Cooking Plan execution failed (HTTP ${res.status}):`, text);
                    return;
                }

                const data = await res.json();
                console.log("[Cron] AI Cooking Plan Generated:", data.success ? "Success" : "Failed");
            } catch (err) {
                console.error(`[Cron] AI Cooking Plan execution failed for ${url}:`, err);
            }
        });

        console.log("[Cron] ✅ Scheduled order cron (every min) + Auto order cron (daily) + AI Plan cron (2AM) started");
    }
}
