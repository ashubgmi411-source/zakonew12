/**
 * LLM Service — Re-exports the multi-LLM fallback from @/lib/llm.
 * Clean import entry point for components and API routes.
 */

export { chatWithFallback } from "@/lib/llm";
export type { ChatMessage } from "@/lib/llm";

// ─── Gender-Respectful Greeting ─────────────────────────────────────

interface GreetingUser {
    name?: string;
    gender?: "male" | "female" | string;
}

/**
 * Returns a time-aware, gender-respectful greeting.
 *
 * Examples:
 *   { name: "Ravi",   gender: "male"   }  →  "Good afternoon Sir Ravi"
 *   { name: "Anjali", gender: "female" }  →  "Good afternoon Ma'am Anjali"
 *   { name: "Alex"                     }  →  "Good afternoon Alex"
 */
export function getRespectfulGreeting(user: GreetingUser): string {
    const firstName = (user.name || "").split(" ")[0] || "Guest";
    const gender = (user.gender || "").toLowerCase().trim();

    // Time-based salutation
    const hour = new Date().getHours();
    let timeGreeting: string;
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 17) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";

    // Gender-respectful title
    if (gender === "male") return `${timeGreeting} Sir ${firstName}`;
    if (gender === "female") return `${timeGreeting} Ma'am ${firstName}`;
    return `${timeGreeting} ${firstName}`;
}

/**
 * Returns the honorific for use in AI system prompts.
 * e.g. "Sir Ravi", "Ma'am Anjali", or just "Ravi"
 */
export function getHonorific(user: GreetingUser): string {
    const firstName = (user.name || "").split(" ")[0] || "Guest";
    const gender = (user.gender || "").toLowerCase().trim();

    if (gender === "male") return `Sir ${firstName}`;
    if (gender === "female") return `Ma'am ${firstName}`;
    return firstName;
}
