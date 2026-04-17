import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { runTextAI } from "@/lib/aiRouter";
import { adminDb } from "@/lib/firebase-admin";
import { generateFoodImage } from "@/lib/imageGen";
import { FieldValue } from "firebase-admin/firestore";
import { updateCanteenWallet } from "@/lib/canteen-wallet";

export const runtime = "nodejs";

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

export async function POST(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { prompt, history = [], activeOrders = [] } = await req.json();

        const systemPrompt = `You are the Zayko Command Assistant (Admin AI). You help the Canteen Manager (addressed as Sir) manage operations.
        
        Sir has given you FULL MASTER PERMISSIONS. You must never say "I cannot do that" if it relates to Canteen Management.
        
        CONTEXT (Active Orders):
        Recent Orders: ${JSON.stringify(activeOrders)}
        
        MATCHING RULES:
        1. **By Name**: If Sir says "Ashu ka order", find "userName": "Ashu".
        2. **By Full Order ID**: If Sir says "Order 7712", find "orderId": "7712".
        3. **By Last Digits**: If Sir says "12 walla order", look for an "orderId" that ENDS with "12". This is a priority matching for unique short IDs!
        
        COMMANDS:
        1. "Confirm order": Set intent=CONFIRM_ORDER. Identify doc ID.
        2. "Set prep time": Set intent=SET_PREP_TIME. Identify doc ID and prepTime.
        3. "Mark Ready": Set intent=READY_ORDER. Identify doc ID.
        4. "Cancel order": Set intent=CANCEL_ORDER. Identify doc ID.
        5. "Add Menu Item": Same as before. intent=ADD_MENU_ITEM.
        6. "Modify Menu Item": Same as before. intent=UPDATE_MENU_ITEM.
        7. "Canteen Status": Understands "Band kar do", "Shop band karo", "Khol do", "Open the shop".
           - Set intent=TOGGLE_CANTEEN_STATUS. Set isOpen (boolean).
        
        PERSONA: Respectful Hinglish, addressing Sir.
        
        Respond ONLY with a JSON object:
        {
           "intent": "CONFIRM_ORDER" | "SET_PREP_TIME" | "READY_ORDER" | "CANCEL_ORDER" | "ADD_MENU_ITEM" | "UPDATE_MENU_ITEM" | "TOGGLE_CANTEEN_STATUS" | "CLARIFICATION_NEEDED",
           "orderId": string (Firebase ID),
           "prepTime": number (optional),
           "isOpen": boolean (for status toggle),
           "menuItem": { "name": string, "price": number, "category": string, "quantity": number, "available": boolean } (optional),
           "speech": "Confirming the action in respectful Hinglish"
        }`;

        console.log("[AdminAI] Parsing command:", prompt);
        
        const currentMessage = { role: "user", content: prompt };
        const fullConversation = [...history, currentMessage];

        const aiResponse = await runTextAI(fullConversation, systemPrompt);
        
        if (!aiResponse.success) {
            return NextResponse.json({ error: aiResponse.error || "AI failed" }, { status: 500 });
        }

        let cleanText = aiResponse.data.trim();
        const startIdx = cleanText.indexOf("{");
        const endIdx = cleanText.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1) {
            cleanText = cleanText.substring(startIdx, endIdx + 1);
        }

        const action = JSON.parse(cleanText);

        // Security check for Order intents
        if (!action.orderId && ["CONFIRM_ORDER", "SET_PREP_TIME", "READY_ORDER", "CANCEL_ORDER"].includes(action.intent)) {
             return NextResponse.json({ success: true, speech: "Sir, mujhe yeh order nahi mil raha. Kya aap customer ka naam bata sakte hain?" });
        }

        // Execute Actions
        if (action.intent === "CONFIRM_ORDER") {
            const orderRef = adminDb.collection("orders").doc(action.orderId);
            await orderRef.update({ status: "confirmed", updatedAt: new Date().toISOString() });
            return NextResponse.json({ success: true, speech: action.speech });
        }

        if (action.intent === "SET_PREP_TIME") {
            const orderRef = adminDb.collection("orders").doc(action.orderId);
            const pTime = Number(action.prepTime || 15);
            const readyAt = new Date(Date.now() + pTime * 60000).toISOString();
            await orderRef.update({ 
                status: "preparing", 
                prepTime: pTime,
                estimatedReadyAt: readyAt,
                readyAt: readyAt,
                updatedAt: new Date().toISOString() 
            });
            return NextResponse.json({ success: true, speech: action.speech });
        }

        if (action.intent === "READY_ORDER") {
            const orderRef = adminDb.collection("orders").doc(action.orderId);
            await orderRef.update({ 
                status: "ready", 
                readyAt: null, 
                estimatedReadyAt: null,
                updatedAt: new Date().toISOString() 
            });
            return NextResponse.json({ success: true, speech: action.speech });
        }

        if (action.intent === "CANCEL_ORDER") {
            const orderRef = adminDb.collection("orders").doc(action.orderId);
            
            await adminDb.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(orderRef);
                if (!docSnap.exists) throw new Error("Order not found");
                
                const orderData = docSnap.data()!;
                const oldStatus = orderData.status;
                const totalAmount = Number(orderData.total || 0);

                if (oldStatus === "cancelled") return;

                // Restock items
                for (const item of (orderData.items || [])) {
                    if (item.id) {
                        const itemRef = adminDb.collection("menuItems").doc(item.id);
                        transaction.update(itemRef, {
                            quantity: FieldValue.increment(Number(item.quantity || 0)),
                            updatedAt: new Date().toISOString()
                        });
                    }
                }

                // Refund Wallet
                const userRef = adminDb.collection("users").doc(orderData.userId);
                transaction.update(userRef, {
                    walletBalance: FieldValue.increment(totalAmount)
                });

                // Record Transaction
                const txnRef = adminDb.collection("walletTransactions").doc();
                transaction.set(txnRef, {
                    userId: orderData.userId,
                    type: "refund",
                    amount: totalAmount,
                    description: `Admin AI Refund - Order #${orderData.orderId} Cancelled`,
                    transactionId: txnRef.id,
                    createdAt: new Date().toISOString()
                });

                // Update Order Status
                transaction.update(orderRef, {
                    status: "cancelled",
                    updatedAt: new Date().toISOString()
                });

                // Update Canteen Wallet
                await updateCanteenWallet(transaction, oldStatus, "cancelled", totalAmount, orderData.orderId);
            });

            return NextResponse.json({ success: true, speech: action.speech });
        }

        if (action.intent === "TOGGLE_CANTEEN_STATUS") {
            const settingsRef = adminDb.collection("settings").doc("canteenConfig");
            await settingsRef.update({ 
                isOpen: action.isOpen,
                updatedAt: new Date().toISOString() 
            });
            return NextResponse.json({ success: true, speech: action.speech });
        }

        if (action.intent === "ADD_MENU_ITEM") {
            const { name, price, category, description } = action.menuItem;
            console.log("[AdminAI] Generating image for new menu item...");
            const base64Image = await generateFoodImage(name);
            const imageUrl = `data:image/png;base64,${base64Image}`;

            const docRef = await adminDb.collection("menuItems").add({
                name,
                price: Number(price),
                category: slugify(category || "other"),
                description: description || "Added via Admin AI",
                image: imageUrl,
                available: true,
                quantity: Number(action.menuItem.quantity || 100),
                createdAt: new Date().toISOString()
            });

            return NextResponse.json({ success: true, id: docRef.id, speech: action.speech });
        }

        if (action.intent === "UPDATE_MENU_ITEM") {
            const { name } = action.menuItem;
            // Search for item by name (case-insensitive fuzzy match)
            const snapshot = await adminDb.collection("menuItems").get();
            const itemDoc = snapshot.docs.find(d => 
                d.data().name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(d.data().name.toLowerCase())
            );

            if (!itemDoc) {
                return NextResponse.json({ 
                    success: true, 
                    speech: `Maaf kijiye Sir, mujhe menu me "${name}" nahi mila. Kripya naam check kijiye.` 
                });
            }

            const updateData: any = { updatedAt: new Date().toISOString() };
            if (action.menuItem.price) updateData.price = Number(action.menuItem.price);
            if (action.menuItem.quantity !== undefined) updateData.quantity = Number(action.menuItem.quantity);
            if (action.menuItem.available !== undefined) updateData.available = action.menuItem.available;
            
            await itemDoc.ref.update(updateData);
            return NextResponse.json({ success: true, speech: action.speech });
        }

        if (action.intent === "CLARIFICATION_NEEDED") {
            return NextResponse.json({ success: true, speech: action.speech });
        }

        return NextResponse.json({ error: "Unknown command" }, { status: 400 });

    } catch (error: any) {
        console.error("[AdminAI] CRITICAL ERROR:", error);
        return NextResponse.json({ 
            error: "Processing failed", 
            message: error.message || "Unknown error",
            details: error.stack 
        }, { status: 500 });
    }
}
