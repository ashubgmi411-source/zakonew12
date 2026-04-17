/**
 * NVIDIA Image Generation Service
 * 
 * Uses NVIDIA NIM (Stable Diffusion XL) to generate high-quality images from prompts.
 * Specifically optimized for food items in the Zayko canteen app.
 */

export async function generateFoodImage(itemDescription: string): Promise<string> {
    const apiKey = process.env.NVIDIA_IMAGE_GEN_KEY;
    if (!apiKey) {
        throw new Error("NVIDIA_IMAGE_GEN_KEY is missing in environment variables.");
    }

    // Enhance the prompt for food photography excellence
    const enhancedPrompt = `High-end professional food photography of ${itemDescription}, appetizing, delicious, studio lighting, depth of field, 8k resolution, cinematic composition, isolated on a neutral background.`;

    try {
        console.log(`[ImageGen] Generating image for: ${itemDescription}...`);
        
        const response = await fetch("https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            body: JSON.stringify({
                text_prompts: [
                    {
                        text: enhancedPrompt,
                        weight: 1
                    }
                ],
                cfg_scale: 7,
                sampler: "K_DPM_2_ANCESTRAL",
                seed: 0,
                steps: 30
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NVIDIA NIM Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        
        // NVIDIA NIM for SDXL returns artifacts array with base64
        if (result.artifacts && result.artifacts.length > 0) {
            return result.artifacts[0].base64;
        }

        throw new Error("No image data returned from NVIDIA NIM");
    } catch (error) {
        console.error("[ImageGen] Failed to generate image:", error);
        throw error;
    }
}
