import type { Point2D, Polygon2D } from "@/lib/spatial";
import type { RouteWaypoint, SpatialFurniture } from "@/lib/spatial-model";

export const SAFESPACE_STORAGE_VERSION = 1;
export const SAFESPACE_STORAGE_KEY = "safespace_confirmed_assessment_v1";

export type AssessmentMetadata = {
  id: string;
  name: string;
  facilityName: string;
  spaceName: string;
  environmentType: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CalibrationProvenance = {
  pixelsPerCm: number;
  realLength: number;
  unit: "cm" | "m";
  pixelDistance: number;
  originPolicy: string;
};

export type PersistedAssessmentState = {
  schemaVersion: number;
  assessmentType: "demo" | "user";
  metadata: AssessmentMetadata | null;
  canonicalBoundary: Polygon2D | null;
  calibration: CalibrationProvenance | null;
  activeProfileId: string;
  routeWaypoints: RouteWaypoint[];
  furniture: SpatialFurniture[];
};

export type StorageLoadResult =
  | { success: true; data: PersistedAssessmentState }
  | { success: false; error: string; isCorrupted: boolean };

export type StorageSaveResult =
  | { success: true }
  | { success: false; error: string };

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

/**
 * Checks whether browser localStorage is available and writable.
 */
export function isStorageAvailable(): boolean {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }
  try {
    const testKey = "__safespace_storage_probe__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates the runtime shape of a candidate persisted state object.
 */
export function validatePersistedPayload(val: unknown): {
  isValid: boolean;
  error?: string;
  data?: PersistedAssessmentState;
} {
  if (typeof val !== "object" || val === null) {
    return { isValid: false, error: "Payload must be a non-null object" };
  }

  const obj = val as Record<string, unknown>;

  if (obj.schemaVersion !== SAFESPACE_STORAGE_VERSION) {
    return {
      isValid: false,
      error: `Unsupported schema version: ${obj.schemaVersion} (expected ${SAFESPACE_STORAGE_VERSION})`,
    };
  }

  if (obj.assessmentType !== "demo" && obj.assessmentType !== "user") {
    return { isValid: false, error: "assessmentType must be 'demo' or 'user'" };
  }

  if (typeof obj.activeProfileId !== "string" || !obj.activeProfileId) {
    return { isValid: false, error: "activeProfileId must be a non-empty string" };
  }

  // Validate canonicalBoundary
  let boundary: Polygon2D | null = null;
  if (obj.canonicalBoundary !== null && obj.canonicalBoundary !== undefined) {
    if (!Array.isArray(obj.canonicalBoundary)) {
      return { isValid: false, error: "canonicalBoundary must be an array or null" };
    }
    const validatedPoints: Point2D[] = [];
    for (let i = 0; i < obj.canonicalBoundary.length; i++) {
      const p = obj.canonicalBoundary[i];
      if (
        typeof p !== "object" ||
        p === null ||
        typeof p.x !== "number" ||
        typeof p.y !== "number" ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y)
      ) {
        return { isValid: false, error: `Invalid coordinate at boundary index ${i}` };
      }
      validatedPoints.push({ x: p.x, y: p.y });
    }
    boundary = validatedPoints;
  }

  // Validate metadata
  let metadata: AssessmentMetadata | null = null;
  if (obj.metadata !== null && obj.metadata !== undefined) {
    if (typeof obj.metadata !== "object") {
      return { isValid: false, error: "metadata must be an object or null" };
    }
    const m = obj.metadata as Record<string, unknown>;
    if (typeof m.id !== "string" || typeof m.name !== "string") {
      return { isValid: false, error: "metadata must include string id and name" };
    }
    metadata = {
      id: m.id,
      name: m.name,
      facilityName: typeof m.facilityName === "string" ? m.facilityName : "",
      spaceName: typeof m.spaceName === "string" ? m.spaceName : "",
      environmentType: typeof m.environmentType === "string" ? m.environmentType : "residence",
      notes: typeof m.notes === "string" ? m.notes : undefined,
      createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
      updatedAt: typeof m.updatedAt === "string" ? m.updatedAt : new Date().toISOString(),
    };
  }

  // Validate calibration provenance
  let calibration: CalibrationProvenance | null = null;
  if (obj.calibration !== null && obj.calibration !== undefined) {
    if (typeof obj.calibration !== "object") {
      return { isValid: false, error: "calibration must be an object or null" };
    }
    const c = obj.calibration as Record<string, unknown>;
    if (
      typeof c.pixelsPerCm !== "number" ||
      !Number.isFinite(c.pixelsPerCm) ||
      c.pixelsPerCm <= 0
    ) {
      return { isValid: false, error: "calibration.pixelsPerCm must be a positive finite number" };
    }
    calibration = {
      pixelsPerCm: c.pixelsPerCm,
      realLength: typeof c.realLength === "number" ? c.realLength : 0,
      unit: c.unit === "m" ? "m" : "cm",
      pixelDistance: typeof c.pixelDistance === "number" ? c.pixelDistance : 0,
      originPolicy: typeof c.originPolicy === "string" ? c.originPolicy : "canvas-origin-0-0",
    };
  }

  // Validate routeWaypoints
  if (!Array.isArray(obj.routeWaypoints)) {
    return { isValid: false, error: "routeWaypoints must be an array" };
  }
  const routeWaypoints: RouteWaypoint[] = [];
  for (let i = 0; i < obj.routeWaypoints.length; i++) {
    const wp = obj.routeWaypoints[i];
    if (
      typeof wp !== "object" ||
      wp === null ||
      typeof wp.id !== "string" ||
      typeof wp.x !== "number" ||
      typeof wp.y !== "number" ||
      !Number.isFinite(wp.x) ||
      !Number.isFinite(wp.y)
    ) {
      return { isValid: false, error: `Invalid waypoint at index ${i}` };
    }
    routeWaypoints.push({
      id: wp.id,
      name: typeof wp.name === "string" ? wp.name : `Waypoint ${i + 1}`,
      x: wp.x,
      y: wp.y,
      isMandatory: Boolean(wp.isMandatory),
    });
  }

  // Validate furniture
  const furniture: SpatialFurniture[] = Array.isArray(obj.furniture)
    ? (obj.furniture as SpatialFurniture[])
    : [];

  return {
    isValid: true,
    data: {
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: obj.assessmentType as "demo" | "user",
      metadata,
      canonicalBoundary: boundary,
      calibration,
      activeProfileId: obj.activeProfileId,
      routeWaypoints,
      furniture,
    },
  };
}

/**
 * Saves confirmed assessment state to browser localStorage.
 * Defensive against quota limits and disabled storage.
 */
export function savePersistedAssessment(state: PersistedAssessmentState): StorageSaveResult {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) {
    return { success: false, error: "Browser storage is not available on this device" };
  }

  try {
    const payloadToSerialize = {
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: state.assessmentType,
      metadata: state.metadata,
      canonicalBoundary: state.canonicalBoundary,
      calibration: state.calibration,
      activeProfileId: state.activeProfileId,
      routeWaypoints: state.routeWaypoints,
      furniture: state.furniture,
    };

    const json = JSON.stringify(payloadToSerialize);
    storage.setItem(SAFESPACE_STORAGE_KEY, json);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to save to storage: ${message}` };
  }
}

/**
 * Loads and validates confirmed assessment state from browser localStorage.
 */
export function loadPersistedAssessment(
  storageKey = SAFESPACE_STORAGE_KEY
): StorageLoadResult {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) {
    return {
      success: false,
      error: "Browser storage is unavailable in this environment",
      isCorrupted: false,
    };
  }

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return {
        success: false,
        error: "No persisted assessment found",
        isCorrupted: false,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: "Persisted storage data is malformed JSON",
        isCorrupted: true,
      };
    }

    const validation = validatePersistedPayload(parsed);
    if (!validation.isValid || !validation.data) {
      return {
        success: false,
        error: validation.error || "Schema validation failed",
        isCorrupted: true,
      };
    }

    return {
      success: true,
      data: validation.data,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Storage access error: ${message}`,
      isCorrupted: false,
    };
  }
}

/**
 * Explicitly clears persisted assessment from browser storage.
 */
export function clearPersistedAssessment(storageKey = SAFESPACE_STORAGE_KEY): StorageSaveResult {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) {
    return { success: false, error: "Browser storage is not available" };
  }

  try {
    storage.removeItem(storageKey);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to clear storage: ${message}` };
  }
}
