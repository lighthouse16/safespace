/**
 * SafeSpace Intake View Types
 * Frontend-local interaction types for the assessment intake and 2D drafting flow.
 * Note: These are ephemeral, session-only view models, NOT canonical domain entities.
 */

export type EnvironmentType =
  | "residence"
  | "clinic"
  | "rehab"
  | "mall"
  | "other";

export const ENVIRONMENT_TYPE_LABELS: Record<EnvironmentType, string> = {
  residence: "Residence",
  clinic: "Clinic or care facility",
  rehab: "Rehabilitation facility",
  mall: "Shopping mall or public indoor space",
  other: "Other",
};

export type AssessmentDetails = {
  assessmentName: string;
  facilityName: string;
  spaceName: string;
  environmentType: EnvironmentType;
  notes?: string;
};

export type SourceType = "upload" | "manual";

export type UploadedFileInfo = {
  file: File;
  name: string;
  size: number;
  type: string;
  objectUrl: string;
  isPdf: boolean;
  previewAvailable: boolean;
};

export type Point2D = {
  x: number; // canvas coordinate in px
  y: number; // canvas coordinate in px
};

export type CalibrationUnit = "cm" | "m";

export type CalibrationState = {
  p1: Point2D | null;
  p2: Point2D | null;
  realLength: number | null;
  unit: CalibrationUnit;
  pixelsPerCm: number | null;
  isCalibrated: boolean;
};

export type BoundaryState = {
  vertices: Point2D[];
  isClosed: boolean;
  selectedVertexIndex: number | null;
  gridSnap: boolean;
};

export type IntakeStep =
  | "details"
  | "source"
  | "draft"
  | "review";
