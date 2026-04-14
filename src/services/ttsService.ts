/**
 * ttsService — Text-to-Speech service using Amazon Polly via API route.
 *
 * speak()        → Plays audio from the TTS API (Polly Kajal Hindi neural voice)
 * stopSpeaking() → Stops any currently playing audio
 * unlockAudio()  → Call on user tap to unlock mobile audio playback
 *
 * MOBILE FIX: Uses AudioContext + silent unlock pattern to bypass
 * mobile browser autoplay restrictions. Must call unlockAudio()
 * on the first user interaction (tap/click).
 */

let currentAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let audioContext: AudioContext | null = null;

/**
 * Unlock audio on mobile — call this on any user interaction (tap/click).
 * Mobile browsers require a user gesture to allow audio playback.
 */
export function unlockAudio(): void {
    if (audioUnlocked) return;

    try {
        // Create AudioContext on user gesture
        if (!audioContext) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) audioContext = new AudioCtx();
        }

        // Resume suspended AudioContext
        if (audioContext?.state === "suspended") {
            audioContext.resume();
        }

        // Play silent audio to unlock HTMLAudioElement on mobile
        const silentAudio = new Audio(
            "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwSHAAAAAAD/+1DEAAAA0AABpAAAABEAIACQAAABE6gBAAGQAAAQeJhB5+UBBwfB8H4nB8Hw+D4Pg+BAEAQcP/KAgGP/8oCAZ//5QEAx///lAQBAEAwAAFAAAAAAAAAAAA//tQxBcAAADSAAAAAAAAANIAAAAASZAAAQCAIAgCAYflAQBB//lAQDH//KAgCf/+UBAEAz///lAQBAMAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        );
        silentAudio.volume = 0.01;
        silentAudio.play().then(() => {
            silentAudio.pause();
            audioUnlocked = true;
            console.log("[TTS] Audio unlocked for mobile playback");
        }).catch(() => {
            // Still locked, will try again next interaction
        });
    } catch (e) {
        // Ignore errors
    }
}

/**
 * Speak text using the server-side TTS API (Amazon Polly / fallback).
 * Falls back to browser SpeechSynthesis if the API fails.
 */
export async function speak(text: string): Promise<void> {
    if (!text || typeof window === "undefined") return;

    // Stop any currently playing audio
    stopSpeaking();

    // Try to unlock if not yet done
    if (!audioUnlocked) unlockAudio();

    const provider = process.env.NEXT_PUBLIC_TTS_PROVIDER || "browser";

    if (provider !== "browser") {
        try {
            const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                return new Promise<void>((resolve) => {
                    const audio = new Audio(url);
                    audio.volume = 1.0;
                    currentAudio = audio;

                    audio.onended = () => {
                        URL.revokeObjectURL(url);
                        currentAudio = null;
                        resolve();
                    };
                    audio.onerror = (e) => {
                        console.error("[TTS] Audio playback error:", e);
                        URL.revokeObjectURL(url);
                        currentAudio = null;
                        // Fallback to browser TTS
                        browserSpeak(text).then(resolve);
                    };

                    // Mobile-safe play with fallback
                    const playPromise = audio.play();
                    if (playPromise) {
                        playPromise.catch((err) => {
                            console.warn("[TTS] Autoplay blocked, trying browser TTS:", err.message);
                            currentAudio = null;
                            URL.revokeObjectURL(url);
                            browserSpeak(text).then(resolve);
                        });
                    }
                });
            } else {
                console.error("[TTS] API returned:", res.status);
            }
        } catch (err) {
            console.error("[TTS] API error:", err);
        }
    }

    // Browser fallback
    return browserSpeak(text);
}

/**
 * Stop any currently playing TTS audio.
 */
export function stopSpeaking(): void {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
    }
}

/**
 * Browser SpeechSynthesis fallback.
 */
function browserSpeak(text: string): Promise<void> {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            resolve();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        utterance.lang = "hi-IN";

        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(
            (v) => v.lang.includes("in") || v.lang.includes("IN")
        );
        if (indianVoice) {
            utterance.voice = indianVoice;
            utterance.lang = indianVoice.lang;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}
