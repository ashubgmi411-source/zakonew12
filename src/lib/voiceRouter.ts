/**
 * Voice Router — Centralized failover and provider selection for ASR and TTS.
 * 
 * Logic:
 * - ASR: NVIDIA Parakeet -> Browser SpeechRecognition Fallback
 * - TTS: NVIDIA Magpie -> ElevenLabs -> AWS Polly -> Browser Synthesis Fallback
 */

export interface VoiceResponse<T> {
    success: boolean;
    provider: string;
    data: T;
    error?: string;
}

// ──────────────────────────────────────────────────
// Circuit Breaker State
// ──────────────────────────────────────────────────
const failures = new Map<string, number>();
const MAX_FAILURES = 2; // Reduced for faster failover in voice

function recordFailure(provider: string) {
    const count = (failures.get(provider) || 0) + 1;
    failures.set(provider, count);
    console.warn(`[VoiceRouter] Provider ${provider} failure count: ${count}`);
}

function recordSuccess(provider: string) {
    failures.set(provider, 0);
}

function isHealthy(provider: string) {
    return (failures.get(provider) || 0) < MAX_FAILURES;
}

// ──────────────────────────────────────────────────
// TTS Providers
// ──────────────────────────────────────────────────

export async function runTTS(text: string): Promise<VoiceResponse<ArrayBuffer | null>> {
    // 1. Try NVIDIA Magpie (Primary)
    const nvKey = process.env.NVIDIA_TTS_KEY;
    if (nvKey && isHealthy("nvidia-magpie")) {
        try {
            const res = await fetch("https://ai.api.nvidia.com/v1/audio/nvidia/magpie-tts-multilingual", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nvKey}`,
                },
                body: JSON.stringify({ 
                    text,
                    language: "hi-IN", // Default to Hindi-Indian context for Zayko
                }),
            });

            if (res.ok) {
                recordSuccess("nvidia-magpie");
                return { success: true, provider: "nvidia-magpie", data: await res.arrayBuffer() };
            }
            throw new Error(`NVIDIA status ${res.status}`);
        } catch (e) {
            console.error("[VoiceRouter] NVIDIA TTS failed:", e);
            recordFailure("nvidia-magpie");
        }
    }

    // 2. ElevenLabs (Secondary)
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (elKey && isHealthy("elevenlabs")) {
        try {
            const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Friendly female
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "xi-api-key": elKey },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                }),
            });

            if (res.ok) {
                recordSuccess("elevenlabs");
                return { success: true, provider: "elevenlabs", data: await res.arrayBuffer() };
            }
            throw new Error(`ElevenLabs status ${res.status}`);
        } catch (e) {
            console.error("[VoiceRouter] ElevenLabs failed:", e);
            recordFailure("elevenlabs");
        }
    }

    // 3. AWS Polly (Tertiary)
    const hasPolly = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
    if (hasPolly && isHealthy("aws-polly")) {
        try {
            const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
            const client = new PollyClient({ region: process.env.AWS_REGION });
            const command = new SynthesizeSpeechCommand({
                Engine: "standard",
                LanguageCode: "hi-IN",
                VoiceId: "Aditi",
                OutputFormat: "mp3",
                Text: text,
            });
            const result = await client.send(command);
            if (result.AudioStream) {
                recordSuccess("aws-polly");
                const buffer = Buffer.from(await result.AudioStream.transformToByteArray());
                return { success: true, provider: "aws-polly", data: buffer.buffer };
            }
        } catch (e) {
            console.error("[VoiceRouter] AWS Polly failed:", e);
            recordFailure("aws-polly");
        }
    }

    return { success: false, provider: "none", data: null, error: "All TTS providers exhausted" };
}

// ──────────────────────────────────────────────────
// ASR Providers
// ──────────────────────────────────────────────────

export async function runASR(audioBlob: Blob): Promise<VoiceResponse<string>> {
    const nvKey = process.env.NVIDIA_ASR_KEY;
    
    if (nvKey && isHealthy("nvidia-parakeet")) {
        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "input.webm");

            const res = await fetch("https://ai.api.nvidia.com/v1/audio/nvidia/parakeet-ctc-0.6b-asr", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${nvKey}`,
                    "Accept": "application/json",
                },
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                recordSuccess("nvidia-parakeet");
                return { success: true, provider: "nvidia-parakeet", data: data.text || "" };
            }
            throw new Error(`NVIDIA ASR status ${res.status}`);
        } catch (e) {
            console.error("[VoiceRouter] NVIDIA ASR failed:", e);
            recordFailure("nvidia-parakeet");
        }
    }

    return { success: false, provider: "none", data: "", error: "NVIDIA ASR unavailable" };
}
