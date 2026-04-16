/**
 * Recommendation Engine — Smart food suggestions
 *
 * Uses:
 * 1. Time of day (morning → tea/coffee, afternoon → meals, evening → snacks)
 * 2. User's past order history from Firestore
 * 3. Current menu availability
 * 4. Trending items (most ordered recently)
 */

export interface RecommendationFilters {
    budget?: number;
    category?: string;
    maxTime?: number;
    partySize?: number;
}

export interface RecommendationResult {
    personalPicks: MenuItemForRecommendation[];  // Based on user history
    timePicks: MenuItemForRecommendation[];       // Based on time of day
    intentPicks: MenuItemForRecommendation[];     // Based on budget/time/category filters
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
 * @param filters - Optional budget, time, and category filters
 */
export function generateRecommendations(
    menuItems: MenuItemForRecommendation[],
    userOrderHistory: string[],
    userName: string = "Guest",
    maxItems: number = 3,
    filters: RecommendationFilters = {}
): RecommendationResult {
    const available = menuItems.filter((m) => m.available && m.quantity > 0);
    const timeSlot = getCurrentTimeSlot();

    // 1. INTENT-BASED PICKS (Highest Priority)
    let intentPicks: MenuItemForRecommendation[] = [];
    if (filters.budget || filters.maxTime || filters.category) {
        intentPicks = available.filter((m) => {
            let match = true;
            if (filters.budget && m.price > filters.budget) match = false;
            if (filters.maxTime && (m.preparationTime || 10) > filters.maxTime) match = false;
            if (filters.category) {
                const cat = (m.category || "").toLowerCase();
                const target = filters.category.toLowerCase();
                if (!cat.includes(target) && !target.includes(cat)) match = false;
            }
            return match;
        }).slice(0, maxItems);
    }

    // 2. TIME-BASED PICKS
    const timePicks = available
        .filter((m) => {
            const cat = (m.category || "").toLowerCase();
            return timeSlot.preferredCategories.some(
                (pref) => cat.includes(pref) || pref.includes(cat)
            );
        })
        .filter(m => !intentPicks.some(p => p.id === m.id)) // Avoid duplicates
        .slice(0, maxItems);

    // 3. PERSONAL PICKS (from order history)
    const historyLower = userOrderHistory.map((n) => n.toLowerCase());
    const personalPicks = available
        .filter((m) => historyLower.includes(m.name.toLowerCase()))
        .filter(m => !intentPicks.some(p => p.id === m.id))
        .slice(0, maxItems);

    // 4. TRENDING PICKS
    const trendingPicks = [...available]
        .sort((a, b) => (a.preparationTime || 15) - (b.preparationTime || 15))
        .filter(m => !intentPicks.some(p => p.id === m.id) && !timePicks.some(p => p.id === m.id))
        .slice(0, maxItems);

    // 5. BUILD MESSAGE
    const firstName = userName.split(" ")[0] || "Guest";
    const message = buildRecommendationMessage(
        firstName,
        timeSlot,
        personalPicks,
        timePicks,
        trendingPicks,
        intentPicks,
        filters
    );

    return { personalPicks, timePicks, intentPicks, trendingPicks, message };
}

function buildRecommendationMessage(
    name: string,
    timeSlot: TimeSlot,
    personalPicks: MenuItemForRecommendation[],
    timePicks: MenuItemForRecommendation[],
    trendingPicks: MenuItemForRecommendation[],
    intentPicks: MenuItemForRecommendation[],
    filters: RecommendationFilters
): string {
    const parts: string[] = [];

    // Greeting
    const greetings: Record<string, string> = {
        morning: `Subah ho gayi ${name}! ☀️`,
        afternoon: `${name}, lunch ka time ho gaya hai. 🍽️`,
        evening: `${name}, sham ki chai aur snacks? 😋`,
        night: `${name}, dinner special bataun? 🌙`,
    };
    parts.push(greetings[timeSlot.label] || `Hey ${name}!`);

    // Intent-based feedback
    if (intentPicks.length > 0) {
        const items = intentPicks.map((i) => `${i.name} (₹${i.price})`).join(", ");
        if (filters.budget && filters.category) {
            parts.push(`₹${filters.budget} ke andar best ${filters.category} options: ${items}`);
        } else if (filters.budget) {
            parts.push(`Tumhare ₹${filters.budget} budget mein ye badhiya options hain: ${items}`);
        } else if (filters.maxTime) {
            parts.push(`Sirf ${filters.maxTime} minutes mein ye ban jayenge: ${items} ⚡`);
        } else if (filters.category) {
            parts.push(`${filters.category} mein ye sabse popular hain: ${items}`);
        }
    } else if (filters.budget || filters.category || filters.maxTime) {
        parts.push(`Oops, tumhari choice (under ₹${filters.budget || "any"}, ${filters.category || "any items"}, ${filters.maxTime || "any"} min) ke hisab se abhi kuch available nahi hai. Kuch aur try karein?`);
    }

    // Party logic
    if (filters.partySize && filters.partySize > 1) {
        const totalBudget = filters.budget || 500;
        const perPerson = Math.floor(totalBudget / filters.partySize);
        parts.push(`🎉 Party vibes! ${filters.partySize} logo ke liye per person ₹${perPerson} ka budget banta hai.`);
        
        // Suggest bulk items
        const bulkItems = intentPicks.length > 0 ? intentPicks : timePicks;
        if (bulkItems.length > 0) {
            const item = bulkItems[0];
            const count = filters.partySize;
            parts.push(`Tum ${count} ${item.name} order kar sakte ho, total ₹${item.price * count} hoga. Value deal hai! 🤝`);
        }
    }

    // Personal picks
    if (personalPicks.length > 0 && intentPicks.length === 0) {
        const items = personalPicks.map((i) => i.name).join(", ");
        parts.push(`Tumhara purana favourite — ${items} — bhi ready hai!`);
    }

    // Time-based picks
    if (timePicks.length > 0 && intentPicks.length === 0) {
        const items = timePicks.map((i) => i.name).join(", ");
        parts.push(`${timeSlot.label === "morning" ? "Breakfast" : timeSlot.label === "afternoon" ? "Lunch" : "Snacks"} ke liye ye best rahega: ${items}`);
    }

    return parts.join("\n\n");
}

/**
 * Fetch user's order history item names from Firestore order data.
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

