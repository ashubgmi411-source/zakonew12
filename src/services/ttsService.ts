/**
 * ttsService — Text-to-Speech for mobile + desktop
 *
 * Uses Web Audio API (AudioContext) for mobile playback.
 * Falls back to browser SpeechSynthesis if API fails or times out.
 * Client-side timeout: 4 seconds — if API doesn't respond, use browser TTS.
 */

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioCtx();
    }
    return audioContext;
}

/**
 * Unlock audio on mobile — call from user gesture (tap/click).
 */
export function unlockAudio(): void {
    if (audioUnlocked) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") {
            ctx.resume().then(() => {
                audioUnlocked = true;
            });
        } else {
            audioUnlocked = true;
        }
        // Silent buffer trick for iOS
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
    } catch { /* ignore */ }
}

/**
 * Speak text — tries API first (4s timeout), then browser TTS.
 */
export async function speak(text: string): Promise<void> {
    if (!text || typeof window === "undefined") return;
    stopSpeaking();

    const provider = process.env.NEXT_PUBLIC_TTS_PROVIDER || "browser";

    if (provider !== "browser") {
        try {
            const ctx = getAudioContext();
            if (ctx.state === "suspended") await ctx.resume();

            // Fetch with 4s timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);

            const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

                return new Promise<void>((resolve) => {
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    currentSource = source;
                    source.onended = () => {
                        currentSource = null;
                        resolve();
                    };
                    source.start(0);
                });
            }
        } catch (err: any) {
            // Timeout, network error, or decode error — silently fall through
            console.warn("[TTS] API failed, using browser:", err.message);
        }
    }

    // Browser SpeechSynthesis fallback
    return browserSpeak(text);
}

/**
 * Stop current audio.
 */
export function stopSpeaking(): void {
    if (currentSource) {
        try { currentSource.stop(); } catch { /* already stopped */ }
        currentSource = null;
    }
    if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
    }
}

function browserSpeak(text: string): Promise<void> {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) { resolve(); return; }

        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 1.0;
        utt.pitch = 1.1;
        utt.lang = "hi-IN";

        const voices = window.speechSynthesis.getVoices();
        const hindiVoice = voices.find(v => v.lang.includes("hi") || v.lang.includes("IN"));
        if (hindiVoice) {
            utt.voice = hindiVoice;
            utt.lang = hindiVoice.lang;
        }

        utt.onend = () => resolve();
        utt.onerror = () => resolve();
        window.speechSynthesis.speak(utt);
    });
}
