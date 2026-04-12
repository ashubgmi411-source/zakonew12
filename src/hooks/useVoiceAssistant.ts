"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseVoiceAssistantProps {
    onFinalTranscript?: (text: string) => void;
}

interface UseVoiceAssistantReturn {
    isListening: boolean;
    isSpeaking: boolean;
    isProcessing: boolean;
    transcript: string;
    interimTranscript: string;
    lastResponse: string;
    startListening: () => void;
    stopListening: () => void;
    speak: (text: string) => Promise<void>;
    cancelSpeech: () => void;
}

// ── Browser type augmentation ──
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

// ── Helper: get a female voice from browser synthesis ──
function getFemaleVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis?.getVoices() || [];

    // First priority: Indian Hindi/English female voices
    const indianPreferred = voices.filter(v =>
        (v.lang.includes("in") || v.lang.includes("IN")) &&
        (v.name.includes("Female") || v.name.includes("Google हिन्दी") || v.name.includes("Neerja") || v.name.includes("Heera"))
    );
    if (indianPreferred.length > 0) return indianPreferred[0];

    // Second priority: Any Indian voice
    const indianAny = voices.find(v => v.lang.includes("in") || v.lang.includes("IN"));
    if (indianAny) return indianAny;

    // Third priority: Google UK / US Female
    const preferred = [
        "Google UK English Female",
        "Google US English",
        "Microsoft Zira",
        "Samantha",
    ];
    for (const name of preferred) {
        const v = voices.find((v) => v.name.includes(name));
        if (v) return v;
    }

    return voices[0] || null;
}

// ── Hook ──
export function useVoiceAssistant({ onFinalTranscript }: UseVoiceAssistantProps = {}): UseVoiceAssistantReturn {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [lastResponse, setLastResponse] = useState("");

    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ── Initialize recognition ──
    useEffect(() => {
        if (typeof window === "undefined") return;

        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true; // Enable interim results
        recognition.lang = "hi-IN"; // Hindi + English (Hinglish)
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalStr = "";
            let interimStr = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalStr += event.results[i][0].transcript;
                } else {
                    interimStr += event.results[i][0].transcript;
                }
            }

            if (interimStr) {
                setInterimTranscript(interimStr);
            }

            if (finalStr) {
                setTranscript(finalStr);
                setInterimTranscript("");
                setIsListening(false);
                if (onFinalTranscript) {
                    onFinalTranscript(finalStr);
                }
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // Ignore common abort/network errors from throwing dev overlay
            if (event.error !== "aborted" && event.error !== "network") {
                console.warn("Speech recognition error:", event.error);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    // ── Load voices when available ──
    useEffect(() => {
        if (typeof window === "undefined") return;
        // Chrome loads voices async
        window.speechSynthesis?.addEventListener?.("voiceschanged", () => { });
    }, []);

    // ── Start listening ──
    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            console.warn("SpeechRecognition not supported");
            return;
        }
        // Cancel any ongoing speech
        window.speechSynthesis?.cancel();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        setTranscript("");
        setInterimTranscript("");
        setIsListening(true);
        try {
            recognitionRef.current.start();
        } catch (e) {
            // Already started
            console.warn("Recognition already active:", e);
        }
    }, []);

    // ── Stop listening ──
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    }, []);

    // ── Speak using Polly (API) or Browser TTS fallback ──
    const speak = useCallback(async (text: string) => {
        if (!text) return;

        setIsSpeaking(true);
        setLastResponse(text);
        window.speechSynthesis?.cancel();
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const provider = process.env.NEXT_PUBLIC_TTS_PROVIDER || "browser";

        if (provider !== "browser") {
            try {
                // Try Polly/API first
                const res = await fetch("/api/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text })
                });

                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audioRef.current = audio;
                    
                    audio.onended = () => {
                        setIsSpeaking(false);
                        URL.revokeObjectURL(url);
                        audioRef.current = null;
                    };
                    
                    audio.onerror = () => {
                        console.error("Audio playback error");
                        setIsSpeaking(false);
                        URL.revokeObjectURL(url);
                        audioRef.current = null;
                        fallbackSpeak(text); // Fallback to browser if play fails
                    };

                    await audio.play();
                    return;
                } else {
                    console.warn("TTS API failed, falling back to browser");
                }
            } catch (err) {
                console.error("TTS API error:", err);
            }
        }

        // Fallback to Browser SpeechSynthesis
        fallbackSpeak(text);
    }, []);

    const fallbackSpeak = (text: string) => {
        // Native Browser SpeechSynthesis (Authentic Indian Accent)
        if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.1;
            utterance.volume = 1;

            const voice = getFemaleVoice();
            if (voice) {
                utterance.voice = voice;
                utterance.lang = voice.lang || "hi-IN";
            } else {
                utterance.lang = "hi-IN";
            }

            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
        } else {
            setIsSpeaking(false);
        }
    };

    // ── Cancel speech ──
    const cancelSpeech = useCallback(() => {
        window.speechSynthesis?.cancel();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsSpeaking(false);
    }, []);

    return {
        isListening,
        isSpeaking,
        isProcessing,
        transcript,
        interimTranscript,
        lastResponse,
        startListening,
        stopListening,
        speak,
        cancelSpeech,
    };
}
