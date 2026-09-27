import test from "node:test";
import assert from "node:assert/strict";
import { countReviewed, hazards } from "../src/components/analysis/risk-analysis";

test("review progress counts only recorded professional decisions", () => {
  assert.equal(countReviewed({}), 0);
  assert.equal(countReviewed({ [hazards[0].id]: "verified", [hazards[1].id]: "site-check" }), 2);
});

test("Harmony route findings use canonical measurements", () => {
  assert.equal(hazards.length, 3);
  assert.equal(hazards[0].measured, "52 cm");
  assert.equal(hazards[0].required, "90 cm");
  assert.equal(hazards[0].objectId, "table-a");
});
