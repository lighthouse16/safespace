import { Type, type Schema } from "@google/genai";
import { getGeminiClient } from "./gemini-client";
import { getActiveTextModel, parseGeminiError } from "./model-config";

export interface FindingsExplanationInput {
  assessmentName: string;
  profileLabel: string;
  findings: Array<{
    title: string;
    severity?: string;
    description: string;
    evidence?: string;
  }>;
  summaryMetrics?: {
    actionableDeficitsCount: number;
    minimumClearanceCm: number | null;
    routeFeasibility: string;
  };
  provenance?: "unverified-client-claims" | "server-verified";
  requestedModel?: string;
}

export interface FindingsExplanationResult {
  executiveSummary: string;
  clinicalRiskNarrative: string;
  caregiverRecommendations: string[];
  measuredFacts: {
    minimumClearanceCm: number | null;
    actionableDeficitsCount: number;
    routeFeasibility: string;
  } | null;
  clientReportedMetrics?: {
    minimumClearanceCm: number | null;
    actionableDeficitsCount: number;
    routeFeasibility: string;
  };
  evidenceIntegrity: "unverified-client-claims" | "server-verified";
  disclaimer: string;
  model: string;
  timestamp: string;
}

const explanationResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description: "Concise 2-3 sentence overview of spatial safety and accessibility grounded strictly in observed metrics",
    },
    clinicalRiskNarrative: {
      type: Type.STRING,
      description: "Clinical explanation connecting observed clearance deficits to user fall risks or mobility impediments",
    },
    caregiverRecommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Actionable, non-invasive recommendations for care team or family members that require human verification",
    },
  },
  required: ["executiveSummary", "clinicalRiskNarrative", "caregiverRecommendations"],
};

export async function explainFindingsWithGemini(
  input: FindingsExplanationInput
): Promise<{ success: boolean; data?: FindingsExplanationResult; error?: string; statusCode?: number }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      error: "Gemini API key is not configured on this server (GEMINI_API_KEY).",
      statusCode: 503,
    };
  }

  const model = getActiveTextModel(input.requestedModel);
  const provenance = input.provenance || "unverified-client-claims";

  try {
    const isUnverified = provenance === "unverified-client-claims";
    const integrityNotice = isUnverified
      ? `ATTENTION — EVIDENCE INTEGRITY STATUS: UNVERIFIED EXTERNAL CLIENT CLAIMS.
The following findings and metrics were submitted by an external browser client and have NOT been verified by SafeSpace's server-side spatial engine.
- You MUST NOT validate or endorse unverified clearance or safety claims.
- You MUST NOT state or imply that the room is certified safe or accessible.
- Clearly frame recommendations as provisional assistance for user-reported pinch points.`
      : `EVIDENCE INTEGRITY STATUS: VERIFIED SERVER-SIDE SPATIAL EVALUATION.
The following findings and metrics were independently computed by SafeSpace's deterministic spatial engine.`;

    const prompt = `You are a clinical accessibility consultant explaining a floorplan assessment.
${integrityNotice}

Assessment: "${input.assessmentName}"
Mobility Profile: "${input.profileLabel}"
Route Feasibility: ${input.summaryMetrics?.routeFeasibility || "Evaluated"}
Minimum Clearance: ${input.summaryMetrics?.minimumClearanceCm !== null && input.summaryMetrics?.minimumClearanceCm !== undefined ? `${input.summaryMetrics.minimumClearanceCm} cm` : "Not measured"}
Deficits Found: ${input.summaryMetrics?.actionableDeficitsCount ?? input.findings.length}

Reported Findings:
${
  input.findings.length > 0
    ? input.findings
        .map(
          (f, idx) =>
            `${idx + 1}. [${f.severity || "Warning"}] ${f.title}: ${f.description}${f.evidence ? ` (Evidence: ${f.evidence})` : ""}`
        )
        .join("\n")
    : "No deficits reported in client submission."
}

STRICT INSTRUCTIONS:
- Do NOT fabricate or alter any measurements, clearance values, or room dimensions. Rely only on the evidence above.
- Clearly separate client-reported facts from AI suggestions.
- Explain in empathetic, professional language how these reported physical pinch points affect someone using ${input.profileLabel}.
- Provide practical recommendations that prioritize resident safety without requiring major structural renovation.
- Keep caregiver recommendations concise and directly tied to the listed findings.`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: explanationResponseSchema,
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const metricsPayload = {
      minimumClearanceCm: input.summaryMetrics?.minimumClearanceCm ?? null,
      actionableDeficitsCount: input.summaryMetrics?.actionableDeficitsCount ?? input.findings.length,
      routeFeasibility: input.summaryMetrics?.routeFeasibility ?? "Evaluated",
    };

    return {
      success: true,
      data: {
        executiveSummary: parsed.executiveSummary || "Evaluation complete.",
        clinicalRiskNarrative: parsed.clinicalRiskNarrative || "",
        caregiverRecommendations: Array.isArray(parsed.caregiverRecommendations)
          ? parsed.caregiverRecommendations
          : [],
        // Never serialize unverified browser claims under the 'measuredFacts' label.
        measuredFacts: isUnverified ? null : metricsPayload,
        clientReportedMetrics: isUnverified ? metricsPayload : undefined,
        evidenceIntegrity: provenance,
        disclaimer: isUnverified
          ? "Unverified client-reported data. SafeSpace spatial interpretations are advisory assistance and do not constitute physical or medical safety certification. Measurements must be verified on site by a qualified assessor."
          : "SafeSpace spatial layout assessment. All AI interpretations and recommendations must be verified on site by a qualified assessor.",
        model,
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
