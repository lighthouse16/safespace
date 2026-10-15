import { Type, type Schema } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL } from "./gemini-client";
import type { SpatialFurniture } from "@/lib/spatial-model";

export interface InterpretedElementCandidate {
  id: string;
  name: string;
  category: SpatialFurniture["category"];
  x: number; // canvas or cm coordinate
  y: number; // canvas or cm coordinate
  width: number; // width in cm
  depth: number; // depth in cm
  rotation: number;
  confidence: number;
  notes?: string;
}

export interface FloorplanInterpretationResult {
  elements: InterpretedElementCandidate[];
  rawCount: number;
  filteredCount: number;
  model: string;
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
          name: { type: Type.STRING, description: "Descriptive name, e.g. Dining Chair, Office Desk, Bed" },
          category: {
            type: Type.STRING,
            description: "Furniture category",
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
    structuralSummary: {
      type: Type.OBJECT,
      properties: {
        notes: { type: Type.STRING, description: "Brief visual summary of room layout" },
      },
    },
  },
  required: ["detectedElements"],
};

export async function interpretFloorplanWithGemini(params: {
  imageBase64: string;
  imageMimeType: string;
  canvasWidth?: number;
  canvasHeight?: number;
  pixelsPerCm?: number;
}): Promise<{ success: boolean; data?: FloorplanInterpretationResult; error?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      error: "Gemini API key is not configured on this server (GEMINI_API_KEY).",
    };
  }

  try {
    const prompt = `You are a clinical accessibility and spatial floorplan analyst.
Analyze this architectural 2D floorplan image. Detect all distinct furniture items, obstacles, and fixtures visible in the space.
For each element, specify its bounding box normalized between 0 and 1000 where (0,0) is top-left and (1000,1000) is bottom-right.
Assign appropriate category, high/moderate confidence score (0.0 to 1.0), and descriptive name.
Do NOT invent objects that are not visible. Be precise.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
    const parsed = JSON.parse(text);
    const rawElements = parsed.detectedElements || [];

    const canvasW = params.canvasWidth || 1000;
    const canvasH = params.canvasHeight || 800;

    if (!params.pixelsPerCm || params.pixelsPerCm <= 0) {
      return {
        success: false,
        error: "Calibration scale required: cannot compute real-world centimeters without valid scale calibration.",
      };
    }

    const ppm = params.pixelsPerCm;
    const validCandidates: InterpretedElementCandidate[] = [];

    for (let i = 0; i < rawElements.length; i++) {
      const el = rawElements[i];
      // Normalize bounds
      const xmin = Math.max(0, Math.min(1000, el.xmin));
      const xmax = Math.max(0, Math.min(1000, el.xmax));
      const ymin = Math.max(0, Math.min(1000, el.ymin));
      const ymax = Math.max(0, Math.min(1000, el.ymax));

      if (xmax <= xmin || ymax <= ymin) continue;

      // Convert normalized (0-1000) to canvas pixel coordinates
      const leftPx = (xmin / 1000) * canvasW;
      const topPx = (ymin / 1000) * canvasH;
      const widthPx = ((xmax - xmin) / 1000) * canvasW;
      const heightPx = ((ymax - ymin) / 1000) * canvasH;

      // Exact coordinate and dimension conversion to real-world centimeters
      const widthCm = Math.round(widthPx / ppm);
      const depthCm = Math.round(heightPx / ppm);
      const centerXCm = Math.round((leftPx + widthPx / 2) / ppm);
      const centerYCm = Math.round((topPx + heightPx / 2) / ppm);

      // Enforce physical constraints: reject impossibly small or oversized noise
      if (widthCm < 15 || depthCm < 15 || widthCm > 600 || depthCm > 600) {
        continue;
      }

      validCandidates.push({
        id: `ai-item-${Date.now()}-${i}`,
        name: el.name || `Detected ${el.category}`,
        category: el.category as SpatialFurniture["category"],
        x: centerXCm,
        y: centerYCm,
        width: Math.max(20, widthCm),
        depth: Math.max(20, depthCm),
        rotation: 0,
        confidence: typeof el.confidence === "number" ? Math.min(1, Math.max(0, el.confidence)) : 0.8,
        notes: el.notes || "",
      });
    }

    return {
      success: true,
      data: {
        elements: validCandidates,
        rawCount: rawElements.length,
        filteredCount: rawElements.length - validCandidates.length,
        model: GEMINI_MODEL,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI interpretation failed";
    return { success: false, error: msg };
  }
}
