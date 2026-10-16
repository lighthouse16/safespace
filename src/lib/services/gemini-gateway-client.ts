import type { InterpretedElementCandidate } from "@/lib/server/ai/floorplan-interpreter";
import type { FurnitureCategory } from "@/lib/spatial-model";
import type { Point2D } from "@/lib/spatial/schema";

function getGatewayBaseUrl(): string {
  const customGateway = process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL?.trim();
  if (customGateway) {
    return customGateway.replace(/\/+$/, "");
  }
  return "";
}

export interface InterpretationRequestPayload {
  userConsent: true;
  imageMimeType: string;
  imageBase64: string;
  pixelsPerCm: number;
  imageWidth?: number;
  imageHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  canonicalBoundary?: readonly Point2D[] | Point2D[];
  requestedModel?: string;
}

export interface InterpretationResponsePayload {
  elements: InterpretedElementCandidate[];
  rawCount: number;
  filteredCount: number;
  model: string;
  scaleUsed: number;
  humanReviewRequired: boolean;
  disclaimer: string;
}

export interface ExplanationRequestPayload {
  userConsent: true;
  assessmentName: string;
  profileLabel: string;
  findings: Array<{
    title: string;
    severity?: string;
    description: string;
    evidence?: string;
  }>;
  metrics?: {
    actionableDeficitsCount?: number;
    minimumClearanceCm?: number | null;
    routeFeasibility?: string;
  };
  requestedModel?: string;
}

export interface ExplanationResponsePayload {
  explanation: {
    executiveSummary: string;
    clinicalRiskNarrative: string;
    caregiverRecommendations: string[];
    measuredFacts: {
      minimumClearanceCm: number | null;
      actionableDeficitsCount: number;
      routeFeasibility: string;
    };
    disclaimer: string;
  };
  model: string;
  timestamp: string;
  source: "gemini" | "evaluator";
}

export interface VisualizationRequestPayload {
  userConsent: true;
  roomType?: string;
  roomDimensions?: { widthCm: number; depthCm: number };
  furnitureList: Array<{
    name: string;
    category?: FurnitureCategory;
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
}

export interface VisualizationResponsePayload {
  imageBase64: string;
  imageMimeType: string;
  model: string;
  disclaimer: string;
  timestamp: string;
}

async function parseResponseOrThrow<T>(res: Response, operationName: string): Promise<T> {
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${operationName} gateway returned non-JSON response (${res.status}): ${
        text.slice(0, 100) || "Empty response"
      }. If using static GitHub Pages, verify NEXT_PUBLIC_GEMINI_GATEWAY_URL points to an active backend.`
    );
  }

  if (!res.ok) {
    const errorMsg = typeof data?.error === "string" ? data.error : `${operationName} request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function requestFloorplanInterpretation(
  payload: InterpretationRequestPayload
): Promise<InterpretationResponsePayload> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/gemini/interpretation`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SafeSpace-Client": "web-guest",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35_000),
  });

  return parseResponseOrThrow<InterpretationResponsePayload>(res, "Floorplan interpretation");
}

export async function requestFindingsExplanation(
  payload: ExplanationRequestPayload
): Promise<ExplanationResponsePayload> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/gemini/explanation`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SafeSpace-Client": "web-guest",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  return parseResponseOrThrow<ExplanationResponsePayload>(res, "Findings explanation");
}

export async function requestInteriorVisualization(
  payload: VisualizationRequestPayload
): Promise<VisualizationResponsePayload> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/gemini/visualize`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SafeSpace-Client": "web-guest",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(50_000),
  });

  return parseResponseOrThrow<VisualizationResponsePayload>(res, "Interior visualization");
}

export async function checkGatewayHealth(): Promise<{
  status: string;
  geminiConfigured: boolean;
  models?: { text: string; image: string };
}> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/gemini/health`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: "error", geminiConfigured: false };
    return await res.json();
  } catch {
    return { status: "unreachable", geminiConfigured: false };
  }
}
