"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, X, Mic, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { getRespectfulGreeting } from "@/services/llmService";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ChatMessage {
    role: "assistant" | "user" | "system";
    content: string;
    timestamp: number;
    structured?: StructuredResponse | null;
}

interface OrderedItem {
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    item_id: string;
}

interface StructuredResponse {
    status: string;
    items?: OrderedItem[];
    grand_total?: number;
    action?: string;
    message?: string;
    found_items?: OrderedItem[];
    not_found_items?: string[];
    item_name?: string;
    requested?: number;
    available?: number;
    orderId?: string;
    total?: number;
}

export default function JarvisChat() {
    const { user, profile, getIdToken } = useAuth();
    const { items, total, clearCart } = useCart();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [processing, setProcessing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmOrder, setConfirmOrder] = useState<any>(null);
    const pendingOrderRef = useRef<any>(null); // prevent double confirm
    const confirmingRef = useRef(false); // guard against re-entry
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Voice input (mobile mic inside chat)
    const {
        isListening,
        transcript: voiceTranscript,
        interimTranscript,
        startListening,
        stopListening,
        speak
    } = useVoiceAssistant({
        onFinalTranscript: (text) => {
            setInput(text);
            handleSend(undefined, undefined, text);
        }
    });

    // When voice transcript updates, fill the input (fallback)
    useEffect(() => {
        if (voiceTranscript && !isListening) {
            setInput(voiceTranscript);
        }
    }, [voiceTranscript, isListening]);

    const toggleVoice = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    useEffect(() => {
        if (open && messages.length === 0) {
            const greeting = getRespectfulGreeting({ name: profile?.name, gender: profile?.gender });
            setMessages([
                {
                    role: "assistant",
                    content: `${greeting}! Main hoon Jarvis — Zayko AI Ordering Engine.\n\nSeedha order bolo, jaise:\n• "6 milk"\n• "2 samosa aur 1 chai"\n• "3 coffee order karo"\n\nMain turant process karunga!`,
                    timestamp: Date.now(),
                },
            ]);
        }
    }, [open, profile, messages.length]);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Order Live Status Voice Announcer
    useEffect(() => {
        if (!user || !profile) return;
        
        // Listen to the most recent active order for this user
        const q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            where("status", "in", ["pending", "confirmed", "preparing", "ready"]),
            orderBy("createdAt", "desc"),
            limit(1)
        );

        let previousStatus: string | null = null;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) return;
            const orderDoc = snapshot.docs[0];
            const currentStatus = orderDoc.data().status;

            // Only speak if status changed (and we had a previous status to avoid speaking on mount)
            if (previousStatus && currentStatus !== previousStatus) {
                if (currentStatus === "confirmed") {
                    speak("Aapka order confirm ho gaya hai, abhi prepare ho raha hai");
                } else if (currentStatus === "preparing") {
                    speak("Aapka order tayar ho raha hai, thoda wait karein");
                } else if (currentStatus === "ready") {
                    speak("Aapka order ready hai, please pick up karein");
                }
            }
            previousStatus = currentStatus;
        });

        return () => unsubscribe();
    }, [user, profile, speak]);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open]);

    // Handle open from Mobile NavBar
    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener('open-jarvis', handler);
        return () => window.removeEventListener('open-jarvis', handler);
    }, []);

    const handleConfirmLLM = async () => {
        if (confirmingRef.current) return; // prevent double click
        const order = pendingOrderRef.current || confirmOrder;
        if (!order) return;
        confirmingRef.current = true;
        setShowConfirm(false);
        setConfirmOrder(null);
        // Add user confirmation message directly — do NOT send to LLM
        setMessages(prev => [...prev, { role: "user", content: "✅ Haan, Order Confirm Karo", timestamp: Date.now() }]);
        const execItems = [{
            item_id: order.itemId,
            name: order.itemName,
            quantity: order.quantity,
            unit_price: order.price,
            total_price: order.price * order.quantity
        }];
        await handleSend("execute_order", execItems);
        pendingOrderRef.current = null;
        confirmingRef.current = false;
    };

    const handleSend = useCallback(async (action?: string, orderItems?: OrderedItem[], overrideText?: string) => {
        const text = overrideText || input.trim();
        if ((!text && !action) || processing) return;

        const userMsg = text || (action === "execute_order" ? "✅ Order Confirm" : action === "place_order" ? "Place Order" : "");
        if (userMsg && action !== "execute_order") {
            setMessages(prev => [...prev, { role: "user", content: userMsg, timestamp: Date.now() }]);
        }

        setInput("");
        setProcessing(true);

        try {
            const token = await getIdToken();
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    messages: messages.concat(
                        userMsg && action !== "execute_order"
                            ? [{ role: "user" as const, content: userMsg, timestamp: Date.now() }]
                            : []
                    ),
                    cart: action === "execute_order" ? orderItems : items,
                    userProfile: profile,
                    action: action || "chat",
                }),
            });

            const data = await res.json();

            // Safety: extract message — never show raw JSON
            const safeMessage = (d: any): string => {
                if (typeof d === 'string') return d;
                if (d?.message && typeof d.message === 'string') return d.message;
                if (d?.status) return buildStructuredDisplay(d);
                return 'Kuch samajh nahi aaya, please dobara try karein.';
            };

            if (res.ok) {
                if (data.action === "ORDER") {
                    const orderData = {
                        itemId: data.itemId,
                        itemName: data.itemName,
                        quantity: data.quantity,
                        price: data.price || 0,
                        message: data.message
                    };
                    setConfirmOrder(orderData);
                    pendingOrderRef.current = orderData;
                    setShowConfirm(true);
                    speak(data.message || `${data.itemName} ka order confirm karein?`);
                    
                    setMessages(prev => [
                        ...prev,
                        {
                            role: "assistant",
                            content: safeMessage(data),
                            timestamp: Date.now(),
                        },
                    ]);
                } else {
                    // Determine if this is a structured response
                    const isStructured = data.status && ["ORDER_CONFIRMED", "ITEM_NOT_FOUND", "STOCK_ERROR", "ORDER_PLACED", "ORDER_FAILED", "CHAT_MODE"].includes(data.status);

                    if (isStructured) {
                        const displayContent = buildStructuredDisplay(data);
                        
                        // Voice out the response
                        let speakText = data.message || displayContent;
                        if (data.status === "ORDER_CONFIRMED") {
                            speakText = `Aapka order summary: Total amount ${data.grand_total} rupees. Kya main order confirm karu?`;
                        }
                        speak(speakText);

                        setMessages(prev => [
                            ...prev,
                            {
                                role: "assistant",
                                content: displayContent,
                                timestamp: Date.now(),
                                structured: data,
                            },
                        ]);

                        if (data.status === "ORDER_PLACED" || data.action === "order_placed") {
                            toast.success("Order placed! 🎉");
                            clearCart();
                        }
                    } else {
                        // Legacy/chat response — always show message string only
                        const msgText = safeMessage(data);
                        speak(msgText);
                        setMessages(prev => [
                            ...prev,
                            {
                                role: "assistant",
                                content: msgText,
                                timestamp: Date.now(),
                            },
                        ]);

                        if (data.action === "order_placed") {
                            toast.success("Order placed via AI! 🎉");
                            clearCart();
                        }
                    }
                }
            } else {
                toast.error(data.error || "AI is taking a break...");
                setMessages(prev => [
                    ...prev,
                    {
                        role: "assistant",
                        content: "Sorry, server side kuch issue hai. Kripya bad mein try karein! 🙏",
                        timestamp: Date.now(),
                    },
                ]);
            }
        } catch (err) {
            console.error("Jarvis Error:", err);
            toast.error("Connection lost");
            speak("Sorry, network error aa gaya.");
        } finally {
            setProcessing(false);
        }
    }, [input, processing, messages, items, profile, getIdToken, clearCart, speak]);

    /** Build a human-readable display string from structured JSON */
    function buildStructuredDisplay(data: StructuredResponse): string {
        switch (data.status) {
            case "ORDER_CONFIRMED": {
                const lines = ["🛒 **Order Summary**\n"];
                for (const item of data.items || []) {
                    lines.push(`• ${item.name} × ${item.quantity} — ₹${item.total_price}`);
                }
                lines.push(`\n💰 Grand Total: ₹${data.grand_total}`);
                lines.push("\nConfirm karna hai? 👇");
                return lines.join("\n");
            }
            case "ITEM_NOT_FOUND": {
                if (data.found_items && data.found_items.length > 0) {
                    const lines = [`⚠️ ${data.message}\n`, "🛒 **Successfully Found:**"];
                    for (const item of data.found_items) {
                        lines.push(`• ${item.name} × ${item.quantity}`);
                    }
                    lines.push("\nConfirm baaki items? (Type 'yes' or use button)");
                    return lines.join("\n");
                }
                return `⚠️ ${data.message}`;
            }
            case "STOCK_ERROR": {
                if (data.found_items && data.found_items.length > 0) {
                    const lines = [`📦 ${data.message}\n`, "🛒 **Successfully Found:**"];
                    for (const item of data.found_items) {
                        lines.push(`• ${item.name} × ${item.quantity}`);
                    }
                    lines.push("\nConfirm baaki items? (Type 'yes' or use button)");
                    return lines.join("\n");
                }
                return `📦 ${data.message}`;
            }
            case "ORDER_PLACED":
                return data.message || "✅ Order placed!";
            case "ORDER_FAILED":
                return data.message || "❌ Order failed!";
            default:
                return data.message || "...";
        }
    }

    const handleConfirmOrder = useCallback(
        (structured: StructuredResponse) => {
            if (confirmingRef.current) return; // prevent double click
            if (!structured.items || structured.items.length === 0) return;
            confirmingRef.current = true;
            // Add user confirm message directly — do NOT send to LLM
            setMessages(prev => [...prev, { role: "user", content: "✅ Order Confirm", timestamp: Date.now() }]);
            handleSend("execute_order", structured.items).then(() => {
                confirmingRef.current = false;
            });
        },
        [handleSend]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
        }
    };

    if (!user) return null;
    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;
    if (pathname?.startsWith("/executive")) return null;

    return (
        <>
            {/* ═══ Floating Orb Trigger ═══ */}
            <motion.button
                onClick={() => setOpen(!open)}
                className="hidden md:flex fixed bottom-6 right-6 z-50 w-12 h-12 md:w-16 md:h-16 rounded-full items-center justify-center text-xl md:text-3xl border-2 border-gold-400/30 breathing-orb"
                style={{
                    background: 'radial-gradient(circle at 35% 35%, #fbbf24, #d4a017, #92400e)',
                }}
                whileTap={{ scale: 0.85 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                {open ? (
                    <span className="text-xl text-zayko-950 font-bold">✕</span>
                ) : (
                    <span className="text-2xl drop-shadow-lg">🤖</span>
                )}
                {/* Pulsing ring behind orb */}
                {!open && (
                    <span className="absolute inset-0 rounded-full border-2 border-gold-400/40 animate-ping" style={{ animationDuration: '3s' }} />
                )}
                {/* Notification Badge */}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zayko-900 shadow-lg shadow-emerald-500/30">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </div>
            </motion.button>

            {/* ═══ Chat Panel ═══ */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.85 }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        className="fixed bottom-0 left-0 right-0 h-[70vh] rounded-t-3xl md:h-[550px] md:bottom-28 md:right-32 md:left-auto md:w-[380px] md:rounded-3xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-2xl z-[60]"
                        style={{ background: "var(--bg-card, rgba(0,0,0,0.8))", border: "1px solid var(--border)" }}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'var(--btn-primary)' }}>
                                        <Bot className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 rounded-full" style={{ borderColor: "var(--bg-elevated)" }}></span>
                                </div>
                                <div>
                                    <h3 className="font-display font-black text-base tracking-tight italic" style={{ color: "var(--text-primary)" }}>JARVIS <span className="text-[10px] px-1.5 py-0.5 rounded ml-1 not-italic" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>ENGINE</span></h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest leading-none mt-1" style={{ color: "var(--accent)" }}>Order Engine Active</p>
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90" style={{ color: "var(--text-secondary)", background: "var(--bg-input)" }}>✕</button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20, y: 8 }}
                                    animate={{ opacity: 1, x: 0, y: 0 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className="max-w-[85%]">
                                        <div 
                                            className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === "user" ? "font-bold rounded-tr-sm" : "rounded-tl-sm"}`} 
                                            style={
                                                msg.role === "user" 
                                                    ? { background: "var(--btn-primary)", color: "#FFF" } 
                                                    : { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }
                                            }
                                        >
                                            {msg.content.split("\n").map((line, idx) => (
                                                <p key={idx} className={idx > 0 ? "mt-1" : ""}>{line}</p>
                                            ))}
                                        </div>

                                        {/* Confirm / Cancel buttons for ORDER_CONFIRMED */}
                                        {msg.structured?.status === "ORDER_CONFIRMED" && (
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => handleConfirmOrder(msg.structured!)}
                                                    disabled={processing}
                                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-xs font-black uppercase tracking-wider hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    <Check className="w-4 h-4" strokeWidth={3} /> Confirm Order
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setMessages(prev => [
                                                            ...prev,
                                                            { role: "assistant", content: "Order cancel kar diya. Kuch aur chahiye?", timestamp: Date.now() },
                                                        ])
                                                    }
                                                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zayko-300 text-xs font-bold uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <X className="w-4 h-4" strokeWidth={3} /> Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Native LLM Order Confirmation Dialog */}
                            {showConfirm && confirmOrder && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="rounded-2xl p-4 my-2 border border-white/10 bg-zayko-800/80 backdrop-blur-md shadow-xl"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Check className="w-5 h-5 text-emerald-400" />
                                        <p className="font-display font-bold text-white text-base">Order Confirm Karo</p>
                                    </div>
                                    <p className="text-sm mb-4 text-zayko-300 font-medium">
                                        {confirmOrder.itemName} x{confirmOrder.quantity} — <span className="text-gold-400 font-bold">₹{confirmOrder.price * confirmOrder.quantity}</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={handleConfirmLLM}
                                            disabled={processing}
                                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-xs font-black uppercase tracking-wider hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all disabled:opacity-50">
                                            ✅ Haan, Order Karo
                                        </button>
                                        <button onClick={() => {
                                            setShowConfirm(false);
                                            setMessages(prev => [...prev, { role: "assistant", content: "Order cancel kar diya. Kuch aur chahiye?", timestamp: Date.now() }]);
                                        }}
                                            disabled={processing}
                                            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zayko-300 text-xs font-bold uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all">
                                            ❌ Nahi, Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {processing && (
                                <div className="flex justify-start">
                                    <div className="bg-white/5 border border-white/[0.08] px-4 py-3 rounded-2xl rounded-tl-sm">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                            <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                            <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-zayko-800/50 border-t border-white/[0.06] relative">
                            {/* Live Transcript Display */}
                            <AnimatePresence>
                                {isListening && interimTranscript && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute -top-12 left-4 right-4 bg-zayko-950/80 backdrop-blur-md rounded-xl p-3 border border-white/10 shadow-lg text-sm text-gold-200 font-medium z-10 italic"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <span className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="truncate">{interimTranscript}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative group flex items-center gap-2">
                                {/* Mic Button */}
                                <div className="relative">
                                    {isListening && (
                                        <>
                                            <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping" style={{ animationDuration: '2s' }} />
                                            <span className="absolute inset-[-4px] rounded-2xl border-2 border-red-500/30 animate-pulse" style={{ animationDuration: '1.5s' }} />
                                        </>
                                    )}
                                    <button
                                        onClick={toggleVoice}
                                        className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md ${
                                            isListening
                                                ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/50"
                                                : "bg-white/5 border border-white/[0.1] text-zayko-400 hover:text-white hover:bg-white/10"
                                        }`}
                                        title={isListening ? "Stop listening" : "Speak your order"}
                                    >
                                        {isListening ? (
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ repeat: Infinity, duration: 1.5 }}
                                            >
                                                <Mic className="w-5 h-5 text-white" />
                                            </motion.div>
                                        ) : <Mic className="w-5 h-5 text-current" />}
                                    </button>
                                </div>

                                <div className="relative flex-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isListening ? "Listening..." : "Type or tap mic to speak..."}
                                        className="w-full bg-white/5 border border-white/[0.1] rounded-2xl py-4 pl-5 pr-14 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/20 focus:shadow-[0_0_20px_rgba(251,191,36,0.1)] transition-all placeholder:text-zayko-600 font-medium"
                                        disabled={processing || isListening}
                                    />
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={processing || !input.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-zayko-900 flex items-center justify-center transition-all active:scale-85 disabled:opacity-30 disabled:grayscale shadow-lg shadow-gold-500/20"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <p className="text-[9px] text-center text-zayko-600 mt-3 font-black uppercase tracking-[0.2em]">Type or Voice · Powered by Zayko AI</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
