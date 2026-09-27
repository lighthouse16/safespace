import test from "node:test";
import assert from "node:assert/strict";
import { snapAndClampPosition } from "../src/components/editor/floorplan-drag";

const bounds = { planWidth: 800, planDepth: 600, itemWidth: 160, itemDepth: 90, grid: 5 };

test("snaps furniture top-left position to 5 cm grid", () => {
  assert.deepEqual(snapAndClampPosition({ x: 183, y: 147 }, bounds), { x: 185, y: 145 });
});

test("keeps the full furniture footprint inside plan bounds", () => {
  assert.deepEqual(snapAndClampPosition({ x: -18, y: 580 }, bounds), { x: 0, y: 510 });
  assert.deepEqual(snapAndClampPosition({ x: 770, y: -12 }, bounds), { x: 640, y: 0 });
});
