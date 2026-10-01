import type { AssessmentDetails, CalibrationUnit, Point2D } from "./intake-view-types";

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".svg": ["image/svg+xml"],
  ".pdf": ["application/pdf"],
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_MIME_MAP);
export const SUPPORTED_MIME_TYPES = Array.from(
  new Set(Object.values(EXTENSION_MIME_MAP).flat())
);

export type FileValidationResult = {
  isValid: boolean;
  error?: string;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : "";
}

export function validateFloorplanFile(file: File): FileValidationResult {
  const ext = getFileExtension(file.name);
  const allowedMimes = EXTENSION_MIME_MAP[ext];

  if (!allowedMimes) {
    return {
      isValid: false,
      error: "Unsupported file format. Please select a PNG, JPEG, SVG, or PDF file up to 25 MB.",
    };
  }

  if (!file.type || !allowedMimes.includes(file.type)) {
    return {
      isValid: false,
      error: "File format does not match its file extension. Please select a valid PNG, JPEG, SVG, or PDF file.",
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

export type MockImageInstance = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
  naturalWidth?: number;
  naturalHeight?: number;
  decode?: () => Promise<void>;
};

/**
 * Verifies that the browser can decode and render an image (PNG, JPEG, SVG).
 * Resolves true if decoding succeeds, false if decoding fails.
 */
export async function verifyImageDecodable(
  objectUrl: string,
  imageFactory?: () => MockImageInstance
): Promise<boolean> {
  return new Promise((resolve) => {
    if (imageFactory) {
      const img = imageFactory();
      img.onload = () => {
        if (typeof img.decode === "function") {
          img.decode()
            .then(() => resolve(true))
            .catch(() => resolve(false));
        } else {
          resolve((img.naturalWidth ?? 1) > 0 && (img.naturalHeight ?? 1) > 0);
        }
      };
      img.onerror = () => resolve(false);
      img.src = objectUrl;
      return;
    }

    if (typeof Image === "undefined") {
      resolve(true);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode()
          .then(() => resolve(img.naturalWidth > 0 && img.naturalHeight > 0))
          .catch(() => resolve(false));
      } else {
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
      }
    };
    img.onerror = () => {
      resolve(false);
    };
    img.src = objectUrl;
  });
}
