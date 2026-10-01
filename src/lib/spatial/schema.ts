/**
 * Canonical Spatial Types and Pure Validation Boundary
 *
 * Coordinates are canonical centimetres (cm), origin (0, 0) top-left.
 * 3D conversion: toMeters(cm) = cm / 100
 */

export type UUID = string;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Segment2D {
  readonly start: Point2D;
  readonly end: Point2D;
}

export type Polygon2D = readonly Point2D[];

export interface BoundingBox2D {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ThresholdSource {
  readonly type: "user-measurement" | "verified-rule" | "clinical-input";
  readonly referenceId: string;
  readonly verificationStatus: "unverified" | "verified" | "professionally-confirmed";
}

export interface SourcedQuantity<U extends string = string> {
  readonly value: number;
  readonly unit: U;
  readonly source: ThresholdSource;
}

export interface DoorSwingSpec {
  readonly hinge: Point2D;
  readonly arcDeg: number;
  readonly direction: "inward-left" | "inward-right" | "outward-left" | "outward-right";
}

export interface CanonicalOpening {
  readonly id: UUID;
  readonly roomId: UUID;
  readonly type: "door" | "window" | "archway";
  readonly start: Point2D;
  readonly end: Point2D;
  readonly clearWidthCm: number;
  readonly thresholdHeightMm?: number;
  readonly swing?: DoorSwingSpec;
}

export interface CanonicalRoom {
  readonly id: UUID;
  readonly floorId: UUID;
  readonly name: string;
  readonly category?: string;
  readonly boundary: Polygon2D;
}

export interface ObjectDimensionsCm {
  readonly width: number;
  readonly depth: number;
  readonly height?: number;
}

export interface CanonicalObject {
  readonly id: UUID;
  readonly roomId: UUID;
  readonly name: string;
  readonly category: string;
  /** Position (cm) in world coordinates, representing object center or anchor point */
  readonly position: Point2D;
  readonly dimensionsCm: ObjectDimensionsCm;
  readonly rotationDeg: number;
  /** Optional custom footprint polygon in local coordinates relative to object center */
  readonly footprint?: Polygon2D;
  readonly isFixed: boolean;
  readonly loadBearingSupport?: boolean;
  readonly confidence?: number;
}

export type AidType =
  | "none"
  | "walking-stick"
  | "quad-cane"
  | "rollator-walker"
  | "manual-wheelchair"
  | "power-wheelchair"
  | string;

export interface CanonicalMobilityProfile {
  readonly id: UUID;
  readonly name: string;
  readonly aidType: AidType;
  readonly preferredClearanceCm: SourcedQuantity<"cm">;
  readonly turningDiameterCm: SourcedQuantity<"cm">;
  readonly envelopeWidthCm?: SourcedQuantity<"cm">;
}

export type RoutePurpose = "routine" | "accessible" | "fire-egress";

export interface CanonicalRoute {
  readonly id: UUID;
  readonly floorId: UUID;
  readonly name: string;
  readonly profileId: UUID;
  readonly waypoints: readonly Point2D[];
  readonly purposes: readonly RoutePurpose[];
}

export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly string[] };

/**
 * Validates a single Point2D.
 */
export function isValidPoint2D(p: unknown): p is Point2D {
  if (typeof p !== "object" || p === null) return false;
  const cand = p as { x?: unknown; y?: unknown };
  return (
    typeof cand.x === "number" &&
    Number.isFinite(cand.x) &&
    typeof cand.y === "number" &&
    Number.isFinite(cand.y)
  );
}

/**
 * Validates a Polygon2D.
 * Must contain at least 3 valid finite vertices and non-zero signed area.
 */
export function validatePolygon2D(polygon: unknown): ValidationResult {
  if (!Array.isArray(polygon)) {
    return { valid: false, errors: ["Polygon must be an array of Point2D vertices"] };
  }
  if (polygon.length < 3) {
    return { valid: false, errors: ["Polygon must have at least 3 vertices"] };
  }

  const errors: string[] = [];
  for (let i = 0; i < polygon.length; i++) {
    if (!isValidPoint2D(polygon[i])) {
      errors.push(`Vertex at index ${i} is not a valid finite Point2D`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check degenerate area (Shoelace formula)
  let doubleArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    doubleArea += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
  }
  if (Math.abs(doubleArea) < 1e-6) {
    return { valid: false, errors: ["Polygon has degenerate zero area"] };
  }

  return { valid: true };
}

/**
 * Validates a CanonicalRoom.
 */
export function validateCanonicalRoom(room: unknown): ValidationResult {
  if (typeof room !== "object" || room === null) {
    return { valid: false, errors: ["Room must be an object"] };
  }
  const r = room as Partial<CanonicalRoom>;
  const errors: string[] = [];

  if (!r.id || typeof r.id !== "string" || r.id.trim() === "") {
    errors.push("Room must have a non-empty id");
  }
  if (!r.name || typeof r.name !== "string" || r.name.trim() === "") {
    errors.push("Room must have a non-empty name");
  }

  const polyValidation = validatePolygon2D(r.boundary);
  if (!polyValidation.valid) {
    errors.push(...polyValidation.errors.map((e) => `Boundary error: ${e}`));
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

/**
 * Validates a CanonicalOpening.
 */
export function validateCanonicalOpening(opening: unknown): ValidationResult {
  if (typeof opening !== "object" || opening === null) {
    return { valid: false, errors: ["Opening must be an object"] };
  }
  const o = opening as Partial<CanonicalOpening>;
  const errors: string[] = [];

  if (!o.id || typeof o.id !== "string" || o.id.trim() === "") {
    errors.push("Opening must have a non-empty id");
  }
  if (!isValidPoint2D(o.start)) {
    errors.push("Opening start must be a valid finite Point2D");
  }
  if (!isValidPoint2D(o.end)) {
    errors.push("Opening end must be a valid finite Point2D");
  }
  if (typeof o.clearWidthCm !== "number" || !Number.isFinite(o.clearWidthCm) || o.clearWidthCm <= 0) {
    errors.push("Opening clearWidthCm must be a positive finite number");
  }
  if (o.swing) {
    if (!isValidPoint2D(o.swing.hinge)) {
      errors.push("Opening swing hinge must be a valid finite Point2D");
    }
    if (typeof o.swing.arcDeg !== "number" || !Number.isFinite(o.swing.arcDeg) || o.swing.arcDeg <= 0) {
      errors.push("Opening swing arcDeg must be a positive finite number");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

/**
 * Validates a CanonicalObject.
 */
export function validateCanonicalObject(obj: unknown): ValidationResult {
  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["Object must be a valid object"] };
  }
  const o = obj as Partial<CanonicalObject>;
  const errors: string[] = [];

  if (!o.id || typeof o.id !== "string" || o.id.trim() === "") {
    errors.push("Object must have a non-empty id");
  }
  if (!isValidPoint2D(o.position)) {
    errors.push("Object position must be a valid finite Point2D");
  }
  if (!o.dimensionsCm || typeof o.dimensionsCm !== "object") {
    errors.push("Object must have dimensionsCm");
  } else {
    if (
      typeof o.dimensionsCm.width !== "number" ||
      !Number.isFinite(o.dimensionsCm.width) ||
      o.dimensionsCm.width <= 0
    ) {
      errors.push("Object width must be a positive finite number");
    }
    if (
      typeof o.dimensionsCm.depth !== "number" ||
      !Number.isFinite(o.dimensionsCm.depth) ||
      o.dimensionsCm.depth <= 0
    ) {
      errors.push("Object depth must be a positive finite number");
    }
  }
  if (typeof o.rotationDeg !== "number" || !Number.isFinite(o.rotationDeg)) {
    errors.push("Object rotationDeg must be a finite number");
  }
  if (o.footprint !== undefined) {
    const footVal = validatePolygon2D(o.footprint);
    if (!footVal.valid) {
      errors.push(...footVal.errors.map((e) => `Footprint error: ${e}`));
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

/**
 * Validates a CanonicalMobilityProfile.
 */
export function validateCanonicalMobilityProfile(profile: unknown): ValidationResult {
  if (typeof profile !== "object" || profile === null) {
    return { valid: false, errors: ["Mobility profile must be an object"] };
  }
  const p = profile as Partial<CanonicalMobilityProfile>;
  const errors: string[] = [];

  if (!p.id || typeof p.id !== "string" || p.id.trim() === "") {
    errors.push("Mobility profile must have a non-empty id");
  }
  if (!p.preferredClearanceCm || typeof p.preferredClearanceCm.value !== "number" || p.preferredClearanceCm.value <= 0) {
    errors.push("Mobility profile preferredClearanceCm must have a positive finite value");
  }
  if (!p.turningDiameterCm || typeof p.turningDiameterCm.value !== "number" || p.turningDiameterCm.value <= 0) {
    errors.push("Mobility profile turningDiameterCm must have a positive finite value");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}
