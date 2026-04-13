/**
 * Emotion Detector — Keyword-based tone classification
 *
 * Zero-cost (no LLM call). Classifies user mood from text to
 * adjust response style and urgency.
 *
 * Tones: hungry | confused | casual | rushed | neutral
 */

export type EmotionState = "hungry" | "confused" | "casual" | "rushed" | "neutral";

interface EmotionResult {
    emotion: EmotionState;
    confidence: number; // 0-1
}

// ─── Keyword Banks ──────────────────────────────

const HUNGRY_KEYWORDS = [
    "bhook", "bhukh", "hungry", "starving", "famished", "pet", "kuch khana",
    "kha", "khana", "khao", "eat", "food", "jaldi", "fast", "turant",
    "abhi", "immediately", "bhook lagi", "pet mein", "bahut bhook",
    "भूख", "खाना", "पेट", "भूख लगी", "जल्दी", "तुरंत",
    "marna", "mar raha", "dying", "starved",
];

const CONFUSED_KEYWORDS = [
    "samajh", "confused", "kya", "decide", "pata nahi", "kuch bhi",
    "suggest", "recommend", "batao", "bata", "help", "idea",
    "dilemma", "option", "choice", "choose", "kya khau", "kya lu",
    "sochna", "socha", "soch", "confuse", "mushkil",
    "समझ", "क्या", "पता नहीं", "बताओ", "सुझाव",
    "what should", "what can", "any suggestion", "what do you",
];

const RUSHED_KEYWORDS = [
    "jaldi", "quick", "fast", "hurry", "rush", "time nahi",
    "class", "urgent", "abhi ke abhi", "turant", "fatafat", "jhat",
    "10 min", "5 min", "chal", "chalo", "late",
    "जल्दी", "फटाफट", "तुरंत", "झट",
];

const CASUAL_KEYWORDS = [
    "timepass", "bore", "chill", "vibe", "mood", "maza",
    "kuch naya", "try", "explore", "interesting", "fun",
    "hangout", "dosti", "friends", "group",
    "टाइमपास", "मजा", "मूड",
];

// ─── Detection Logic ────────────────────────────

function countMatches(text: string, keywords: string[]): number {
    const lower = text.toLowerCase();
    return keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
}

/**
 * Detect the emotional tone from user text.
 * Uses keyword frequency to classify — no LLM needed.
 */
export function detectEmotion(text: string): EmotionResult {
    const scores: Record<EmotionState, number> = {
        hungry: countMatches(text, HUNGRY_KEYWORDS),
        confused: countMatches(text, CONFUSED_KEYWORDS),
        rushed: countMatches(text, RUSHED_KEYWORDS),
        casual: countMatches(text, CASUAL_KEYWORDS),
        neutral: 0,
    };

    // Find highest scoring emotion
    let topEmotion: EmotionState = "neutral";
    let topScore = 0;

    for (const [emotion, score] of Object.entries(scores)) {
        if (score > topScore) {
            topScore = score;
            topEmotion = emotion as EmotionState;
        }
    }

    // Require at least 1 keyword match to classify
    if (topScore === 0) {
        return { emotion: "neutral", confidence: 0.5 };
    }

    // Confidence based on how many keywords matched
    const confidence = Math.min(1.0, 0.5 + topScore * 0.15);

    return { emotion: topEmotion, confidence };
}

/**
 * Detect user's language preference from text.
 */
export function detectLanguage(text: string): "hindi" | "english" | "hinglish" {
    // Check for Devanagari characters
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    // Check for Latin characters
    const hasLatin = /[a-zA-Z]/.test(text);

    // Common Hindi/Hinglish words written in English
    const hindiMarkers = [
        "hai", "hain", "kya", "karo", "karo", "do", "de", "mein", "mera",
        "yaar", "bhai", "aaj", "abhi", "nahi", "chahiye", "wala", "wali",
        "aur", "bhi", "toh", "ka", "ki", "ke", "se", "pe", "ko",
        "accha", "thik", "sab", "bahut", "bohot", "arre", "haan",
    ];

    const words = text.toLowerCase().split(/\s+/);
    const hindiWordCount = words.filter((w) => hindiMarkers.includes(w)).length;
    const totalWords = words.length;

    if (hasDevanagari && !hasLatin) return "hindi";
    if (!hasDevanagari && hindiWordCount === 0) return "english";
    return "hinglish"; // mixed or romanized Hindi
}
