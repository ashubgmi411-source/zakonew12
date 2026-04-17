/**
 * AI Provider Adapters — Individual provider implementations for the AI Router.
 *
 * Each provider implements the AIProviderAdapter interface with:
 * - generateText(prompt, systemPrompt?) → text response
 * - generateFromImage(base64, mimeType, prompt) → text response (vision providers only)
 * - supportsVision → boolean flag
 * - supportsText → boolean flag
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { CohereClientV2 } from "cohere-ai";

// ──────────────────────────────────────────────────
// Common Interface
// ──────────────────────────────────────────────────

export interface AIProviderAdapter {
    /** Provider name for logging */
    name: string;
    /** Whether this provider supports image/vision inputs natively */
    supportsVision: boolean;
    /** Whether this provider supports text-based reasoning */
    supportsText: boolean;
    /** Generate text from a text prompt or message history */
    generateText(prompt: string | any[], systemPrompt?: string): Promise<string>;
    /** Generate text from an image + prompt (only if supportsVision is true) */
    generateFromImage?(
        base64Image: string,
        mimeType: string,
        prompt: string
    ): Promise<string>;
}

// ──────────────────────────────────────────────────
// Gemini Provider (supports vision + text)
// ──────────────────────────────────────────────────

export function getGeminiProvider(apiKey: string): AIProviderAdapter {
    return {
        name: "gemini",
        supportsVision: true,
        supportsText: true,

        async generateText(prompt: string | any[], systemPrompt?: string): Promise<string> {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
            });
            
            if (Array.isArray(prompt)) {
                // Gemini "chat" format is { role: "user" | "model", parts: [{ text: string }] }
                // We'll map the standard { role, content } format
                const history = prompt.slice(0, -1).map(m => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                }));
                const lastMessage = prompt[prompt.length - 1].content;
                const chat = model.startChat({ history });
                const result = await chat.sendMessage(lastMessage);
                return result.response.text();
            }
            
            const result = await model.generateContent(prompt);
            return result.response.text();
        },

        async generateFromImage(
            base64Image: string,
            mimeType: string,
            prompt: string
        ): Promise<string> {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Image, mimeType } },
            ]);
            return result.response.text();
        },
    };
}

// ──────────────────────────────────────────────────
// Groq Provider (supports vision + text)
// ──────────────────────────────────────────────────

export function getGroqProvider(apiKey: string): AIProviderAdapter {
    return {
        name: "groq",
        supportsVision: true, // Groq supports vision via Llama 3.2 vision
        supportsText: true,

        async generateText(prompt: string | any[], systemPrompt?: string): Promise<string> {
            const groq = new Groq({ apiKey });
            let messages: any[] = [];
            
            if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

            if (Array.isArray(prompt)) {
                messages = [...messages, ...prompt];
            } else {
                messages.push({ role: "user", content: prompt });
            }

            const completion = await groq.chat.completions.create({
                messages,
                model: "llama-3.1-8b-instant",
                temperature: 0.7,
                max_tokens: 2048,
            });
            return completion.choices[0]?.message?.content || "";
        },

        async generateFromImage(
            base64Image: string,
            mimeType: string,
            prompt: string
        ): Promise<string> {
            const groq = new Groq({ apiKey });
            // Groq supports vision via llama-3.2-11b-vision-preview
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ] as any,
                model: "llama-3.2-11b-vision-preview",
                temperature: 0.3,
                max_tokens: 2048,
            });
            return completion.choices[0]?.message?.content || "";
        },
    };
}

// ──────────────────────────────────────────────────
// Cohere Provider (text only)
// ──────────────────────────────────────────────────

export function getCohereProvider(apiKey: string): AIProviderAdapter {
    return {
        name: "cohere",
        supportsVision: false,
        supportsText: true,

        async generateText(prompt: string | any[], systemPrompt?: string): Promise<string> {
            const cohere = new CohereClientV2({ token: apiKey });
            let messages: any[] = [];
            
            if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

            if (Array.isArray(prompt)) {
                messages = [...messages, ...prompt];
            } else {
                messages.push({ role: "user", content: prompt });
            }

            const response = await cohere.chat({
                model: "command-r-plus",
                messages,
            });

            const content = response.message?.content;
            if (Array.isArray(content)) {
                return content
                    .map((c: any) => (typeof c === "string" ? c : (c as { text?: string }).text || ""))
                    .join("");
            }
            return typeof content === "string" ? content : "";
        },
    };
}

// ──────────────────────────────────────────────────
// Poe Provider (supports vision + text)
// ──────────────────────────────────────────────────

export function getPoeProvider(apiKey: string): AIProviderAdapter {
    return {
        name: "poe",
        supportsVision: true,
        supportsText: true,

        async generateText(prompt: string | any[], systemPrompt?: string): Promise<string> {
            let messages: any[] = [];
            if (Array.isArray(prompt)) {
                messages = prompt;
                if (systemPrompt) messages = [{ role: "system", content: systemPrompt }, ...messages];
            } else {
                const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
                messages = [{ role: "user", content: fullPrompt }];
            }

            const response = await fetch("https://api.poe.com/bot/ChatGPT", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    query: messages,
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                throw new Error(`Poe API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.text || data.response || data.content || "";
        },

        async generateFromImage(
            base64Image: string,
            mimeType: string,
            prompt: string
        ): Promise<string> {
            // Poe multimodal/vision call using GPT-4o bot
            const response = await fetch("https://api.poe.com/bot/GPT-4o", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    query: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                {
                                    type: "image",
                                    data: base64Image,
                                    mime_type: mimeType,
                                },
                            ],
                        },
                    ],
                }),
            });

            if (!response.ok) {
                throw new Error(`Poe Vision API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.text || data.response || data.content || "";
        },
    };
}

// ──────────────────────────────────────────────────
// NVIDIA Chat Provider (NIM)
// ──────────────────────────────────────────────────

export function getNvidiaChatProvider(apiKey: string): AIProviderAdapter {
    return {
        name: "nvidia",
        supportsVision: false,
        supportsText: true,

        async generateText(prompt: string | any[], systemPrompt?: string): Promise<string> {
            try {
                let messages: any[] = [];
                if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

                if (Array.isArray(prompt)) {
                    messages = [...messages, ...prompt];
                } else {
                    messages.push({ role: "user", content: prompt });
                }

                const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: "meta/llama-3.1-405b-instruct",
                        messages,
                        temperature: 0.6,
                        max_tokens: 2048,
                    }),
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`NVIDIA NIM HTTP ${response.status}: ${errText}`);
                }

                const data = await response.json();
                return data.choices?.[0]?.message?.content || "";
            } catch (error) {
                console.error("[NvidiaProvider] LLM failed:", error);
                throw error;
            }
        },
    };
}
