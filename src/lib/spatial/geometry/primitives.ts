import type { BoundingBox2D, Point2D, Segment2D } from "../schema";

/**
 * Euclidean distance between two points in centimetres.
 */
export function distancePointToPoint(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Shortest distance from a point to a finite line segment.
 * Returns distance, closest projected point, and parameter t in [0, 1].
 */
export function distancePointToSegment(
  p: Point2D,
  seg: Segment2D
): { distance: number; closestPoint: Point2D; t: number } {
  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = distancePointToPoint(p, seg.start);
    return { distance: d, closestPoint: seg.start, t: 0 };
  }

  const rawT = ((p.x - seg.start.x) * dx + (p.y - seg.start.y) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const closestPoint: Point2D = {
    x: seg.start.x + t * dx,
    y: seg.start.y + t * dy,
  };

  return {
    distance: distancePointToPoint(p, closestPoint),
    closestPoint,
    t,
  };
}

/**
 * Shortest distance between two finite line segments.
 */
export function distanceSegmentToSegment(s1: Segment2D, s2: Segment2D): number {
  // Check if they intersect
  const dx1 = s1.end.x - s1.start.x;
  const dy1 = s1.end.y - s1.start.y;
  const dx2 = s2.end.x - s2.start.x;
  const dy2 = s2.end.y - s2.start.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (denom !== 0) {
    const t = ((s2.start.x - s1.start.x) * dy2 - (s2.start.y - s1.start.y) * dx2) / denom;
    const u = ((s2.start.x - s1.start.x) * dy1 - (s2.start.y - s1.start.y) * dx1) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return 0; // Segments intersect
    }
  }

  const d1 = distancePointToSegment(s1.start, s2).distance;
  const d2 = distancePointToSegment(s1.end, s2).distance;
  const d3 = distancePointToSegment(s2.start, s1).distance;
  const d4 = distancePointToSegment(s2.end, s1).distance;

  return Math.min(d1, d2, d3, d4);
}

/**
 * Computes cumulative length of a polyline through an ordered list of points.
 */
export function polylineLength(points: readonly Point2D[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += distancePointToPoint(points[i], points[i + 1]);
  }
  return total;
}

/**
 * Computes axis-aligned bounding box enclosing a set of 2D points.
 */
export function boundingBox(points: readonly Point2D[]): BoundingBox2D {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Expands bounding box by a given margin in centimetres.
 */
export function expandBoundingBox(bb: BoundingBox2D, marginCm: number): BoundingBox2D {
  return {
    minX: bb.minX - marginCm,
    minY: bb.minY - marginCm,
    maxX: bb.maxX + marginCm,
    maxY: bb.maxY + marginCm,
  };
}
