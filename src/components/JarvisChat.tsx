"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, X, Mic, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import toast from "react-hot-toast";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { speak, unlockAudio } from "@/services/ttsService";
import { getRespectfulGreeting } from "@/services/llmService";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ChatMessage {
    role: "assistant" | "user" | "system";
    content: string;
    timestamp: number;
    suggestions?: string[];
    upsell?: { message: string; items: Array<{ id: string; name: string; price: number }> } | null;
    structured?: StructuredResponse | null;
}

interface OrderedItem {
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    item_id?: string;
    id?: string;
}

interface StructuredResponse {
    status?: string;
    message?: string;
    remaining_balance?: number;
    order_id?: string;
    grand_total?: number;
    items?: OrderedItem[];
    found_items?: OrderedItem[];
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
    const [isMuted, setIsMuted] = useState(false);
    const pendingOrderRef = useRef<any>(null);
    const confirmingRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Voice input
    const {
        isListening,
        isSpeaking,
        transcript: voiceTranscript,
        interimTranscript,
        startListening,
        stopListening,
    } = useVoiceAssistant({
        onFinalTranscript: (text) => {
            setInput(text);
            handleSend(undefined, undefined, text);
        },
    });

    useEffect(() => {
        if (voiceTranscript && !isListening) {
            setInput(voiceTranscript);
        }
    }, [voiceTranscript, isListening]);

    const toggleVoice = () => {
        unlockAudio(); // Unlock mobile audio on user tap
        if (isListening) stopListening();
        else startListening();
    };

    // Unlock audio when chat panel opens (user gesture)
    useEffect(() => {
        if (open) unlockAudio();
    }, [open]);

    // Greeting on open
    useEffect(() => {
        if (open && messages.length === 0) {
            const userName = profile?.name?.split(" ")[0] || "Guest";
            const hour = new Date().getHours();
            const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
            
            setMessages([
                {
                    role: "assistant",
                    content: `${timeGreeting} ${userName}! 👋\nKya order karein aaj?`,
                    timestamp: Date.now(),
                    suggestions: ["Aaj kya hai?", "Kuch suggest karo", "Wallet balance"],
                },
            ]);
        }
    }, [open, profile, messages.length]);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 300);
    }, [open]);

    // Open from Mobile NavBar
    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener("open-ziva", handler);
        return () => window.removeEventListener("open-ziva", handler);
    }, []);

    // Order status announcements
    useEffect(() => {
        if (!user || !profile) return;
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
            const currentStatus = snapshot.docs[0].data().status;
            if (previousStatus && currentStatus !== previousStatus && !isMuted) {
                const statusMessages: Record<string, string> = {
                    confirmed: "Aapka order confirm ho gaya hai!",
                    preparing: "Aapka order tayar ho raha hai, thoda wait karein",
                    ready: "Aapka order ready hai! Please pick up karein",
                };
                if (statusMessages[currentStatus]) speak(statusMessages[currentStatus]);
            }
            previousStatus = currentStatus;
        });
        return () => unsubscribe();
    }, [user, profile, isMuted]);

    // ─── Confirm Order (from LLM confirmation dialog) ───
    const handleConfirmLLM = async () => {
        if (confirmingRef.current) return;
        const order = pendingOrderRef.current || confirmOrder;
        if (!order) return;

        confirmingRef.current = true;
        setShowConfirm(false);
        setConfirmOrder(null);

        setMessages((prev) => [...prev, { role: "user", content: "✅ Haan, Order Confirm Karo", timestamp: Date.now() }]);

        const execItems = (Array.isArray(order) ? order : [order]).map(itm => ({
            item_id: itm.itemId,
            name: itm.itemName,
            quantity: itm.quantity,
            unit_price: itm.itemPrice || itm.price,
            total_price: (itm.itemPrice || itm.price) * itm.quantity,
        }));

        await handleSend("execute_order", execItems);
        pendingOrderRef.current = null;
        confirmingRef.current = false;
    };

    // ─── Main Send Handler ───
    const handleSend = useCallback(
        async (action?: string, orderItems?: OrderedItem[], overrideText?: string) => {
            const text = overrideText || input.trim();
            if ((!text && !action) || processing) return;

            unlockAudio(); // Ensure mobile audio is unlocked on every send

            const userMsg = text || (action === "execute_order" ? "✅ Order Confirm" : "");
            if (userMsg && action !== "execute_order") {
                setMessages((prev) => [...prev, { role: "user", content: userMsg, timestamp: Date.now() }]);
            }

            setInput("");
            setProcessing(true);

            try {
                const token = await getIdToken();

                // Use unified /api/assistant for everything except execute_order
                // which can also go through /api/assistant
                const res = await fetch("/api/assistant", {
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

                const getSafeMsg = (d: any) => {
                    if (typeof d === "string") return d;
                    if (d.message && typeof d.message === "string") return d.message;
                    return "Kuch samajh nahi aara, sorry.";
                };
                const safeMsg = getSafeMsg(data);

                if (res.ok) {
                    if (data.action === "ORDER" && data.items && data.items.length > 0) {
                        const orderData = data.items.map((item: any) => ({
                            itemId: item.itemId,
                            itemName: item.itemName,
                            quantity: item.quantity,
                            price: item.price || 0,
                            message: safeMsg,
                        }));
                        setConfirmOrder(orderData);
                        pendingOrderRef.current = orderData;
                        setShowConfirm(true);

                        if (!isMuted) speak(data.voiceText || safeMsg);
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "assistant",
                                content: safeMsg,
                                timestamp: Date.now(),
                                suggestions: data.suggestions,
                                upsell: data.upsell,
                            },
                        ]);
                    } else if (
                        action === "execute_order" ||
                        data.action === "order_placed" ||
                        data.status === "ORDER_PLACED"
                    ) {
                        if (!isMuted) speak(data.voiceText || safeMsg);
                        setMessages((prev) => [
                            ...prev,
                            { role: "assistant", content: safeMsg, timestamp: Date.now() },
                        ]);
                        toast.success("Order placed! 🎉");
                        clearCart();
                    } else {
                        // CHAT, RECOMMENDATION, WALLET, MENU, UNAVAILABLE
                        if (!isMuted) speak(data.voiceText || safeMsg);
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "assistant",
                                content: safeMsg,
                                timestamp: Date.now(),
                                suggestions: data.suggestions,
                            },
                        ]);
                    }
                } else {
                    if (!isMuted) speak(data.message || "Sorry, server side kuch issue hai");
                    toast.error(data.message || "AI is taking a break...");
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "assistant",
                            content: data.message || "Sorry, server side kuch issue hai. Kripya dobara try karein! 🙏",
                            timestamp: Date.now(),
                        },
                    ]);
                }
            } catch (err) {
                console.error("Ziva Error:", err);
                toast.error("Connection lost");
                if (!isMuted) speak("Sorry, network error aa gaya.");
            } finally {
                setProcessing(false);
            }
        },
        [input, processing, messages, items, profile, getIdToken, clearCart, isMuted]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
        }
    };

    // ─── Quick suggestion chip click ───
    const handleSuggestionClick = (text: string) => {
        setInput(text);
        handleSend(undefined, undefined, text);
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
                    background: "radial-gradient(circle at 35% 35%, #fbbf24, #d4a017, #92400e)",
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
                {!open && (
                    <span
                        className="absolute inset-0 rounded-full border-2 border-gold-400/40 animate-ping"
                        style={{ animationDuration: "3s" }}
                    />
                )}
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
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "var(--btn-primary)" }}>
                                        <Bot className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 rounded-full" style={{ borderColor: "var(--bg-elevated)" }}></span>
                                </div>
                                <div>
                                    <h3 className="font-display font-black text-base tracking-tight italic" style={{ color: "var(--text-primary)" }}>
                                        ZIVA{" "}
                                        <span className="text-[10px] px-1.5 py-0.5 rounded ml-1 not-italic" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                                            v2.0
                                        </span>
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest leading-none mt-1" style={{ color: "var(--accent)" }}>
                                        {isSpeaking ? "Speaking..." : processing ? "Thinking..." : "Smart Agent Active"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Mute toggle */}
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                                    style={{ color: "var(--text-secondary)", background: "var(--bg-input)" }}
                                    title={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90" style={{ color: "var(--text-secondary)", background: "var(--bg-input)" }}>
                                    ✕
                                </button>
                            </div>
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
                                            {(() => {
                                                let displayContent = msg.content;
                                                try {
                                                    const parsed = JSON.parse(displayContent);
                                                    if (parsed.message) displayContent = parsed.message;
                                                } catch {
                                                    // Not JSON
                                                }
                                                return displayContent.split("\n").map((line, idx) => (
                                                    <p key={idx} className={idx > 0 ? "mt-1" : ""}>
                                                        {line}
                                                    </p>
                                                ));
                                            })()}
                                        </div>

                                        {/* ── Suggestion Chips ── */}
                                        {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {msg.suggestions.map((sug, si) => (
                                                    <motion.button
                                                        key={si}
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: si * 0.05 }}
                                                        onClick={() => handleSuggestionClick(sug)}
                                                        className="px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all active:scale-95 hover:shadow-md flex items-center gap-1"
                                                        style={{
                                                            background: "var(--bg-input)",
                                                            borderColor: "var(--border)",
                                                            color: "var(--accent)",
                                                        }}
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                        {sug}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        )}

                                        {/* ── Upsell Card ── */}
                                        {msg.role === "assistant" && msg.upsell && msg.upsell.items.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="mt-2 p-3 rounded-xl border"
                                                style={{ background: "var(--bg-input)", borderColor: "var(--border)" }}
                                            >
                                                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
                                                    💡 Combo Suggestion
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {msg.upsell.items.map((item, ui) => (
                                                        <button
                                                            key={ui}
                                                            onClick={() => handleSuggestionClick(`${item.name} bhi add karo`)}
                                                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all active:scale-95"
                                                            style={{
                                                                background: "var(--bg-elevated)",
                                                                borderColor: "var(--border)",
                                                                color: "var(--text-primary)",
                                                            }}
                                                        >
                                                            + {item.name} ₹{item.price}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Confirm / Cancel for ORDER_CONFIRMED */}
                                        {msg.structured?.status === "ORDER_CONFIRMED" && (
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => {
                                                        if (confirmingRef.current || !msg.structured?.items?.length) return;
                                                        confirmingRef.current = true;
                                                        setMessages((prev) => [...prev, { role: "user", content: "✅ Order Confirm", timestamp: Date.now() }]);
                                                        handleSend("execute_order", msg.structured!.items).then(() => {
                                                            confirmingRef.current = false;
                                                        });
                                                    }}
                                                    disabled={processing}
                                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-xs font-black uppercase tracking-wider hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    <Check className="w-4 h-4" strokeWidth={3} /> Confirm
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setMessages((prev) => [
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
                                    className="rounded-2xl p-4 my-2 border border-white/10 backdrop-blur-md shadow-xl"
                                    style={{ background: "var(--bg-elevated)" }}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Check className="w-5 h-5 text-emerald-400" />
                                        <p className="font-display font-bold text-base" style={{ color: "var(--text-primary)" }}>
                                            Order Confirm Karo
                                        </p>
                                    </div>
                                    <div className="text-sm mb-4 font-medium space-y-1" style={{ color: "var(--text-secondary)" }}>
                                        {(Array.isArray(confirmOrder) ? confirmOrder : [confirmOrder]).map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg">
                                                <span>{item.itemName} x{item.quantity}</span>
                                                <span style={{ color: "var(--accent)" }} className="font-bold">
                                                    ₹{item.price * item.quantity}
                                                </span>
                                            </div>
                                        ))}
                                        {Array.isArray(confirmOrder) && confirmOrder.length > 1 && (
                                            <div className="flex justify-between items-center mt-2 px-3 pt-2 border-t border-white/10">
                                                <span className="font-bold text-white">Total</span>
                                                <span style={{ color: "var(--accent)" }} className="font-bold">
                                                    ₹{confirmOrder.reduce((sum, item) => sum + item.price * item.quantity, 0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleConfirmLLM}
                                            disabled={processing}
                                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-xs font-black uppercase tracking-wider hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            ✅ Haan, Order Karo
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowConfirm(false);
                                                setMessages((prev) => [...prev, { role: "assistant", content: "Order cancel kar diya 👍 Aur kuch chahiye?", timestamp: Date.now() }]);
                                            }}
                                            disabled={processing}
                                            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all"
                                            style={{ color: "var(--text-secondary)" }}
                                        >
                                            ❌ Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Processing indicator */}
                            {processing && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "0ms" }}></span>
                                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "150ms" }}></span>
                                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "300ms" }}></span>
                                            </div>
                                            <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                                Ziva soch rahi hai...
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Speaking indicator */}
                            <AnimatePresence>
                                {isSpeaking && !isMuted && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex justify-start"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl" style={{ background: "var(--accent-glow)" }}>
                                            <div className="flex items-end gap-0.5 h-4">
                                                {[...Array(5)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        className="w-1 rounded-full"
                                                        style={{ background: "var(--accent)" }}
                                                        animate={{ height: ["4px", `${12 + Math.random() * 8}px`, "4px"] }}
                                                        transition={{ repeat: Infinity, duration: 0.6 + Math.random() * 0.4, delay: i * 0.1 }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
                                                Speaking...
                                            </span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t relative" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                            {/* Live Transcript */}
                            <AnimatePresence>
                                {isListening && interimTranscript && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute -top-12 left-4 right-4 rounded-xl p-3 border shadow-lg text-sm font-medium z-10 italic"
                                        style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <span className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                                                <span className="w-1 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
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
                                            <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping" style={{ animationDuration: "2s" }} />
                                            <span className="absolute inset-[-4px] rounded-2xl border-2 border-red-500/30 animate-pulse" style={{ animationDuration: "1.5s" }} />
                                        </>
                                    )}
                                    <button
                                        onClick={toggleVoice}
                                        className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md ${
                                            isListening
                                                ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/50"
                                                : ""
                                        }`}
                                        style={
                                            !isListening
                                                ? { background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
                                                : undefined
                                        }
                                        title={isListening ? "Stop listening" : "Speak your order"}
                                    >
                                        {isListening ? (
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                                <Mic className="w-5 h-5 text-white" />
                                            </motion.div>
                                        ) : (
                                            <Mic className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>

                                <div className="relative flex-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isListening ? "Listening..." : "Bolo ya type karo..."}
                                        className="w-full rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none transition-all font-medium"
                                        style={{
                                            background: "var(--bg-input)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-primary)",
                                        }}
                                        disabled={processing || isListening}
                                    />
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={processing || !input.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-85 disabled:opacity-30 disabled:grayscale shadow-lg"
                                        style={{ background: "var(--btn-primary)", color: "#FFF" }}
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[9px] text-center mt-3 font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>
                                Voice · Text · AI-Powered · Zayko v2.0
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
