/**
 * TTS API — ElevenLabs / Amazon Polly with strict timeout
 *
 * Provider chain: ElevenLabs -> Polly -> 503
 * All providers have 4-second AbortController timeout.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_KEYS = (process.env.ELEVENLABS_KEYS || ELEVENLABS_API_KEY)
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel - friendly female

const hasPollyCreds =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION;

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || typeof text !== "string" || text.length > 500) {
            return NextResponse.json({ error: "Invalid text" }, { status: 400 });
        }

        // Try ElevenLabs with multi-key failover
        if (ELEVENLABS_KEYS.length > 0) {
            for (const key of ELEVENLABS_KEYS) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 4000);

                    const response = await fetch(
                        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "xi-api-key": key,
                            },
                            body: JSON.stringify({
                                text,
                                model_id: "eleven_multilingual_v2",
                                voice_settings: {
                                    stability: 0.5,
                                    similarity_boost: 0.75,
                                },
                            }),
                            signal: controller.signal,
                        }
                    );

                    clearTimeout(timeout);

                    if (response.ok) {
                        const audioBuffer = await response.arrayBuffer();
                        return new NextResponse(audioBuffer, {
                            status: 200,
                            headers: {
                                "Content-Type": "audio/mpeg",
                                "Cache-Control": "no-cache",
                            },
                        });
                    }

                    // If we got a 401 or 429, log and try next key
                    console.error(`[TTS] ElevenLabs key failure (${response.status}). Trying next key if available.`);
                } catch (elError: any) {
                    console.error("[TTS] ElevenLabs request failed:", elError.message);
                }
            }
        }

        // Fallback: Polly (with strict timeout)
        if (hasPollyCreds) {
            try {
                // Dynamic import to avoid loading SDK when not needed
                const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");

                const client = new PollyClient({
                    region: process.env.AWS_REGION,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                    },
                });

                const command = new SynthesizeSpeechCommand({
                    Engine: "standard",
                    LanguageCode: "hi-IN",
                    VoiceId: "Aditi",
                    OutputFormat: "mp3",
                    Text: text,
                    TextType: "text",
                });

                // Race against 4s timeout
                const pollyResult = await Promise.race([
                    client.send(command),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Polly timeout 4s")), 4000)
                    ),
                ]);

                if (pollyResult.AudioStream) {
                    const audioBuffer = Buffer.from(await pollyResult.AudioStream.transformToByteArray());
                    return new NextResponse(audioBuffer, {
                        status: 200,
                        headers: {
                            "Content-Type": "audio/mpeg",
                            "Cache-Control": "no-cache",
                        },
                    });
                }
            } catch (pollyError: any) {
                console.error("[TTS] Polly failed:", pollyError.message);
            }
        }

        // Return 503 — client will use browser SpeechSynthesis
        return NextResponse.json({ error: "TTS unavailable" }, { status: 503 });

    } catch (error) {
        console.error("[TTS] API error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
