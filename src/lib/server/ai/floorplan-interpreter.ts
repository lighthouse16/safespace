import { Type, type Schema } from "@google/genai";
import { getGeminiClient } from "./gemini-client";
import { getActiveTextModel, parseGeminiError } from "./model-config";
import type { FurnitureCategory } from "@/lib/spatial-model";
import { isPointInPolygon } from "@/lib/spatial/geometry/polygons";
import type { Point2D } from "@/lib/spatial/schema";

export interface InterpretedElementCandidate {
  id: string;
  name: string;
  category: FurnitureCategory;
  x: number; // top-left x in cm
  y: number; // top-left y in cm
  width: number; // width in cm
  depth: number; // depth in cm
  rotation: number;
  confidence: number;
  notes?: string;
  isConfirmed?: boolean;
}

export interface FloorplanInterpretationResult {
  elements: InterpretedElementCandidate[];
  rawCount: number;
  filteredCount: number;
  model: string;
  scaleUsed: number;
  humanReviewRequired: boolean;
}

const interpretationResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedElements: {
      type: Type.ARRAY,
      description: "List of detected furniture, fixtures, and obstacles in the floorplan image",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Descriptive name, e.g. Dining Chair, Office Desk, Single Bed, Wardrobe" },
          category: {
            type: Type.STRING,
            description: "Furniture category matching SafeSpace taxonomy",
            enum: [
              "chair",
              "desk",
              "bench",
              "table",
              "cabinet",
              "plant",
              "mat",
              "handrail",
              "light",
              "medical-fixture",
            ],
          },
          ymin: { type: Type.INTEGER, description: "Top coordinate 0-1000" },
          xmin: { type: Type.INTEGER, description: "Left coordinate 0-1000" },
          ymax: { type: Type.INTEGER, description: "Bottom coordinate 0-1000" },
          xmax: { type: Type.INTEGER, description: "Right coordinate 0-1000" },
          confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" },
          notes: { type: Type.STRING, description: "Visual evidence observation" },
        },
        required: ["name", "category", "ymin", "xmin", "ymax", "xmax", "confidence"],
      },
    },
  },
  required: ["detectedElements"],
};

const VALID_CATEGORIES = new Set<FurnitureCategory>([
  "chair",
  "desk",
  "bench",
  "table",
  "cabinet",
  "plant",
  "mat",
  "handrail",
  "light",
  "medical-fixture",
]);

export interface NormalizedBoxTransformInput {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  imageWidth?: number;
  imageHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  pixelsPerCm: number;
}

export interface PhysicalBoxResult {
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
}

/**
 * Transforms Gemini 0-1000 normalized image coordinates to canonical SafeSpace physical centimeters.
 * Accurately models SVG viewBox (800x600 default) with preserveAspectRatio="xMidYMid meet" letterboxing
 * and divides canvas pixels by calibration pixelsPerCm.
 */
export function transformNormalizedBoxToPhysicalCm(
  input: NormalizedBoxTransformInput
): PhysicalBoxResult {
  const boxW = input.canvasWidth && input.canvasWidth > 0 ? input.canvasWidth : 800;
  const boxH = input.canvasHeight && input.canvasHeight > 0 ? input.canvasHeight : 600;
  const imgW = input.imageWidth && input.imageWidth > 0 ? input.imageWidth : boxW;
  const imgH = input.imageHeight && input.imageHeight > 0 ? input.imageHeight : boxH;
  const ppm = input.pixelsPerCm;

  // SVG preserveAspectRatio="xMidYMid meet" transform
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const renderedW = imgW * scale;
  const renderedH = imgH * scale;
  const offsetX = (boxW - renderedW) / 2;
  const offsetY = (boxH - renderedH) / 2;

  const normXmin = Math.max(0, Math.min(1000, input.xmin)) / 1000;
  const normXmax = Math.max(0, Math.min(1000, input.xmax)) / 1000;
  const normYmin = Math.max(0, Math.min(1000, input.ymin)) / 1000;
  const normYmax = Math.max(0, Math.min(1000, input.ymax)) / 1000;

  const canvasPxLeft = offsetX + normXmin * renderedW;
  const canvasPxTop = offsetY + normYmin * renderedH;
  const canvasPxWidth = (normXmax - normXmin) * renderedW;
  const canvasPxHeight = (normYmax - normYmin) * renderedH;

  return {
    xCm: Math.round(canvasPxLeft / ppm),
    yCm: Math.round(canvasPxTop / ppm),
    widthCm: Math.round(canvasPxWidth / ppm),
    depthCm: Math.round(canvasPxHeight / ppm),
  };
}

export async function interpretFloorplanWithGemini(params: {
  imageBase64: string;
  imageMimeType: string;
  canvasWidth?: number;
  canvasHeight?: number;
  imageWidth?: number;
  imageHeight?: number;
  pixelsPerCm?: number;
  canonicalBoundary?: readonly Point2D[] | Point2D[];
  requestedModel?: string;
  userConsent?: boolean;
}): Promise<{ success: boolean; data?: FloorplanInterpretationResult; error?: string; statusCode?: number }> {
  if (params.userConsent === false) {
    return {
      success: false,
      error: "User consent required before analyzing floorplan with external AI.",
      statusCode: 400,
    };
  }

  if (!params.pixelsPerCm || params.pixelsPerCm <= 0 || !Number.isFinite(params.pixelsPerCm)) {
    return {
      success: false,
      error: "Calibration scale required. Floorplan image must be calibrated with a real-world reference dimension before interpreting spatial dimensions.",
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

  const model = getActiveTextModel(params.requestedModel);
  const ppm = params.pixelsPerCm;

  try {
    const prompt = `You are a clinical accessibility and spatial floorplan perception assistant.
Analyze this architectural 2D floorplan image. Detect all distinct furniture items, obstacles, and fixtures visible in the space.
For each element, specify its bounding box normalized between 0 and 1000 where (0,0) is top-left and (1000,1000) is bottom-right.
Assign the closest valid category from: chair, desk, bench, table, cabinet, plant, mat, handrail, light, medical-fixture.
Assign a realistic confidence score (0.0 to 1.0) and a concise descriptive name.
Do NOT invent objects that are not clearly visible. Be precise.`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: params.imageMimeType,
                data: params.imageBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: interpretationResponseSchema,
        temperature: 0.2,
      },
    });

    const text = response.text || "{}";
    let parsed: { detectedElements?: Array<Record<string, unknown>> } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: "Model returned invalid JSON format.",
        statusCode: 502,
      };
    }

    const rawElements = Array.isArray(parsed.detectedElements) ? parsed.detectedElements : [];
    const validCandidates: InterpretedElementCandidate[] = [];

    for (let i = 0; i < rawElements.length; i++) {
      const el = rawElements[i];
      if (!el || typeof el !== "object") continue;

      const rawCategory = String(el.category || "").toLowerCase() as FurnitureCategory;
      const category: FurnitureCategory = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "cabinet";

      const xminRaw = Number(el.xmin);
      const xmaxRaw = Number(el.xmax);
      const yminRaw = Number(el.ymin);
      const ymaxRaw = Number(el.ymax);

      if (
        !Number.isFinite(xminRaw) ||
        !Number.isFinite(xmaxRaw) ||
        !Number.isFinite(yminRaw) ||
        !Number.isFinite(ymaxRaw)
      ) {
        continue;
      }

      const xmin = Math.max(0, Math.min(1000, xminRaw));
      const xmax = Math.max(0, Math.min(1000, xmaxRaw));
      const ymin = Math.max(0, Math.min(1000, yminRaw));
      const ymax = Math.max(0, Math.min(1000, ymaxRaw));

      if (xmax <= xmin || ymax <= ymin) continue;

      const physical = transformNormalizedBoxToPhysicalCm({
        xmin,
        ymin,
        xmax,
        ymax,
        imageWidth: params.imageWidth,
        imageHeight: params.imageHeight,
        canvasWidth: params.canvasWidth,
        canvasHeight: params.canvasHeight,
        pixelsPerCm: ppm,
      });

      const { xCm, yCm, widthCm, depthCm } = physical;

      // Validate realistic furniture dimensions in cm (reject noise or massive boxes)
      if (widthCm < 15 || depthCm < 15 || widthCm > 600 || depthCm > 600) {
        continue;
      }

      // If boundary is supplied, verify center is inside boundary or near it
      if (params.canonicalBoundary && params.canonicalBoundary.length >= 3) {
        const centerCm = { x: xCm + widthCm / 2, y: yCm + depthCm / 2 };
        const insideCenter = isPointInPolygon(centerCm, params.canonicalBoundary);
        if (!insideCenter) {
          const corners = [
            { x: xCm, y: yCm },
            { x: xCm + widthCm, y: yCm },
            { x: xCm + widthCm, y: yCm + depthCm },
            { x: xCm, y: yCm + depthCm },
          ];
          const anyCornerInside = corners.some((c) => isPointInPolygon(c, params.canonicalBoundary!));
          if (!anyCornerInside) {
            continue;
          }
        }
      }

      const confRaw = Number(el.confidence);
      const confidence = Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw)) : 0.8;

      validCandidates.push({
        id: `ai-detect-${Date.now()}-${i}`,
        name: typeof el.name === "string" && el.name.trim() ? el.name.trim() : `Detected ${category}`,
        category,
        x: xCm,
        y: yCm,
        width: Math.max(20, widthCm),
        depth: Math.max(20, depthCm),
        rotation: 0,
        confidence,
        notes: typeof el.notes === "string" ? el.notes : undefined,
        isConfirmed: false,
      });
    }

    return {
      success: true,
      data: {
        elements: validCandidates,
        rawCount: rawElements.length,
        filteredCount: rawElements.length - validCandidates.length,
        model,
        scaleUsed: ppm,
        humanReviewRequired: true,
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
