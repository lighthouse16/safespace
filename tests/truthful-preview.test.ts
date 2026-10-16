import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stage = readFileSync(new URL("../src/components/workflow/Stage1Layout.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("fixture summary renders actual counts including zero", () => {
  assert.match(stage, /return \{ beds, sofas, tables, storage, appliances, sanitary \};/);
  assert.doesNotMatch(stage, /(?:beds|sofas|tables|storage|appliances|sanitary):\s*\w+\s*\|\|\s*\d+/);
});

test("landing page enforces canonical branding, single primary CTA, and no fabricated metrics", () => {
  assert.match(page, /BrandMark/);
  assert.match(page, /Design safer/);
  assert.match(page, /movement paths/);
  assert.match(page, /Review floorplans for accessibility and safety with clear, actionable spatial insight\./);
  assert.match(page, /Start assessment/);
  assert.match(page, /href="\/assessments\/new"/);
  assert.doesNotMatch(page, /HeroPreviewCard/);
  assert.doesNotMatch(page, /Compliant width|32 m|Score/);
});
