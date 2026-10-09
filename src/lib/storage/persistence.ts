import type { Point2D, Polygon2D } from "@/lib/spatial";
import { isSimplePolygon, polygonArea, validatePolygon2D } from "@/lib/spatial";
import type { MobilityProfileData, RouteWaypoint, SpatialFurniture } from "@/lib/spatial-model";

export const SAFESPACE_STORAGE_VERSION = 1;
export const SAFESPACE_STORAGE_KEY = "safespace_confirmed_assessment_v1";
export const SAFESPACE_ACTIVE_WORKSPACE_KEY = "safespace_active_workspace_v1";

export type ActiveWorkspace = "demo" | "user";

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
  activeProfileSnapshot?: MobilityProfileData | null;
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
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  try {
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    return null;
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
 * Persists user's explicit active workspace selection ("demo" | "user").
 */
export function saveActiveWorkspace(workspace: ActiveWorkspace): boolean {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) return false;
  try {
    storage.setItem(SAFESPACE_ACTIVE_WORKSPACE_KEY, workspace);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads user's explicit active workspace selection, defaulting safely.
 */
export function loadActiveWorkspace(): ActiveWorkspace {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) return "demo";
  try {
    const raw = storage.getItem(SAFESPACE_ACTIVE_WORKSPACE_KEY);
    if (raw === "user" || raw === "demo") {
      return raw;
    }
    const hasUser = storage.getItem(SAFESPACE_STORAGE_KEY);
    return hasUser ? "user" : "demo";
  } catch {
    return "demo";
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

  // Validate activeProfileSnapshot if present
  let activeProfileSnapshot: MobilityProfileData | null = null;
  if (obj.activeProfileSnapshot !== null && obj.activeProfileSnapshot !== undefined) {
    if (typeof obj.activeProfileSnapshot !== "object") {
      return { isValid: false, error: "activeProfileSnapshot must be an object or null" };
    }
    const snap = obj.activeProfileSnapshot as Record<string, unknown>;
    if (
      typeof snap.id !== "string" ||
      !snap.id ||
      typeof snap.name !== "string" ||
      !snap.name ||
      typeof snap.minClearanceCm !== "number" ||
      !Number.isFinite(snap.minClearanceCm) ||
      snap.minClearanceCm <= 0 ||
      typeof snap.turningSpaceCm !== "number" ||
      !Number.isFinite(snap.turningSpaceCm) ||
      snap.turningSpaceCm <= 0
    ) {
      return { isValid: false, error: "activeProfileSnapshot must contain valid id, name, and positive finite clearance dimensions" };
    }
    activeProfileSnapshot = {
      id: snap.id,
      name: snap.name,
      description: typeof snap.description === "string" ? snap.description : "",
      minClearanceCm: snap.minClearanceCm,
      turningSpaceCm: snap.turningSpaceCm,
      fallHistory: Boolean(snap.fallHistory),
      requiresSupport: Boolean(snap.requiresSupport),
      lowLightSensitivity:
        snap.lowLightSensitivity === "Low" || snap.lowLightSensitivity === "High"
          ? snap.lowLightSensitivity
          : "Moderate",
    };
  }

  // Validate canonicalBoundary
  let boundary: Polygon2D | null = null;
  if (obj.canonicalBoundary !== null && obj.canonicalBoundary !== undefined) {
    if (!Array.isArray(obj.canonicalBoundary)) {
      return { isValid: false, error: "canonicalBoundary must be an array or null" };
    }
    if (obj.canonicalBoundary.length < 3) {
      return { isValid: false, error: `canonicalBoundary requires at least 3 vertices (found ${obj.canonicalBoundary.length})` };
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

    const polyValidation = validatePolygon2D(validatedPoints);
    if (!polyValidation.valid) {
      return { isValid: false, error: `Invalid polygon boundary: ${polyValidation.errors?.join(", ")}` };
    }

    if (!isSimplePolygon(validatedPoints)) {
      return { isValid: false, error: "canonicalBoundary is self-intersecting (must be a simple polygon)" };
    }

    if (polygonArea(validatedPoints) <= 1e-3) {
      return { isValid: false, error: "canonicalBoundary area is zero or near-zero" };
    }

    boundary = validatedPoints;
  }

  // User assessments strictly require a valid canonicalBoundary
  if (obj.assessmentType === "user" && (!boundary || boundary.length < 3)) {
    return { isValid: false, error: "User assessment requires a valid closed canonicalBoundary with >= 3 vertices" };
  }

  // Validate metadata
  let metadata: AssessmentMetadata | null = null;
  if (obj.metadata !== null && obj.metadata !== undefined) {
    if (typeof obj.metadata !== "object") {
      return { isValid: false, error: "metadata must be an object or null" };
    }
    const m = obj.metadata as Record<string, unknown>;
    if (typeof m.id !== "string" || !m.id.trim() || typeof m.name !== "string" || !m.name.trim()) {
      return { isValid: false, error: "metadata must include non-empty string id and name" };
    }
    if (typeof m.createdAt !== "string" || isNaN(Date.parse(m.createdAt))) {
      return { isValid: false, error: "metadata.createdAt must be a valid ISO date string" };
    }
    if (typeof m.updatedAt !== "string" || isNaN(Date.parse(m.updatedAt))) {
      return { isValid: false, error: "metadata.updatedAt must be a valid ISO date string" };
    }
    metadata = {
      id: m.id.trim(),
      name: m.name.trim(),
      facilityName: typeof m.facilityName === "string" ? m.facilityName.trim() : "",
      spaceName: typeof m.spaceName === "string" ? m.spaceName.trim() : "",
      environmentType: typeof m.environmentType === "string" && m.environmentType.trim() ? m.environmentType : "residence",
      notes: typeof m.notes === "string" ? m.notes.trim() : undefined,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  // User assessments strictly require metadata
  if (obj.assessmentType === "user" && !metadata) {
    return { isValid: false, error: "User assessment requires non-null metadata" };
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
    if (
      typeof c.realLength !== "number" ||
      !Number.isFinite(c.realLength) ||
      c.realLength <= 0
    ) {
      return { isValid: false, error: "calibration.realLength must be a positive finite number" };
    }
    if (
      typeof c.pixelDistance !== "number" ||
      !Number.isFinite(c.pixelDistance) ||
      c.pixelDistance <= 0
    ) {
      return { isValid: false, error: "calibration.pixelDistance must be a positive finite number" };
    }
    if (c.unit !== "cm" && c.unit !== "m") {
      return { isValid: false, error: "calibration.unit must be 'cm' or 'm'" };
    }
    if (typeof c.originPolicy !== "string" || c.originPolicy !== "canvas-origin-0-0") {
      return { isValid: false, error: "calibration.originPolicy must be 'canvas-origin-0-0'" };
    }

    const realLengthCm = c.realLength * (c.unit === "m" ? 100 : 1);
    const expectedPixelsPerCm = c.pixelDistance / realLengthCm;
    const ratioDiff = Math.abs(c.pixelsPerCm - expectedPixelsPerCm) / expectedPixelsPerCm;
    if (ratioDiff > 0.02) {
      return {
        isValid: false,
        error: `calibration.pixelsPerCm (${c.pixelsPerCm}) is inconsistent with pixelDistance (${c.pixelDistance}) and realLength (${c.realLength} ${c.unit})`,
      };
    }

    calibration = {
      pixelsPerCm: c.pixelsPerCm,
      realLength: c.realLength,
      unit: c.unit,
      pixelDistance: c.pixelDistance,
      originPolicy: "canvas-origin-0-0",
    };
  }

  // User assessments strictly require calibration provenance
  if (obj.assessmentType === "user" && !calibration) {
    return { isValid: false, error: "User assessment requires non-null calibration provenance" };
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
      !wp.id ||
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
  if (!Array.isArray(obj.furniture)) {
    return { isValid: false, error: "furniture must be an array" };
  }
  const furniture: SpatialFurniture[] = [];
  for (let i = 0; i < obj.furniture.length; i++) {
    const f = obj.furniture[i];
    if (
      typeof f !== "object" ||
      f === null ||
      typeof f.id !== "string" ||
      !f.id.trim() ||
      typeof f.name !== "string" ||
      !f.name.trim() ||
      typeof f.category !== "string" ||
      !f.category.trim() ||
      typeof f.roomId !== "string" ||
      !f.roomId.trim() ||
      typeof f.x !== "number" ||
      typeof f.y !== "number" ||
      !Number.isFinite(f.x) ||
      !Number.isFinite(f.y) ||
      typeof f.width !== "number" ||
      !Number.isFinite(f.width) ||
      f.width <= 0 ||
      typeof f.depth !== "number" ||
      !Number.isFinite(f.depth) ||
      f.depth <= 0 ||
      typeof f.height !== "number" ||
      !Number.isFinite(f.height) ||
      f.height <= 0 ||
      typeof f.rotation !== "number" ||
      !Number.isFinite(f.rotation) ||
      typeof f.isFixed !== "boolean"
    ) {
      return { isValid: false, error: `Invalid furniture item at index ${i}` };
    }
    if (
      f.detectionConfidence !== undefined &&
      (typeof f.detectionConfidence !== "number" ||
        !Number.isFinite(f.detectionConfidence) ||
        f.detectionConfidence < 0 ||
        f.detectionConfidence > 1)
    ) {
      return { isValid: false, error: `Invalid detectionConfidence at furniture index ${i}` };
    }
    furniture.push(f as SpatialFurniture);
  }

  return {
    isValid: true,
    data: {
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: obj.assessmentType as "demo" | "user",
      metadata,
      canonicalBoundary: boundary,
      calibration,
      activeProfileId: obj.activeProfileId,
      activeProfileSnapshot,
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

  const validation = validatePersistedPayload(state);
  if (!validation.isValid) {
    return { success: false, error: validation.error || "Schema validation failed" };
  }

  try {
    const payloadToSerialize = {
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: state.assessmentType,
      metadata: state.metadata,
      canonicalBoundary: state.canonicalBoundary,
      calibration: state.calibration,
      activeProfileId: state.activeProfileId,
      activeProfileSnapshot: state.activeProfileSnapshot,
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
