import type { Point2D, Polygon2D, Segment2D } from "../schema";
import { distancePointToSegment } from "./primitives";

/**
 * Returns edges of a polygon as an array of Segment2D.
 */
export function polygonEdges(polygon: Polygon2D): Segment2D[] {
  const edges: Segment2D[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    edges.push({
      start: polygon[i],
      end: polygon[(i + 1) % n],
    });
  }
  return edges;
}

/**
 * Signed area of a 2D polygon using the Shoelace formula.
 * Positive for clockwise in screen/canvas coordinates (+y down),
 * or counter-clockwise in Cartesian coordinates (+y up).
 */
export function polygonSignedArea(polygon: Polygon2D): number {
  let area2 = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area2 += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
  }
  return area2 / 2;
}

/**
 * Absolute area of a 2D polygon in cm².
 */
export function polygonArea(polygon: Polygon2D): number {
  return Math.abs(polygonSignedArea(polygon));
}

/**
 * Tests if a point lies on any edge of a polygon within a tolerance.
 */
export function isPointOnPolygonBoundary(
  point: Point2D,
  polygon: Polygon2D,
  toleranceCm = 1e-4
): boolean {
  const edges = polygonEdges(polygon);
  for (const edge of edges) {
    if (distancePointToSegment(point, edge).distance <= toleranceCm) {
      return true;
    }
  }
  return false;
}

/**
 * Tests if a point is strictly or weakly inside a 2D polygon using ray-casting.
 * Handles vertices and horizontal edges robustly.
 */
export function isPointInPolygon(
  point: Point2D,
  polygon: Polygon2D,
  includeBoundary = true,
  boundaryToleranceCm = 1e-4
): boolean {
  if (polygon.length < 3) return false;

  if (isPointOnPolygonBoundary(point, polygon, boundaryToleranceCm)) {
    return includeBoundary;
  }

  let inside = false;
  const n = polygon.length;
  const { x, y } = point;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Computes shortest distance from a point to the perimeter of a polygon.
 */
export function distancePointToPolygonBoundary(
  point: Point2D,
  polygon: Polygon2D
): number {
  const edges = polygonEdges(polygon);
  let minD = Infinity;
  for (const edge of edges) {
    const d = distancePointToSegment(point, edge).distance;
    if (d < minD) minD = d;
  }
  return minD;
}

/**
 * Computes shortest distance from a point to a filled polygon.
 * If point is inside polygon, returns 0.
 * If point is outside, returns distance to closest edge.
 */
export function distancePointToPolygon(
  point: Point2D,
  polygon: Polygon2D
): number {
  if (isPointInPolygon(point, polygon, true)) {
    return 0;
  }
  return distancePointToPolygonBoundary(point, polygon);
}
