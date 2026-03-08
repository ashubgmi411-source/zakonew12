/**
 * /api/executive/ai-insights — LLM-Powered Business Insights
 *
 * GET — Aggregates real business data from Firestore and uses
 * the AI Router (Gemini → Poe → Groq → Cohere) to generate
 * executive-grade insights. Results are cached for 10 minutes.
 *
 * Falls back to algorithmic insights if all LLM providers fail.
 *
 * Protected by Super Admin JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin-auth";
import {
    generateAIInsights,
    gatherAnalyticsData,
    generateAlgorithmicInsights,
} from "@/services/aiInsightsService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const admin = verifySuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Try LLM-powered insights first
        const result = await generateAIInsights();

        return NextResponse.json({
            success: true,
            insights: result.insights,
            provider: result.provider,
            cached: result.cached,
        });
    } catch (llmError) {
        console.warn("[Executive/AIInsights] LLM generation failed, falling back to algorithmic:", llmError);

        try {
            // Fallback: gather data and run algorithmic analysis
            const data = await gatherAnalyticsData();
            const insights = generateAlgorithmicInsights(data);

            return NextResponse.json({
                success: true,
                insights,
                provider: "algorithmic_fallback",
                cached: false,
            });
        } catch (fallbackError) {
            console.error("[Executive/AIInsights] Complete failure:", fallbackError);
            return NextResponse.json(
                { error: "Failed to generate insights" },
                { status: 500 }
            );
        }
    }
}
