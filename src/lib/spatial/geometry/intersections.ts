import type { Point2D, Polygon2D, Segment2D } from "../schema";
import { isPointInPolygon, polygonEdges } from "./polygons";

/**
 * Orientation helper for 3 points:
 * 0 -> collinear
 * 1 -> clockwise
 * 2 -> counterclockwise
 */
function orientation(p: Point2D, q: Point2D, r: Point2D): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

/**
 * Checks if point q lies on segment pr (assuming p, q, r are collinear).
 */
function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-9 &&
    q.x >= Math.min(p.x, r.x) - 1e-9 &&
    q.y <= Math.max(p.y, r.y) + 1e-9 &&
    q.y >= Math.min(p.y, r.y) - 1e-9
  );
}

/**
 * Tests if two 2D line segments intersect.
 */
export function segmentIntersectsSegment(s1: Segment2D, s2: Segment2D): boolean {
  const p1 = s1.start;
  const q1 = s1.end;
  const p2 = s2.start;
  const q2 = s2.end;

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  // Special collinear cases
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/**
 * Computes exact intersection point of two line segments if one exists.
 * Returns null if parallel, disjoint, or collinear overlap.
 */
export function segmentIntersectionPoint(
  s1: Segment2D,
  s2: Segment2D
): Point2D | null {
  const dx1 = s1.end.x - s1.start.x;
  const dy1 = s1.end.y - s1.start.y;
  const dx2 = s2.end.x - s2.start.x;
  const dy2 = s2.end.y - s2.start.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) {
    return null; // Collinear or parallel
  }

  const t =
    ((s2.start.x - s1.start.x) * dy2 - (s2.start.y - s1.start.y) * dx2) / denom;
  const u =
    ((s2.start.x - s1.start.x) * dy1 - (s2.start.y - s1.start.y) * dx1) / denom;

  if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
    return {
      x: s1.start.x + t * dx1,
      y: s1.start.y + t * dy1,
    };
  }

  return null;
}

/**
 * Tests if a line segment intersects a polygon boundary or is contained inside it.
 */
export function segmentIntersectsPolygon(
  segment: Segment2D,
  polygon: Polygon2D
): boolean {
  // If either endpoint is inside polygon
  if (
    isPointInPolygon(segment.start, polygon, true) ||
    isPointInPolygon(segment.end, polygon, true)
  ) {
    return true;
  }

  // Check intersection with any boundary edge
  const edges = polygonEdges(polygon);
  for (const edge of edges) {
    if (segmentIntersectsSegment(segment, edge)) {
      return true;
    }
  }

  return false;
}

/**
 * Tests if two 2D polygons intersect (boundary crossing or full containment).
 * Works for arbitrary (convex or concave) simple polygons.
 */
export function polygonIntersectsPolygon(
  polyA: Polygon2D,
  polyB: Polygon2D
): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  // 1. Any edge of A intersects any edge of B
  const edgesA = polygonEdges(polyA);
  const edgesB = polygonEdges(polyB);

  for (const ea of edgesA) {
    for (const eb of edgesB) {
      if (segmentIntersectsSegment(ea, eb)) {
        return true;
      }
    }
  }

  // 2. Any vertex of A inside B (A contained in B)
  for (const ptA of polyA) {
    if (isPointInPolygon(ptA, polyB, true)) {
      return true;
    }
  }

  // 3. Any vertex of B inside A (B contained in A)
  for (const ptB of polyB) {
    if (isPointInPolygon(ptB, polyA, true)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a 2D footprint is completely contained within a walkable room boundary.
 * Correctly detects when rotated footprint edges exit and re-enter concave polygon notches (L/U shapes)
 * even when all footprint vertices remain inside.
 */
export function isFootprintContainedInBoundary(
  footprint: Polygon2D,
  roomBoundary: Polygon2D
): boolean {
  if (footprint.length < 3 || roomBoundary.length < 3) return false;

  // 1. All vertices of footprint must be inside or on boundary of room
  for (const v of footprint) {
    if (!isPointInPolygon(v, roomBoundary, true)) {
      return false;
    }
  }

  // 2. Footprint centroid check
  let sumX = 0;
  let sumY = 0;
  for (const v of footprint) {
    sumX += v.x;
    sumY += v.y;
  }
  const centroid: Point2D = { x: sumX / footprint.length, y: sumY / footprint.length };
  if (!isPointInPolygon(centroid, roomBoundary, true)) {
    return false;
  }

  // 3. Check each footprint edge for crossings into exterior concavities
  const roomEdges = polygonEdges(roomBoundary);
  for (let i = 0; i < footprint.length; i++) {
    const p1 = footprint[i];
    const p2 = footprint[(i + 1) % footprint.length];
    const edgeSeg: Segment2D = { start: p1, end: p2 };

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) continue;

    const tValues: number[] = [0, 1];

    for (const bEdge of roomEdges) {
      const pt = segmentIntersectionPoint(edgeSeg, bEdge);
      if (pt) {
        const t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
        if (t > 1e-6 && t < 1 - 1e-6) {
          tValues.push(t);
        }
      }
    }

    tValues.sort((a, b) => a - b);

    // Remove near-duplicate t values
    const uniqueT: number[] = [];
    for (const t of tValues) {
      if (uniqueT.length === 0 || t - uniqueT[uniqueT.length - 1] > 1e-5) {
        uniqueT.push(t);
      }
    }

    // For each subsegment, test midpoint
    for (let j = 0; j < uniqueT.length - 1; j++) {
      const midT = (uniqueT[j] + uniqueT[j + 1]) / 2;
      const midPoint: Point2D = {
        x: p1.x + midT * dx,
        y: p1.y + midT * dy,
      };

      if (!isPointInPolygon(midPoint, roomBoundary, true)) {
        return false;
      }
    }
  }

  // 4. Check if any room boundary vertex is strictly inside the footprint (swallowing a notch corner)
  for (const bv of roomBoundary) {
    if (isPointInPolygon(bv, footprint, false)) {
      return false;
    }
  }

  return true;
}
