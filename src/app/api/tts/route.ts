// ZIVA AI TTS ROUTE - VERIFIED V3 - RECREATED FROM SCRATCH
import { NextRequest, NextResponse } from "next/server";
import { runTTS } from "@/lib/voiceRouter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || typeof text !== "string" || text.length > 500) {
            return NextResponse.json({ error: "Invalid text" }, { status: 400 });
        }

        const result = await runTTS(text);

        if (result.success && result.data) {
            return new NextResponse(result.data, {
                status: 200,
                headers: {
                    "Content-Type": "audio/mpeg",
                    "Cache-Control": "no-cache",
                    "X-Voice-Provider": result.provider,
                },
            });
        }

        return NextResponse.json({ 
            error: "TTS unavailable", 
            fallback: "browser" 
        }, { status: 503 });

    } catch (error) {
        console.error("[TTS] API error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
