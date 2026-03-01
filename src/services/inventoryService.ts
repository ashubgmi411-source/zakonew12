/**
 * Inventory Service — Core business logic for inventory management
 *
 * All writes go through Firebase Admin SDK (server-side only).
 * Transaction-safe stock deduction for order integration.
 */

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
    InventoryItem,
    StockLog,
    MenuRecipeMapping,
    AddInventoryItemRequest,
    StockAdjustmentRequest,
    InventoryAnalytics,
    DailyStockSnapshot,
    StockLogType,
} from "@/types/inventory";

const INVENTORY_COL = "inventory_items";
const STOCK_LOGS_COL = "stock_logs";
const RECIPE_MAP_COL = "menu_recipe_mapping";
const SNAPSHOT_COL = "daily_stock_snapshots";

// ─── CRUD Operations ─────────────────────────────

export async function addInventoryItem(
    data: AddInventoryItemRequest,
    adminUsername: string
): Promise<InventoryItem> {
    const now = new Date().toISOString();
    const ref = adminDb.collection(INVENTORY_COL).doc();

    const item: Omit<InventoryItem, "id"> = {
        name: data.name.trim(),
        category: data.category,
        currentStock: data.currentStock,
        unit: data.unit,
        reorderLevel: data.reorderLevel,
        supplierName: data.supplierName.trim(),
        costPerUnit: data.costPerUnit,
        lastRestockedAt: data.currentStock > 0 ? now : null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
    };

    await ref.set(item);

    // Log initial stock if > 0
    if (data.currentStock > 0) {
        await createStockLog({
            itemId: ref.id,
            itemName: data.name.trim(),
            type: "ADD",
            quantity: data.currentStock,
            previousStock: 0,
            newStock: data.currentStock,
            reason: "Initial stock on item creation",
            performedBy: adminUsername,
            createdAt: now,
        });
    }

    return { id: ref.id, ...item };
}

export async function updateInventoryItem(
    itemId: string,
    updates: Partial<Pick<InventoryItem, "name" | "category" | "unit" | "reorderLevel" | "supplierName" | "costPerUnit">>
): Promise<void> {
    await adminDb.collection(INVENTORY_COL).doc(itemId).update({
        ...updates,
        updatedAt: new Date().toISOString(),
    });
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
    // Soft delete
    await adminDb.collection(INVENTORY_COL).doc(itemId).update({
        isDeleted: true,
        updatedAt: new Date().toISOString(),
    });
}

export async function getInventoryItems(filters?: {
    category?: string;
    lowStockOnly?: boolean;
    search?: string;
}): Promise<InventoryItem[]> {
    let query: FirebaseFirestore.Query = adminDb
        .collection(INVENTORY_COL)
        .where("isDeleted", "!=", true);

    if (filters?.category) {
        query = query.where("category", "==", filters.category);
    }

    const snapshot = await query.get();
    let items: InventoryItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as InventoryItem[];

    // Client-side filtering for search and low stock (Firestore limitations)
    if (filters?.search) {
        const term = filters.search.toLowerCase();
        items = items.filter(
            (item) =>
                item.name.toLowerCase().includes(term) ||
                item.supplierName.toLowerCase().includes(term)
        );
    }

    if (filters?.lowStockOnly) {
        items = items.filter(
            (item) => item.currentStock <= item.reorderLevel
        );
    }

    // Sort by name
    items.sort((a, b) => a.name.localeCompare(b.name));

    return items;
}

export async function getInventoryItem(
    itemId: string
): Promise<InventoryItem | null> {
    const doc = await adminDb.collection(INVENTORY_COL).doc(itemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as InventoryItem;
}

// ─── Stock Adjustment ────────────────────────────

export async function adjustStock(
    data: StockAdjustmentRequest,
    adminUsername: string
): Promise<{ newStock: number }> {
    const itemRef = adminDb.collection(INVENTORY_COL).doc(data.itemId);

    const result = await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(itemRef);
        if (!doc.exists) throw new Error("Inventory item not found");

        const item = doc.data() as Omit<InventoryItem, "id">;
        const previousStock = item.currentStock;
        let newStock: number;

        if (data.type === "ADD") {
            newStock = previousStock + data.quantity;
        } else {
            // DEDUCT or WASTE
            newStock = previousStock - data.quantity;
            if (newStock < 0) {
                throw new Error(
                    `Cannot deduct ${data.quantity} ${item.unit}. Only ${previousStock} ${item.unit} available.`
                );
            }
        }

        const updates: Record<string, unknown> = {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
        };

        if (data.type === "ADD") {
            updates.lastRestockedAt = new Date().toISOString();
        }

        transaction.update(itemRef, updates);

        // Create log within transaction
        const logRef = adminDb.collection(STOCK_LOGS_COL).doc();
        transaction.set(logRef, {
            itemId: data.itemId,
            itemName: item.name,
            type: data.type,
            quantity: data.quantity,
            previousStock,
            newStock,
            reason: data.reason,
            performedBy: adminUsername,
            createdAt: new Date().toISOString(),
        });

        return { newStock };
    });

    return result;
}

// ─── Auto Stock Deduction (Order Integration) ────

/**
 * Deducts raw ingredient stock for all items in an order.
 * Called within the order placement transaction.
 *
 * @param transaction - Active Firestore transaction
 * @param orderItems - Array of { menuItemId, quantity } from the order
 * @param orderId - For logging
 * @returns true if deduction succeeded (or no mappings exist)
 */
export async function deductInventoryForOrder(
    transaction: FirebaseFirestore.Transaction,
    orderItems: Array<{ menuItemId: string; menuItemName: string; quantity: number }>,
    orderId: string
): Promise<void> {
    // 1. Fetch all recipe mappings for ordered menu items
    const menuItemIds = [...new Set(orderItems.map((i) => i.menuItemId))];
    if (menuItemIds.length === 0) return;

    // Batch fetch recipe mappings (outside transaction reads — must be done before writes)
    const mappingsByMenuItem: Record<string, MenuRecipeMapping[]> = {};

    for (const menuItemId of menuItemIds) {
        const mappingSnap = await transaction.get(
            adminDb
                .collection(RECIPE_MAP_COL)
                .where("menuItemId", "==", menuItemId)
        );
        if (!mappingSnap.empty) {
            mappingsByMenuItem[menuItemId] = mappingSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as MenuRecipeMapping[];
        }
    }

    // If no recipe mappings exist for any items, skip deduction
    if (Object.keys(mappingsByMenuItem).length === 0) return;

    // 2. Aggregate total ingredient requirements
    const ingredientRequirements: Record<
        string,
        { name: string; totalRequired: number }
    > = {};

    for (const orderItem of orderItems) {
        const mappings = mappingsByMenuItem[orderItem.menuItemId];
        if (!mappings) continue;

        for (const mapping of mappings) {
            const key = mapping.ingredientId;
            if (!ingredientRequirements[key]) {
                ingredientRequirements[key] = {
                    name: mapping.ingredientName,
                    totalRequired: 0,
                };
            }
            ingredientRequirements[key].totalRequired +=
                mapping.quantityRequired * orderItem.quantity;
        }
    }

    // 3. Read current stock for all required ingredients
    const ingredientIds = Object.keys(ingredientRequirements);
    const ingredientDocs: Record<
        string,
        { ref: FirebaseFirestore.DocumentReference; data: Omit<InventoryItem, "id"> }
    > = {};

    for (const ingId of ingredientIds) {
        const ref = adminDb.collection(INVENTORY_COL).doc(ingId);
        const snap = await transaction.get(ref);
        if (!snap.exists) {
            throw new Error(
                `Ingredient "${ingredientRequirements[ingId].name}" not found in inventory`
            );
        }
        ingredientDocs[ingId] = {
            ref,
            data: snap.data() as Omit<InventoryItem, "id">,
        };
    }

    // 4. Validate stock availability
    for (const [ingId, requirement] of Object.entries(ingredientRequirements)) {
        const current = ingredientDocs[ingId].data.currentStock;
        if (current < requirement.totalRequired) {
            throw new Error(
                `Insufficient stock for "${requirement.name}": need ${requirement.totalRequired} ${ingredientDocs[ingId].data.unit}, only ${current} available`
            );
        }
    }

    // 5. Write phase — deduct stock and create logs
    for (const [ingId, requirement] of Object.entries(ingredientRequirements)) {
        const doc = ingredientDocs[ingId];
        const previousStock = doc.data.currentStock;
        const newStock = previousStock - requirement.totalRequired;

        transaction.update(doc.ref, {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
        });

        // Create auto-deduct log
        const logRef = adminDb.collection(STOCK_LOGS_COL).doc();
        transaction.set(logRef, {
            itemId: ingId,
            itemName: requirement.name,
            type: "AUTO_DEDUCT" as StockLogType,
            quantity: requirement.totalRequired,
            previousStock,
            newStock,
            reason: `Auto-deducted for order #${orderId}`,
            performedBy: "system",
            orderId,
            createdAt: new Date().toISOString(),
        });
    }
}

/**
 * Pre-order check: validates that all ingredients are available
 * for the given menu items without modifying stock.
 */
export async function checkStockAvailability(
    menuItemIds: string[]
): Promise<{
    available: boolean;
    unavailableItems: Array<{ ingredientName: string; required: number; available: number; unit: string }>;
}> {
    const unavailableItems: Array<{
        ingredientName: string;
        required: number;
        available: number;
        unit: string;
    }> = [];

    // Fetch recipe mappings
    for (const menuItemId of menuItemIds) {
        const mappingSnap = await adminDb
            .collection(RECIPE_MAP_COL)
            .where("menuItemId", "==", menuItemId)
            .get();

        for (const mappingDoc of mappingSnap.docs) {
            const mapping = mappingDoc.data() as MenuRecipeMapping;
            const invDoc = await adminDb
                .collection(INVENTORY_COL)
                .doc(mapping.ingredientId)
                .get();

            if (!invDoc.exists) {
                unavailableItems.push({
                    ingredientName: mapping.ingredientName,
                    required: mapping.quantityRequired,
                    available: 0,
                    unit: mapping.unit,
                });
                continue;
            }

            const currentStock = invDoc.data()?.currentStock || 0;
            if (currentStock < mapping.quantityRequired) {
                unavailableItems.push({
                    ingredientName: mapping.ingredientName,
                    required: mapping.quantityRequired,
                    available: currentStock,
                    unit: mapping.unit,
                });
            }
        }
    }

    return {
        available: unavailableItems.length === 0,
        unavailableItems,
    };
}

// ─── Stock Logs ──────────────────────────────────

async function createStockLog(
    log: Omit<StockLog, "id">
): Promise<void> {
    await adminDb.collection(STOCK_LOGS_COL).add(log);
}

export async function getStockLogs(filters?: {
    itemId?: string;
    type?: StockLogType;
    limit?: number;
    startAfter?: string;
}): Promise<StockLog[]> {
    let query: FirebaseFirestore.Query = adminDb
        .collection(STOCK_LOGS_COL)
        .orderBy("createdAt", "desc");

    if (filters?.itemId) {
        query = query.where("itemId", "==", filters.itemId);
    }

    if (filters?.type) {
        query = query.where("type", "==", filters.type);
    }

    const limit = filters?.limit || 50;
    query = query.limit(limit);

    if (filters?.startAfter) {
        query = query.startAfter(filters.startAfter);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as StockLog[];
}

// ─── Analytics ───────────────────────────────────

export async function getInventoryAnalytics(): Promise<InventoryAnalytics> {
    // Fetch all active items
    const itemSnap = await adminDb
        .collection(INVENTORY_COL)
        .where("isDeleted", "!=", true)
        .get();

    const items = itemSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as InventoryItem[];

    const totalValue = items.reduce(
        (sum, item) => sum + item.currentStock * item.costPerUnit,
        0
    );
    const lowStockItems = items.filter(
        (i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel
    ).length;
    const outOfStockItems = items.filter((i) => i.currentStock <= 0).length;

    // Most used ingredients (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deductLogsSnap = await adminDb
        .collection(STOCK_LOGS_COL)
        .where("type", "in", ["AUTO_DEDUCT", "DEDUCT"])
        .where("createdAt", ">=", sevenDaysAgo.toISOString())
        .orderBy("createdAt", "desc")
        .limit(500)
        .get();

    const usageMap: Record<string, { name: string; total: number; unit: string }> = {};
    deductLogsSnap.forEach((doc) => {
        const log = doc.data();
        if (!usageMap[log.itemId]) {
            usageMap[log.itemId] = { name: log.itemName, total: 0, unit: "" };
        }
        usageMap[log.itemId].total += log.quantity;
    });

    // Fill in units from items
    for (const item of items) {
        if (usageMap[item.id]) {
            usageMap[item.id].unit = item.unit;
        }
    }

    const mostUsedIngredients = Object.entries(usageMap)
        .map(([itemId, data]) => ({
            itemId,
            itemName: data.name,
            totalDeducted: data.total,
            unit: data.unit,
        }))
        .sort((a, b) => b.totalDeducted - a.totalDeducted)
        .slice(0, 10);

    // Waste tracking (last 7 days)
    const wasteLogsSnap = await adminDb
        .collection(STOCK_LOGS_COL)
        .where("type", "==", "WASTE")
        .where("createdAt", ">=", sevenDaysAgo.toISOString())
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

    const wasteMap: Record<string, { name: string; total: number; unit: string }> = {};
    wasteLogsSnap.forEach((doc) => {
        const log = doc.data();
        if (!wasteMap[log.itemId]) {
            wasteMap[log.itemId] = { name: log.itemName, total: 0, unit: "" };
        }
        wasteMap[log.itemId].total += log.quantity;
    });

    for (const item of items) {
        if (wasteMap[item.id]) {
            wasteMap[item.id].unit = item.unit;
        }
    }

    const wasteReport = Object.entries(wasteMap)
        .map(([itemId, data]) => ({
            itemId,
            itemName: data.name,
            totalWasted: data.total,
            unit: data.unit,
        }))
        .sort((a, b) => b.totalWasted - a.totalWasted);

    // Purchase suggestions
    const purchaseSuggestions = items
        .filter((item) => item.currentStock <= item.reorderLevel)
        .map((item) => {
            const suggestedQuantity = Math.max(
                item.reorderLevel * 2 - item.currentStock,
                item.reorderLevel
            );
            return {
                itemId: item.id,
                itemName: item.name,
                currentStock: item.currentStock,
                reorderLevel: item.reorderLevel,
                suggestedQuantity,
                estimatedCost: suggestedQuantity * item.costPerUnit,
                unit: item.unit,
                supplierName: item.supplierName,
            };
        })
        .sort((a, b) => b.estimatedCost - a.estimatedCost);

    return {
        totalValue,
        totalItems: items.length,
        lowStockItems,
        outOfStockItems,
        mostUsedIngredients,
        wasteReport,
        purchaseSuggestions,
    };
}

// ─── Recipe Mapping ──────────────────────────────

export async function getRecipeMappings(
    menuItemId?: string
): Promise<MenuRecipeMapping[]> {
    let query: FirebaseFirestore.Query = adminDb.collection(RECIPE_MAP_COL);

    if (menuItemId) {
        query = query.where("menuItemId", "==", menuItemId);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as MenuRecipeMapping[];
}

export async function setRecipeMappings(
    menuItemId: string,
    menuItemName: string,
    ingredients: Array<{
        ingredientId: string;
        ingredientName: string;
        quantityRequired: number;
        unit: string;
    }>
): Promise<void> {
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    // Delete existing mappings for this menu item
    const existingSnap = await adminDb
        .collection(RECIPE_MAP_COL)
        .where("menuItemId", "==", menuItemId)
        .get();

    existingSnap.forEach((doc) => batch.delete(doc.ref));

    // Create new mappings
    for (const ing of ingredients) {
        const ref = adminDb.collection(RECIPE_MAP_COL).doc();
        batch.set(ref, {
            menuItemId,
            menuItemName,
            ingredientId: ing.ingredientId,
            ingredientName: ing.ingredientName,
            quantityRequired: ing.quantityRequired,
            unit: ing.unit,
            createdAt: now,
            updatedAt: now,
        });
    }

    await batch.commit();
}

export async function deleteRecipeMapping(mappingId: string): Promise<void> {
    await adminDb.collection(RECIPE_MAP_COL).doc(mappingId).delete();
}

// ─── Daily Snapshot ──────────────────────────────

export async function createDailySnapshot(): Promise<DailyStockSnapshot> {
    const items = await getInventoryItems();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    const snapshotItems = items.map((item) => ({
        itemId: item.id,
        itemName: item.name,
        stock: item.currentStock,
        unit: item.unit,
        value: item.currentStock * item.costPerUnit,
    }));

    const totalValue = snapshotItems.reduce((sum, i) => sum + i.value, 0);

    const ref = adminDb.collection(SNAPSHOT_COL).doc(dateStr);
    const snapshot: Omit<DailyStockSnapshot, "id"> = {
        date: dateStr,
        items: snapshotItems,
        totalValue,
        createdAt: now.toISOString(),
    };

    await ref.set(snapshot, { merge: true });

    return { id: dateStr, ...snapshot };
}

// ─── CSV Export ──────────────────────────────────

export async function getInventoryCSVData(): Promise<string> {
    const items = await getInventoryItems();

    const headers = [
        "Name",
        "Category",
        "Current Stock",
        "Unit",
        "Reorder Level",
        "Status",
        "Supplier",
        "Cost/Unit (₹)",
        "Total Value (₹)",
        "Last Restocked",
    ];

    const rows = items.map((item) => {
        const status =
            item.currentStock <= 0
                ? "Out of Stock"
                : item.currentStock <= item.reorderLevel
                    ? "Low"
                    : "Healthy";
        return [
            `"${item.name}"`,
            item.category,
            item.currentStock,
            item.unit,
            item.reorderLevel,
            status,
            `"${item.supplierName}"`,
            item.costPerUnit,
            (item.currentStock * item.costPerUnit).toFixed(2),
            item.lastRestockedAt || "Never",
        ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
}

// ─── Low Stock Alerts ────────────────────────────

export async function getLowStockAlerts(): Promise<
    Array<{
        id: string;
        name: string;
        currentStock: number;
        reorderLevel: number;
        unit: string;
        status: "low" | "out_of_stock";
    }>
> {
    const items = await getInventoryItems();

    return items
        .filter((item) => item.currentStock <= item.reorderLevel)
        .map((item) => ({
            id: item.id,
            name: item.name,
            currentStock: item.currentStock,
            reorderLevel: item.reorderLevel,
            unit: item.unit,
            status: item.currentStock <= 0 ? ("out_of_stock" as const) : ("low" as const),
        }))
        .sort((a, b) => a.currentStock - b.currentStock);
}
