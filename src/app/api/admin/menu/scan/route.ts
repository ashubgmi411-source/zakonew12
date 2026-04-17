import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { runVisionAI } from "@/lib/aiRouter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { image, mimeType } = await req.json();

        if (!image) {
            return NextResponse.json({ error: "Image data is required" }, { status: 400 });
        }

        // Base64 cleanup
        const base64Data = image.includes(",") ? image.split(",")[1] : image;

        const prompt = `Extract food and drink items from this canteen menu image.
        For each item, identify:
        - name: The name of the dish
        - price: The cost as a number (omit currency symbols)
        - category: One of [Beverages, Snacks, Main Course, Fast Food, Desserts]
        - description: A short 1-sentence description if available
        - preparationTime: Estimated minutes (number, default to 15 if unknown)

        Return ONLY a valid JSON array of objects. Example: 
        [{"name": "Samosa", "price": 10, "category": "Snacks", "description": "Crispy fried snack", "preparationTime": 5}]
        No markdown, no plain text.`;

        console.log("[MenuScan] Calling Vision AI for OCR + Structuring...");
        const result = await runVisionAI(base64Data, mimeType || "image/jpeg", prompt);

        if (!result.success) {
            return NextResponse.json({ error: result.error || "AI processing failed" }, { status: 500 });
        }

        // Clean up AI output (occasionally models wrap JSON in markdown)
        let cleanText = result.data.trim();
        if (cleanText.startsWith("```json")) {
            cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
        } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/```/g, "").trim();
        }

        // Extract JSON if there's surrounding text
        const start = cleanText.indexOf("[");
        const end = cleanText.lastIndexOf("]");
        if (start !== -1 && end > start) {
            cleanText = cleanText.substring(start, end + 1);
        }

        try {
            const items = JSON.parse(cleanText);
            return NextResponse.json({ 
                success: true, 
                items,
                provider: result.provider 
            });
        } catch (parseErr) {
            console.error("[MenuScan] Raw response failed to parse:", result.data);
            return NextResponse.json({ 
                error: "Failed to parse menu items from AI response",
                raw: result.data 
            }, { status: 500 });
        }

    } catch (error) {
        console.error("[MenuScan] Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
