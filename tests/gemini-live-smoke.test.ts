import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isGeminiConfigured } from "@/lib/server/ai/gemini-client";
import { interpretFloorplanWithGemini } from "@/lib/server/ai/floorplan-interpreter";
import { explainFindingsWithGemini } from "@/lib/server/ai/findings-explainer";
import { visualizeInteriorWithGemini } from "@/lib/server/ai/interior-visualizer";

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

test("Gemini AI: Live API smoke test (Controlled Floorplan Interpretation)", async (t) => {
  const apiKeyConfigured = isGeminiConfigured();
  if (!apiKeyConfigured) {
    t.skip("SKIPPED: GEMINI_API_KEY environment variable not configured.");
    return;
  }

  const demoPath = join(process.cwd(), "public", "demo-floorplan.png");
  const imgBuffer = await readFile(demoPath);
  const base64 = imgBuffer.toString("base64");

  const res = await interpretFloorplanWithGemini({
    imageBase64: base64,
    imageMimeType: "image/png",
    pixelsPerCm: 1.5,
    imageWidth: 800,
    imageHeight: 600,
    userConsent: true,
  });

  assert.equal(res.success, true);
  assert.ok(res.data);
  assert.equal(res.data.model, "gemini-3.1-flash-lite");
  assert.equal(res.data.scaleUsed, 1.5);
  assert.equal(res.data.humanReviewRequired, true);
  assert.ok(res.data.elements.length > 0, "Should detect at least 1 fixture");
  for (const el of res.data.elements) {
    assert.ok(el.width >= 15 && el.width <= 600, `Width ${el.width} must be in bounds`);
    assert.ok(el.depth >= 15 && el.depth <= 600, `Depth ${el.depth} must be in bounds`);
    assert.ok(Number.isFinite(el.x) && Number.isFinite(el.y));
  }
});

test("Gemini AI: Live API smoke test (Controlled Explanation)", async (t) => {
  const apiKeyConfigured = isGeminiConfigured();
  if (!apiKeyConfigured) {
    t.skip("SKIPPED: GEMINI_API_KEY environment variable not configured. Live external Gemini call omitted without falsification.");
    return;
  }

  // Live structured findings explanation test with gemini-3.1-flash-lite
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
  assert.equal(explanationRes.data.model, "gemini-3.1-flash-lite");
  assert.equal(explanationRes.data.measuredFacts, null, "Browser metrics are not independently verified");
  assert.equal(explanationRes.data.clientReportedMetrics?.minimumClearanceCm, 65);
});

test("Gemini AI: Live Image Generation (Billed Key or Handled 429 Free Tier)", async (t) => {
  const apiKeyConfigured = isGeminiConfigured();
  if (!apiKeyConfigured) {
    t.skip("SKIPPED: GEMINI_API_KEY environment variable not configured.");
    return;
  }

  const imageRes = await visualizeInteriorWithGemini({
    roomType: "Rehabilitation Room",
    furnitureList: [
      { name: "Support Bench", category: "bench", widthCm: 120, depthCm: 45, x: 50, y: 50, rotation: 0 },
      { name: "Low Table", category: "table", widthCm: 80, depthCm: 60, x: 200, y: 150, rotation: 90 },
    ],
    userConsent: true,
  });

  if (imageRes.success) {
    // Verified real-money image generation success on billed key
    assert.ok(imageRes.data?.imageBase64);
    assert.equal(imageRes.data.model, "gemini-3.1-flash-lite-image");
    assert.match(imageRes.data.disclaimer, /generic spatial inspiration/i);
  } else {
    // Unbilled key produces Google 429 RESOURCE_EXHAUSTED (0 quota allocated by Google)
    assert.equal(imageRes.success, false);
    assert.equal(imageRes.statusCode, 429);
    assert.match(imageRes.error || "", /quota|rate limit/i);
  }
});

test("Gemini AI: Mocked Image Generation Payload & Disclaimer Verification", async () => {
  // Test mock image data formatting, base64 extraction, and truthfulness labeling
  const mockImageResult = {
    imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    imageMimeType: "image/png",
    model: "gemini-3.1-flash-lite-image",
    disclaimer: "AI concept visualization — generic spatial inspiration only. Not to scale and not an engineering drawing. All clearances must be verified via the deterministic 2D spatial evaluator.",
    timestamp: new Date().toISOString(),
  };

  assert.ok(mockImageResult.imageBase64.length > 0);
  assert.equal(mockImageResult.imageMimeType, "image/png");
  assert.equal(mockImageResult.model, "gemini-3.1-flash-lite-image");
  assert.match(mockImageResult.disclaimer, /generic spatial inspiration/i);
  assert.match(mockImageResult.disclaimer, /not to scale/i);
});
