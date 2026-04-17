/**
 * AI Router — Centralized multi-provider AI routing engine with OCR fallback.
 *
 * Features:
 * - Hybrid Vision: Try native vision support -> Fallback to OCR + Text Reasoning
 * - Circuit Breaker: tracks failures per provider+key, cooldown after 3 failures
 * - Key Rotation: reads comma-separated keys from env, rotates through healthy keys
 * - Standardized response and error reporting
 */

import {
    getGeminiProvider,
    getGroqProvider,
    getCohereProvider,
    getPoeProvider,
    getNvidiaChatProvider,
    type AIProviderAdapter,
} from "@/lib/aiProviders";
import { extractTextFromImage } from "@/lib/ocr";

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

/** Standardized AI response regardless of provider */
export interface AIResponse<T = string> {
    success: boolean;
    provider: string;
    data: T;
    error?: string;
    reason?: "ALL_PROVIDERS_EXHAUSTED" | "OCR_FAILED" | "NO_VISION_CAPABLE_PROVIDER" | "AUTH_FAILED" | "UNKNOWN";
}

/** Supported provider names */
export type ProviderName = "gemini" | "poe" | "groq" | "cohere" | "nvidia";

/** Configuration for the AI router */
interface RouterConfig {
    maxRetriesPerProvider: number;
    cooldownMs: number;
    maxFailuresBeforeBreak: number;
}

// ──────────────────────────────────────────────────
// Circuit Breaker State (in-memory)
// ──────────────────────────────────────────────────

interface CircuitState {
    failures: number;
    lastFailureAt: number;
    isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitState>();

const DEFAULT_CONFIG: RouterConfig = {
    maxRetriesPerProvider: 3,
    cooldownMs: 5 * 60 * 1000,
    maxFailuresBeforeBreak: 3,
};

// ──────────────────────────────────────────────────
// Key Management
// ──────────────────────────────────────────────────

/**
 * Get all API keys for a provider.
 * Merges keys from PROVIDER_KEYS (comma-separated) and PROVIDER_API_KEY.
 * Deduplicates to ensure no redundant attempts.
 */
function getKeysForProvider(provider: ProviderName): string[] {
    const multiKeyEnvMap: Record<ProviderName, string> = {
        gemini: "GEMINI_KEYS",
        groq: "GROQ_KEYS",
        cohere: "COHERE_KEYS",
        poe: "POE_KEYS",
    };

    const singleKeyEnvMap: Record<ProviderName, string> = {
        gemini: "GEMINI_API_KEY",
        groq: "GROQ_API_KEY",
        cohere: "COHERE_API_KEY",
        poe: "POE_API_KEY",
        nvidia: "NVIDIA_LLM_KEY",
    };

    const allKeys: string[] = [];

    // Add keys from multi-key env var
    const multiKeyVal = process.env[multiKeyEnvMap[provider]];
    if (multiKeyVal) {
        const keys = multiKeyVal.split(",").map((k) => k.trim()).filter(Boolean);
        allKeys.push(...keys);
    }

    // Add key from single-key env var
    const singleKeyVal = process.env[singleKeyEnvMap[provider]];
    if (singleKeyVal?.trim()) {
        allKeys.push(singleKeyVal.trim());
    }

    // Deduplicate
    return Array.from(new Set(allKeys));
}

// ──────────────────────────────────────────────────
// Logic Functions
// ──────────────────────────────────────────────────

function getCircuitState(provider: ProviderName, keyIndex: number): CircuitState {
    const key = `${provider}:${keyIndex}`;
    if (!circuitBreakers.has(key)) {
        circuitBreakers.set(key, { failures: 0, lastFailureAt: 0, isOpen: false });
    }
    return circuitBreakers.get(key)!;
}

function isCircuitAvailable(provider: ProviderName, keyIndex: number, config: RouterConfig): boolean {
    const state = getCircuitState(provider, keyIndex);
    if (!state.isOpen) return true;
    const elapsed = Date.now() - state.lastFailureAt;
    if (elapsed >= config.cooldownMs) {
        state.failures = 0;
        state.isOpen = false;
        return true;
    }
    return false;
}

function recordFailure(provider: ProviderName, keyIndex: number, config: RouterConfig): void {
    const state = getCircuitState(provider, keyIndex);
    state.failures++;
    state.lastFailureAt = Date.now();
    if (state.failures >= config.maxFailuresBeforeBreak) {
        state.isOpen = true;
    }
}

function recordSuccess(provider: ProviderName, keyIndex: number): void {
    const state = getCircuitState(provider, keyIndex);
    state.failures = 0;
    state.isOpen = false;
}

function isAuthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
        message.includes("401") ||
        message.includes("403") ||
        message.includes("unauthorized") ||
        message.includes("forbidden") ||
        message.includes("invalid api key") ||
        message.includes("invalid_api_key") ||
        message.includes("api key not valid") ||
        message.includes("permission denied")
    );
}

const PROVIDER_ORDER: ProviderName[] = ["nvidia", "gemini", "poe", "groq", "cohere"];

function getProviderAdapter(provider: ProviderName, apiKey: string): AIProviderAdapter {
    switch (provider) {
        case "gemini": return getGeminiProvider(apiKey);
        case "groq": return getGroqProvider(apiKey);
        case "cohere": return getCohereProvider(apiKey);
        case "poe": return getPoeProvider(apiKey);
        case "nvidia": return getNvidiaChatProvider(apiKey);
    }
}

// ──────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────

/**
 * Run a text-based AI request with fallback.
 */
export async function runTextAI(
    prompt: string | any[],
    systemPrompt?: string,
    config: Partial<RouterConfig> = {}
): Promise<AIResponse<string>> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    for (const provider of PROVIDER_ORDER) {
        const keys = getKeysForProvider(provider);
        if (keys.length === 0) continue;

        const testAdapter = getProviderAdapter(provider, keys[0]);
        if (!testAdapter.supportsText) continue;

        let retriesUsed = 0;
        for (let ki = 0; ki < keys.length && retriesUsed < cfg.maxRetriesPerProvider; ki++) {
            if (!isCircuitAvailable(provider, ki, cfg)) continue;

            retriesUsed++;
            try {
                const adapter = getProviderAdapter(provider, keys[ki]);
                const result = await adapter.generateText(prompt, systemPrompt);
                if (result && result.trim()) {
                    recordSuccess(provider, ki);
                    return { success: true, provider, data: result };
                }
            } catch (error) {
                console.warn(`[AIRouter] ${provider}:key${ki} failed:`, error);
                recordFailure(provider, ki, cfg);
                if (isAuthError(error)) break;
            }
        }
    }

    return {
        success: false,
        provider: "none",
        data: "",
        error: "All text AI providers are currently unavailable.",
        reason: "ALL_PROVIDERS_EXHAUSTED"
    };
}

/**
 * Run a vision-based AI request with hybrid OCR fallback.
 */
export async function runVisionAI(
    base64Image: string,
    mimeType: string,
    prompt: string,
    config: Partial<RouterConfig> = {}
): Promise<AIResponse<string>> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    let totalVisionAttempts = 0;

    // --- PHASE 1: Try Native Vision Providers ---
    for (const provider of PROVIDER_ORDER) {
        const keys = getKeysForProvider(provider);
        if (keys.length === 0) continue;

        const testAdapter = getProviderAdapter(provider, keys[0]);
        if (!testAdapter.supportsVision) continue;

        let retriesUsed = 0;
        for (let ki = 0; ki < keys.length && retriesUsed < cfg.maxRetriesPerProvider; ki++) {
            if (!isCircuitAvailable(provider, ki, cfg)) continue;

            totalVisionAttempts++;
            retriesUsed++;
            try {
                const adapter = getProviderAdapter(provider, keys[ki]);
                const result = await adapter.generateFromImage!(base64Image, mimeType, prompt);
                if (result && result.trim()) {
                    recordSuccess(provider, ki);
                    console.log(`[AIRouter] ✅ Native vision success via ${provider}`);
                    return { success: true, provider, data: result };
                }
            } catch (error) {
                console.warn(`[AIRouter] Vision ${provider}:key${ki} failed:`, error);
                recordFailure(provider, ki, cfg);
                if (isAuthError(error)) break;
            }
        }
    }

    // --- PHASE 2: OCR Fallback ---
    console.log("[AIRouter] ⚠️ Native vision failed or unavailable. Triggering OCR fallback...");

    let extractedText = "";
    try {
        extractedText = await extractTextFromImage(base64Image, mimeType);
    } catch (ocrError) {
        return {
            success: false,
            provider: "none",
            data: "",
            error: `OCR Fallback failed: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`,
            reason: "OCR_FAILED"
        };
    }

    if (!extractedText || extractedText.trim().length < 5) {
        return {
            success: false,
            provider: "none",
            data: "",
            error: "OCR failed to extract meaningful text from image.",
            reason: "OCR_FAILED"
        };
    }

    // --- PHASE 3: Process OCR Text with Text-LLM ---
    const ocrPrompt = `The following text was extracted via OCR from a menu image. It may contain typos or be poorly formatted. 
Please analyze this text and extract food/drink items, prices, and categories into a JSON array.

EXTRACTION RULES:
${prompt}

RAW OCR TEXT:
---
${extractedText}
---`;

    console.log("[AIRouter] OCR text extracted, calling text-only LLM for structuring...");
    const textResult = await runTextAI(ocrPrompt);

    if (textResult.success) {
        return {
            ...textResult,
            provider: `${textResult.provider} (via OCR)`
        };
    }

    return {
        success: false,
        provider: "none",
        data: "",
        error: "All vision providers failed, and text-only fallback also failed.",
        reason: "ALL_PROVIDERS_EXHAUSTED"
    };
}

export function getRouterHealth(): Record<string, { available: boolean; failures: number; isOpen: boolean }> {
    const health: Record<string, { available: boolean; failures: number; isOpen: boolean }> = {};
    for (const provider of PROVIDER_ORDER) {
        const keys = getKeysForProvider(provider);
        for (let ki = 0; ki < keys.length; ki++) {
            const id = `${provider}:key${ki}`;
            if (circuitBreakers.has(id)) {
                const state = circuitBreakers.get(id)!;
                const available = isCircuitAvailable(provider, ki, DEFAULT_CONFIG);
                health[id] = { available, failures: state.failures, isOpen: state.isOpen };
            }
        }
    }
    return health;
}

export const runAI = runTextAI;
