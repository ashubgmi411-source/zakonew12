/**
 * Inventory Management System — Type Definitions
 *
 * Covers:
 * - inventory_items collection
 * - stock_logs collection
 * - menu_recipe_mapping collection
 * - daily_stock_snapshots collection
 */

// ─── Enums ───────────────────────────────────────

export type InventoryCategory =
    | "veg"
    | "non-veg"
    | "beverage"
    | "snack"
    | "dairy"
    | "grain"
    | "spice"
    | "condiment"
    | "packaging"
    | "other";

export type InventoryUnit =
    | "kg"
    | "g"
    | "liter"
    | "ml"
    | "pieces"
    | "packets"
    | "dozen";

export type StockLogType =
    | "ADD"
    | "DEDUCT"
    | "AUTO_DEDUCT"
    | "WASTE";

export type StockStatus = "healthy" | "low" | "out_of_stock";

// ─── Firestore Documents ─────────────────────────

/** inventory_items collection */
export interface InventoryItem {
    id: string;
    name: string;
    category: InventoryCategory;
    currentStock: number;
    unit: InventoryUnit;
    reorderLevel: number;
    supplierName: string;
    costPerUnit: number;
    lastRestockedAt: string | null;
    createdAt: string;
    updatedAt: string;
    isDeleted?: boolean;
}

/** stock_logs collection */
export interface StockLog {
    id: string;
    itemId: string;
    itemName: string;
    type: StockLogType;
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string;
    performedBy: string; // adminId or "system"
    orderId?: string;
    createdAt: string;
}

/** menu_recipe_mapping collection */
export interface MenuRecipeMapping {
    id: string;
    menuItemId: string;
    menuItemName: string;
    ingredientId: string;
    ingredientName: string;
    quantityRequired: number;
    unit: InventoryUnit;
    createdAt: string;
    updatedAt: string;
}

/** daily_stock_snapshots collection */
export interface DailyStockSnapshot {
    id: string;
    date: string; // YYYY-MM-DD
    items: Array<{
        itemId: string;
        itemName: string;
        stock: number;
        unit: InventoryUnit;
        value: number; // stock * costPerUnit
    }>;
    totalValue: number;
    createdAt: string;
}

// ─── Request / Response Types ────────────────────

export interface AddInventoryItemRequest {
    name: string;
    category: InventoryCategory;
    currentStock: number;
    unit: InventoryUnit;
    reorderLevel: number;
    supplierName: string;
    costPerUnit: number;
}

export interface StockAdjustmentRequest {
    itemId: string;
    type: "ADD" | "DEDUCT" | "WASTE";
    quantity: number;
    reason: string;
}

export interface RecipeMappingRequest {
    menuItemId: string;
    menuItemName: string;
    ingredients: Array<{
        ingredientId: string;
        ingredientName: string;
        quantityRequired: number;
        unit: InventoryUnit;
    }>;
}

export interface InventoryAnalytics {
    totalValue: number;
    totalItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    mostUsedIngredients: Array<{
        itemId: string;
        itemName: string;
        totalDeducted: number;
        unit: string;
    }>;
    wasteReport: Array<{
        itemId: string;
        itemName: string;
        totalWasted: number;
        unit: string;
    }>;
    purchaseSuggestions: Array<{
        itemId: string;
        itemName: string;
        currentStock: number;
        reorderLevel: number;
        suggestedQuantity: number;
        estimatedCost: number;
        unit: string;
        supplierName: string;
    }>;
}

// ─── Helper ──────────────────────────────────────

export function getStockStatus(item: InventoryItem): StockStatus {
    if (item.currentStock <= 0) return "out_of_stock";
    if (item.currentStock <= item.reorderLevel) return "low";
    return "healthy";
}
