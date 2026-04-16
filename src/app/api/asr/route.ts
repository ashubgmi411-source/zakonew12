import { NextRequest, NextResponse } from "next/server";
import { runASR } from "@/lib/voiceRouter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as Blob;

        if (!audioFile) {
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        const result = await runASR(audioFile);

        if (result.success) {
            return NextResponse.json({ 
                text: result.data, 
                provider: result.provider 
            });
        }

        return NextResponse.json({ 
            error: result.error || "ASR failed", 
            fallback: "browser" 
        }, { status: 503 });

    } catch (error) {
        console.error("[ASR] API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
