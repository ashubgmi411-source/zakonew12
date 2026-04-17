import Tesseract from "tesseract.js";

/**
 * OCR Utility — Extracted raw text from a base64-encoded image.
 * 
 * Uses Tesseract.js for local image-to-text conversion.
 */

export async function extractTextFromImage(
    base64Image: string,
    mimeType: string
): Promise<string> {
    try {
        console.log(`[OCR] Starting text extraction (type: ${mimeType})...`);
        
        const nvidiaKey = process.env.NVIDIA_OCR_KEY;
        if (nvidiaKey) {
            try {
                console.log("[OCR] Attempting NVIDIA High-Precision OCR...");
                const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
                
                const nvResponse = await fetch("https://ai.api.nvidia.com/v1/cv/nvidia/ocrmaster", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${nvidiaKey}`,
                        "Accept": "application/json",
                    },
                    body: JSON.stringify({ image: base64Data }),
                });

                if (nvResponse.ok) {
                    const nvData = await nvResponse.json();
                    // Extract text from NVIDIA response (standard NIM OCR format)
                    const extracted = nvData.description || nvData.text || (nvData.annotations?.map((a: any) => a.description).join(" "));
                    if (extracted) {
                        console.log("[OCR] NVIDIA OCR successful.");
                        return extracted;
                    }
                }
                console.warn("[OCR] NVIDIA OCR returned no text, falling back to Tesseract.");
            } catch (nvErr) {
                console.warn("[OCR] NVIDIA OCR failed, falling back to Tesseract:", nvErr);
            }
        }

        // Tesseract Fallback
        const base64Data = base64Image.includes(",")
            ? base64Image.split(",")[1]
            : base64Image;

        const imageBuffer = Buffer.from(base64Data, "base64");

        const result = await Tesseract.recognize(imageBuffer, "eng", {
            logger: (m) => {
                if (m.status === "recognizing text") {
                    // Log progress if needed
                }
            },
        });

        const text = result.data.text;

        if (!text || text.trim().length === 0) {
            console.warn("[OCR] Extraction completed but returned no text.");
            return "";
        }

        console.log(`[OCR] Extraction successful (${text.length} characters)`);
        return text;
    } catch (error) {
        console.error("[OCR] Extraction failed:", error);
        throw new Error(`OCR_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
}
