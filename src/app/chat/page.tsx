"use client";
import React, { Suspense, useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter, useSearchParams } from "next/navigation";
import ChatBubble from "@/components/ChatBubble";
import toast from "react-hot-toast";

export default function ChatPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            }
        >
            <ChatPageInner />
        </Suspense>
    );
}

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

function ChatPageInner() {
    const { user, profile, loading, refreshProfile, getIdToken } = useAuth();
    const { items: cartItems, total: cartTotal, clearCart } = useCart();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<{ orderId: string; total: number } | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    // Auto-scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle "place_order" action from cart
    useEffect(() => {
        if (searchParams?.get("action") === "place_order" && cartItems.length > 0 && profile) {
            handlePlaceOrder();
        }
    }, [searchParams, profile]);

    const handlePlaceOrder = async () => {
        if (cartItems.length === 0) {
            addMessage("assistant", "Your cart is empty! Go add some items first 🍽️");
            return;
        }

        setSending(true);
        addMessage("user", "I want to place my order 🛒");

        try {
            const token = await getIdToken();
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "place_order",
                    cart: cartItems,
                    userProfile: profile,
                }),
            });

            const data = await res.json();
            addMessage("assistant", data.message);

            if (data.orderId) {
                setPendingOrder({ orderId: data.orderId, total: data.total });
            }
        } catch {
            addMessage("assistant", "Oops! Something went wrong. Please try again! 🙏");
        }
        setSending(false);
    };

    const confirmOrder = async () => {
        if (!pendingOrder || !user || !profile) return;

        setSending(true);
        addMessage("user", "Yes, confirm my order! ✅");

        try {
            const token = await getIdToken();
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: user.uid,
                    items: cartItems.map((item) => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                    })),
                    total: pendingOrder.total,
                    orderId: pendingOrder.orderId,
                    userName: profile.name,
                    userEmail: profile.email,
                }),
            });

            const data = await res.json();

            if (data.success) {
                addMessage(
                    "assistant",
                    `🎉 Order confirmed!\n\n✅ Order #${pendingOrder.orderId} has been placed successfully!\n💰 ₹${pendingOrder.total} deducted from your wallet.\n\nYour food is being prepared! Check the Orders page for real-time updates. Enjoy your meal! 🍽️😊`
                );
                clearCart();
                setPendingOrder(null);
                await refreshProfile();
                toast.success("Order placed successfully! 🎉");
            } else {
                addMessage("assistant", `❌ ${data.error || "Failed to place order. Please try again."}`);
            }
        } catch {
            addMessage("assistant", "❌ Something went wrong while placing your order. Please try again!");
        }
        setSending(false);
    };

    const sendMessage = async () => {
        if (!input.trim() || sending) return;

        const userMsg = input.trim();
        setInput("");
        addMessage("user", userMsg);

        // Check for confirmation keywords
        const confirmKeywords = ["yes", "confirm", "place", "ok", "sure", "proceed"];
        if (pendingOrder && confirmKeywords.some((k) => userMsg.toLowerCase().includes(k))) {
            confirmOrder();
            return;
        }

        // Check for cancel
        if (pendingOrder && ["no", "cancel", "stop"].some((k) => userMsg.toLowerCase().includes(k))) {
            setPendingOrder(null);
            addMessage("assistant", "No worries! Your order has been cancelled. Feel free to browse the menu or modify your cart! 😊🍽️");
            return;
        }

        setSending(true);
        try {
            const token = await getIdToken();
            const chatMessages = [...messages, { role: "user" as const, content: userMsg, timestamp: "" }]
                .map((m) => ({ role: m.role, content: m.content }));

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ messages: chatMessages, userProfile: profile ? { name: profile.name, email: profile.email, rollNumber: profile.rollNumber } : undefined }),
            });

            const data = await res.json();
            addMessage("assistant", data.message);

            // Handle AI Recommendations/Suggestions
            if (data.suggestedItemIds && Array.isArray(data.suggestedItemIds) && data.suggestedItemIds.length > 0) {
                console.log("Chat: New suggestions received", data.suggestedItemIds);
                sessionStorage.setItem("ziva_suggestions", JSON.stringify(data.suggestedItemIds));
                // Dispatch custom event for MenuPage to pick up
                window.dispatchEvent(new CustomEvent("ziva:suggestions-updated", { 
                    detail: { itemIds: data.suggestedItemIds } 
                }));
            }
        } catch {
            addMessage("assistant", "Sorry, I'm having trouble right now. Please try again! 🙏");
        }
        setSending(false);
    };

    const addMessage = (role: "user" | "assistant", content: string) => {
        setMessages((prev) => [
            ...prev,
            {
                role,
                content,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
        ]);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-lg">
                        🤖
                    </div>
                    <div>
                        <h2 className="font-display font-bold text-zayko-700">Campus Bot</h2>
                        <p className="text-xs text-emerald-500 flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Online • AI-powered ordering
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-3xl mx-auto">
                    {messages.length === 0 && (
                        <div className="text-center py-16 animate-fade-in">
                            <div className="text-6xl mb-4">🤖</div>
                            <h3 className="text-xl font-display font-bold text-gray-700 mb-2">
                                Hey {profile?.name?.split(" ")[0] || "there"}!
                            </h3>
                            <p className="text-gray-500 mb-6">
                                I&apos;m your Campus Bot. I can help you place orders, answer questions about the menu, or just chat!
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {[
                                    "What's on the menu? 🍽️",
                                    "Help me place an order 🛒",
                                    "What's popular today? 🔥",
                                ].map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => { setInput(q); }}
                                        className="px-4 py-2 bg-zayko-50 text-zayko-600 rounded-xl text-sm hover:bg-zayko-100 transition-colors"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        let displayContent = msg.content;
                        try {
                            const parsed = JSON.parse(displayContent);
                            if (parsed.message) displayContent = parsed.message;
                        } catch {
                            // Ignore, not valid JSON
                        }
                        return <ChatBubble key={idx} role={msg.role} content={displayContent} timestamp={msg.timestamp} />;
                    })}

                    {/* Confirmation Buttons */}
                    {pendingOrder && !sending && (
                        <div className="flex gap-2 ml-10 animate-scale-in">
                            <button
                                onClick={confirmOrder}
                                className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all hover:scale-105"
                            >
                                ✅ Confirm Order
                            </button>
                            <button
                                onClick={() => {
                                    setPendingOrder(null);
                                    addMessage("assistant", "Order cancelled. Browse the menu whenever you're ready! 😊");
                                }}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    )}

                    {sending && (
                        <div className="flex items-center gap-2 ml-10 text-gray-400 animate-fade-in">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                            </div>
                            <span className="text-sm">Campus Bot is typing...</span>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Input Bar */}
            <div className="bg-white border-t border-gray-100 px-4 py-3">
                <div className="max-w-3xl mx-auto flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Type a message..."
                        className="input-field flex-1"
                        disabled={sending}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={sending || !input.trim()}
                        className="btn-primary px-6 flex items-center gap-2"
                    >
                        <span>Send</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
