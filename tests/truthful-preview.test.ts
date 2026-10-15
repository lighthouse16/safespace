import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stage = readFileSync(new URL("../src/components/workflow/Stage1Layout.tsx", import.meta.url), "utf8");
const hero = readFileSync(new URL("../src/components/landing/HeroPreviewCard.tsx", import.meta.url), "utf8");

test("fixture summary renders actual counts including zero", () => {
  assert.match(stage, /return \{ beds, sofas, tables, storage, appliances, sanitary \};/);
  assert.doesNotMatch(stage, /(?:beds|sofas|tables|storage|appliances|sanitary):\s*\w+\s*\|\|\s*\d+/);
});

test("hero preview labels fabricated metrics and has no inert export button", () => {
  assert.match(hero, /Illustrative sample/);
  assert.match(hero, /Not an assessment/);
  assert.doesNotMatch(hero, /<button\b/);
});
