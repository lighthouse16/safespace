import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const canvas = readFileSync(new URL("../src/components/intake/BoundaryDraftCanvas.tsx", import.meta.url), "utf8");

test("intake canvas never substitutes demo geometry for user data", () => {
  assert.doesNotMatch(canvas, /Use recommended boundary|intake-step3-floorplan\.png|"3\.0 m"/);
  assert.match(canvas, /source === "upload" && uploadedFile\?\.previewAvailable/);
  assert.match(canvas, /boundary\.isClosed && boundary\.vertices\.length >= 3 && calibration\.isCalibrated/);
  assert.match(canvas, /\{assessmentName \|\| "Not provided"\}/);
});
