import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_FURNITURE,
  INITIAL_ROUTE,
  LAYOUT_ALTERNATIVES,
  calculateLiveMetrics,
} from "../src/lib/spatial-model";

test("initial Queen Care Clinic condition evaluates to high risk 68 with 54cm clearance", () => {
  const metrics = calculateLiveMetrics(INITIAL_FURNITURE, null, INITIAL_ROUTE);
  assert.equal(metrics.riskIndex, 68);
  assert.equal(metrics.riskLevel, "High");
  assert.equal(metrics.minClearanceCm, 54);
  assert.equal(metrics.highPriorityHazardsCount, 3);
  assert.equal(metrics.activeHazardsCount, 7);
  assert.equal(metrics.routeLengthM, 11.8);
});

test("balanced layout reduces risk to 27 and achieves 96cm minimum clearance", () => {
  const balancedAlt = LAYOUT_ALTERNATIVES["balanced"];
  assert.ok(balancedAlt);
  assert.equal(balancedAlt.riskIndex, 27);
  assert.equal(balancedAlt.riskLevel, "Low");
  assert.equal(balancedAlt.minClearanceCm, 96);
  assert.equal(balancedAlt.costHkd, 850);
  assert.equal(balancedAlt.highPriorityHazardsCount, 0);
  assert.equal(balancedAlt.routeLengthM, 10.4);
});

test("dynamic constraint warning fires when chair C-04 is placed dangerously close to route", () => {
  // Move chair-c04 to pinch point (230, 240)
  const modified = INITIAL_FURNITURE.map((f) =>
    f.id === "chair-c04" ? { ...f, x: 230, y: 240 } : f
  );
  const metrics = calculateLiveMetrics(modified, null, INITIAL_ROUTE);
  assert.ok(metrics.minClearanceCm < 90);
  assert.ok(metrics.constraintWarning !== null);
  assert.match(metrics.constraintWarning!, /reduces walker clearance/);
});
