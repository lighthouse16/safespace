import type { AssessmentDetails, CalibrationUnit, Point2D } from "./intake-view-types";

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".pdf"];
export const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
];

export type FileValidationResult = {
  isValid: boolean;
  error?: string;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFloorplanFile(file: File): FileValidationResult {
  const name = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidMime = SUPPORTED_MIME_TYPES.includes(file.type);

  if (!hasValidExt || (!hasValidMime && file.type !== "")) {
    return {
      isValid: false,
      error: "Unsupported file format. Please select a PNG, JPEG, SVG, or PDF file up to 25 MB.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File exceeds the 25 MB size limit (selected file is ${formatFileSize(
        file.size
      )}). Please select a smaller file.`,
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      error: "The selected file is empty (0 bytes). Please select a valid floorplan file.",
    };
  }

  return { isValid: true };
}

export type MeasurementValidationResult = {
  isValid: boolean;
  value?: number;
  error?: string;
};

export function validateMeasurement(input: string): MeasurementValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Please enter a real-world length.",
    };
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) {
    return {
      isValid: false,
      error: "Measurement must be a finite positive number greater than 0.",
    };
  }

  return {
    isValid: true,
    value: num,
  };
}

export function computePixelDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function computePixelsPerCm(
  p1: Point2D,
  p2: Point2D,
  realLength: number,
  unit: CalibrationUnit
): number {
  if (realLength <= 0 || !Number.isFinite(realLength)) return 0;
  const pixelDist = computePixelDistance(p1, p2);
  if (pixelDist <= 0) return 0;
  const lengthInCm = unit === "m" ? realLength * 100 : realLength;
  if (lengthInCm <= 0) return 0;
  return pixelDist / lengthInCm;
}

export function validateAssessmentDetails(details: AssessmentDetails): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!details.assessmentName.trim()) {
    errors.assessmentName = "Assessment name is required.";
  }
  if (!details.facilityName.trim()) {
    errors.facilityName = "Facility or residence name is required.";
  }
  if (!details.spaceName.trim()) {
    errors.spaceName = "Space or area name is required.";
  }
  if (!details.environmentType) {
    errors.environmentType = "Environment type is required.";
  }

  return errors;
}
