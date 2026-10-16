import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limiter";
import { explainFindingsWithGemini } from "@/lib/server/ai/findings-explainer";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

const AnonymousExplanationSchema = z.object({
  userConsent: z.literal(true),
  assessmentName: z.string().min(1).max(200).default("Floorplan Assessment"),
  profileLabel: z.string().min(1).max(100).default("Standard Mobility Profile"),
  findings: z
    .array(
      z.object({
        title: z.string().max(200),
        severity: z.string().max(50).optional(),
        description: z.string().max(1000),
        evidence: z.string().max(500).optional(),
      })
    )
    .max(50, "Maximum 50 findings supported per explanation request")
    .default([]),
  metrics: z
    .object({
      actionableDeficitsCount: z.number().int().min(0).optional(),
      minimumClearanceCm: z.number().nullable().optional(),
      routeFeasibility: z.string().optional(),
    })
    .optional(),
  requestedModel: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, "explanation");

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

  const parsed = AnonymousExplanationSchema.safeParse(body);
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

  const { assessmentName, profileLabel, findings, metrics, requestedModel } = parsed.data;

  const result = await explainFindingsWithGemini({
    assessmentName,
    profileLabel,
    findings,
    summaryMetrics: metrics
      ? {
          actionableDeficitsCount: metrics.actionableDeficitsCount ?? findings.length,
          minimumClearanceCm: metrics.minimumClearanceCm ?? null,
          routeFeasibility: metrics.routeFeasibility || "Evaluated",
        }
      : undefined,
    requestedModel,
  });

  if (!result.success || !result.data) {
    return jsonResponse(
      {
        error: result.error || "Findings explanation failed.",
      },
      result.statusCode || 502,
      request
    );
  }

  return jsonResponse(
    {
      explanation: {
        executiveSummary: result.data.executiveSummary,
        clinicalRiskNarrative: result.data.clinicalRiskNarrative,
        caregiverRecommendations: result.data.caregiverRecommendations,
        measuredFacts: result.data.measuredFacts,
        disclaimer: result.data.disclaimer,
      },
      model: result.data.model,
      timestamp: result.data.timestamp,
      source: "gemini",
    },
    200,
    request
  );
}
