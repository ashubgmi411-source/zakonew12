/**
 * ttsService — Text-to-Speech service using Amazon Polly via API route.
 *
 * speak()        → Plays audio from the TTS API (Polly Aditi Hindi female)
 * stopSpeaking() → Stops any currently playing audio
 */

let currentAudio: HTMLAudioElement | null = null;

/**
 * Speak text using the server-side TTS API (Amazon Polly / fallback).
 * Falls back to browser SpeechSynthesis if the API fails.
 */
export async function speak(text: string): Promise<void> {
    if (!text || typeof window === "undefined") return;

    // Stop any currently playing audio
    stopSpeaking();

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
                const audio = new Audio(url);
                currentAudio = audio;

                return new Promise<void>((resolve) => {
                    audio.onended = () => {
                        URL.revokeObjectURL(url);
                        currentAudio = null;
                        resolve();
                    };
                    audio.onerror = () => {
                        URL.revokeObjectURL(url);
                        currentAudio = null;
                        // Fallback to browser
                        browserSpeak(text).then(resolve);
                    };
                    audio.play().catch(() => {
                        browserSpeak(text).then(resolve);
                    });
                });
            }
        } catch (err) {
            console.error("TTS API error:", err);
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
