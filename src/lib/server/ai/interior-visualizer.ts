import { getGeminiClient } from "./gemini-client";
import { getActiveImageModel, parseGeminiError, isModelRetired } from "./model-config";

export interface InteriorVisualizerInput {
  roomType?: string;
  roomDimensions?: { widthCm: number; depthCm: number };
  roomBoundary?: Array<{ x: number; y: number }>;
  furnitureList: Array<{
    name: string;
    category?: string;
    widthCm?: number;
    depthCm?: number;
    x?: number;
    y?: number;
    rotation?: number;
  }>;
  obstacles?: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    depth: number;
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

  if (input.requestedModel && isModelRetired(input.requestedModel)) {
    return {
      success: false,
      error: `Requested image model '${input.requestedModel}' is retired. Please use a supported production model.`,
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
  const dimensionsSummary = input.roomDimensions
    ? `Room footprint: ${Math.round(input.roomDimensions.widthCm)} cm width by ${Math.round(input.roomDimensions.depthCm)} cm depth.`
    : "Standard barrier-free residential care room.";

  const spatialFurnitureSummary = input.furnitureList.length > 0
    ? input.furnitureList
        .slice(0, 15)
        .map((f) => {
          const coords = (f.x !== undefined && f.y !== undefined)
            ? `placed at (${Math.round(f.x)}, ${Math.round(f.y)}) cm, rotation ${f.rotation || 0}°`
            : "";
          const size = (f.widthCm && f.depthCm) ? `(${Math.round(f.widthCm)}x${Math.round(f.depthCm)} cm)` : "";
          return `${f.name} ${size} ${coords}`.trim();
        })
        .join("; ")
    : "accessible seating, low bedside table, wide barrier-free transit zone";

  const obstaclesSummary = input.obstacles && input.obstacles.length > 0
    ? `Keep clear of architectural obstacles: ${input.obstacles.map((o) => o.name).join(", ")}.`
    : "Ensure clear transit zones along primary corridors.";

  const prompt = [
    `Architectural interior perspective photo of a well-lit, barrier-free ${roomName}.`,
    dimensionsSummary,
    `Grounded spatial arrangement: ${spatialFurnitureSummary}.`,
    obstaclesSummary,
    `Key design elements: wide open pathway, level matte flooring without trip hazards, sturdy supportive furniture, abundant warm daylight, clean modern aesthetics.`,
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
        disclaimer: "AI concept visualization — generic spatial inspiration only. Not to scale and not an engineering or layout-accurate drawing. All clearances must be verified via the deterministic 2D spatial evaluator.",
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
