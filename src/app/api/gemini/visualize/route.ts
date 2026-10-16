import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limiter";
import { readBoundedJson } from "@/lib/server/request-guard";
import { visualizeInteriorWithGemini } from "@/lib/server/ai/interior-visualizer";
import { isModelRetired } from "@/lib/server/ai/model-config";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

const AnonymousVisualizationSchema = z.object({
  userConsent: z.literal(true),
  roomType: z.string().max(100).optional().default("Care Space"),
  roomDimensions: z
    .object({
      widthCm: z.number().finite().positive(),
      depthCm: z.number().finite().positive(),
    })
    .optional(),
  furnitureList: z
    .array(
      z.object({
        name: z.string().max(100),
        category: z.string().max(50).optional(),
        widthCm: z.number().finite().positive().optional(),
        depthCm: z.number().finite().positive().optional(),
        x: z.number().finite().optional(),
        y: z.number().finite().optional(),
        rotation: z.number().finite().optional(),
      })
    )
    .max(30, "Maximum 30 furniture items supported per visualization request")
    .default([]),
  obstacles: z
    .array(
      z.object({
        name: z.string().max(100),
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite().positive(),
        depth: z.number().finite().positive(),
      })
    )
    .max(20)
    .optional(),
  layoutTitle: z.string().max(100).optional(),
  isAlternative: z.boolean().optional().default(false),
  requestedModel: z.string().optional(),
  isPremium: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  // 1. Enforce origin check and bounded JSON read (max 256KB)
  const bodyRead = await readBoundedJson<unknown>(request, 256 * 1024);
  if (!bodyRead.success || !bodyRead.data) {
    return bodyRead.response || jsonResponse({ error: "Failed to read request body." }, 400, request);
  }

  // 2. Rate limit check
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, "visualize");
  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: rateLimit.reason || "Rate limit exceeded for image generation. Please wait a moment.",
        retryAfter: rateLimit.retryAfterSeconds,
      },
      429,
      request,
      rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : {}
    );
  }

  // 3. Schema validation
  const parsed = AnonymousVisualizationSchema.safeParse(bodyRead.data);
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
    roomType,
    roomDimensions,
    furnitureList,
    obstacles,
    layoutTitle,
    isAlternative,
    requestedModel,
    isPremium,
  } = parsed.data;

  // 4. Retired model check
  if (requestedModel && isModelRetired(requestedModel)) {
    return jsonResponse(
      {
        error: `Requested image model '${requestedModel}' has been retired. Please use a supported production model.`,
      },
      400,
      request
    );
  }

  const result = await visualizeInteriorWithGemini({
    roomType,
    roomDimensions,
    furnitureList,
    obstacles,
    layoutTitle,
    isAlternative,
    requestedModel,
    isPremium,
    userConsent: true,
  });

  if (!result.success || !result.data) {
    return jsonResponse(
      {
        error: result.error || "Interior visual preview generation failed.",
      },
      result.statusCode || 502,
      request
    );
  }

  return jsonResponse(
    {
      imageBase64: result.data.imageBase64,
      imageMimeType: result.data.imageMimeType,
      model: result.data.model,
      disclaimer: result.data.disclaimer,
      timestamp: result.data.timestamp,
    },
    200,
    request
  );
}
