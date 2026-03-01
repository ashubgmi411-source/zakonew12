/**
 * Orders API — GET user orders + POST create order
 * 
 * SECURITY CHANGES:
 * - GET: Requires Firebase ID token, enforces caller === userId
 * - POST: Requires Firebase ID token, enforces caller === userId
 * - Order ID now uses UUID-based format (not 6-digit random number)
 * - Client-provided orderId is ignored — server generates it
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/user-auth";
import { generateOrderId } from "@/lib/orderIdUtils";
import { FieldValue, DocumentSnapshot } from "firebase-admin/firestore";
import { deductInventoryForOrder } from "@/services/inventoryService";

export const runtime = "nodejs";

// GET /api/orders?userId=xxx — Fetch user's orders
export async function GET(req: NextRequest) {
    // SECURITY: Require Firebase ID token
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // SECURITY: Prevent IDOR — user can only view their own orders
    if (userId !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const snapshot = await adminDb
            .collection("orders")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();

        const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ orders });
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}

// POST /api/orders — Create a new order (with wallet deduction)
export async function POST(req: NextRequest) {
    // SECURITY: Require Firebase ID token
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, items, total, userName, userEmail } = await req.json();

        // SECURITY: Prevent IDOR — user can only create orders for themselves
        if (userId !== uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No items in order" }, { status: 400 });
        }

        if (!total || total <= 0) {
            return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
        }

        // SECURITY: Server generates the order ID (ignores client-provided orderId)
        const orderId = generateOrderId();

        // CANTEEN CHECK: Block orders if canteen is closed
        const configDoc = await adminDb.doc("settings/canteenConfig").get();
        if (configDoc.exists) {
            const config = configDoc.data();
            if (config && config.isOpen === false) {
                return NextResponse.json({ error: "Canteen is currently closed" }, { status: 403 });
            }

            // Check operating hours
            if (config?.startTime && config?.endTime) {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const [startH, startM] = config.startTime.split(":").map(Number);
                const [endH, endM] = config.endTime.split(":").map(Number);
                const startMinutes = startH * 60 + startM;
                const endMinutes = endH * 60 + endM;

                if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
                    return NextResponse.json(
                        { error: `Canteen is open from ${config.startTime} to ${config.endTime}` },
                        { status: 403 }
                    );
                }
            }
        }
        await adminDb.runTransaction(async (transaction) => {
            // 1. READ PHASE: Fetch all required data first

            // 1.1 Fetch user doc
            const userRef = adminDb.collection("users").doc(userId);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("User not found");

            // 1.2 Fetch all menu items in parallel (within the transaction)
            const itemSnapshots: { item: any, snapshot: DocumentSnapshot }[] = [];
            for (const item of items) {
                const itemRef = adminDb.collection("menuItems").doc(item.id);
                const itemDoc = await transaction.get(itemRef);
                itemSnapshots.push({ item, snapshot: itemDoc });
            }

            // 2. VALIDATION PHASE

            // 2.1 Check wallet balance
            const walletBalance = userDoc.data()?.walletBalance || 0;
            if (walletBalance < total) {
                throw new Error("Insufficient wallet balance");
            }

            // 2.2 Check menu item quantities
            for (const { item, snapshot } of itemSnapshots) {
                if (!snapshot.exists) throw new Error(`Item ${item.name} no longer exists`);

                const currentQty = snapshot.data()?.quantity || 0;
                if (currentQty < item.quantity) {
                    throw new Error(`${item.name} only has ${currentQty} left`);
                }
            }

            // 3. WRITE PHASE: All updates happen after all reads/validations

            // 3.1 Update menu item quantities
            for (const { item, snapshot } of itemSnapshots) {
                const itemRef = adminDb.collection("menuItems").doc(item.id);
                const currentQty = snapshot.data()?.quantity || 0;
                const newQty = currentQty - item.quantity;

                transaction.update(itemRef, {
                    quantity: newQty,
                    available: newQty > 0,
                    updatedAt: new Date().toISOString(),
                });
            }

            // 3.2 Deduct wallet
            transaction.update(userRef, {
                walletBalance: FieldValue.increment(-total),
            });

            // 3.3 Create order document
            const userRollNumber = userDoc.data()?.rollNumber || "";
            const userPhone = userDoc.data()?.phone || "";
            const orderRef = adminDb.collection("orders").doc();
            transaction.set(orderRef, {
                orderId,
                userId,
                userName: userName || "Unknown",
                userEmail: userEmail || "Unknown",
                userPhone,
                userRollNumber,
                items,
                total,
                paymentMode: "Wallet",
                status: "pending",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // 3.4 Record wallet debit transaction
            const txnRef = adminDb.collection("walletTransactions").doc();
            transaction.set(txnRef, {
                userId,
                type: "debit",
                amount: total,
                description: `Order #${orderId}`,
                transactionId: txnRef.id,
                createdAt: new Date().toISOString(),
            });

            // 3.5 Auto-deduct raw ingredient stock via recipe mappings
            try {
                const orderItemsForInventory = items.map((item: any) => ({
                    menuItemId: item.id,
                    menuItemName: item.name,
                    quantity: item.quantity,
                }));
                await deductInventoryForOrder(transaction, orderItemsForInventory, orderId);
            } catch (invErr) {
                // Log but don't block order if no recipe mappings exist
                console.warn("[Orders] Inventory deduction note:", invErr instanceof Error ? invErr.message : invErr);
            }
        });

        return NextResponse.json({ success: true, orderId });
    } catch (error) {
        console.error("Order creation failed:", error);
        const message = error instanceof Error ? error.message : "Failed to create order";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
