/**
 * Demand Prediction Service — AI-powered demand forecasting for Stock Manager
 *
 * Features:
 * - Fetches last 7 and 30 day order history from Firestore
 * - Aggregates per-item quantities and day-of-week patterns
 * - Calls LLM via chatWithFallback() for AI predictions
 * - 6-hour in-memory cache to minimize API/Firestore calls
 * - Inventory cross-check for stock shortage alerts
 */

import { adminDb } from "@/lib/firebase-admin";
import { chatWithFallback } from "@/lib/llm";

// ─── Types ────────────────────────────────────────

export interface PredictionItem {
    itemName: string;
    predictedQuantity: number;
    confidence: number;
    trend: "up" | "down" | "stable";
    avgDaily7: number;
    avgDaily30: number;
}

export interface WasteInsight {
    message: string;
    type: "increase" | "decrease" | "pattern" | "warning";
    itemName?: string;
}

export interface ProductionSlot {
    slot: string;
    items: { itemName: string; quantity: number }[];
}

export interface InventoryAlert {
    itemName: string;
    predictedDemand: number;
    currentStock: number;
    status: "ok" | "low" | "critical";
    deficit: number;
}

export interface DemandPredictionResult {
    predictions: PredictionItem[];
    insights: WasteInsight[];
    productionPlan: ProductionSlot[];
    inventoryAlerts: InventoryAlert[];
    todaySales: { itemName: string; quantity: number }[];
    dailyTrend: { date: string; total: number }[];
    weeklyPattern: { day: string; total: number }[];
    generatedAt: string;
    aiProvider: string;
}

// ─── Cache ────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cachedResult: DemandPredictionResult | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
    return cachedResult !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ─── Helpers ──────────────────────────────────────

function getDateNDaysAgo(n: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}

function getDayName(date: Date): string {
    return date.toLocaleDateString("en-US", { weekday: "long" });
}

function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
}

// ─── Core Functions ───────────────────────────────

async function fetchOrderHistory(days: number) {
    const since = getDateNDaysAgo(days);
    const snap = await adminDb
        .collection("orders")
        .where("createdAt", ">=", since.toISOString())
        .orderBy("createdAt", "desc")
        .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
}

async function fetchInventoryItems() {
    const snap = await adminDb.collection("inventory_items").get();
    return snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        currentStock: doc.data().currentStock || 0,
        unit: doc.data().unit || "pieces",
        reorderLevel: doc.data().reorderLevel || 0,
    }));
}

function aggregateOrders(orders: any[]) {
    const itemTotals: Record<string, number> = {};
    const dailyTotals: Record<string, number> = {};
    const dayOfWeekTotals: Record<string, number> = {};
    const itemDayOfWeek: Record<string, Record<string, number>> = {};

    for (const order of orders) {
        const items = order.items || [];
        const orderDate = order.createdAt
            ? formatDate(new Date(order.createdAt))
            : formatDate(new Date());
        const dayName = order.createdAt
            ? getDayName(new Date(order.createdAt))
            : getDayName(new Date());

        for (const item of items) {
            const name = item.name || item.itemName || "Unknown";
            const qty = item.quantity || 1;

            itemTotals[name] = (itemTotals[name] || 0) + qty;
            dailyTotals[orderDate] = (dailyTotals[orderDate] || 0) + qty;
            dayOfWeekTotals[dayName] = (dayOfWeekTotals[dayName] || 0) + qty;

            if (!itemDayOfWeek[name]) itemDayOfWeek[name] = {};
            itemDayOfWeek[name][dayName] = (itemDayOfWeek[name][dayName] || 0) + qty;
        }
    }

    return { itemTotals, dailyTotals, dayOfWeekTotals, itemDayOfWeek };
}

function buildTodaySales(orders: any[]): { itemName: string; quantity: number }[] {
    const today = formatDate(new Date());
    const todayOrders = orders.filter((o) => {
        if (!o.createdAt) return false;
        return formatDate(new Date(o.createdAt)) === today;
    });

    const sales: Record<string, number> = {};
    for (const order of todayOrders) {
        for (const item of order.items || []) {
            const name = item.name || item.itemName || "Unknown";
            sales[name] = (sales[name] || 0) + (item.quantity || 1);
        }
    }

    return Object.entries(sales)
        .map(([itemName, quantity]) => ({ itemName, quantity }))
        .sort((a, b) => b.quantity - a.quantity);
}

// ─── AI Prediction ────────────────────────────────

async function callAIForPredictions(
    agg7: ReturnType<typeof aggregateOrders>,
    agg30: ReturnType<typeof aggregateOrders>,
    tomorrowDay: string
): Promise<{ predictions: PredictionItem[]; insights: WasteInsight[]; productionPlan: ProductionSlot[]; provider: string }> {
    const top20Items7 = Object.entries(agg7.itemTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);

    const top20Items30 = Object.entries(agg30.itemTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);

    const prompt = `You are a demand prediction AI for a college canteen.

HISTORICAL DATA (last 7 days):
${top20Items7.map(([name, qty]) => `- ${name}: ${qty} sold (avg ${(qty / 7).toFixed(1)}/day)`).join("\n")}

Day-of-week pattern (7 days):
${Object.entries(agg7.dayOfWeekTotals).map(([day, qty]) => `- ${day}: ${qty} total`).join("\n")}

HISTORICAL DATA (last 30 days):
${top20Items30.map(([name, qty]) => `- ${name}: ${qty} sold (avg ${(qty / 30).toFixed(1)}/day)`).join("\n")}

Tomorrow is ${tomorrowDay}.

Respond ONLY in valid JSON format. No markdown, no explanation, JUST the JSON object:
{
  "predictions": [
    { "itemName": "string", "predictedQuantity": number, "confidence": number (0-100), "trend": "up"|"down"|"stable" }
  ],
  "insights": [
    { "message": "string", "type": "increase"|"decrease"|"pattern"|"warning", "itemName": "string or null" }
  ],
  "productionPlan": [
    { "slot": "Morning Preparation (before 10 AM)", "items": [{ "itemName": "string", "quantity": number }] },
    { "slot": "Lunch Preparation (10 AM - 12 PM)", "items": [{ "itemName": "string", "quantity": number }] }
  ]
}

RULES:
- predictions: Include TOP 15 items by predicted demand. Use day-of-week patterns to adjust for ${tomorrowDay}.
- confidence: 70-95% for items with consistent data, 40-70% for volatile items.
- insights: 3-5 actionable food waste reduction insights.
- productionPlan: Split preparation by morning (snacks, breakfast) and lunch (main course, heavy items).
- Predict quantities as whole numbers.`;

    const systemPrompt = "You are a demand prediction AI. You analyze canteen order data and predict tomorrow's demand. Always respond with ONLY valid JSON. No markdown.";

    try {
        const { response, provider } = await chatWithFallback(
            [{ role: "user", content: prompt }],
            systemPrompt
        );

        // Parse the JSON response
        let cleanResponse = response.trim();
        // Remove markdown code blocks if present
        if (cleanResponse.startsWith("```")) {
            cleanResponse = cleanResponse.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const parsed = JSON.parse(cleanResponse);

        return {
            predictions: (parsed.predictions || []).map((p: any) => ({
                itemName: p.itemName || "Unknown",
                predictedQuantity: Math.round(p.predictedQuantity || 0),
                confidence: Math.min(100, Math.max(0, p.confidence || 50)),
                trend: ["up", "down", "stable"].includes(p.trend) ? p.trend : "stable",
                avgDaily7: 0,
                avgDaily30: 0,
            })),
            insights: (parsed.insights || []).map((i: any) => ({
                message: i.message || "",
                type: ["increase", "decrease", "pattern", "warning"].includes(i.type) ? i.type : "pattern",
                itemName: i.itemName || undefined,
            })),
            productionPlan: (parsed.productionPlan || []).map((s: any) => ({
                slot: s.slot || "Preparation",
                items: (s.items || []).map((it: any) => ({
                    itemName: it.itemName || "Unknown",
                    quantity: Math.round(it.quantity || 0),
                })),
            })),
            provider,
        };
    } catch (err) {
        console.error("[DemandPrediction] AI parsing failed:", err);
        // Return fallback statistical predictions
        return buildFallbackPredictions(agg7, agg30, tomorrowDay);
    }
}

function buildFallbackPredictions(
    agg7: ReturnType<typeof aggregateOrders>,
    agg30: ReturnType<typeof aggregateOrders>,
    tomorrowDay: string
) {
    const predictions: PredictionItem[] = Object.entries(agg7.itemTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([itemName, qty7]) => {
            const qty30 = agg30.itemTotals[itemName] || 0;
            const avgDaily7 = qty7 / 7;
            const avgDaily30 = qty30 / 30;
            const dayFactor = (agg7.itemDayOfWeek[itemName]?.[tomorrowDay] || avgDaily7) / Math.max(avgDaily7, 1);

            return {
                itemName,
                predictedQuantity: Math.round(avgDaily7 * dayFactor * 1.1),
                confidence: Math.min(85, Math.round(50 + (qty7 / Math.max(qty30 / 4, 1)) * 10)),
                trend: avgDaily7 > avgDaily30 * 1.1 ? "up" as const : avgDaily7 < avgDaily30 * 0.9 ? "down" as const : "stable" as const,
                avgDaily7: Math.round(avgDaily7 * 10) / 10,
                avgDaily30: Math.round(avgDaily30 * 10) / 10,
            };
        });

    return {
        predictions,
        insights: [{ message: "AI service unavailable — showing statistical predictions based on 7-day averages.", type: "warning" as const }],
        productionPlan: [
            { slot: "Morning Preparation", items: predictions.slice(0, 5).map((p) => ({ itemName: p.itemName, quantity: Math.round(p.predictedQuantity * 0.4) })) },
            { slot: "Lunch Preparation", items: predictions.slice(0, 5).map((p) => ({ itemName: p.itemName, quantity: Math.round(p.predictedQuantity * 0.6) })) },
        ],
        provider: "statistical-fallback",
    };
}

// ─── Inventory Cross-Check ────────────────────────

async function crossCheckInventory(predictions: PredictionItem[]): Promise<InventoryAlert[]> {
    const inventoryItems = await fetchInventoryItems();
    const inventoryMap = new Map(inventoryItems.map((i) => [i.name.toLowerCase(), i]));

    return predictions.map((pred) => {
        const inv = inventoryMap.get(pred.itemName.toLowerCase());
        const currentStock = inv?.currentStock || 0;
        const deficit = Math.max(0, pred.predictedQuantity - currentStock);
        let status: "ok" | "low" | "critical" = "ok";
        if (deficit > 0 && currentStock <= 0) status = "critical";
        else if (deficit > 0) status = "low";

        return {
            itemName: pred.itemName,
            predictedDemand: pred.predictedQuantity,
            currentStock,
            status,
            deficit,
        };
    }).sort((a, b) => {
        const statusOrder = { critical: 0, low: 1, ok: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
    });
}

// ─── Main Export ──────────────────────────────────

export async function getDemandPredictions(forceRefresh = false): Promise<DemandPredictionResult> {
    if (!forceRefresh && isCacheValid()) {
        return cachedResult!;
    }

    console.log("[DemandPrediction] Generating fresh predictions...");

    // Fetch order history
    const [orders7, orders30] = await Promise.all([
        fetchOrderHistory(7),
        fetchOrderHistory(30),
    ]);

    // Aggregate
    const agg7 = aggregateOrders(orders7);
    const agg30 = aggregateOrders(orders30);

    // Tomorrow's day name
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = getDayName(tomorrow);

    // Today's sales
    const todaySales = buildTodaySales(orders7);

    // Daily trend (last 7 days)
    const dailyTrend: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = getDateNDaysAgo(i);
        const dateStr = formatDate(d);
        dailyTrend.push({
            date: dateStr,
            total: agg7.dailyTotals[dateStr] || 0,
        });
    }

    // Weekly pattern
    const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const weeklyPattern = weekDays.map((day) => ({
        day: day.slice(0, 3),
        total: agg30.dayOfWeekTotals[day] || 0,
    }));

    // AI predictions
    const { predictions, insights, productionPlan, provider } = await callAIForPredictions(agg7, agg30, tomorrowDay);

    // Enrich predictions with averages
    const enrichedPredictions = predictions.map((p) => ({
        ...p,
        avgDaily7: Math.round(((agg7.itemTotals[p.itemName] || 0) / 7) * 10) / 10,
        avgDaily30: Math.round(((agg30.itemTotals[p.itemName] || 0) / 30) * 10) / 10,
    }));

    // Inventory cross-check
    const inventoryAlerts = await crossCheckInventory(enrichedPredictions);

    const result: DemandPredictionResult = {
        predictions: enrichedPredictions,
        insights,
        productionPlan,
        inventoryAlerts,
        todaySales,
        dailyTrend,
        weeklyPattern,
        generatedAt: new Date().toISOString(),
        aiProvider: provider,
    };

    // Cache the result
    cachedResult = result;
    cacheTimestamp = Date.now();
    console.log(`[DemandPrediction] Predictions cached. Provider: ${provider}. Items: ${predictions.length}`);

    return result;
}
