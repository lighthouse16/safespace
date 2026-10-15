import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tool = readFileSync(new URL("../src/components/intake/CalibrationTool.tsx", import.meta.url), "utf8");

test("calibration UI requires user measurement and reports only applied scale", () => {
  assert.match(tool, /calibration\.realLength != null \? String\(calibration\.realLength\) : ""/);
  assert.match(tool, /calibration\.isCalibrated && calibration\.pixelsPerCm/);
  assert.match(tool, /"Not calibrated"/);
  assert.doesNotMatch(tool, /85 px = 3\.0 m|validation\.value \?\? 3|realLength \?\? 3\.0/);
});
