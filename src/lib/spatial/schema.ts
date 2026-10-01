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

export type DoorSweepDirection = "clockwise" | "counterclockwise";

export type DoorSemanticDirection =
  | "inward-left"
  | "inward-right"
  | "outward-left"
  | "outward-right";

export interface DoorSwingSpec {
  readonly hinge: Point2D;
  /** Opening arc angle in degrees (positive magnitude, e.g. 90) */
  readonly arcDeg: number;
  /**
   * Explicit geometric sweep direction in canonical coordinates (+x right, +y down):
   * - "clockwise": angle increases (+sweep)
   * - "counterclockwise": angle decreases (-sweep)
   */
  readonly sweepDirection: DoorSweepDirection;
  /**
   * Optional architectural semantic direction metadata.
   * Retained as descriptive metadata only; does not alter geometric sweep calculation.
   */
  readonly direction?: DoorSemanticDirection;
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
 * Helper to determine if two line segments (p1-q1) and (p2-q2) intersect.
 */
function segmentsIntersect(p1: Point2D, q1: Point2D, p2: Point2D, q2: Point2D): boolean {
  const ccw = (a: Point2D, b: Point2D, c: Point2D) =>
    (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

  const o1 = ccw(p1, q1, p2);
  const o2 = ccw(p1, q1, q2);
  const o3 = ccw(p2, q2, p1);
  const o4 = ccw(p2, q2, q1);

  // General intersection test: orientations differ across both segment lines
  const eps = 1e-9;
  const cross1 = (o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps);
  const cross2 = (o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps);

  if (cross1 && cross2) {
    return true;
  }

  const onSeg = (p: Point2D, q: Point2D, r: Point2D) =>
    q.x <= Math.max(p.x, r.x) + eps &&
    q.x >= Math.min(p.x, r.x) - eps &&
    q.y <= Math.max(p.y, r.y) + eps &&
    q.y >= Math.min(p.y, r.y) - eps;

  if (Math.abs(o1) <= eps && onSeg(p1, p2, q1)) return true;
  if (Math.abs(o2) <= eps && onSeg(p1, q2, q1)) return true;
  if (Math.abs(o3) <= eps && onSeg(p2, p1, q2)) return true;
  if (Math.abs(o4) <= eps && onSeg(p2, q1, q2)) return true;

  return false;
}

/**
 * Validates a Polygon2D.
 * Must contain at least 3 valid finite vertices, non-zero signed area,
 * and be a simple polygon (no self-intersections among non-adjacent edges).
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

  // Check degenerate consecutive duplicate vertices
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    if (
      Math.hypot(polygon[i].x - polygon[next].x, polygon[i].y - polygon[next].y) < 1e-6
    ) {
      return {
        valid: false,
        errors: [`Polygon has duplicate consecutive vertices at indices ${i} and ${next}`],
      };
    }
  }

  // Check simple polygon invariant: no non-adjacent edge intersections
  const n = polygon.length;
  for (let i = 0; i < n - 1; i++) {
    const p1 = polygon[i];
    const q1 = polygon[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges: (i, i+1) and wrap-around (0, n-1)
      if (j === i + 1 || (i === 0 && j === n - 1)) {
        continue;
      }
      const p2 = polygon[j];
      const q2 = polygon[(j + 1) % n];
      if (segmentsIntersect(p1, q1, p2, q2)) {
        return {
          valid: false,
          errors: [
            `Polygon is self-intersecting (non-simple): edges ${i} and ${j} intersect`,
          ],
        };
      }
    }
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
 * Validates a SourcedQuantity object.
 */
export function validateSourcedQuantity(
  sq: unknown,
  expectedUnit: string,
  fieldName: string,
  requirePositive = true
): string[] {
  const errors: string[] = [];
  if (typeof sq !== "object" || sq === null) {
    errors.push(`${fieldName} must be a SourcedQuantity object`);
    return errors;
  }
  const s = sq as Partial<SourcedQuantity>;
  if (typeof s.value !== "number" || !Number.isFinite(s.value)) {
    errors.push(`${fieldName} value must be a finite number`);
  } else if (requirePositive && s.value <= 0) {
    errors.push(`${fieldName} value must be a positive finite number`);
  }
  if (s.unit !== expectedUnit) {
    errors.push(`${fieldName} unit must be "${expectedUnit}", received "${s.unit}"`);
  }
  if (typeof s.source !== "object" || s.source === null) {
    errors.push(`${fieldName} source must be an object`);
  } else {
    const src = s.source as Partial<ThresholdSource>;
    const validTypes = ["user-measurement", "verified-rule", "clinical-input"];
    if (!src.type || !validTypes.includes(src.type)) {
      errors.push(`${fieldName} source.type must be one of: ${validTypes.join(", ")}`);
    }
    if (typeof src.referenceId !== "string" || src.referenceId.trim() === "") {
      errors.push(`${fieldName} source.referenceId must be a non-empty string`);
    }
    const validStatuses = ["unverified", "verified", "professionally-confirmed"];
    if (!src.verificationStatus || !validStatuses.includes(src.verificationStatus)) {
      errors.push(`${fieldName} source.verificationStatus must be one of: ${validStatuses.join(", ")}`);
    }
  }
  return errors;
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
  if (!r.floorId || typeof r.floorId !== "string" || r.floorId.trim() === "") {
    errors.push("Room must have a non-empty floorId");
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
  if (!o.roomId || typeof o.roomId !== "string" || o.roomId.trim() === "") {
    errors.push("Opening must have a non-empty roomId");
  }
  const validTypes = ["door", "window", "archway"];
  if (!o.type || !validTypes.includes(o.type)) {
    errors.push(`Opening type must be one of: ${validTypes.join(", ")}`);
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
    const validSweeps = ["clockwise", "counterclockwise"];
    if (!o.swing.sweepDirection || !validSweeps.includes(o.swing.sweepDirection)) {
      errors.push(`Opening swing sweepDirection must be one of: ${validSweeps.join(", ")}`);
    }
    if (o.swing.direction !== undefined) {
      const validDirs = ["inward-left", "inward-right", "outward-left", "outward-right"];
      if (!validDirs.includes(o.swing.direction)) {
        errors.push(`Opening swing direction must be one of: ${validDirs.join(", ")}`);
      }
    }
    if (isValidPoint2D(o.swing.hinge) && isValidPoint2D(o.start) && isValidPoint2D(o.end)) {
      const dStart = Math.hypot(o.start.x - o.swing.hinge.x, o.start.y - o.swing.hinge.y);
      const dEnd = Math.hypot(o.end.x - o.swing.hinge.x, o.end.y - o.swing.hinge.y);
      if (dStart > 1e-4 && dEnd > 1e-4) {
        errors.push("Opening swing hinge must coincide with either opening start or end endpoint");
      }
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
  if (!o.roomId || typeof o.roomId !== "string" || o.roomId.trim() === "") {
    errors.push("Object must have a non-empty roomId");
  }
  if (!o.name || typeof o.name !== "string" || o.name.trim() === "") {
    errors.push("Object must have a non-empty name");
  }
  if (!o.category || typeof o.category !== "string" || o.category.trim() === "") {
    errors.push("Object must have a non-empty category");
  }
  if (typeof o.isFixed !== "boolean") {
    errors.push("Object isFixed must be a boolean");
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
    if (
      o.dimensionsCm.height !== undefined &&
      (typeof o.dimensionsCm.height !== "number" ||
        !Number.isFinite(o.dimensionsCm.height) ||
        o.dimensionsCm.height <= 0)
    ) {
      errors.push("Object height must be a positive finite number if provided");
    }
  }
  if (typeof o.rotationDeg !== "number" || !Number.isFinite(o.rotationDeg)) {
    errors.push("Object rotationDeg must be a finite number");
  }
  if (
    o.confidence !== undefined &&
    (typeof o.confidence !== "number" ||
      !Number.isFinite(o.confidence) ||
      o.confidence < 0 ||
      o.confidence > 1)
  ) {
    errors.push("Object confidence must be a finite number between 0 and 1 if provided");
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
  if (!p.name || typeof p.name !== "string" || p.name.trim() === "") {
    errors.push("Mobility profile must have a non-empty name");
  }
  if (!p.aidType || typeof p.aidType !== "string" || p.aidType.trim() === "") {
    errors.push("Mobility profile must have a non-empty aidType");
  }

  errors.push(...validateSourcedQuantity(p.preferredClearanceCm, "cm", "preferredClearanceCm", true));
  errors.push(...validateSourcedQuantity(p.turningDiameterCm, "cm", "turningDiameterCm", true));

  if (p.envelopeWidthCm !== undefined) {
    errors.push(...validateSourcedQuantity(p.envelopeWidthCm, "cm", "envelopeWidthCm", true));
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}
