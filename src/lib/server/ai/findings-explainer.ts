import { Type, type Schema } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL } from "./gemini-client";

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
}

export interface FindingsExplanationResult {
  executiveSummary: string;
  clinicalRiskNarrative: string;
  caregiverRecommendations: string[];
  disclaimer: string;
  model: string;
}

const explanationResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description: "Concise 2-3 sentence overview of spatial safety and accessibility",
    },
    clinicalRiskNarrative: {
      type: Type.STRING,
      description: "Clinical explanation connecting observed clearance deficits to user fall risks or mobility impediments",
    },
    caregiverRecommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Actionable, non-invasive recommendations for care team or family members",
    },
  },
  required: ["executiveSummary", "clinicalRiskNarrative", "caregiverRecommendations"],
};

export async function explainFindingsWithGemini(
  input: FindingsExplanationInput
): Promise<{ success: boolean; data?: FindingsExplanationResult; error?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      error: "Gemini API key is not configured on this server (GEMINI_API_KEY).",
    };
  }

  try {
    const prompt = `You are a clinical accessibility consultant explaining an objective floorplan assessment.
Assessment: "${input.assessmentName}"
Mobility Profile: "${input.profileLabel}"
Route Feasibility: ${input.summaryMetrics?.routeFeasibility || "Evaluated"}
Minimum Clearance: ${input.summaryMetrics?.minimumClearanceCm ? `${input.summaryMetrics.minimumClearanceCm} cm` : "Not measured"}
Deficits Found: ${input.summaryMetrics?.actionableDeficitsCount ?? input.findings.length}

Deterministic Findings Detected by Engine:
${input.findings
  .map(
    (f, idx) =>
      `${idx + 1}. [${f.severity || "Warning"}] ${f.title}: ${f.description}${f.evidence ? ` (Evidence: ${f.evidence})` : ""}`
  )
  .join("\n")}

STRICT INSTRUCTIONS:
- Do NOT fabricate or alter any measurements, clearance values, or room dimensions. Rely only on the evidence above.
- Explain in empathetic, clear, professional language how these specific physical pinch points affect someone using ${input.profileLabel}.
- Provide practical recommendations that prioritize resident safety without requiring major structural renovation.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: explanationResponseSchema,
        temperature: 0.3,
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
        disclaimer:
          "SafeSpace is a spatial layout assessment tool and does not constitute certified clinical or medical diagnosis.",
        model: GEMINI_MODEL,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI explanation failed";
    return { success: false, error: msg };
  }
}
