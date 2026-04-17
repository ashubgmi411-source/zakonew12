"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { speak, stopSpeaking, unlockAudio } from "@/services/ttsService";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { Bot, Bell, Terminal, Mic, ShieldCheck, X } from "lucide-react";

export default function AdminZiva() {
    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
    } = useVoiceAssistant();

    const [isProcessing, setIsProcessing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [lastResponse, setLastResponse] = useState("");
    const [textInput, setTextInput] = useState("");
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
    const lastProcessedRef = useRef<string>("");
    const hasUnlockedRef = useRef(false);

    // ── 1. Real-time Order Monitor ──
    useEffect(() => {
        // Only announce orders that come in AFTER the component is mounted
        const mountTime = Date.now();
        
        const q = query(
            collection(db, "orders"),
            where("status", "in", ["pending", "confirmed", "preparing"]), // Sync all active orders
            orderBy("createdAt", "desc"),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const currentOrders: any[] = [];
            snapshot.docs.forEach((doc) => {
                const orderData = { id: doc.id, ...doc.data() };
                currentOrders.push(orderData);
            });
            setActiveOrders(currentOrders);

            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const order = change.doc.data();
                    const orderTime = new Date(order.createdAt).getTime();
                    
                    // Only announce truly "new" PENDING orders
                    if (orderTime > mountTime && order.status === "pending") {
                        const itemsList = order.items.map((i: any) => `${i.quantity} ${i.name}`).join(", ");
                        const announcement = `Sir! Naya order aaya hai, ${order.userName} ki taraf se. Item hain ${itemsList}.`;
                        
                        toast.success(`New Order: ${order.userName}`, {
                            icon: "🔔",
                            duration: 6000
                        });
                        
                        speak(announcement);
                    }
                }
            });
        });

        return () => unsubscribe();
    }, []);

    // ── 2. Process Admin Commands ──
    const processAdminCommand = useCallback(async (text: string) => {
        if (!text.trim()) return;
        setIsProcessing(true);
        setIsOpen(true);
        setTextInput(""); // Clear input on submit

        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/admin/ai/process", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token || ""}`,
                },
                body: JSON.stringify({ 
                    prompt: text,
                    history: history.slice(-10), // Send last 10 messages
                    activeOrders: activeOrders.map(o => ({
                        id: o.id,
                        orderId: o.orderId, // Display ID like #7712
                        userName: o.userName,
                        items: o.items.map((it: any) => it.name).join(", "),
                        status: o.status
                    }))
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setLastResponse(data.speech);
                speak(data.speech);
                
                // Update History
                setHistory(prev => [
                    ...prev.slice(-9), 
                    { role: "user", content: text },
                    { role: "assistant", content: data.speech }
                ]);

                toast.success("Command Executed", { icon: "✅" });
            } else {
                const errorMsg = data.message ? `${data.error}: ${data.message}` : (data.error || "Action failed");
                speak("Maaf kijiye Sir, main yeh command execute nahi kar paya.");
                toast.error(errorMsg);
            }
        } catch (err) {
            console.error("Admin Assistant Error:", err);
            speak("Sir, network error ki wajah se action fail ho gaya.");
        } finally {
            setIsProcessing(false);
        }
    }, [history]);

    useEffect(() => {
        if (!isListening && transcript && !isProcessing && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;
            processAdminCommand(transcript);
        }
    }, [isListening, transcript, isProcessing, processAdminCommand]);

    const handleToggle = () => {
        if (!hasUnlockedRef.current) {
            unlockAudio();
            hasUnlockedRef.current = true;
        }
        if (isListening) {
            stopListening();
        } else {
            setLastResponse("");
            // Note: transcript is managed by hook, but we reset our local tracker
            lastProcessedRef.current = ""; 
            stopSpeaking();
            startListening();
            setIsOpen(true);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="bg-zayko-900 border border-emerald-500/20 rounded-2xl p-4 w-72 shadow-2xl backdrop-blur-lg"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-widest">Admin Commander</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-zayko-500 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="bg-zayko-950/50 rounded-xl p-3 border border-zayko-800 mb-2 h-24 flex flex-col justify-center overflow-hidden">
                            {isListening ? (
                                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleToggle}>
                                    <div className="flex gap-1 items-center justify-center mb-1">
                                        {[1, 2, 3, 4].map(i => (
                                            <motion.div
                                                key={i}
                                                animate={{ height: [8, 20, 8] }}
                                                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                                className="w-1 bg-emerald-400 rounded-full"
                                            />
                                        ))}
                                    </div>
                                    <div className="text-[10px] text-emerald-300 font-mono text-center truncate italic w-full">
                                        {interimTranscript || "Listening Sir..."}
                                    </div>
                                    <span className="text-[8px] text-emerald-500 font-bold animate-pulse uppercase mt-1">Tap Bot to Finish</span>
                                </div>
                            ) : isProcessing ? (
                                <div className="text-xs text-emerald-400 animate-pulse text-center font-mono tracking-widest">EXECUTING COMMAND...</div>
                            ) : lastResponse ? (
                                <div className="text-xs text-emerald-500 font-medium leading-relaxed italic">
                                    "{lastResponse}"
                                </div>
                            ) : (
                                <div className="text-[10px] text-zayko-500 text-center font-medium">
                                    "Confirm kardo order #123"<br/>
                                    "Chips ka price 25 kardo"<br/>
                                    "Ek naya item add karna hai"
                                </div>
                            )}
                        </div>

                        {/* Keyboard Chat Input */}
                        <div className="relative group mb-2">
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && processAdminCommand(textInput)}
                                placeholder="Type a command Sir..."
                                className="w-full bg-zayko-950 border border-zayko-800 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-zayko-600 focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                <Terminal className="w-3 h-3 text-emerald-400" />
                            </div>
                        </div>

                        {(transcript || lastResponse) && (
                            <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar scroll-smooth">
                                {transcript && <p className="text-[11px] text-zayko-300 italic">“ {transcript} ”</p>}
                                {lastResponse && (
                                    <motion.p 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }}
                                        className="text-[11px] text-emerald-400 font-medium border-l-2 border-emerald-500/30 pl-2 py-1"
                                    >
                                        Command Center: {lastResponse}
                                    </motion.p>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={handleToggle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-2 transition-all ${
                    isListening ? "bg-red-500 border-red-400" : "bg-emerald-600 border-emerald-400/30"
                }`}
            >
                {isListening ? <X className="text-white" /> : <Bot className="text-white" />}
                {!isOpen && !isListening && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-zayko-900 flex items-center justify-center">
                        <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                    </div>
                )}
            </motion.button>
        </div>
    );
}
