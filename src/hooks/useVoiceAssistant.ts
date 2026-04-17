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
    activeProvider: string;
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
    const voices = typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (!voices || voices.length === 0) return null;

    // 1. Android Specific Female Voices (hie-local and hic-local are usually female)
    const androidFemale = voices.find(v => v.lang.toLowerCase() === "hi-in" && (v.name.includes("hie-local") || v.name.includes("hic-local")));
    if (androidFemale) return androidFemale;

    // 2. iOS/Desktop specific known female names for Hindi
    const specificNames = ["Google हिन्दी", "Lekha", "Veena", "Aditi", "Neerja", "Heera"];
    for (const name of specificNames) {
        const match = voices.find(v => v.name.includes(name));
        if (match) return match;
    }

    // 3. Any voice with "Female" in the name for Indian languages
    const femaleIN = voices.find(v =>
        (v.lang.toLowerCase().includes("in") || v.lang.toLowerCase().includes("hi")) &&
        v.name.toLowerCase().includes("female")
    );
    if (femaleIN) return femaleIN;

    // 4. Any direct Hindi voice (even if male, it's better than English gibberish)
    const anyHindi = voices.find(v => v.lang === "hi-IN" || v.lang === "hi_IN" || v.lang === "hi-in");
    if (anyHindi) return anyHindi;

    // 5. Any language from India (fallback)
    const anyIN = voices.find(v => v.lang.includes("in") || v.lang.includes("IN"));
    if (anyIN) return anyIN;

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
    const [activeProvider, setActiveProvider] = useState<string>("browser");

    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Keep onFinalTranscript fresh without triggering re-initialization
    const onFinalTranscriptRef = useRef(onFinalTranscript);
    useEffect(() => {
        onFinalTranscriptRef.current = onFinalTranscript;
    }, [onFinalTranscript]);

    // ── 1. Initialize Browser Recognition (as backup) ──
    const initRecognition = useCallback(() => {
        if (typeof window === "undefined") return null;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "hi-IN";
        
        recognition.onresult = (event: any) => {
            let finalStr = "";
            let interimStr = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalStr += event.results[i][0].transcript;
                else interimStr += event.results[i][0].transcript;
            }
            if (interimStr) setInterimTranscript(interimStr);
            if (finalStr) {
                setTranscript(finalStr);
                setInterimTranscript("");
                if (onFinalTranscriptRef.current) onFinalTranscriptRef.current(finalStr);
            }
        };

        recognition.onend = () => {
            if (activeProvider === "browser") setIsListening(false);
        };

        return recognition;
    }, [activeProvider]);

    useEffect(() => {
        recognitionRef.current = initRecognition();
    }, [initRecognition]);

    // ── 2. Handle Audio Recording (for Server ASR) ──
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
        } catch (err) {
            console.error("Failed to start recording:", err);
            setActiveProvider("browser"); // Force fallback if mic access fails for MediaRecorder
        }
    };

    const processAudioBlob = async (blob: Blob) => {
        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append("audio", blob);

            const res = await fetch("/api/asr", { method: "POST", body: formData });
            if (res.ok) {
                const data = await res.json();
                if (data.text) {
                    setTranscript(data.text);
                    setActiveProvider(data.provider || "server");
                    if (onFinalTranscriptRef.current) onFinalTranscriptRef.current(data.text);
                    return;
                }
            }
            throw new Error("Server ASR failed");
        } catch (err) {
            console.warn("Server ASR failed, but browser ASR may have results:", err);
            // If browser recognition is already running and has a transcript, we're good.
            // Otherwise, we might have lost the input.
        } finally {
            setIsProcessing(false);
            setIsListening(false);
        }
    };

    // ── Helper: Detect Mobile ──
    const isMobile = useCallback(() => {
        if (typeof window === "undefined") return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }, []);

    // ── Start listening ──
    const startListening = useCallback(async () => {
        setIsListening(true);
        setTranscript("");
        setInterimTranscript("");
        
        // Unlock audio
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance("");
            u.volume = 0;
            window.speechSynthesis.speak(u);
        }

        const mobile = isMobile();
        console.log(`[VoiceAssistant] Starting on ${mobile ? "mobile" : "desktop"}`);

        if (mobile && recognitionRef.current) {
            // On mobile, prioritize native SpeechRecognition to avoid conflicts
            // Many mobile browsers (Chrome Android) block one if the other is recording
            setActiveProvider("browser");
            try {
                recognitionRef.current.lang = "hi-IN"; // Better for Hinglish on mobile
                recognitionRef.current.start();
            } catch (e) {
                console.warn("Recognition already active", e);
            }
        } else {
            // On desktop, use both: NVIDIA for high accuracy + Browser for live preview
            setActiveProvider("nvidia-parakeet");
            startRecording();
            
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.lang = "en-IN";
                    recognitionRef.current.start();
                } catch (e) {
                    console.warn("Recognition already active", e);
                }
            }
        }
    }, [isMobile, startRecording]);

    const stopListening = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    }, []);

    // ── Speak with Failover ──
    const speak = useCallback(async (text: string) => {
        if (!text) return;
        setIsSpeaking(true);
        setLastResponse(text);
        window.speechSynthesis?.cancel();

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        try {
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
                const provider = res.headers.get("X-Voice-Provider") || "api";
                console.log(`[TTS] Speaking via ${provider}`);

                audio.onended = () => {
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    audioRef.current = null;
                };

                audio.onerror = () => {
                    URL.revokeObjectURL(url);
                    fallbackSpeak(text);
                };

                await audio.play();
                return;
            }
        } catch (err) {
            console.error("TTS API error:", err);
        }

        fallbackSpeak(text);
    }, []);

    const fallbackSpeak = (text: string) => {
        if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "hi-IN";
            const femaleVoice = getFemaleVoice();
            if (femaleVoice) utterance.voice = femaleVoice;
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        } else {
            setIsSpeaking(false);
        }
    };

    const cancelSpeech = useCallback(() => {
        window.speechSynthesis?.cancel();
        if (audioRef.current) {
            audioRef.current.pause();
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
        activeProvider,
        startListening,
        stopListening,
        speak,
        cancelSpeech,
    };
}
