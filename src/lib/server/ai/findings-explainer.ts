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
  };
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

  try {
    const prompt = `You are a clinical accessibility consultant explaining an objective floorplan assessment.
Assessment: "${input.assessmentName}"
Mobility Profile: "${input.profileLabel}"
Route Feasibility: ${input.summaryMetrics?.routeFeasibility || "Evaluated"}
Minimum Clearance: ${input.summaryMetrics?.minimumClearanceCm !== null && input.summaryMetrics?.minimumClearanceCm !== undefined ? `${input.summaryMetrics.minimumClearanceCm} cm` : "Not measured"}
Deficits Found: ${input.summaryMetrics?.actionableDeficitsCount ?? input.findings.length}

Deterministic Findings Detected by Spatial Engine:
${
  input.findings.length > 0
    ? input.findings
        .map(
          (f, idx) =>
            `${idx + 1}. [${f.severity || "Warning"}] ${f.title}: ${f.description}${f.evidence ? ` (Evidence: ${f.evidence})` : ""}`
        )
        .join("\n")
    : "No deterministic deficits detected along the assessed route."
}

STRICT INSTRUCTIONS:
- Do NOT fabricate or alter any measurements, clearance values, or room dimensions. Rely only on the evidence above.
- Clearly separate measured facts from AI suggestions.
- Explain in empathetic, professional language how these specific physical pinch points affect someone using ${input.profileLabel}.
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

    return {
      success: true,
      data: {
        executiveSummary: parsed.executiveSummary || "Evaluation complete.",
        clinicalRiskNarrative: parsed.clinicalRiskNarrative || "",
        caregiverRecommendations: Array.isArray(parsed.caregiverRecommendations)
          ? parsed.caregiverRecommendations
          : [],
        measuredFacts: {
          minimumClearanceCm: input.summaryMetrics?.minimumClearanceCm ?? null,
          actionableDeficitsCount: input.summaryMetrics?.actionableDeficitsCount ?? input.findings.length,
          routeFeasibility: input.summaryMetrics?.routeFeasibility ?? "Evaluated",
        },
        disclaimer:
          "SafeSpace is a spatial layout assessment tool. All AI interpretations and recommendations must be verified on site by a qualified assessor.",
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
