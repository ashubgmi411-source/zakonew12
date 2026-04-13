/**
 * Upsell Engine — Smart food pairing suggestions
 *
 * When a user orders an item, suggests 1-2 complementary items.
 * Uses category-based pairing rules + price awareness.
 *
 * Example:
 * User orders "Burger"
 * → "Burger ke saath Fries aur Coke combo le loge? ₹20 extra me"
 */

export interface MenuItemForUpsell {
    id: string;
    name: string;
    price: number;
    category: string;
    available: boolean;
    quantity: number;
}

export interface UpsellSuggestion {
    item: MenuItemForUpsell;
    reason: string; // Why this is suggested
}

export interface UpsellResult {
    suggestions: UpsellSuggestion[];
    message: string;
}

// ─── Pairing Rules ──────────────────────────────
// Maps category/item patterns to preferred companion categories

interface PairingRule {
    /** Matches if ordered item name or category contains any of these */
    triggers: string[];
    /** Categories to look for companions */
    pairWith: string[];
    /** Specific item name substrings to prefer */
    preferItems: string[];
}

const PAIRING_RULES: PairingRule[] = [
    {
        triggers: ["burger", "बर्गर"],
        pairWith: ["beverages", "snacks", "fast-food"],
        preferItems: ["fries", "coke", "pepsi", "cold drink", "shake"],
    },
    {
        triggers: ["samosa", "समोसा", "kachori", "कचोरी", "pakora", "pakoda"],
        pairWith: ["tea-coffee", "tea-&-coffee", "beverages"],
        preferItems: ["chai", "tea", "coffee", "lassi"],
    },
    {
        triggers: ["paratha", "parantha", "परांठा", "पराठा"],
        pairWith: ["beverages", "tea-coffee"],
        preferItems: ["chai", "lassi", "curd", "dahi", "butter"],
    },
    {
        triggers: ["pizza", "पिज़्ज़ा"],
        pairWith: ["beverages", "snacks"],
        preferItems: ["coke", "pepsi", "garlic bread", "fries", "cold drink"],
    },
    {
        triggers: ["sandwich", "सैंडविच"],
        pairWith: ["beverages", "snacks"],
        preferItems: ["coffee", "juice", "shake", "fries"],
    },
    {
        triggers: ["noodles", "pasta", "maggi", "नूडल्स", "पास्ता", "मैगी"],
        pairWith: ["beverages", "snacks"],
        preferItems: ["cold drink", "momos", "spring roll"],
    },
    {
        triggers: ["momos", "मोमोज", "मोमो"],
        pairWith: ["beverages", "snacks"],
        preferItems: ["cold drink", "noodles", "fried rice"],
    },
    {
        triggers: ["biryani", "rice", "thali", "meal"],
        pairWith: ["beverages", "desserts"],
        preferItems: ["lassi", "raita", "gulab jamun", "sweet"],
    },
    {
        triggers: ["coffee", "कॉफी"],
        pairWith: ["snacks", "desserts"],
        preferItems: ["cookie", "muffin", "sandwich", "cake", "brownie"],
    },
    {
        triggers: ["tea", "chai", "चाय"],
        pairWith: ["snacks"],
        preferItems: ["samosa", "biscuit", "pakora", "mathri", "rusk"],
    },
    {
        triggers: ["dosa", "idli", "डोसा", "इडली"],
        pairWith: ["beverages"],
        preferItems: ["coffee", "filter coffee", "tea", "vada"],
    },
    {
        triggers: ["roll", "wrap", "रोल"],
        pairWith: ["beverages"],
        preferItems: ["cold drink", "shake", "juice"],
    },
];

// ─── Upsell Logic ───────────────────────────────

/**
 * Generate upsell suggestions for ordered items.
 *
 * @param orderedItemNames - Item names the user just ordered
 * @param menuItems - Full available menu
 * @param maxSuggestions - Max companions to suggest (default 2)
 */
export function generateUpsell(
    orderedItemNames: string[],
    menuItems: MenuItemForUpsell[],
    maxSuggestions: number = 2
): UpsellResult {
    const available = menuItems.filter((m) => m.available && m.quantity > 0);
    const orderedLower = orderedItemNames.map((n) => n.toLowerCase());

    // Don't suggest items already being ordered
    const candidates = available.filter(
        (m) => !orderedLower.includes(m.name.toLowerCase())
    );

    const suggestions: UpsellSuggestion[] = [];
    const usedItemIds = new Set<string>();

    for (const orderedName of orderedLower) {
        // Find matching pairing rule
        const rule = PAIRING_RULES.find((r) =>
            r.triggers.some((t) => orderedName.includes(t.toLowerCase()))
        );

        if (!rule) continue;

        // First: try preferred items by name
        for (const pref of rule.preferItems) {
            if (suggestions.length >= maxSuggestions) break;

            const match = candidates.find(
                (c) =>
                    c.name.toLowerCase().includes(pref.toLowerCase()) &&
                    !usedItemIds.has(c.id)
            );

            if (match) {
                suggestions.push({
                    item: match,
                    reason: `${orderedName} ke saath ${match.name} perfect combo hai!`,
                });
                usedItemIds.add(match.id);
            }
        }

        // Second: try by category
        if (suggestions.length < maxSuggestions) {
            for (const cat of rule.pairWith) {
                if (suggestions.length >= maxSuggestions) break;

                const match = candidates.find(
                    (c) =>
                        (c.category || "").toLowerCase().includes(cat) &&
                        !usedItemIds.has(c.id)
                );

                if (match) {
                    suggestions.push({
                        item: match,
                        reason: `${match.name} bhi try karo — match hoga!`,
                    });
                    usedItemIds.add(match.id);
                }
            }
        }
    }

    // Build message
    const message = buildUpsellMessage(orderedItemNames, suggestions);

    return { suggestions, message };
}

function buildUpsellMessage(
    orderedItems: string[],
    suggestions: UpsellSuggestion[]
): string {
    if (suggestions.length === 0) return "";

    const orderedStr = orderedItems.join(" aur ");

    if (suggestions.length === 1) {
        const s = suggestions[0];
        return `💡 ${orderedStr} ke saath ${s.item.name} (₹${s.item.price}) try karoge? Perfect combo!`;
    }

    const names = suggestions.map((s) => `${s.item.name} (₹${s.item.price})`).join(" aur ");
    const extraCost = suggestions.reduce((sum, s) => sum + s.item.price, 0);
    return `💡 ${orderedStr} ke saath ${names} combo le lo — sirf ₹${extraCost} extra!`;
}
