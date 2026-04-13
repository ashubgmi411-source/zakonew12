/**
 * Context Manager — Session-based conversation memory
 *
 * Tracks conversation state so the AI can understand references like:
 * - "ek aur de do" → repeats last ordered item
 * - "wahi jo bola tha" → references last suggestion
 * - "aur kuch?" → continues from last intent
 *
 * Used server-side in /api/assistant to enrich LLM context.
 */

// ─── Types ──────────────────────────────────────

export interface OrderedItemMemory {
    itemId: string;
    itemName: string;
    quantity: number;
    price: number;
}

export interface ConversationContext {
    sessionId: string;
    userId: string;
    userName: string;
    turns: number;
    lastIntent: "ORDER" | "MENU_QUERY" | "WALLET_QUERY" | "RECOMMENDATION" | "GENERAL_CHAT" | null;
    lastOrderedItems: OrderedItemMemory[];
    lastSuggestedItems: string[];
    lastUpsellItems: string[];
    pendingConfirmation: boolean;
    pendingOrder: OrderedItemMemory[] | null;
    emotionState: "hungry" | "confused" | "casual" | "rushed" | "neutral";
    languagePreference: "hindi" | "english" | "hinglish";
    createdAt: number;
    updatedAt: number;
}

// ─── In-Memory Session Store ────────────────────
// Key: userId, Value: ConversationContext
// Sessions expire after 30 min of inactivity

const sessions = new Map<string, ConversationContext>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a conversation context for a user.
 */
export function getContext(userId: string, userName: string = "Guest"): ConversationContext {
    const existing = sessions.get(userId);

    if (existing) {
        // Check if session is expired
        if (Date.now() - existing.updatedAt > SESSION_TTL_MS) {
            sessions.delete(userId);
        } else {
            return existing;
        }
    }

    // Create new session
    const ctx: ConversationContext = {
        sessionId: `session_${userId}_${Date.now()}`,
        userId,
        userName,
        turns: 0,
        lastIntent: null,
        lastOrderedItems: [],
        lastSuggestedItems: [],
        lastUpsellItems: [],
        pendingConfirmation: false,
        pendingOrder: null,
        emotionState: "neutral",
        languagePreference: "hinglish",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    sessions.set(userId, ctx);
    return ctx;
}

/**
 * Update context after processing a turn.
 */
export function updateContext(
    userId: string,
    updates: Partial<ConversationContext>
): ConversationContext {
    const ctx = sessions.get(userId);
    if (!ctx) {
        // If no ctx exists, create one with defaults
        const newCtx = getContext(userId);
        Object.assign(newCtx, updates, { updatedAt: Date.now(), turns: newCtx.turns + 1 });
        sessions.set(userId, newCtx);
        return newCtx;
    }

    Object.assign(ctx, updates, { updatedAt: Date.now(), turns: ctx.turns + 1 });
    return ctx;
}

/**
 * Record that an order was placed.
 */
export function recordOrder(userId: string, items: OrderedItemMemory[]): void {
    const ctx = sessions.get(userId);
    if (ctx) {
        ctx.lastOrderedItems = items;
        ctx.lastIntent = "ORDER";
        ctx.pendingConfirmation = false;
        ctx.pendingOrder = null;
        ctx.updatedAt = Date.now();
    }
}

/**
 * Record pending order awaiting confirmation.
 */
export function setPendingOrder(userId: string, items: OrderedItemMemory[]): void {
    const ctx = sessions.get(userId);
    if (ctx) {
        ctx.pendingOrder = items;
        ctx.pendingConfirmation = true;
        ctx.updatedAt = Date.now();
    }
}

/**
 * Clear pending order (after confirm or cancel).
 */
export function clearPendingOrder(userId: string): void {
    const ctx = sessions.get(userId);
    if (ctx) {
        ctx.pendingOrder = null;
        ctx.pendingConfirmation = false;
        ctx.updatedAt = Date.now();
    }
}

/**
 * Check if user said something that references previous context.
 * Returns the referenced items or null.
 */
export function resolveContextReference(
    userId: string,
    userText: string
): OrderedItemMemory[] | null {
    const ctx = sessions.get(userId);
    if (!ctx) return null;

    const lower = userText.toLowerCase().trim();

    // "ek aur", "one more", "same again", "wahi", "repeat", "phirse", "dobara"
    const REPEAT_PATTERNS = [
        /ek\s*aur/i, /one\s*more/i, /same\s*again/i, /wahi/i, /wohi/i,
        /repeat/i, /phirse/i, /dobara/i, /wapas/i, /firse/i,
        /same/i, /वही/i, /एक\s*और/i, /दोबारा/i, /फिरसे/i,
    ];

    const isRepeat = REPEAT_PATTERNS.some((p) => p.test(lower));

    if (isRepeat && ctx.lastOrderedItems.length > 0) {
        return ctx.lastOrderedItems;
    }

    return null;
}

/**
 * Build context summary string for LLM system prompt injection.
 */
export function buildContextSummary(userId: string): string {
    const ctx = sessions.get(userId);
    if (!ctx || ctx.turns === 0) return "";

    const parts: string[] = [];
    parts.push(`\nCONVERSATION CONTEXT (Turn ${ctx.turns}):`);

    if (ctx.lastIntent) {
        parts.push(`- Last intent: ${ctx.lastIntent}`);
    }

    if (ctx.lastOrderedItems.length > 0) {
        const items = ctx.lastOrderedItems
            .map((i) => `${i.itemName} x${i.quantity}`)
            .join(", ");
        parts.push(`- Last ordered: ${items}`);
        parts.push(`- If user says "ek aur", "same again", "wahi", "repeat" → they mean: ${items}`);
    }

    if (ctx.lastSuggestedItems.length > 0) {
        parts.push(`- Last suggested: ${ctx.lastSuggestedItems.join(", ")}`);
    }

    if (ctx.pendingConfirmation && ctx.pendingOrder) {
        const pending = ctx.pendingOrder
            .map((i) => `${i.itemName} x${i.quantity}`)
            .join(", ");
        parts.push(`- PENDING ORDER awaiting confirmation: ${pending}`);
        parts.push(`- If user says "haan", "yes", "confirm", "done", "ok" → CONFIRM the pending order`);
        parts.push(`- If user says "nahi", "no", "cancel", "rehne do" → CANCEL the pending order`);
    }

    if (ctx.emotionState !== "neutral") {
        parts.push(`- User mood: ${ctx.emotionState}`);
    }

    return parts.join("\n");
}

/**
 * Clean up expired sessions (call periodically if needed).
 */
export function cleanupSessions(): void {
    const now = Date.now();
    for (const [userId, ctx] of sessions) {
        if (now - ctx.updatedAt > SESSION_TTL_MS) {
            sessions.delete(userId);
        }
    }
}
