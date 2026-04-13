import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/user-auth";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ action: "UNAVAILABLE", message: "Unauthorized login." }, { status: 401 });
    }

    try {
        const { messages } = await req.json();
        
        // 1. Fetch live menu from Firestore
        const menuSnap = await adminDb.collection("menuItems").where("available", "==", true).get();
        const liveMenu = menuSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "",
            price: doc.data().price || 0,
            quantity: doc.data().quantity || 0,
        }));
        
        // 2. Pass menu to LLM system prompt
        const menuList = liveMenu.map(m => `- ${m.name} (ID: ${m.id}, Price: ₹${m.price}, Stock: ${m.quantity})`).join("\n");
        const systemPrompt = `You are Jarvis, AI assistant for Zayko.

AVAILABLE MENU:
${menuList}

RESPONSE FORMAT:
You must ONLY return a valid JSON object. Do not include markdown ticks like \`\`\`json or any text outside the braces.
{
  "action": "ORDER" | "CHAT" | "UNAVAILABLE",
  "itemId": "firestore_id (only for ORDER)",
  "itemName": "item name (only for ORDER)",
  "itemPrice": 55,
  "quantity": 1,
  "message": "Friendly Hinglish response"
}

RULES:
1. If the user wants to order an item, ensure it is in the menu. Action="ORDER". Return itemId, itemName, itemPrice, quantity, and a friendly message.
2. If order item is not in the menu or user asks for impossible food, Action="UNAVAILABLE" and message explaining it.
3. For general queries, Action="CHAT" and message.
4. Always speak Hinglish unless they use English. Fuzzily match item names.
`;

        const lastUserMsg = messages[messages.length - 1]?.content || "";

        let responseJsonStr = "";
        let groqSuccess = false;

        // 5. Try Groq first
        if (process.env.GROQ_API_KEY) {
            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...messages
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.2
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    responseJsonStr = data.choices[0].message.content;
                    groqSuccess = true;
                }
            } catch (e) {
                console.error("Groq error:", e);
            }
        }

        // Try Gemini fallback
        if (!groqSuccess && process.env.GEMINI_API_KEY) {
            try {
                const apiKey = process.env.GEMINI_API_KEY;
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                
                const historyParts = messages.map((m: any) => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                }));
                // Insert system prompt into first user message
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
                            temperature: 0.2
                        }
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    responseJsonStr = data.candidates[0].content.parts[0].text;
                }
            } catch (e) {
                console.error("Gemini error:", e);
            }
        }

        if (!responseJsonStr) {
            return NextResponse.json({
                action: "UNAVAILABLE",
                message: "Sorry, server side kuch issue hai"
            });
        }

        let parsed;
        try {
            parsed = JSON.parse(responseJsonStr);
        } catch (e) {
            let clean = responseJsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
            try {
                parsed = JSON.parse(clean);
            } catch {
                parsed = { action: "CHAT", message: clean };
            }
        }

        // 4. Validate Stock / Availability
        if (parsed.action === "ORDER") {
            const item = liveMenu.find(m => m.id === parsed.itemId || m.name.toLowerCase() === parsed.itemName?.toLowerCase());
            if (!item || item.quantity < (parsed.quantity || 1)) {
                parsed.action = "UNAVAILABLE";
                parsed.message = `Sorry, ${parsed.itemName || 'yeh item'} abhi available nahi hai ya stock mein nahi hai.`;
            } else {
                parsed.itemId = item.id;
                parsed.itemName = item.name;
                parsed.itemPrice = item.price;
            }
        }

        return NextResponse.json(parsed);

    } catch (e) {
        console.error("Jarvis Route Error", e);
        return NextResponse.json({ action: "UNAVAILABLE", message: "Sorry, server side kuch issue hai" });
    }
}
