/**
 * Jarvis NLP Parser — extracts item names and quantities 
 * from natural Hinglish/English text like:
 * "milk 2 packet kar do" → { name: "milk", quantity: 2 }
 * "mere liye 3 upma de do" → { name: "upma", quantity: 3 }
 * "1 boil egg add karo" → { name: "boil egg", quantity: 1 }
 */

export interface ParsedItem {
    rawName: string;
    quantity: number;
}

// Common Hindi filler words to strip
const FILLER_WORDS = new Set([
    "kar", "karo", "kardo", "kro", "de", "do", "dedo", "dena",
    "add", "order", "laga", "lagao", "lagado", "bhej", "bhejo",
    "mere", "mera", "meri", "mujhe", "ko", "liye", "ke", "ka",
    "ek", "please", "plz", "pls", "bhi", "aur", "or", "and",
    "packet", "packets", "plate", "plates", "piece", "pieces",
    "glass", "glasses", "cup", "cups", "bowl", "bowls",
    "chahiye", "chaiye", "manga", "mangao", "mangwa", "rakh",
    "set", "sets", "la", "lao", "lana", "hai", "hain",
    // Hindi Devanagari support
    "कर", "करो", "करदो", "दे", "दो", "देदो", "देना", "ऑर्डर",
    "लगा", "लगाओ", "भेज", "भेजो", "मेरे", "मेरा", "मेरी", "मुझे",
    "को", "लिए", "के", "का", "एक", "प्लीज़", "प्लीज", "भी",
    "और", "प्लेट", "पीस", "ग्लास", "कप", "चाहिए", "मंगा",
    "मंगाओ", "रख", "ला", "लाओ", "लाना", "है", "हैं", "पैकेट", "करदें", "दें"
]);

/**
 * Parse a single line/sentence for item + quantity.
 * Supports patterns like:
 *   "2 momos"  |  "momos 2"  |  "momos x2"  |  "momos × 2"
 *   "ek momos" (Hindi ek=1)  |  "do momos" (Hindi do=2)
 */
const HINDI_NUMBERS: Record<string, number> = {
    ek: 1, do: 2, teen: 3, char: 4, panch: 5,
    che: 6, saat: 7, aath: 8, nau: 9, das: 10,
    // Hindi Devanagari script
    एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5,
    छह: 6, छे: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
};

export function parseNaturalLanguage(text: string): ParsedItem[] {
    let normalized = text;

    // Smart auto-segmentation: if user says "2 milk 1 samosa" without "and/aur", 
    // we inject a comma between the item name ("milk") and the next number ("1").
    normalized = normalized.replace(/([a-zA-Z\u0900-\u097F]+)\s+(\d+)\b/g, "$1 , $2");
    
    // Do the same for transitions from number to word if no space (legacy case)
    // normalized = normalized.replace(/(\d+)([a-zA-Z\u0900-\u097F]+)/g, "$1 $2");

    // Do the same for Hindi number words (ek, do, teen, एक, दो...)
    const hindiNumWords = Object.keys(HINDI_NUMBERS).join("|");
    const hindiRegex = new RegExp(`([a-zA-Z\\u0900-\\u097F]+)\\s+(${hindiNumWords})\\b`, "gi");
    normalized = normalized.replace(hindiRegex, "$1 , $2");

    // Handle case where user says "milk 2 samosa 3" -> segments might lose "3"
    // If a segment is JUST a number, we should probably append it to previous segment 
    // but better split logic is to ensure word-number-word becomes word-number , word
    normalized = normalized.replace(/(\d+)\s+([a-zA-Z\u0900-\u097F]+)/g, " , $1 $2");
    // Clean double commas
    normalized = normalized.replace(/,\s*,/g, ",");

    // Split by comma, "aur", "and", "&" or newline for multi-item support
    const segments = normalized
        .split(/[,&\n]|(?:\s+(?:aur|and|or|और)\s+)/gi)
        .map(s => s.trim())
        .filter(Boolean);

    const results: ParsedItem[] = [];

    for (const segment of segments) {
        const parsed = parseSingleSegment(segment);
        if (parsed) results.push(parsed);
    }

    return results;
}

function parseSingleSegment(text: string): ParsedItem | null {
    let quantity = 1;
    let remaining = text.toLowerCase().trim();

    // 1. Try extract leading number: "2 momos" or "02 momos"
    const leadingNum = remaining.match(/^(\d+)\s+/);
    if (leadingNum) {
        quantity = parseInt(leadingNum[1], 10);
        remaining = remaining.slice(leadingNum[0].length);
    }

    // 2. Try extract trailing number: "momos 2" or "momos x2"
    const trailingNum = remaining.match(/\s+[x×]?(\d+)$/);
    if (trailingNum) {
        quantity = parseInt(trailingNum[1], 10);
        remaining = remaining.slice(0, -trailingNum[0].length);
    }

    // 3. Try Hindi number words
    const words = remaining.split(/\s+/);
    const hindiIdx = words.findIndex(w => HINDI_NUMBERS[w] !== undefined);
    if (hindiIdx !== -1 && !leadingNum && !trailingNum) {
        quantity = HINDI_NUMBERS[words[hindiIdx]];
        words.splice(hindiIdx, 1);
        remaining = words.join(" ");
    }

    // 4. Strip filler words
    const cleaned = remaining
        .split(/\s+/)
        .filter(w => !FILLER_WORDS.has(w) && w.length > 0)
        .join(" ")
        .trim();

    if (!cleaned) return null;
    if (quantity <= 0) quantity = 1;
    if (quantity > 50) quantity = 50; // Safety cap

    return { rawName: cleaned, quantity };
}

/**
 * Phonetic Transliteration Dictionary
 * Maps common Devanagari canteen words to English so we can match the database.
 */
const TRANSLITERATION_MAP: Record<string, string> = {
    "समोसा": "samosa", "चाय": "chai", "कॉफी": "coffee", "रोल": "roll",
    "मैगी": "maggi", "गुलाब": "gulab", "जामुन": "jamun", "पनीर": "paneer",
    "चिकन": "chicken", "बर्गर": "burger", "पिज़्ज़ा": "pizza", "पिज़्ज़ा": "pizza",
    "पास्ता": "pasta", "सैंडविच": "sandwich", "पेटीज": "patties", "पेटीज़": "patties",
    "कोल्ड": "cold", "ड्रिंक": "drink", "पानी": "water", "बॉटल": "bottle",
    "अंडा": "egg", "आमलेट": "omelette", "डोसा": "dosa", "इडली": "idli",
    "वड़ा": "vada", "पाव": "pav", "भाजी": "bhaji", "छोले": "chole",
    "भटूरे": "bhature", "रोटी": "roti", "नान": "naan", "दाल": "dal",
    "चावल": "rice", "राइस": "rice", "वेज": "veg", "मंचूरियन": "manchurian",
    "नूडल्स": "noodles", "फ्राइड": "fried", "मोमोज": "momos", "मोमो": "momo",
    "परांठा": "paratha", "पराठा": "paratha", "आलू": "aloo", "गोभी": "gobi",
    "प्याज": "pyaz", "कचोरी": "kachori", "जूस": "juice", "शेक्स": "shake",
    "शेक": "shake", "मिल्क": "milk", "लस्सी": "lassi", "दही": "dahi",
    "जलेबी": "jalebi", "मक्खन": "butter", "बटर": "butter", "मसाला": "masala",
    "सादा": "plain"
};

export function transliterateHindi(text: string): string {
    let result = text;
    for (const [hindi, eng] of Object.entries(TRANSLITERATION_MAP)) {
        const regex = new RegExp(hindi, "g");
        result = result.replace(regex, eng);
    }
    return result;
}

/**
 * Fuzzy match a parsed name against available menu items.
 * Returns the best matching menu item or null.
 */
export function fuzzyMatchItem<T extends { name: string }>(
    rawName: string,
    menuItems: T[]
): T | null {
    const query = transliterateHindi(rawName).toLowerCase().trim();

    // 1. Exact match
    const exact = menuItems.find(m => m.name.toLowerCase() === query);
    if (exact) return exact;

    // 2. Starts-with match
    const startsWith = menuItems.find(m => m.name.toLowerCase().startsWith(query));
    if (startsWith) return startsWith;

    // 3. Contains match
    const contains = menuItems.find(m => m.name.toLowerCase().includes(query));
    if (contains) return contains;

    // 4. Reverse contains (query contains item name)
    const reverseContains = menuItems.find(m => query.includes(m.name.toLowerCase()));
    if (reverseContains) return reverseContains;

    // 5. Word overlap similarity
    const queryWords = query.split(/\s+/).filter(Boolean);
    let bestMatch: T | null = null;
    let bestScore = 0;

    for (const item of menuItems) {
        const itemNameStr = item.name || "";
        const itemWords = itemNameStr.toLowerCase().split(/\s+/).filter(Boolean);

        if (itemWords.length === 0) continue;

        const overlap = queryWords.filter(qw =>
            itemWords.some(iw => {
                // Prevent empty string or single letter aggressive matching
                if (qw.length < 2 || iw.length < 2) return iw === qw;
                return iw.includes(qw) || qw.includes(iw);
            })
        ).length;
        const score = overlap / Math.max(queryWords.length, itemWords.length);
        if (score > bestScore && score >= 0.4) {
            bestScore = score;
            bestMatch = item;
        }
    }

    return bestMatch;
}
