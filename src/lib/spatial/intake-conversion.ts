import type { Point2D, Polygon2D, Segment2D } from "./schema";
import { segmentIntersectsSegment } from "./geometry/intersections";
import { distancePointToPolygonBoundary, isPointInPolygon, polygonArea } from "./geometry/polygons";

/**
 * Coordinate Conversion & Origin Policy
 * ─────────────────────────────────────────────────────────────
 * Policy: canvas-origin-0-0
 * - Intake drafting occurs in an SVG viewBox of 800 × 600 px.
 * - Origin (0, 0) is the top-left corner of the intake canvas / floorplan image.
 * - +X axis points right (east), +Y axis points down (south), matching standard SVG canvas coordinates.
 * - Rotation 0° aligns with +X axis.
 * - Conversion formula:
 *     x_cm = (x_px - originPx.x) / pixelsPerCm
 *     y_cm = (y_px - originPx.y) / pixelsPerCm
 * - Reverse conversion formula:
 *     x_px = x_cm * pixelsPerCm + originPx.x
 *     y_px = y_cm * pixelsPerCm + originPx.y
 * - Local-origin changes are never silently applied; default originPx is (0, 0).
 */
export const INTAKE_ORIGIN_POLICY = "canvas-origin-0-0";

export type CoordinateConversionPolicy = {
  pixelsPerCm: number;
  originPx: Point2D;
  unit: "cm";
  originPolicy: typeof INTAKE_ORIGIN_POLICY;
};

export type IntakeBoundaryValidationResult = {
  isValid: boolean;
  error?: string;
  polygonCm?: Polygon2D;
  boundsCm?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    widthCm: number;
    heightCm: number;
  };
  areaCm2?: number;
};

/**
 * Converts intake canvas pixel coordinates to canonical centimetres.
 */
export function convertIntakePointToCm(
  point: Point2D,
  pixelsPerCm: number,
  originPx: Point2D = { x: 0, y: 0 }
): Point2D {
  if (!Number.isFinite(pixelsPerCm) || pixelsPerCm <= 0) {
    throw new Error(`Invalid pixelsPerCm scale: ${pixelsPerCm}. Must be a positive finite number.`);
  }
  return {
    x: (point.x - originPx.x) / pixelsPerCm,
    y: (point.y - originPx.y) / pixelsPerCm,
  };
}

/**
 * Converts canonical centimetres back to intake canvas pixel coordinates.
 */
export function convertCmToCanvasPx(
  point: Point2D,
  pixelsPerCm: number,
  originPx: Point2D = { x: 0, y: 0 }
): Point2D {
  if (!Number.isFinite(pixelsPerCm) || pixelsPerCm <= 0) {
    throw new Error(`Invalid pixelsPerCm scale: ${pixelsPerCm}. Must be a positive finite number.`);
  }
  return {
    x: point.x * pixelsPerCm + originPx.x,
    y: point.y * pixelsPerCm + originPx.y,
  };
}

/**
 * Converts an entire array of intake canvas vertices from pixels to canonical centimetres.
 */
export function convertIntakePolygonToCm(
  vertices: readonly Point2D[],
  pixelsPerCm: number,
  originPx: Point2D = { x: 0, y: 0 }
): Polygon2D {
  return vertices.map((v) => convertIntakePointToCm(v, pixelsPerCm, originPx));
}

// Ergonomic / test aliases
export const convertPixelPointToCm = convertIntakePointToCm;
export const convertCmPointToPixels = convertCmToCanvasPx;
export const convertPixelPolygonToCm = convertIntakePolygonToCm;

export function convertCmPolygonToPixels(
  vertices: readonly Point2D[],
  pixelsPerCm: number,
  originPx: Point2D = { x: 0, y: 0 }
): Polygon2D {
  return vertices.map((v) => convertCmToCanvasPx(v, pixelsPerCm, originPx));
}

export function computePolygonShoelaceAreaCm2(polygon: Polygon2D): number {
  return polygonArea(polygon);
}

/**
 * Checks whether a polygon is simple (does not have self-intersecting edges).
 */
export function isSimplePolygon(vertices: readonly Point2D[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  for (let i = 0; i < n; i++) {
    const s1: Segment2D = {
      start: vertices[i],
      end: vertices[(i + 1) % n],
    };

    for (let j = i + 2; j < n; j++) {
      // Wrap-around adjacent check: first edge (0) and last edge (n-1) share vertex 0
      if (i === 0 && j === n - 1) continue;

      const s2: Segment2D = {
        start: vertices[j],
        end: vertices[(j + 1) % n],
      };

      if (segmentIntersectsSegment(s1, s2)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Computes axis-aligned bounding box of a 2D polygon in cm.
 */
export function computePolygonBoundsCm(polygon: Polygon2D): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  widthCm: number;
  heightCm: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const widthCm = maxX - minX;
  const heightCm = maxY - minY;

  return { minX, minY, maxX, maxY, width: widthCm, height: heightCm, widthCm, heightCm };
}

/**
 * Validates an intake draft boundary polygon before confirmation:
 * 1. Requires valid calibration scale (pixelsPerCm > 0 and finite).
 * 2. Requires closed polygon flag.
 * 3. Requires at least 3 vertices.
 * 4. Checks all vertex coordinates are finite numbers.
 * 5. Checks for duplicate consecutive vertices.
 * 6. Checks that polygon does not self-intersect.
 * 7. Checks physical dimensions are positive finite numbers.
 * 8. Checks area is positive.
 */
export function validateIntakeBoundary(
  vertices: readonly Point2D[],
  isClosed: boolean,
  pixelsPerCm: number | null | undefined,
  originPx: Point2D = { x: 0, y: 0 }
): IntakeBoundaryValidationResult {
  if (pixelsPerCm === null || pixelsPerCm === undefined || !Number.isFinite(pixelsPerCm) || pixelsPerCm <= 0) {
    return {
      isValid: false,
      error: "Scale calibration is missing or invalid. Please calibrate a reference measurement before confirming.",
    };
  }

  if (!isClosed) {
    return {
      isValid: false,
      error: "Boundary polygon is not closed. Click the first vertex or close the loop to complete drafting.",
    };
  }

  if (!Array.isArray(vertices) || vertices.length < 3) {
    return {
      isValid: false,
      error: `Boundary requires at least 3 vertices (found ${vertices ? vertices.length : 0}).`,
    };
  }

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    if (typeof v.x !== "number" || typeof v.y !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y)) {
      return {
        isValid: false,
        error: `Vertex at index ${i} has invalid or non-finite coordinates.`,
      };
    }
  }

  // Filter or check duplicate consecutive vertices
  const cleanVertices: Point2D[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const curr = vertices[i];
    const prev = cleanVertices[cleanVertices.length - 1];
    if (prev && Math.hypot(curr.x - prev.x, curr.y - prev.y) < 1e-4) {
      continue; // skip zero-length edge
    }
    cleanVertices.push(curr);
  }

  if (cleanVertices.length < 3) {
    return {
      isValid: false,
      error: "Boundary collapsed to fewer than 3 distinct vertices.",
    };
  }

  // Check self-intersections
  if (!isSimplePolygon(cleanVertices)) {
    return {
      isValid: false,
      error: "Boundary polygon self-intersects. Perimeter edges must not cross each other.",
    };
  }

  // Convert to cm
  const polygonCm = convertIntakePolygonToCm(cleanVertices, pixelsPerCm, originPx);

  // Compute area and bounds
  const area = polygonArea(polygonCm);
  if (area <= 1e-3) {
    return {
      isValid: false,
      error: "Boundary area is zero or near zero. Please draft an enclosed room area.",
    };
  }

  const bounds = computePolygonBoundsCm(polygonCm);
  if (bounds.widthCm <= 1 || bounds.heightCm <= 1) {
    return {
      isValid: false,
      error: `Physical room dimensions too small (${bounds.widthCm.toFixed(1)} × ${bounds.heightCm.toFixed(1)} cm). Minimum 1 cm required.`,
    };
  }

  return {
    isValid: true,
    polygonCm,
    boundsCm: bounds,
    areaCm2: area,
  };
}

/**
 * Finds a guaranteed interior point inside a 2D polygon with maximum wall clearance.
 * Used for placing route waypoints (start, destination, checkpoint) safely inside concave or irregular rooms.
 */
export function findInteriorProvisionalPoint(
  polygon: Polygon2D,
  phase: "start" | "end" | "intermediate" = "start",
  referencePoints?: readonly Point2D[]
): Point2D {
  if (!polygon || polygon.length < 3) {
    return { x: 200, y: 250 };
  }

  const bounds = computePolygonBoundsCm(polygon);
  const steps = 30;
  const stepX = Math.max(1, bounds.widthCm / steps);
  const stepY = Math.max(1, bounds.heightCm / steps);

  const candidates: { pt: Point2D; dist: number }[] = [];

  for (let ix = 1; ix < steps; ix++) {
    const cx = bounds.minX + ix * stepX;
    for (let iy = 1; iy < steps; iy++) {
      const cy = bounds.minY + iy * stepY;
      const pt: Point2D = { x: Math.round(cx), y: Math.round(cy) };
      if (isPointInPolygon(pt, polygon, false)) {
        const dist = distancePointToPolygonBoundary(pt, polygon);
        if (dist > 1) {
          candidates.push({ pt, dist });
        }
      }
    }
  }

  if (candidates.length === 0) {
    let sumX = 0;
    let sumY = 0;
    for (const v of polygon) {
      sumX += v.x;
      sumY += v.y;
    }
    const centroid = { x: Math.round(sumX / polygon.length), y: Math.round(sumY / polygon.length) };
    if (isPointInPolygon(centroid, polygon, false)) {
      return centroid;
    }
    return { x: Math.round(polygon[0].x), y: Math.round(polygon[0].y) };
  }

  const maxDist = Math.max(...candidates.map((c) => c.dist));
  const clearanceThreshold = Math.min(maxDist * 0.4, 25);
  const comfortable = candidates.filter((c) => c.dist >= clearanceThreshold);
  const pool = comfortable.length > 0 ? comfortable : candidates;

  if (phase === "start") {
    pool.sort((a, b) => {
      const scoreA = a.pt.x * 1.2 + a.pt.y - a.dist * 0.5;
      const scoreB = b.pt.x * 1.2 + b.pt.y - b.dist * 0.5;
      return scoreA - scoreB;
    });
    return pool[0].pt;
  }

  if (phase === "end") {
    if (referencePoints && referencePoints.length > 0) {
      const ref = referencePoints[0];
      pool.sort((a, b) => {
        const distA = Math.hypot(a.pt.x - ref.x, a.pt.y - ref.y);
        const distB = Math.hypot(b.pt.x - ref.x, b.pt.y - ref.y);
        return distB - distA;
      });
      return pool[0].pt;
    }
    pool.sort((a, b) => {
      const scoreA = a.pt.x * 1.2 + a.pt.y + a.dist * 0.5;
      const scoreB = b.pt.x * 1.2 + b.pt.y + b.dist * 0.5;
      return scoreB - scoreA;
    });
    return pool[0].pt;
  }

  if (referencePoints && referencePoints.length >= 2) {
    const p1 = referencePoints[referencePoints.length - 2];
    const p2 = referencePoints[referencePoints.length - 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    pool.sort((a, b) => {
      const dMidA = Math.hypot(a.pt.x - midX, a.pt.y - midY);
      const dMidB = Math.hypot(b.pt.x - midX, b.pt.y - midY);
      return dMidA - dMidB;
    });
    return pool[0].pt;
  }

  pool.sort((a, b) => b.dist - a.dist);
  return pool[0].pt;
}
