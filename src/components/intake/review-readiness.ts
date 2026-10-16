import type { BoundaryState, CalibrationState } from "./intake-view-types";
import {
  validateIntakeBoundary,
  type IntakeBoundaryValidationResult,
} from "@/lib/spatial";

/** Shared review gate: a calibrated image is not a traced, physical room. */
export function getIntakeReviewReadiness(
  boundary: BoundaryState,
  calibration: CalibrationState,
  assessmentName: string
): {
  validation: IntakeBoundaryValidationResult;
  canConfirm: boolean;
  message: string;
} {
  const validation = validateIntakeBoundary(
    boundary.vertices,
    boundary.isClosed,
    calibration.pixelsPerCm
  );
  const canConfirm = calibration.isCalibrated && validation.isValid && Boolean(assessmentName.trim());
  let message = "";

  if (!calibration.isCalibrated || !calibration.pixelsPerCm) {
    message = "Scale is not calibrated. Return to drafting and set a real-world reference length.";
  } else if (boundary.vertices.length < 3) {
    message = "Your floorplan is calibrated, but its room boundary has not been traced. Go back to drafting, choose Draw boundary, click at least three corners, and select Close Boundary.";
  } else if (!boundary.isClosed) {
    message = "Your room boundary is still open. Go back to drafting and select Close Boundary.";
  } else if (!validation.isValid) {
    message = validation.error || "Check your boundary geometry before proceeding.";
  } else if (!assessmentName.trim()) {
    message = "Assessment name is required.";
  }

  return { validation, canConfirm, message };
}
