/**
 * Recommendation Engine — Smart food suggestions
 *
 * Uses:
 * 1. Time of day (morning → tea/coffee, afternoon → meals, evening → snacks)
 * 2. User's past order history from Firestore
 * 3. Current menu availability
 * 4. Trending items (most ordered recently)
 */

export interface MenuItemForRecommendation {
    id: string;
    name: string;
    price: number;
    category: string;
    available: boolean;
    quantity: number;
    preparationTime?: number;
}

export interface RecommendationResult {
    personalPicks: MenuItemForRecommendation[];  // Based on user history
    timePicks: MenuItemForRecommendation[];       // Based on time of day
    trendingPicks: MenuItemForRecommendation[];   // Most ordered
    message: string;                               // Conversational text
}

// ─── Time-based Category Mapping ────────────────

interface TimeSlot {
    start: number;  // hour (24h)
    end: number;
    preferredCategories: string[];
    label: string;
}

const TIME_SLOTS: TimeSlot[] = [
    {
        start: 6, end: 11,
        preferredCategories: [
            "tea-coffee", "tea-&-coffee", "tea", "coffee", "beverages",
            "breakfast", "south-indian", "south-indians", "parathas", "paratha",
            "bread", "snacks", "snack", "healthy", "healthy-food",
        ],
        label: "morning",
    },
    {
        start: 11, end: 15,
        preferredCategories: [
            "lunch", "indian-meals", "thali", "biryani", "north-indian",
            "chinese", "chinese-food", "noodles-pasta", "noodles", "pasta",
            "rolls-wraps", "rolls", "combo", "combos", "meal-combo",
        ],
        label: "afternoon",
    },
    {
        start: 15, end: 19,
        preferredCategories: [
            "snacks", "snack", "fast-food", "street-food", "momos",
            "burgers", "burger", "sandwiches", "sandwich", "pizza",
            "french-fries", "chaat", "tea-coffee", "tea-&-coffee",
            "fresh-juices", "juice", "shake", "smoothie", "cold",
        ],
        label: "evening",
    },
    {
        start: 19, end: 23,
        preferredCategories: [
            "dinner", "indian-meals", "chinese", "chinese-food",
            "noodles-pasta", "rolls-wraps", "biryani", "thali",
            "desserts", "ice-cream", "sweets",
        ],
        label: "night",
    },
];

function getCurrentTimeSlot(): TimeSlot {
    const hour = new Date().getHours();
    return TIME_SLOTS.find((s) => hour >= s.start && hour < s.end)
        || TIME_SLOTS[0]; // fallback to morning
}

// ─── Recommendation Logic ───────────────────────

/**
 * Generate smart recommendations.
 *
 * @param menuItems - All available menu items
 * @param userOrderHistory - Array of item names the user has ordered before
 * @param userName - User's first name for personalization
 * @param maxItems - Max items per category (default 3)
 */
export function generateRecommendations(
    menuItems: MenuItemForRecommendation[],
    userOrderHistory: string[],
    userName: string = "Guest",
    maxItems: number = 3
): RecommendationResult {
    const available = menuItems.filter((m) => m.available && m.quantity > 0);
    const timeSlot = getCurrentTimeSlot();

    // 1. TIME-BASED PICKS
    const timePicks = available
        .filter((m) => {
            const cat = (m.category || "").toLowerCase();
            return timeSlot.preferredCategories.some(
                (pref) => cat.includes(pref) || pref.includes(cat)
            );
        })
        .slice(0, maxItems);

    // 2. PERSONAL PICKS (from order history)
    const historyLower = userOrderHistory.map((n) => n.toLowerCase());
    const personalPicks = available
        .filter((m) => historyLower.includes(m.name.toLowerCase()))
        .slice(0, maxItems);

    // 3. TRENDING PICKS (cheapest + available → popular proxy)
    // In a real system, you'd count recent order frequency from Firestore
    const trendingPicks = [...available]
        .sort((a, b) => {
            // Prefer items with lower prep time (faster = more popular usually)
            const prepA = a.preparationTime || 15;
            const prepB = b.preparationTime || 15;
            return prepA - prepB;
        })
        .slice(0, maxItems);

    // 4. BUILD MESSAGE
    const firstName = userName.split(" ")[0] || "Guest";
    const message = buildRecommendationMessage(
        firstName,
        timeSlot,
        personalPicks,
        timePicks,
        trendingPicks
    );

    return { personalPicks, timePicks, trendingPicks, message };
}

function buildRecommendationMessage(
    name: string,
    timeSlot: TimeSlot,
    personalPicks: MenuItemForRecommendation[],
    timePicks: MenuItemForRecommendation[],
    trendingPicks: MenuItemForRecommendation[]
): string {
    const parts: string[] = [];

    // Greeting based on time
    const greetings: Record<string, string> = {
        morning: `Good morning ${name}! ☀️`,
        afternoon: `${name}, lunch time ho gaya! 🍽️`,
        evening: `${name}, aaj evening snack ka mood hai? 😋`,
        night: `${name}, dinner time! 🌙`,
    };
    parts.push(greetings[timeSlot.label] || `Hey ${name}!`);

    // Personal picks
    if (personalPicks.length > 0) {
        const items = personalPicks.map((i) => i.name).join(", ");
        parts.push(`Tumhari favourite — ${items} — available hai!`);
    }

    // Time-based picks
    if (timePicks.length > 0) {
        const items = timePicks.map((i) => `${i.name} (₹${i.price})`).join(", ");
        parts.push(`${timeSlot.label === "morning" ? "Breakfast" : timeSlot.label === "afternoon" ? "Lunch" : "Snacks"} ke liye try karo: ${items}`);
    }

    // Trending
    if (trendingPicks.length > 0 && personalPicks.length === 0) {
        const items = trendingPicks.map((i) => i.name).join(", ");
        parts.push(`Trending abhi: ${items} 🔥`);
    }

    return parts.join("\n\n");
}

/**
 * Fetch user's order history item names from Firestore order data.
 * Call this from the API route with the raw orders array.
 */
export function extractOrderHistoryItems(
    orders: Array<{ items: Array<{ name: string }> }>
): string[] {
    const itemNames = new Set<string>();
    for (const order of orders) {
        for (const item of order.items || []) {
            if (item.name) itemNames.add(item.name);
        }
    }
    return Array.from(itemNames);
}
