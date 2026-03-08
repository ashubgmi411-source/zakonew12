/**
 * AI Insights Service — LLM-powered business intelligence for executives.
 *
 * Responsibilities:
 * 1. Aggregate analytics from Firestore (orders, menuItems, users, inventory)
 * 2. Build a structured prompt for the LLM
 * 3. Parse LLM response into UI-ready insights
 *
 * Uses chatWithFallback() for automatic multi-provider fallback.
 */

import { adminDb } from "@/lib/firebase-admin";
import { chatWithFallback } from "@/services/llmService";

// ─── Types ──────────────────────────────────────

export interface AnalyticsData {
    revenue_last_7_days: number;
    revenue_previous_7_days: number;
    orders_last_7_days: number;
    orders_previous_7_days: number;
    top_selling_items: Array<{ name: string; quantity: number }>;
    lowest_selling_items: Array<{ name: string; quantity: number }>;
    hourly_order_distribution: Record<number, number>;
    peak_hour: string;
    repeat_customer_rate: number;
    avg_order_value_this_week: number;
    avg_order_value_last_week: number;
    inventory_low_stock_items: Array<{ name: string; currentStock: number; reorderLevel: number; unit: string }>;
    wallet_pct: number;
    razorpay_pct: number;
}

export interface InsightItem {
    icon: string;
    text: string;
    type: "growth" | "warning" | "info" | "trend";
}

// ─── Cache ──────────────────────────────────────

let cachedInsights: InsightItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateInsightsCache(): void {
    cachedInsights = null;
    cacheTimestamp = 0;
}

export function getCachedInsights(): InsightItem[] | null {
    if (cachedInsights && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
        return cachedInsights;
    }
    return null;
}

function setCachedInsights(insights: InsightItem[]): void {
    cachedInsights = insights;
    cacheTimestamp = Date.now();
}

// ─── Step 1: Gather Analytics Data ──────────────

export async function gatherAnalyticsData(): Promise<AnalyticsData> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const weekAgoStr = weekAgo.toISOString();
    const twoWeeksAgoStr = twoWeeksAgo.toISOString();

    // ── Fetch orders from last 14 days ──
    const ordersSnap = await adminDb
        .collection("orders")
        .where("createdAt", ">=", twoWeeksAgoStr)
        .orderBy("createdAt", "desc")
        .get();

    const thisWeek = {
        total: 0, orders: 0, wallet: 0, razorpay: 0,
        items: {} as Record<string, number>,
        hours: {} as Record<number, number>,
        customers: new Set<string>(),
    };
    const lastWeek = {
        total: 0, orders: 0,
        items: {} as Record<string, number>,
        customers: new Set<string>(),
    };

    // Track all customers for repeat rate
    const allCustomerOrders: Record<string, number> = {};

    ordersSnap.forEach((doc) => {
        const o = doc.data();
        if (o.status === "cancelled") return;

        const createdAt = new Date(o.createdAt);
        const total = o.total || 0;
        const payMode = (o.paymentMode || "").toLowerCase();
        const isRazorpay = payMode.includes("razorpay") || payMode.includes("online");
        const customerId = o.userId || o.userEmail || "unknown";

        // Track repeat customers
        allCustomerOrders[customerId] = (allCustomerOrders[customerId] || 0) + 1;

        if (createdAt >= weekAgo) {
            thisWeek.total += total;
            thisWeek.orders++;
            thisWeek.customers.add(customerId);
            if (isRazorpay) thisWeek.razorpay += total;
            else thisWeek.wallet += total;

            const hour = createdAt.getHours();
            thisWeek.hours[hour] = (thisWeek.hours[hour] || 0) + 1;

            for (const item of (o.items || [])) {
                const name = item.name || "Unknown";
                thisWeek.items[name] = (thisWeek.items[name] || 0) + (item.quantity || 1);
            }
        } else {
            lastWeek.total += total;
            lastWeek.orders++;
            lastWeek.customers.add(customerId);

            for (const item of (o.items || [])) {
                const name = item.name || "Unknown";
                lastWeek.items[name] = (lastWeek.items[name] || 0) + (item.quantity || 1);
            }
        }
    });

    // ── Top / Lowest selling items ──
    const sortedItems = Object.entries(thisWeek.items)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity);

    const topSellingItems = sortedItems.slice(0, 5);
    const lowestSellingItems = sortedItems.length > 3
        ? sortedItems.slice(-3).reverse()
        : sortedItems.slice().reverse();

    // ── Peak hour ──
    let peakHour = "N/A";
    if (Object.keys(thisWeek.hours).length > 0) {
        const [peakH] = Object.entries(thisWeek.hours).sort(([, a], [, b]) => b - a)[0];
        const h = parseInt(peakH);
        peakHour = `${h.toString().padStart(2, "0")}:00 - ${(h + 1).toString().padStart(2, "0")}:00`;
    }

    // ── Repeat customer rate ──
    const totalUniqueCustomers = Object.keys(allCustomerOrders).length;
    const repeatCustomers = Object.values(allCustomerOrders).filter((c) => c > 1).length;
    const repeatRate = totalUniqueCustomers > 0
        ? Math.round((repeatCustomers / totalUniqueCustomers) * 100)
        : 0;

    // ── Avg order value ──
    const avgThis = thisWeek.orders > 0 ? Math.round(thisWeek.total / thisWeek.orders) : 0;
    const avgLast = lastWeek.orders > 0 ? Math.round(lastWeek.total / lastWeek.orders) : 0;

    // ── Payment split ──
    const walletPct = thisWeek.total > 0 ? Math.round((thisWeek.wallet / thisWeek.total) * 100) : 0;
    const razorpayPct = thisWeek.total > 0 ? 100 - walletPct : 0;

    // ── Inventory low stock items ──
    const inventorySnap = await adminDb
        .collection("inventory_items")
        .where("isDeleted", "!=", true)
        .get();

    const lowStockItems: AnalyticsData["inventory_low_stock_items"] = [];
    inventorySnap.forEach((doc) => {
        const d = doc.data();
        if (d.currentStock <= d.reorderLevel) {
            lowStockItems.push({
                name: d.name,
                currentStock: d.currentStock,
                reorderLevel: d.reorderLevel,
                unit: d.unit,
            });
        }
    });

    return {
        revenue_last_7_days: Math.round(thisWeek.total),
        revenue_previous_7_days: Math.round(lastWeek.total),
        orders_last_7_days: thisWeek.orders,
        orders_previous_7_days: lastWeek.orders,
        top_selling_items: topSellingItems,
        lowest_selling_items: lowestSellingItems,
        hourly_order_distribution: thisWeek.hours,
        peak_hour: peakHour,
        repeat_customer_rate: repeatRate,
        avg_order_value_this_week: avgThis,
        avg_order_value_last_week: avgLast,
        inventory_low_stock_items: lowStockItems,
        wallet_pct: walletPct,
        razorpay_pct: razorpayPct,
    };
}

// ─── Step 2: Build LLM Prompt ───────────────────

export function buildInsightsPrompt(data: AnalyticsData): string {
    return `You are a senior business analyst for a college canteen management system called "Zayko".
Analyze the following real-time business data and generate exactly 5-7 concise, actionable executive insights.

BUSINESS DATA:
- Revenue this week: ₹${data.revenue_last_7_days}
- Revenue last week: ₹${data.revenue_previous_7_days}
- Orders this week: ${data.orders_last_7_days}
- Orders last week: ${data.orders_previous_7_days}
- Avg order value this week: ₹${data.avg_order_value_this_week}
- Avg order value last week: ₹${data.avg_order_value_last_week}
- Top selling items: ${data.top_selling_items.map(i => `${i.name} (${i.quantity} units)`).join(", ") || "No data"}
- Lowest selling items: ${data.lowest_selling_items.map(i => `${i.name} (${i.quantity} units)`).join(", ") || "No data"}
- Peak order hour: ${data.peak_hour}
- Repeat customer rate: ${data.repeat_customer_rate}%
- Payment split: Wallet ${data.wallet_pct}% / Razorpay ${data.razorpay_pct}%
- Low stock items: ${data.inventory_low_stock_items.length > 0 ? data.inventory_low_stock_items.map(i => `${i.name} (${i.currentStock}/${i.reorderLevel} ${i.unit})`).join(", ") : "None"}

RULES:
1. Each insight must be 1 sentence, direct and data-driven.
2. Include specific numbers and percentages from the data.
3. Suggest actionable steps where relevant (e.g., "Consider a promotion", "Restock immediately").
4. Classify each insight by type: "growth" (positive), "warning" (negative/risk), "info" (neutral), "trend" (behavioral).
5. Assign an appropriate emoji icon to each.

Respond ONLY with a valid JSON array, no markdown, no extra text. Format:
[
  { "icon": "📈", "text": "...", "type": "growth" },
  { "icon": "⚠️", "text": "...", "type": "warning" }
]`;
}

// ─── Step 3: Generate Insights via LLM ──────────

export async function generateAIInsights(): Promise<{
    insights: InsightItem[];
    provider: string;
    cached: boolean;
}> {
    // Check cache first
    const cached = getCachedInsights();
    if (cached) {
        return { insights: cached, provider: "cache", cached: true };
    }

    // Gather data
    const analyticsData = await gatherAnalyticsData();

    // Build prompt
    const prompt = buildInsightsPrompt(analyticsData);

    // Call LLM
    const { response, provider } = await chatWithFallback(
        [{ role: "user", content: prompt }],
        "You are a business intelligence analyst. Respond only with valid JSON arrays. No markdown code fences."
    );

    // Parse LLM response
    const insights = parseLLMResponse(response);

    if (insights.length > 0) {
        setCachedInsights(insights);
        return { insights, provider, cached: false };
    }

    // If parsing failed, return fallback
    throw new Error(`LLM response could not be parsed into insights. Provider: ${provider}`);
}

// ─── Response Parser ────────────────────────────

function parseLLMResponse(response: string): InsightItem[] {
    try {
        // Try to extract JSON from the response (LLMs sometimes add markdown fences)
        let jsonStr = response.trim();

        // Remove markdown code fences if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Find the JSON array boundaries
        const startIdx = jsonStr.indexOf("[");
        const endIdx = jsonStr.lastIndexOf("]");
        if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        }

        const parsed = JSON.parse(jsonStr);

        if (!Array.isArray(parsed)) return [];

        // Validate and normalize each insight
        const validTypes = new Set(["growth", "warning", "info", "trend"]);
        return parsed
            .filter((item: Record<string, unknown>) =>
                item &&
                typeof item.text === "string" &&
                item.text.trim().length > 0
            )
            .map((item: Record<string, unknown>) => ({
                icon: typeof item.icon === "string" ? item.icon : "📊",
                text: (item.text as string).trim(),
                type: (validTypes.has(item.type as string) ? item.type : "info") as InsightItem["type"],
            }))
            .slice(0, 8); // Cap at 8 insights max
    } catch (err) {
        console.error("[AIInsights] Failed to parse LLM response:", err);
        return [];
    }
}

// ─── Algorithmic Fallback ───────────────────────

/**
 * Generate basic algorithmic insights as a fallback when all LLM providers fail.
 * This is the same logic that existed in the original route handler.
 */
export function generateAlgorithmicInsights(data: AnalyticsData): InsightItem[] {
    const insights: InsightItem[] = [];

    // Revenue trend
    if (data.revenue_previous_7_days > 0 && data.revenue_last_7_days > 0) {
        const pctChange = Math.round(
            ((data.revenue_last_7_days - data.revenue_previous_7_days) / data.revenue_previous_7_days) * 100
        );
        if (pctChange > 0) {
            insights.push({
                icon: "📈",
                text: `Revenue increased ${pctChange}% this week (₹${data.revenue_last_7_days.toLocaleString()} vs ₹${data.revenue_previous_7_days.toLocaleString()} last week).`,
                type: "growth",
            });
        } else if (pctChange < -5) {
            insights.push({
                icon: "📉",
                text: `Revenue decreased ${Math.abs(pctChange)}% this week. Consider promotions or menu updates.`,
                type: "warning",
            });
        }
    }

    // Order volume
    if (data.orders_previous_7_days > 0 && data.orders_last_7_days > 0) {
        const pctChange = Math.round(
            ((data.orders_last_7_days - data.orders_previous_7_days) / data.orders_previous_7_days) * 100
        );
        if (Math.abs(pctChange) >= 10) {
            insights.push({
                icon: pctChange > 0 ? "🚀" : "⚠️",
                text: `Order volume ${pctChange > 0 ? "up" : "down"} ${Math.abs(pctChange)}% (${data.orders_last_7_days} vs ${data.orders_previous_7_days} last week).`,
                type: pctChange > 0 ? "growth" : "warning",
            });
        }
    }

    // Top item
    if (data.top_selling_items.length > 0) {
        const top = data.top_selling_items[0];
        insights.push({
            icon: "🔥",
            text: `"${top.name}" is the most popular item this week with ${top.quantity} units ordered.`,
            type: "info",
        });
    }

    // Peak hour
    if (data.peak_hour !== "N/A") {
        insights.push({
            icon: "⏰",
            text: `Peak order time: ${data.peak_hour}.`,
            type: "info",
        });
    }

    // Low stock warning
    if (data.inventory_low_stock_items.length > 0) {
        const names = data.inventory_low_stock_items.slice(0, 3).map((i) => i.name).join(", ");
        insights.push({
            icon: "📦",
            text: `${data.inventory_low_stock_items.length} inventory items are low on stock: ${names}. Restock recommended.`,
            type: "warning",
        });
    }

    if (insights.length === 0) {
        insights.push({
            icon: "📊",
            text: "Not enough data to generate insights yet. More orders will unlock trend analysis.",
            type: "info",
        });
    }

    return insights;
}
