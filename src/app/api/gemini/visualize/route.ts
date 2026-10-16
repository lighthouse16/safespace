import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limiter";
import { visualizeInteriorWithGemini } from "@/lib/server/ai/interior-visualizer";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

const AnonymousVisualizationSchema = z.object({
  userConsent: z.literal(true),
  roomType: z.string().max(100).optional().default("Care Space"),
  furnitureList: z
    .array(
      z.object({
        name: z.string().max(100),
        category: z.string().max(50).optional(),
        widthCm: z.number().finite().positive().optional(),
        depthCm: z.number().finite().positive().optional(),
      })
    )
    .max(30, "Maximum 30 furniture items supported per visualization request")
    .default([]),
  layoutTitle: z.string().max(100).optional(),
  isAlternative: z.boolean().optional().default(false),
  requestedModel: z.string().optional(),
  isPremium: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400, request);
  }

  const parsed = AnonymousVisualizationSchema.safeParse(body);
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

  const { roomType, furnitureList, layoutTitle, isAlternative, requestedModel, isPremium } = parsed.data;

  const result = await visualizeInteriorWithGemini({
    roomType,
    furnitureList,
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
