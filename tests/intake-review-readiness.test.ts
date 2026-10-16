import test from "node:test";
import assert from "node:assert/strict";
import { getIntakeReviewReadiness } from "@/components/intake/review-readiness";
import type { BoundaryState, CalibrationState } from "@/components/intake/intake-view-types";

const calibrated: CalibrationState = {
  p1: { x: 100, y: 100 },
  p2: { x: 300, y: 100 },
  realLength: 2,
  unit: "m",
  pixelsPerCm: 1,
  isCalibrated: true,
};
const rectangle: BoundaryState = {
  vertices: [
    { x: 100, y: 100 }, { x: 500, y: 100 },
    { x: 500, y: 400 }, { x: 100, y: 400 },
  ],
  isClosed: true,
  selectedVertexIndex: null,
  gridSnap: false,
};

test("Calibration alone never enables assessment confirmation", () => {
  const state = getIntakeReviewReadiness(
    { ...rectangle, vertices: [], isClosed: false },
    calibrated,
    "Room review"
  );
  assert.equal(state.canConfirm, false);
  assert.match(state.message, /boundary has not been traced/);
  assert.equal(state.validation.isValid, false);
});

test("Open or invalid geometry does not allow confirmation", () => {
  const open = getIntakeReviewReadiness({ ...rectangle, isClosed: false }, calibrated, "Room review");
  assert.equal(open.canConfirm, false);
  assert.match(open.message, /still open/i);
  const uncalibrated = getIntakeReviewReadiness(rectangle, { ...calibrated, isCalibrated: false }, "Room review");
  assert.equal(uncalibrated.canConfirm, false);
  assert.match(uncalibrated.message, /not calibrated/);
});

test("Valid calibrated closed room enables confirmation with no warning", () => {
  const result = getIntakeReviewReadiness(rectangle, calibrated, "Room review");
  assert.equal(result.canConfirm, true);
  assert.equal(result.message, "");
  assert.ok(result.validation.polygonCm);
});

test("An unnamed assessment is never confirmed, even with valid geometry", () => {
  const result = getIntakeReviewReadiness(rectangle, calibrated, "   ");
  assert.equal(result.canConfirm, false);
  assert.match(result.message, /name is required/);
});
