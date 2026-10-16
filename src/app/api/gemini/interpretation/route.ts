import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limiter";
import { interpretFloorplanWithGemini } from "@/lib/server/ai/floorplan-interpreter";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

const AnonymousInterpretationSchema = z.object({
  userConsent: z.literal(true),
  imageMimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  imageBase64: z.string().min(1).max(7_000_000, "Image exceeds maximum allowed size of ~5MB"),
  pixelsPerCm: z.number().finite().positive("Calibration scale must be a positive number"),
  imageWidth: z.number().finite().positive().optional(),
  imageHeight: z.number().finite().positive().optional(),
  canvasWidth: z.number().finite().positive().optional(),
  canvasHeight: z.number().finite().positive().optional(),
  canonicalBoundary: z.array(z.object({ x: z.number().finite(), y: z.number().finite() })).optional(),
  requestedModel: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, "interpretation");

  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: rateLimit.reason || "Rate limit exceeded. Please wait before making more AI requests.",
        retryAfter: rateLimit.retryAfterSeconds,
      },
      429,
      request,
      rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : {}
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400, request);
  }

  const parsed = AnonymousInterpretationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      400,
      request
    );
  }

  const {
    imageBase64,
    imageMimeType,
    pixelsPerCm,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
    canonicalBoundary,
    requestedModel,
  } = parsed.data;

  const result = await interpretFloorplanWithGemini({
    imageBase64,
    imageMimeType,
    pixelsPerCm,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
    canonicalBoundary,
    requestedModel,
  });

  if (!result.success || !result.data) {
    return jsonResponse(
      {
        error: result.error || "Floorplan interpretation failed.",
      },
      result.statusCode || 502,
      request
    );
  }

  return jsonResponse(
    {
      elements: result.data.elements,
      rawCount: result.data.rawCount,
      filteredCount: result.data.filteredCount,
      model: result.data.model,
      scaleUsed: result.data.scaleUsed,
      humanReviewRequired: true,
      disclaimer: "AI interpretations are assistance proposals and must be reviewed and accepted by a qualified assessor.",
    },
    200,
    request
  );
}
