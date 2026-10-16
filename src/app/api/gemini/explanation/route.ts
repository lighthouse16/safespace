import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limiter";
import { readBoundedJson } from "@/lib/server/request-guard";
import { explainFindingsWithGemini } from "@/lib/server/ai/findings-explainer";
import { runServerEvaluation } from "@/lib/server/spatial/evaluator-service";
import type { SpatialEvaluationResult } from "@/lib/spatial";
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
  geometry: z
    .object({
      boundary: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
      furniture: z.array(z.any()).optional(),
      waypoints: z.array(z.any()).optional(),
      profile: z.any().optional(),
    })
    .optional(),
  requestedModel: z.string().optional(),
});

export async function POST(request: Request) {
  // 1. Enforce origin check and bounded JSON read (max 256KB)
  const bodyRead = await readBoundedJson<unknown>(request, 256 * 1024);
  if (!bodyRead.success || !bodyRead.data) {
    return bodyRead.response || jsonResponse({ error: "Failed to read request body." }, 400, request);
  }

  // 2. Check rate limit
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

  // 3. Validate schema
  const parsed = AnonymousExplanationSchema.safeParse(bodyRead.data);
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

  const { assessmentName, profileLabel, findings, metrics, geometry, requestedModel } = parsed.data;

  // 4. Adversarial & Evidence Integrity Checks
  if (metrics?.actionableDeficitsCount === 0 && findings.length > 0) {
    const hasCritical = findings.some(
      (f) =>
        f.severity === "critical" ||
        f.severity === "danger" ||
        /blocked|fall hazard|hazard|pinch point|inaccessible/i.test(f.title)
    );
    if (hasCritical) {
      return jsonResponse(
        { error: "Adversarial or contradictory evidence: critical deficits listed with zero reported deficit count" },
        400,
        request
      );
    }
  }

  if (metrics?.minimumClearanceCm !== undefined && metrics.minimumClearanceCm !== null) {
    if (metrics.minimumClearanceCm < 0 || metrics.minimumClearanceCm > 2000) {
      return jsonResponse(
        { error: "Clearance measurement out of physical range (0-2000 cm)" },
        400,
        request
      );
    }
    if (metrics.minimumClearanceCm < 30 && metrics.routeFeasibility === "Fully Accessible") {
      return jsonResponse(
        { error: "Contradictory evidence: pinch point clearance (<30cm) reported as fully accessible" },
        400,
        request
      );
    }
  }

  // 5. Attempt canonical server-side geometric evaluation if geometry was provided
  let provenance: "unverified-client-claims" | "server-verified" = "unverified-client-claims";
  let effectiveFindings = findings;
  let effectiveMetrics = metrics
    ? {
        actionableDeficitsCount: metrics.actionableDeficitsCount ?? findings.length,
        minimumClearanceCm: metrics.minimumClearanceCm ?? null,
        routeFeasibility: metrics.routeFeasibility || "Evaluated",
      }
    : undefined;

  if (geometry?.profile && Array.isArray(geometry.furniture) && Array.isArray(geometry.waypoints)) {
    try {
      const serverEval = await runServerEvaluation({
        boundary: geometry.boundary || null,
        furniture: geometry.furniture,
        waypoints: geometry.waypoints,
        profile: geometry.profile,
      });

      if (serverEval.success && serverEval.result) {
        provenance = "server-verified";
        const res: SpatialEvaluationResult = serverEval.result;
        effectiveFindings = res.findings.map((f) => ({
          title: f.title,
          severity: f.severity,
          description: f.description,
          evidence: f.evidence?.rawEvidenceString,
        }));
        effectiveMetrics = {
          actionableDeficitsCount: res.summary.actionableDeficitsCount,
          minimumClearanceCm: res.summary.minimumClearanceCm,
          routeFeasibility: res.summary.routeFeasibility,
        };
      }
    } catch {
      // Evaluation fallback to unverified client claims with strict disclaimer
      provenance = "unverified-client-claims";
    }
  }

  // 6. Call Gemini
  const result = await explainFindingsWithGemini({
    assessmentName,
    profileLabel,
    findings: effectiveFindings,
    summaryMetrics: effectiveMetrics,
    provenance,
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
        clientReportedMetrics: result.data.clientReportedMetrics,
        evidenceIntegrity: result.data.evidenceIntegrity,
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
