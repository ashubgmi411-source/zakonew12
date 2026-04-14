/**
 * Unified Assistant API — Smart Conversational Food Ordering Agent
 *
 * Orchestrates: Context → Emotion → Intent → Recommendations → Upsell → LLM → Response
 *
 * POST /api/assistant
 *
 * Input:  { messages, userProfile, action?, cart? }
 * Output: { message, action, suggestions, upsell, orderPreview, voiceText }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/user-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { adminDb } from "@/lib/firebase-admin";
import { generateOrderId } from "@/lib/orderIdUtils";
import { FieldValue } from "firebase-admin/firestore";
import { deductInventoryForOrder } from "@/services/inventoryService";

// Intelligence modules
import {
    getContext,
    updateContext,
    resolveContextReference,
    buildContextSummary,
    setPendingOrder,
    clearPendingOrder,
    recordOrder,
    type OrderedItemMemory,
} from "@/lib/assistant/contextManager";
import { detectEmotion, detectLanguage } from "@/lib/assistant/emotionDetector";
import {
    generateRecommendations,
    extractOrderHistoryItems,
    type MenuItemForRecommendation,
} from "@/lib/assistant/recommendationEngine";
import { generateUpsell, type MenuItemForUpsell } from "@/lib/assistant/upsellEngine";
import { buildSystemPrompt } from "@/lib/assistant/personalityEngine";

export const runtime = "nodejs";

// ─── Types ──────────────────────────────────────

interface AssistantRequest {
    messages: Array<{ role: string; content: string; timestamp?: number }>;
    userProfile: {
        name: string;
        email: string;
        phone?: string;
        rollNumber?: string;
        gender?: string;
        walletBalance?: number;
    };
    action?: string;
    cart?: any[];
}

// ─── Main Handler ───────────────────────────────

export async function POST(req: NextRequest) {
    // Rate limit: 25 req/min
    const rateLimitResponse = checkRateLimit(req, 25, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check
    let uid = await getAuthenticatedUser(req);
    if (!uid) {
        if (process.env.NODE_ENV === "development") {
            uid = "test-user-id";
        } else {
            return NextResponse.json(
                { action: "UNAVAILABLE", message: "Login karo pehle! 🔐" },
                { status: 401 }
            );
        }
    }

    try {
        const body: AssistantRequest = await req.json();
        const { messages, userProfile, action, cart } = body;

        const userName = userProfile?.name || "Guest";
        const userGender = userProfile?.gender || "";

        // ─── Step 0: Get/create conversation context ───
        const ctx = getContext(uid, userName);

        // ─── Step 0.5: Handle order execution (confirm / place) ───
        if (action === "execute_order" && cart && cart.length > 0) {
            return await executeOrder(uid, cart, userProfile);
        }

        // ─── Step 1: Get the latest user message ───
        const lastUserMsg = messages?.filter((m) => m.role === "user").pop()?.content || "";
        if (!lastUserMsg && !action) {
            return NextResponse.json({ action: "CHAT", message: "Kuch bolna toh padega yaar! 😄" });
        }

        // ─── Step 2: Emotion + Language detection ───
        const { emotion } = detectEmotion(lastUserMsg);
        const language = detectLanguage(lastUserMsg);

        // ─── Step 3: Fetch live menu ───
        const menuSnap = await adminDb.collection("menuItems").get();
        const liveMenu = menuSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "",
            price: doc.data().price || 0,
            available: doc.data().available !== false,
            quantity: doc.data().quantity || 0,
            category: doc.data().category || "",
            preparationTime: doc.data().preparationTime || 10,
        }));
        const availableMenu = liveMenu.filter((m) => m.available && m.quantity > 0);

        // ─── Step 4: Fetch wallet balance ───
        let walletBalance = userProfile?.walletBalance || 0;
        try {
            const userDoc = await adminDb.collection("users").doc(uid).get();
            if (userDoc.exists) {
                walletBalance = userDoc.data()?.walletBalance || 0;
            }
        } catch { /* use profile balance */ }

        // ─── Step 5: Check for context references ("ek aur", "same again") ───
        const contextItems = resolveContextReference(uid, lastUserMsg);
        let contextHint = "";
        if (contextItems) {
            const itemsList = contextItems.map((i) => `${i.itemName} x${i.quantity}`).join(", ");
            contextHint = `\nUSER REFERENCE DETECTED: User is repeating a previous order: ${itemsList}. Process this as an ORDER.`;
        }

        // ─── Step 6: Fetch user order history for recommendations ───
        let orderHistory: string[] = [];
        let recommendationHint = "";
        try {
            const ordersSnap = await adminDb
                .collection("orders")
                .where("userId", "==", uid)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            const orders = ordersSnap.docs.map((d) => d.data() as { items: Array<{ name: string }> });
            orderHistory = extractOrderHistoryItems(orders);

            // Pre-generate recommendation text
            const recs = generateRecommendations(
                availableMenu as MenuItemForRecommendation[],
                orderHistory,
                userName,
                3
            );
            if (recs.message) {
                recommendationHint = recs.message;
            }
        } catch {
            // Order history not critical — continue without it
        }

        // ─── Step 7: Get canteen status ───
        let canteenIsOpen = true;
        let canteenTiming = "9AM – 6PM";
        try {
            const configDoc = await adminDb.doc("settings/canteenConfig").get();
            if (configDoc.exists) {
                const config = configDoc.data();
                canteenIsOpen = config?.isOpen !== false;
                if (config?.startTime && config?.endTime) {
                    canteenTiming = `${config.startTime} – ${config.endTime}`;
                }
            }
        } catch { /* default */ }

        // ─── Step 8: Build the super system prompt ───
        const menuListStr = availableMenu
            .map((m) => `- ${m.name} (ID: ${m.id}, ₹${m.price}, Stock: ${m.quantity}, Category: ${m.category})`)
            .join("\n");

        const contextSummary = buildContextSummary(uid) + (contextHint ? `\n${contextHint}` : "");

        const systemPrompt = buildSystemPrompt({
            userName,
            userGender,
            walletBalance,
            menuListStr,
            contextSummary,
            emotionState: emotion,
            languagePreference: language,
            recommendationHint,
            canteenIsOpen,
            canteenTiming,
        });

        // ─── Step 9: Call LLM ───
        let responseJsonStr = "";
        let llmProvider = "none";

        // Trim conversation history to last 6 messages to avoid token limits
        const trimmedMessages = messages.slice(-6).map((m) => ({
            role: m.role === "assistant" ? "assistant" as const : "user" as const,
            content: m.content,
        }));

        // Try Groq first (fastest)
        if (process.env.GROQ_API_KEY) {
            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...trimmedMessages,
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.3,
                        max_tokens: 1024,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    responseJsonStr = data.choices?.[0]?.message?.content || "";
                    llmProvider = "groq";
                } else {
                    const errText = await res.text().catch(() => "");
                    console.error(`[Assistant] Groq failed (${res.status}):`, errText.slice(0, 300));
                }
            } catch (e) {
                console.error("[Assistant] Groq network error:", e);
            }
        }

        // Fallback 1: Gemini (primary key)
        if (!responseJsonStr && process.env.GEMINI_API_KEY) {
            try {
                const apiKey = process.env.GEMINI_API_KEY;
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

                const historyParts = trimmedMessages.map((m) => ({
                    role: m.role === "assistant" ? "model" as const : "user" as const,
                    parts: [{ text: m.content }],
                }));

                if (historyParts.length > 0 && historyParts[0].role === "user") {
                    historyParts[0].parts[0].text = systemPrompt + "\n\nUser: " + historyParts[0].parts[0].text;
                }

                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: historyParts,
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.3,
                        },
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    responseJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    llmProvider = "gemini";
                } else {
                    const errText = await res.text().catch(() => "");
                    console.error(`[Assistant] Gemini failed (${res.status}):`, errText.slice(0, 300));
                }
            } catch (e) {
                console.error("[Assistant] Gemini network error:", e);
            }
        }

        // Fallback 2: Gemini with rotation key
        if (!responseJsonStr && process.env.GEMINI_KEYS) {
            const keys = process.env.GEMINI_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
            for (const apiKey of keys) {
                if (apiKey === process.env.GEMINI_API_KEY) continue; // Skip primary (already tried)
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

                    const historyParts = trimmedMessages.map((m) => ({
                        role: m.role === "assistant" ? "model" as const : "user" as const,
                        parts: [{ text: m.content }],
                    }));

                    if (historyParts.length > 0 && historyParts[0].role === "user") {
                        historyParts[0].parts[0].text = systemPrompt + "\n\nUser: " + historyParts[0].parts[0].text;
                    }

                    const res = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: historyParts,
                            generationConfig: {
                                responseMimeType: "application/json",
                                temperature: 0.3,
                            },
                        }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        responseJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (responseJsonStr) {
                            llmProvider = "gemini-rotation";
                            break;
                        }
                    } else {
                        const errText = await res.text().catch(() => "");
                        console.error(`[Assistant] Gemini rotation key failed (${res.status}):`, errText.slice(0, 200));
                    }
                } catch (e) {
                    console.error("[Assistant] Gemini rotation error:", e);
                }
            }
        }

        // Fallback 3: Groq rotation keys
        if (!responseJsonStr && process.env.GROQ_KEYS) {
            const keys = process.env.GROQ_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
            for (const key of keys) {
                if (key === process.env.GROQ_API_KEY) continue; // Skip primary
                try {
                    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${key}`,
                        },
                        body: JSON.stringify({
                            model: "llama-3.1-8b-instant",
                            messages: [
                                { role: "system", content: systemPrompt },
                                ...trimmedMessages,
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0.3,
                            max_tokens: 1024,
                        }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        responseJsonStr = data.choices?.[0]?.message?.content || "";
                        if (responseJsonStr) {
                            llmProvider = "groq-rotation";
                            break;
                        }
                    }
                } catch (e) {
                    console.error("[Assistant] Groq rotation error:", e);
                }
            }
        }

        if (!responseJsonStr) {
            console.error("[Assistant] ALL LLM providers failed. GROQ_KEY set:", !!process.env.GROQ_API_KEY, "GEMINI_KEY set:", !!process.env.GEMINI_API_KEY);
            return NextResponse.json({
                action: "UNAVAILABLE",
                message: "Sorry yaar, AI services abhi down hain. Thodi der baad try karo! 🙏",
                provider: "none",
            });
        }

        // ─── Step 10: Parse LLM response ───
        let parsed: any;
        try {
            let clean = responseJsonStr.trim();
            // Strip markdown wrappers
            clean = clean.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
            // Extract JSON boundaries
            const jsonStart = clean.indexOf("{");
            const jsonEnd = clean.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                clean = clean.substring(jsonStart, jsonEnd + 1);
            }
            parsed = JSON.parse(clean);
        } catch {
            parsed = { action: "CHAT", message: responseJsonStr };
        }

        // ─── Step 11: Post-process based on action ───
        let llmAction = (parsed.action || "CHAT").toUpperCase();
        let upsellData = null;
        let suggestions: string[] = parsed.suggestions || [];

        // ── Block Output if LLM Hallucinates Order While Closed ──
        if ((llmAction === "ORDER" || llmAction === "CONFIRM_PENDING") && !canteenIsOpen) {
            llmAction = "CHAT";
            parsed.action = "CHAT";
            parsed.message = `Canteen abhi band hai yaar! Khulne ka time hai: ${canteenTiming}. Jab open hogi tab order karna, please 😔`;
        }

        // Handle ORDER action
        if (llmAction === "ORDER") {
            const reqItems = parsed.orderItems || [];
            
            // Fallback for single item format just in case
            if (reqItems.length === 0 && parsed.itemName) {
                reqItems.push({ itemName: parsed.itemName, quantity: parsed.quantity || 1 });
            }

            if (reqItems.length === 0) {
                parsed.action = "UNAVAILABLE";
                parsed.message = parsed.message || "Aapne kya order kiya samajh nahi aaya. Kripya dubara batayein?";
            } else {
                const orderItems: OrderedItemMemory[] = [];
                const unavailableNames: string[] = [];
                const outOfStockNames: string[] = [];
                const validNames: string[] = [];

                for (const reqItem of reqItems) {
                    const matchedItem = availableMenu.find(
                        (m) =>
                            m.id === reqItem.itemId ||
                            m.name.toLowerCase() === (reqItem.itemName || "").toLowerCase()
                    );

                    if (!matchedItem) {
                        unavailableNames.push(reqItem.itemName || "Unknown item");
                    } else if (matchedItem.quantity < (reqItem.quantity || 1)) {
                        outOfStockNames.push(`${matchedItem.name} (sirf ${matchedItem.quantity} bacha hai)`);
                    } else {
                        orderItems.push({
                            itemId: matchedItem.id,
                            itemName: matchedItem.name,
                            quantity: parseInt(reqItem.quantity) || 1,
                            price: matchedItem.price,
                        });
                        validNames.push(matchedItem.name);
                    }
                }

                if (orderItems.length === 0) {
                    parsed.action = "UNAVAILABLE";
                    if (unavailableNames.length > 0) parsed.message = `Sorry, "${unavailableNames.join(", ")}" menu mein nahi mila.`;
                    else if (outOfStockNames.length > 0) parsed.message = `${outOfStockNames.join(", ")} out of stock hain.`;
                } else {
                    // Save valid order items into parsed for frontend
                    parsed.orderItems = orderItems;
                    
                    // Generate upsell based on first valid item
                    const upsellResult = generateUpsell(
                        [validNames[0]],
                        availableMenu as MenuItemForUpsell[],
                        2
                    );
                    if (upsellResult.suggestions.length > 0) {
                        upsellData = {
                            message: upsellResult.message,
                            items: upsellResult.suggestions.map((s) => ({
                                id: s.item.id,
                                name: s.item.name,
                                price: s.item.price,
                            })),
                        };
                        if (upsellResult.message) {
                            parsed.message = (parsed.message || "") + "\n\n💡 " + upsellResult.message;
                            parsed.voiceText = `Order lag gaya! ${upsellResult.voiceText}`;
                        }
                    } else {
                        parsed.voiceText = "Order lag gaya! Aur kuch lenge?";
                    }

                    // Set pending order in context
                    setPendingOrder(uid, orderItems);
                    
                    // Add warnings if any part of the order failed
                    if (unavailableNames.length > 0 || outOfStockNames.length > 0) {
                        const issues = [...unavailableNames.map(n => `"${n}" menu mein nahi hai`), ...outOfStockNames].join(", ");
                        parsed.message = `Main ${validNames.join(", ")} aapke order mein add kar diya hai!\nLekin dhyan de: ${issues}.\n\n` + (parsed.message || "");
                    }
                }
            }
        }

        // Handle WALLET action
        if (llmAction === "WALLET") {
            parsed.message = parsed.message || `${userName.split(" ")[0]}, tumhara wallet balance ₹${walletBalance} hai.`;
            if (walletBalance < 50) {
                parsed.message += " Balance thoda kam hai, top-up kar lo! 💰";
            }
        }

        // Handle RECOMMENDATION action
        if (llmAction === "RECOMMENDATION" || llmAction === "MENU") {
            if (recommendationHint) {
                parsed.message = parsed.message || recommendationHint;
            }
            // Add suggestion names
            if (suggestions.length === 0) {
                suggestions = availableMenu.slice(0, 5).map((m) => m.name);
            }
        }

        // Handle CONFIRM_PENDING
        if (llmAction === "CONFIRM_PENDING") {
            const pendingCtx = getContext(uid);
            if (pendingCtx.pendingOrder && pendingCtx.pendingOrder.length > 0) {
                // Execute the pending order
                const execItems = pendingCtx.pendingOrder.map((item) => ({
                    item_id: item.itemId,
                    name: item.itemName,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity,
                }));
                clearPendingOrder(uid);
                return await executeOrder(uid, execItems, userProfile);
            } else {
                parsed.message = "Koi pending order nahi hai abhi. Naya order dena hai? 😊";
                parsed.action = "CHAT";
            }
        }

        // Handle CANCEL_PENDING
        if (llmAction === "CANCEL_PENDING") {
            clearPendingOrder(uid);
            parsed.message = parsed.message || "Order cancel kar diya 👍 Aur kuch chahiye?";
            parsed.action = "CHAT";
        }

        // ─── Step 12: Update conversation context ───
        updateContext(uid, {
            lastIntent: llmAction as any,
            emotionState: emotion,
            languagePreference: language,
            lastSuggestedItems: suggestions,
        });

        // ─── Step 13: Build final response ───
        return NextResponse.json({
            ...parsed,
            provider: llmProvider,
            suggestions,
            upsell: upsellData,
            walletBalance,
            voiceText: parsed.voiceText || stripEmojis(parsed.message || ""),
            items: parsed.orderItems || [], // Provide items for frontend compatibility
        });
    } catch (error: any) {
        console.error("[Assistant] Error:", error);
        return NextResponse.json(
            { action: "UNAVAILABLE", message: "Server error aa gaya yaar! 😔 Dobara try karo.", details: error.message || String(error) },
            { status: 500 }
        );
    }
}

// ─── Order Execution ────────────────────────────

async function executeOrder(uid: string, cart: any[], userProfile: any) {
    const orderId = generateOrderId();
    const total = cart.reduce(
        (sum: number, item: any) => sum + (item.unit_price || item.price || 0) * (item.quantity || 1),
        0
    );

    try {
        await adminDb.runTransaction(async (transaction) => {
            // 1. ALL READS FIRST
            const userRef = adminDb.collection("users").doc(uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) throw new Error("User not found");

            const walletBalance = userSnap.data()?.walletBalance || 0;
            if (walletBalance < total) {
                throw new Error(`Insufficient balance — ₹${total} chahiye lekin ₹${walletBalance} hai`);
            }

            // Read stock for all items
            const itemData: Array<{ ref: any; snap: any; item: any }> = [];
            for (const item of cart) {
                const itemId = item.item_id || item.id;
                if (itemId) {
                    const itemRef = adminDb.collection("menuItems").doc(itemId);
                    const itemSnap = await transaction.get(itemRef);
                    itemData.push({ ref: itemRef, snap: itemSnap, item });
                }
            }

            // 2. VALIDATE & WRITE
            for (const { snap, item, ref } of itemData) {
                if (!snap.exists) throw new Error(`"${item.name}" menu mein nahi mila`);
                const currentQty = snap.data()?.quantity || 0;
                if (currentQty < item.quantity) {
                    throw new Error(`"${item.name}" out of stock — sirf ${currentQty} bacha hai`);
                }
                transaction.update(ref, {
                    quantity: FieldValue.increment(-item.quantity),
                });
            }

            // Deduct wallet
            transaction.update(userRef, {
                walletBalance: FieldValue.increment(-total),
            });

            // Create order
            const orderRef = adminDb.collection("orders").doc();
            transaction.set(orderRef, {
                orderId,
                userId: uid,
                userName: userProfile?.name || "",
                userEmail: userProfile?.email || "",
                userPhone: userSnap.data()?.phone || "",
                items: cart.map((c: any) => ({
                    id: c.item_id || c.id,
                    name: c.name,
                    quantity: c.quantity,
                    price: c.unit_price || c.price,
                })),
                total,
                status: "pending",
                createdAt: new Date().toISOString(),
            });

            // Wallet transaction record
            const txnRef = adminDb.collection("walletTransactions").doc();
            transaction.set(txnRef, {
                userId: uid,
                type: "debit",
                amount: total,
                description: `Ziva Order #${orderId}`,
                createdAt: new Date().toISOString(),
            });

            // Inventory deduction
            try {
                const orderItemsForInventory = cart.map((c: any) => ({
                    menuItemId: c.item_id || c.id,
                    menuItemName: c.name,
                    quantity: c.quantity,
                }));
                await deductInventoryForOrder(transaction, orderItemsForInventory, orderId);
            } catch (invErr) {
                console.warn("[Assistant] Inventory note:", invErr instanceof Error ? invErr.message : invErr);
            }
        });

        // Record in context
        recordOrder(
            uid,
            cart.map((c: any) => ({
                itemId: c.item_id || c.id,
                itemName: c.name,
                quantity: c.quantity,
                price: c.unit_price || c.price,
            }))
        );

        const itemsSummary = cart
            .map((c: any) => `${c.name} x${c.quantity}`)
            .join(", ");

        return NextResponse.json({
            status: "ORDER_PLACED",
            action: "order_placed",
            message: `✅ Order placed! 🎉\n\n🆔 #${orderId}\n🛒 ${itemsSummary}\n💰 ₹${total} wallet se deducted\n\nTumhara order prepare ho raha hai! 🍽️`,
            voiceText: `Order placed! ${itemsSummary}. ${total} rupees deducted. Tumhara order prepare ho raha hai!`,
            orderId,
            total,
            provider: "ziva-executor",
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({
            status: "ORDER_FAILED",
            action: "order_failed",
            message: `❌ Order fail: ${message}`,
            voiceText: `Order fail ho gaya. ${message}`,
        });
    }
}

// ─── Helpers ────────────────────────────────────

function stripEmojis(text: string): string {
    return text.replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
        ""
    ).replace(/\s+/g, " ").trim();
}
