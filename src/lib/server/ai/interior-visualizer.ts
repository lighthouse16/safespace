import { getGeminiClient } from "./gemini-client";
import { getActiveImageModel, parseGeminiError } from "./model-config";

export interface InteriorVisualizerInput {
  roomType?: string;
  furnitureList: Array<{
    name: string;
    category?: string;
    widthCm?: number;
    depthCm?: number;
  }>;
  layoutTitle?: string;
  isAlternative?: boolean;
  requestedModel?: string;
  isPremium?: boolean;
  userConsent: boolean;
}

export interface InteriorVisualizerResult {
  imageBase64: string;
  imageMimeType: string;
  model: string;
  disclaimer: string;
  timestamp: string;
}

export async function visualizeInteriorWithGemini(
  input: InteriorVisualizerInput
): Promise<{ success: boolean; data?: InteriorVisualizerResult; error?: string; statusCode?: number }> {
  if (!input.userConsent) {
    return {
      success: false,
      error: "User consent required before generating AI visual concept.",
      statusCode: 400,
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      error: "Gemini API key is not configured on this server (GEMINI_API_KEY).",
      statusCode: 503,
    };
  }

  const model = getActiveImageModel(input.requestedModel, input.isPremium);

  const roomName = input.roomType || "Living & Clinic Care Room";
  const furnitureSummary = input.furnitureList.length > 0
    ? input.furnitureList.slice(0, 15).map((f) => f.name).join(", ")
    : "accessible seating, low table, clear transit zone";

  const prompt = [
    `Architectural interior perspective photo of a well-lit, barrier-free ${roomName}.`,
    `Furnished with: ${furnitureSummary}.`,
    `Key design elements: wide open pathway, level matte flooring without trip hazards, sturdy furniture with supportive armrests, abundant warm daylight, clean modern aesthetics.`,
    `High quality architectural concept rendering, wide eye-level camera angle.`,
  ].join(" ");

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K", // 1K output to control costs and latency
        },
      },
    });

    let imageBase64: string | null = null;
    let imageMimeType = "image/png";

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      return {
        success: false,
        error: "Image generation model did not return image data.",
        statusCode: 502,
      };
    }

    return {
      success: true,
      data: {
        imageBase64,
        imageMimeType,
        model,
        disclaimer: "AI concept visualization — not to scale. Conceptual depiction only, not an engineering drawing.",
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const parsedErr = parseGeminiError(err);
    return {
      success: false,
      error: parsedErr.message,
      statusCode: parsedErr.statusCode,
    };
  }
}
