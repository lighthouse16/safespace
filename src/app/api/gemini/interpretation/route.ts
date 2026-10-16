import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limiter";
import { readBoundedJson, verifyImageBinary } from "@/lib/server/request-guard";
import { interpretFloorplanWithGemini } from "@/lib/server/ai/floorplan-interpreter";
import { isModelRetired } from "@/lib/server/ai/model-config";
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
  // 1. Enforce origin check and bounded JSON read (max 7MB for image base64 upload)
  const bodyRead = await readBoundedJson<unknown>(request, 7 * 1024 * 1024);
  if (!bodyRead.success || !bodyRead.data) {
    return bodyRead.response || jsonResponse({ error: "Failed to read request body." }, 400, request);
  }

  // 2. Rate limit check
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

  // 3. Schema validation
  const parsed = AnonymousInterpretationSchema.safeParse(bodyRead.data);
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

  // 4. Verify binary image signature (magic bytes)
  const binaryCheck = verifyImageBinary(imageBase64, imageMimeType);
  if (!binaryCheck.valid) {
    return jsonResponse(
      {
        error: `Invalid image binary: ${binaryCheck.error}`,
      },
      400,
      request
    );
  }

  // 5. Expired model check
  if (requestedModel && isModelRetired(requestedModel)) {
    return jsonResponse(
      {
        error: `Requested model '${requestedModel}' has been retired. Please use a supported production model.`,
      },
      400,
      request
    );
  }

  const result = await interpretFloorplanWithGemini({
    imageBase64,
    imageMimeType,
    pixelsPerCm,
    imageWidth: binaryCheck.width || imageWidth,
    imageHeight: binaryCheck.height || imageHeight,
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
