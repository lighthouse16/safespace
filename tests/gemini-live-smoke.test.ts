import test from "node:test";
import assert from "node:assert/strict";
import { isGeminiConfigured } from "@/lib/server/ai/gemini-client";
import { interpretFloorplanWithGemini } from "@/lib/server/ai/floorplan-interpreter";
import { explainFindingsWithGemini } from "@/lib/server/ai/findings-explainer";

test("Gemini AI: Calibration scale is mandatory for floorplan interpretation", async () => {
  // Positive pixelsPerCm validation is enforced before any LLM inference
  const invalidScaleResult = await interpretFloorplanWithGemini({
    imageBase64: "dGVzdC1iYXNlNjQ=",
    imageMimeType: "image/png",
    pixelsPerCm: 0,
  });

  assert.equal(invalidScaleResult.success, false);
  assert.match(invalidScaleResult.error || "", /calibration scale/i);
});

test("Gemini AI: Live API smoke test (Controlled)", async (t) => {
  const apiKeyConfigured = isGeminiConfigured();
  if (!apiKeyConfigured) {
    t.skip("SKIPPED: GEMINI_API_KEY environment variable not configured. Live external Gemini call omitted without falsification.");
    return;
  }

  // Live structured findings explanation test
  const explanationRes = await explainFindingsWithGemini({
    assessmentName: "Live Gemini Verification Suite",
    profileLabel: "Manual Wheelchair",
    findings: [
      {
        title: "Bed clearance below standard",
        description: "Passage clearance is 65 cm, which is below the 85 cm threshold.",
        severity: "critical",
        evidence: "Required: 85cm, Observed: 65cm",
      },
    ],
    summaryMetrics: {
      actionableDeficitsCount: 1,
      minimumClearanceCm: 65,
      routeFeasibility: "Infeasible",
    },
  });

  assert.equal(explanationRes.success, true);
  assert.ok(explanationRes.data);
  assert.ok((explanationRes.data.executiveSummary?.length ?? 0) > 0);
  assert.ok((explanationRes.data.clinicalRiskNarrative?.length ?? 0) > 0);
  assert.ok(explanationRes.data.model);
});
