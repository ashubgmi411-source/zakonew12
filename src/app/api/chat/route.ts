/**
 * Chat API — AI chat assistant for order placement
 * 
 * SECURITY CHANGES:
 * - Requires Firebase ID token verification
 * - Rate limited (20 req/min per IP)
 * - Order ID uses UUID format instead of 6-digit random
 */

import { NextRequest, NextResponse } from "next/server";
import { chatWithFallback, ChatMessage } from "@/lib/llm";
import { getHonorific } from "@/services/llmService";
import { getAuthenticatedUser } from "@/lib/user-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { adminDb } from "@/lib/firebase-admin";
import { generateOrderId } from "@/lib/orderIdUtils";
import { FieldValue } from "firebase-admin/firestore";
import { MenuItemForEngine } from "@/lib/order-engine";
import { deductInventoryForOrder } from "@/services/inventoryService";
import { matchFaq } from "@/lib/faq";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    // SECURITY: Rate limit chat requests (20 per minute)
    const rateLimitResponse = checkRateLimit(req, 20, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    // SECURITY: Require Firebase ID token
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    try {
        const { messages, cart, userProfile, action } = await req.json();

        // SECURITY: Zayko-format order ID (replaces UUID-based ID)
        const generateId = () => generateOrderId();

        // Fetch canteen status for AI context
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
        } catch (e) {
            console.error("Failed to fetch canteen config for chat:", e);
        }

        // Build user context string with gender-respectful addressing
        const userName = userProfile?.name || "";
        const userGender = userProfile?.gender || "";
        const honorific = getHonorific({ name: userName, gender: userGender });
        const userContextBlock = userName
            ? `\n\nCURRENT USER INFO:\n- Name: ${userName}\n- Gender: ${userGender || "not specified"}\n- Honorific to use: ${honorific}\n- Email: ${userProfile?.email || "N/A"}\n- Roll Number: ${userProfile?.rollNumber || "N/A"}`
            : "";

        const canteenStatusBlock = canteenIsOpen
            ? `\n\nCANTEEN STATUS: OPEN (Timing: ${canteenTiming})`
            : `\n\nCANTEEN STATUS: CLOSED (Timing: ${canteenTiming})\nIMPORTANT: Canteen is currently closed. Do NOT suggest any food items. Respond to any food/order request with: "Canteen abhi band hai 😔 Timing: ${canteenTiming}"`;

        // Fetch live menu unconditionally for context injection
        let menuItemsJSON = "[]";
        try {
            const menuSnap = await adminDb.collection("menuItems").where("available", "==", true).get();
            const liveMenu = menuSnap.docs.map((doc) => ({
                id: doc.id,
                name: doc.data().name || "",
                price: doc.data().price || 0,
                // Avoid injecting huge amounts of redundant data to keep prompt small
            }));
            menuItemsJSON = JSON.stringify(liveMenu);
        } catch (e) {
            console.error("Menu fetch error for JARVIS prompt:", e);
            menuItemsJSON = "Failed to load live menu. Apologize to the user.";
        }

        let systemPrompt = `You are Jarvis, the AI assistant for Zayko — an AI-powered canteen management system. You are smart, friendly, and helpful.

AVAILABLE MENU (fetched fresh from database):
${menuItemsJSON}

YOUR CAPABILITIES:
1. Take food orders in Hindi, English, or Hinglish
2. Answer menu/price questions  
3. Check order status
4. Give food recommendations

LANGUAGE RULE: Always reply in the same language the user used.
You understand and respond to:
- Pure Hindi: 'एक आलू परांठा दो'
- Hinglish: 'yaar ek aloo paratha de do bhai'  
- English: 'order one aloo paratha'
- Mixed: 'mujhe 2 burger chahiye with extra cheese'

Common Hindi order phrases to detect:
- 'de do / dena / chahiye / lena hai / la do / order karo' → means: user wants to ORDER
- 'kya hai / menu dikhao / kya milta hai / abhi kya ban raha hai' → means: user wants MENU
- 'kitna / price / daam / kitne ka / sasta kya hai' → means: user wants PRICE INFO
- 'cancel / nahi chahiye / rehne do' → means: CANCEL order

RESPONSE FORMAT — Always respond with valid JSON only:
{
  "action": "ORDER" | "CHAT" | "MENU" | "STATUS",
  "itemId": "firestore_id (only for ORDER)",
  "itemName": "item name (only for ORDER)", 
  "quantity": 1,
  "price": 0,
  "message": "Your conversational reply here"
}

MATCHING RULES:
- Match item names fuzzily (burgar = burger, paratha = aloo paratha, Hindi names: आलू परांठा = aloo paratha)
- Extract quantity from text (do = 2, ek = 1, teen = 3, एक = 1, दो = 2)
- If unclear which item, ask for clarification
- Never make up items not in the menu list

NATURAL LANGUAGE EXAMPLES:
- User: "yaar bhookh lagi hai kuch do" -> You respond with CHAT action and suggest menu items.
- User: "aloo paratha bana do" -> Action: ORDER, itemId: (id), quantity: 1
- User: "2 burger chahiye bhai" -> Action: ORDER, itemId: (id), quantity: 2

NEVER output plain text — ALWAYS output valid JSON.`;

        // Append dynamic context to system prompt
        systemPrompt += userContextBlock;
        systemPrompt += canteenStatusBlock;

        if (action === "place_order" && cart && cart.length > 0 && userProfile) {
            const orderId = generateId();
            const cartSummary = cart
                .map((item: { name: string; quantity: number; price: number }) => `• ${item.name} x${item.quantity} — ₹${item.price * item.quantity}`)
                .join("\n");
            const total = cart.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);

            systemPrompt += `\n\nThe user wants to place an order. Here are the details:
Student Name: ${userProfile.name}
Email: ${userProfile.email}
Roll Number: ${userProfile.rollNumber}

Cart Items:
${cartSummary}

Total: ₹${total}
Order ID: #${orderId}

Generate a short, friendly order confirmation message that:
1. Lists all items with quantities and prices
2. Shows the total amount and Order ID #${orderId}
3. Asks them to confirm the order and mentions the amount will be deducted from their wallet.
Keep it extremely short and concise! NO long explanations.`;

            const chatMessages: ChatMessage[] = [
                { role: "user", content: "I want to place my order" },
            ];

            const { response, provider } = await chatWithFallback(chatMessages, systemPrompt);

            // Extract message if it was wrapped in JSON
            let finalMessage = response;
            try {
                let cleanRaw = response.trim();
                if (cleanRaw.startsWith("```json")) cleanRaw = cleanRaw.replace(/```json/g, "").replace(/```/g, "").trim();
                else if (cleanRaw.startsWith("```")) cleanRaw = cleanRaw.replace(/```/g, "").trim();
                
                const start = cleanRaw.indexOf("{");
                const end = cleanRaw.lastIndexOf("}");
                if (start !== -1 && end > start) {
                    const parsed = JSON.parse(cleanRaw.substring(start, end + 1));
                    if (parsed.message) finalMessage = parsed.message;
                }
            } catch (e) {
                // Keep original
            }

            return NextResponse.json({
                message: finalMessage,
                provider,
                orderId,
                total,
                action: "confirm_order",
            });
        }

        // ── ORDER ENGINE: execute_order action (user confirmed an order) ──
        if (action === "execute_order" && cart && cart.length > 0 && userProfile) {
            if (!isCanteenOpen) {
                return NextResponse.json({
                    status: "ERROR",
                    message: `Canteen abhi band hai! Khulne ka time hai: ${canteenTiming}. Jab open hogi tab order karna, please.`,
                });
            }

            const orderId = generateId();
            const total = cart.reduce(
                (sum: number, item: { unit_price: number; quantity: number }) =>
                    sum + item.unit_price * item.quantity,
                0
            );

            try {
                await adminDb.runTransaction(async (transaction) => {
                    // 1. ALL READS FIRST
                    const userRef = adminDb.collection("users").doc(uid);
                    const userSnap = await transaction.get(userRef);
                    if (!userSnap.exists) throw new Error("User not found");

                    const walletBalance = userSnap.data()?.walletBalance || 0;
                    if (walletBalance < total)
                        throw new Error("Insufficient wallet balance");

                    // Read stock for all items
                    const itemData: Array<{ ref: any; snap: any; item: any }> = [];
                    for (const item of cart) {
                        if (item.item_id) {
                            const itemRef = adminDb.collection("menuItems").doc(item.item_id);
                            const itemSnap = await transaction.get(itemRef);
                            itemData.push({ ref: itemRef, snap: itemSnap, item });
                        }
                    }

                    // 2. ALL VALIDATION & WRITES
                    for (const { snap, item, ref } of itemData) {
                        if (!snap.exists) throw new Error(`Menu item "${item.name}" not found`);
                        const currentQty = snap.data()?.quantity || 0;
                        if (currentQty < item.quantity)
                            throw new Error(`"${item.name}" out of stock (only ${currentQty} left)`);

                        // Queue update
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
                        userName: userProfile.name,
                        userEmail: userProfile.email,
                        userPhone: userSnap.data()?.phone || "",
                        items: cart.map((c: { name: string; quantity: number; unit_price: number; item_id: string }) => ({
                            id: c.item_id, // Store ID for restocking logic
                            name: c.name,
                            quantity: c.quantity,
                            price: c.unit_price,
                        })),
                        total,
                        status: "pending",
                        createdAt: new Date().toISOString(),
                    });

                    // Record wallet transaction
                    const txnRef = adminDb.collection("walletTransactions").doc();
                    transaction.set(txnRef, {
                        userId: uid,
                        type: "debit",
                        amount: total,
                        description: `Order #${orderId}`,
                        createdAt: new Date().toISOString(),
                    });

                    // Auto-deduct raw ingredient stock via recipe mappings
                    try {
                        const orderItemsForInventory = cart.map((c: any) => ({
                            menuItemId: c.item_id || c.id,
                            menuItemName: c.name,
                            quantity: c.quantity,
                        }));
                        await deductInventoryForOrder(transaction, orderItemsForInventory, orderId);
                    } catch (invErr) {
                        console.warn("[Chat] Inventory deduction note:", invErr instanceof Error ? invErr.message : invErr);
                    }
                });

                return NextResponse.json({
                    status: "ORDER_PLACED",
                    message: `✅ Order placed successfully! 🎉\n\n🆔 Order ID: #${orderId}\n💰 ₹${total} deducted from wallet.\n\nAapka order prepare ho raha hai! 🍽️`,
                    orderId,
                    total,
                    action: "order_placed",
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return NextResponse.json({
                    status: "ORDER_FAILED",
                    message: `❌ Order failed: ${message}`,
                });
            }
        }

        const chatMessages: ChatMessage[] = (messages || []).map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

        const lastUserMsg = chatMessages.filter((m) => m.role === "user").pop();

        if (lastUserMsg) {
            const faqResult = matchFaq(lastUserMsg.content);

            if (faqResult.matched) {
                // Static FAQ — return answer directly
                if (faqResult.answer) {
                    return NextResponse.json({ message: faqResult.answer, provider: "faq" });
                }

                // Dynamic FAQ — fetch menu data and build response
                if (faqResult.dynamic === "fastest_items") {
                    try {
                        const menuSnap = await adminDb.collection("menuItems")
                            .where("available", "==", true)
                            .orderBy("preparationTime", "asc")
                            .limit(5)
                            .get();
                        const items = menuSnap.docs.map((d) => d.data());
                        if (items.length === 0) {
                            return NextResponse.json({ message: "Abhi koi fast item available nahi hai 😔", provider: "faq" });
                        }
                        const list = items
                            .map((it) => `• ${it.name} — ₹${it.price} (${it.preparationTime} min)`)
                            .join("\n");
                        return NextResponse.json({
                            message: `Yeh sabse jaldi milne wale items hain 🚀\n\n${list}\n\nOrder karna hai toh cart mein add karo!`,
                            provider: "faq",
                        });
                    } catch (e) {
                        console.error("Dynamic FAQ (fastest) error:", e);
                    }
                }

                if (faqResult.dynamic === "combo_suggestion") {
                    try {
                        const menuSnap = await adminDb.collection("menuItems")
                            .where("available", "==", true)
                            .orderBy("preparationTime", "asc")
                            .limit(10)
                            .get();
                        const items = menuSnap.docs.map((d) => d.data());
                        if (items.length < 2) {
                            return NextResponse.json({ message: "Abhi combo ke liye enough items available nahi hain 😔", provider: "faq" });
                        }
                        // Pick 2-3 items with low prep time for a combo
                        const combo = items.slice(0, 3);
                        const total = combo.reduce((s, it) => s + (it.price || 0), 0);
                        const maxPrep = Math.max(...combo.map((it) => it.preparationTime || 0));
                        const list = combo
                            .map((it) => `• ${it.name} — ₹${it.price}`)
                            .join("\n");
                        return NextResponse.json({
                            message: `Here's a quick combo suggestion 🍽️\n\n${list}\n\n💰 Total: ₹${total}\n⏱️ Ready in ~${maxPrep} min\n\nCart mein add karo aur order place karo!`,
                            provider: "faq",
                        });
                    } catch (e) {
                        console.error("Dynamic FAQ (combo) error:", e);
                    }
                }
            }
        }

        // ── LLM Execution ──
        const { response, provider } = await chatWithFallback(chatMessages, systemPrompt);

        // EXTRA: Provide graceful JSON cleanup since AI models occasionally leak markdown wrapper around JSON
        let parsedLLMResp;
        try {
            let cleanRaw = response.trim();
            if (cleanRaw.startsWith("\`\`\`json")) {
                cleanRaw = cleanRaw.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
            } else if (cleanRaw.startsWith("\`\`\`")) {
                cleanRaw = cleanRaw.replace(/\`\`\`/g, "").trim();
            }

            // Attempt initial JSON extraction via standard boundary brackets if there are trailing conversational strings
            const jsonStartInx = cleanRaw.indexOf("{");
            const jsonEndInx = cleanRaw.lastIndexOf("}");
            if (jsonStartInx !== -1 && jsonEndInx !== -1 && jsonEndInx > jsonStartInx) {
                cleanRaw = cleanRaw.substring(jsonStartInx, jsonEndInx + 1);
            }

            parsedLLMResp = JSON.parse(cleanRaw);
        } catch (e) {
            console.warn("Failed to natively parse LLM JSON framework fallback to CHAT mode:", e);
            parsedLLMResp = { action: "CHAT", message: response };
        }

        // ── Block Output if LLM Hallucinates Order While Closed ──
        if (parsedLLMResp?.action === "ORDER" && !isCanteenOpen) {
            parsedLLMResp = { 
                action: "CHAT", 
                message: `Canteen abhi band hai yaar! Khulne ka time hai: ${canteenTiming}. Abhi order place nahi ho sakta 😔` 
            };
        }

        if (action === "confirm_order" && cart && cart.length > 0) {
            // Re-generate order ID and place it
            const orderId = generateId();
            const total = cart.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);

            try {
                await adminDb.runTransaction(async (transaction) => {
                    // 1. ALL READS FIRST
                    const userRef = adminDb.collection("users").doc(uid);
                    const userSnap = await transaction.get(userRef);
                    if (!userSnap.exists) throw new Error("User not found");

                    const walletBalance = userSnap.data()?.walletBalance || 0;
                    if (walletBalance < total) throw new Error("Insufficient wallet balance");

                    // Read stock for all items
                    const itemDataStore: Array<{ ref: any; snap: any; item: any }> = [];
                    for (const item of cart) {
                        // In confirm_order, the cart items might have 'id' instead of 'item_id'
                        const itemId = item.item_id || item.id;
                        if (itemId) {
                            const itemRef = adminDb.collection("menuItems").doc(itemId);
                            const itemSnap = await transaction.get(itemRef);
                            itemDataStore.push({ ref: itemRef, snap: itemSnap, item });
                        }
                    }

                    // 2. ALL VALIDATION & WRITES
                    for (const { snap, item, ref } of itemDataStore) {
                        if (!snap.exists) throw new Error(`Menu item "${item.name}" no longer exists`);
                        const currentQty = snap.data()?.quantity || 0;
                        if (currentQty < item.quantity) {
                            throw new Error(`"${item.name}" out of stock (only ${currentQty} left)`);
                        }
                        transaction.update(ref, {
                            quantity: FieldValue.increment(-item.quantity),
                            updatedAt: new Date().toISOString()
                        });
                    }

                    // Deduct wallet
                    transaction.update(userRef, { walletBalance: FieldValue.increment(-total) });

                    // Create order
                    const orderRef = adminDb.collection("orders").doc();
                    transaction.set(orderRef, {
                        orderId,
                        userId: uid,
                        userName: userProfile.name,
                        userEmail: userProfile.email,
                        userPhone: userSnap.data()?.phone || "",
                        items: cart.map((c: any) => ({
                            name: c.name,
                            quantity: c.quantity,
                            price: c.price || c.unit_price,
                        })),
                        total,
                        status: "pending",
                        createdAt: new Date().toISOString(),
                    });

                    // Record transaction
                    const txnRef = adminDb.collection("walletTransactions").doc();
                    transaction.set(txnRef, {
                        userId: uid,
                        type: "debit",
                        amount: total,
                        description: `Jarvis Order #${orderId}`,
                        createdAt: new Date().toISOString(),
                    });

                    // Auto-deduct raw ingredient stock via recipe mappings
                    try {
                        const orderItemsForInventory = cart.map((c: any) => ({
                            menuItemId: c.item_id || c.id,
                            menuItemName: c.name,
                            quantity: c.quantity,
                        }));
                        await deductInventoryForOrder(transaction, orderItemsForInventory, orderId);
                    } catch (invErr) {
                        console.warn("[Chat] Inventory deduction note:", invErr instanceof Error ? invErr.message : invErr);
                    }
                });

                return NextResponse.json({
                    message: `✅ Order placed successfully by Jarvis! 🎉\n\n🆔 Order ID: #${orderId}\n💰 ₹${total} deducted from wallet.\n\nAapka order prepare ho raha hai! 🍽️`,
                    provider: "jarvis-executor",
                    action: "order_placed"
                });
            } catch (err: any) {
                return NextResponse.json({ message: `❌ Order failed: ${err.message}`, provider: "error" });
            }
        }

        return NextResponse.json({ ...parsedLLMResp, provider });
    } catch (error: any) {
        console.error("Chat error:", error);
        return NextResponse.json(
            { error: error?.message || String(error), provider: "error" },
            { status: 500 }
        );
    }
}
