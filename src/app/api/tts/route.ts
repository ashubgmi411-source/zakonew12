/**
 * TTS API — Amazon Polly / ElevenLabs proxy
 *
 * Keeps API keys server-side. Returns audio/mpeg stream.
 * Provider chain: Polly -> ElevenLabs -> Fallback to client browser TTS
 */

import { NextRequest, NextResponse } from "next/server";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

export const runtime = "nodejs";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

const hasPollyCreds =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION;

let pollyClient: PollyClient | null = null;
if (hasPollyCreds) {
    pollyClient = new PollyClient({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || typeof text !== "string" || text.length > 500) {
            return NextResponse.json({ error: "Invalid text" }, { status: 400 });
        }

        // Try Polly first
        if (pollyClient) {
            try {
                const command = new SynthesizeSpeechCommand({
                    Engine: "neural",
                    LanguageCode: "hi-IN", // Hindi/English bilingual
                    VoiceId: "Aditi",
                    OutputFormat: "mp3",
                    Text: text,
                    TextType: "text",
                });

                const response = await pollyClient.send(command);

                if (response.AudioStream) {
                    const audioBuffer = Buffer.from(await response.AudioStream.transformToByteArray());
                    return new NextResponse(audioBuffer, {
                        status: 200,
                        headers: {
                            "Content-Type": "audio/mpeg",
                            "Cache-Control": "no-cache",
                        },
                    });
                }
            } catch (pollyError) {
                console.error("Polly TTS failed, falling back to ElevenLabs:", pollyError);
                // Fallthrough to ElevenLabs
            }
        }

        // Fallback to ElevenLabs
        if (ELEVENLABS_API_KEY) {
            try {
                const response = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "xi-api-key": ELEVENLABS_API_KEY,
                        },
                        body: JSON.stringify({
                            text,
                            model_id: "eleven_multilingual_v2",
                            voice_settings: {
                                stability: 0.5,
                                similarity_boost: 0.75,
                                style: 0.3,
                                use_speaker_boost: true,
                            },
                        }),
                    }
                );

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
                console.error("ElevenLabs error:", response.status, await response.text());
            } catch (elError) {
                console.error("ElevenLabs TTS error:", elError);
            }
        }

        return NextResponse.json({ error: "All TTS providers failed" }, { status: 503 });

    } catch (error) {
        console.error("TTS API error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
