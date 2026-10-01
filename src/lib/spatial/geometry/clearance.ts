import type {
  CanonicalObject,
  Point2D,
  Polygon2D,
  Segment2D,
} from "../schema";
import { deriveWorldFootprint } from "./footprints";
import { polygonEdges } from "./polygons";
import { distancePointToSegment } from "./primitives";

export interface BottleneckEvidence {
  readonly position: Point2D;
  readonly clearanceCm: number;
  readonly obstacleId?: string;
  readonly routeSegmentIndex: number;
}

export interface CorridorObstacleCollision {
  readonly obstacleId: string;
  readonly minDistanceCm: number;
  readonly bottleneckPosition: Point2D;
  readonly routeSegmentIndex: number;
}

/**
 * Finds closest point on segment s to an arbitrary point p.
 */
function closestPointOnSegment(p: Point2D, s: Segment2D): Point2D {
  return distancePointToSegment(p, s).closestPoint;
}

/**
 * Computes closest pair of points between two segments and their distance.
 */
function closestPointsBetweenSegments(
  s1: Segment2D,
  s2: Segment2D
): { dist: number; p1: Point2D; p2: Point2D } {
  // Check if they intersect
  const dx1 = s1.end.x - s1.start.x;
  const dy1 = s1.end.y - s1.start.y;
  const dx2 = s2.end.x - s2.start.x;
  const dy2 = s2.end.y - s2.start.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) > 1e-9) {
    const t = ((s2.start.x - s1.start.x) * dy2 - (s2.start.y - s1.start.y) * dx2) / denom;
    const u = ((s2.start.x - s1.start.x) * dy1 - (s2.start.y - s1.start.y) * dx1) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const interPt: Point2D = {
        x: s1.start.x + t * dx1,
        y: s1.start.y + t * dy1,
      };
      return { dist: 0, p1: interPt, p2: interPt };
    }
  }

  // Check 4 candidate closest point pairs
  const candidates: { dist: number; p1: Point2D; p2: Point2D }[] = [];

  const cp1 = closestPointOnSegment(s1.start, s2);
  candidates.push({ dist: Math.hypot(s1.start.x - cp1.x, s1.start.y - cp1.y), p1: s1.start, p2: cp1 });

  const cp2 = closestPointOnSegment(s1.end, s2);
  candidates.push({ dist: Math.hypot(s1.end.x - cp2.x, s1.end.y - cp2.y), p1: s1.end, p2: cp2 });

  const cp3 = closestPointOnSegment(s2.start, s1);
  candidates.push({ dist: Math.hypot(cp3.x - s2.start.x, cp3.y - s2.start.y), p1: cp3, p2: s2.start });

  const cp4 = closestPointOnSegment(s2.end, s1);
  candidates.push({ dist: Math.hypot(cp4.x - s2.end.x, cp4.y - s2.end.y), p1: cp4, p2: s2.end });

  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].dist < best.dist) {
      best = candidates[i];
    }
  }

  return best;
}

/**
 * Computes shortest distance from a route segment to an obstacle footprint polygon.
 */
export function distanceSegmentToPolygon(
  segment: Segment2D,
  polygon: Polygon2D
): { minDistanceCm: number; routePoint: Point2D; polygonPoint: Point2D } {
  const edges = polygonEdges(polygon);
  let bestDist = Infinity;
  let bestRoutePoint: Point2D = segment.start;
  let bestPolyPoint: Point2D = polygon[0];

  for (const edge of edges) {
    const res = closestPointsBetweenSegments(segment, edge);
    if (res.dist < bestDist) {
      bestDist = res.dist;
      bestRoutePoint = res.p1;
      bestPolyPoint = res.p2;
    }
  }

  return {
    minDistanceCm: bestDist,
    routePoint: bestRoutePoint,
    polygonPoint: bestPolyPoint,
  };
}

/**
 * Tests whether a dilated corridor of radius r along a route polyline intersects obstacles.
 * Radius is preferredClearanceCm / 2.
 */
export function testCorridorCollisions(
  path: readonly Point2D[],
  corridorRadiusCm: number,
  obstacles: readonly CanonicalObject[]
): CorridorObstacleCollision[] {
  if (path.length < 2) return [];

  const collisions: CorridorObstacleCollision[] = [];

  for (let segIdx = 0; segIdx < path.length - 1; segIdx++) {
    const segment: Segment2D = { start: path[segIdx], end: path[segIdx + 1] };

    for (const obs of obstacles) {
      const footprint = deriveWorldFootprint(obs);
      const { minDistanceCm, routePoint } = distanceSegmentToPolygon(segment, footprint);

      if (minDistanceCm <= corridorRadiusCm + 1e-4) {
        collisions.push({
          obstacleId: obs.id,
          minDistanceCm,
          bottleneckPosition: routePoint,
          routeSegmentIndex: segIdx,
        });
      }
    }
  }

  return collisions;
}

/**
 * Computes the minimum clearance along a path to all obstacles and optional room boundary walls.
 * Returns narrowest clearance and bottleneck evidence.
 */
export function computeRouteClearance(
  path: readonly Point2D[],
  obstacles: readonly CanonicalObject[],
  roomBoundary?: Polygon2D
): {
  minimumClearanceCm: number;
  bottlenecks: BottleneckEvidence[];
} {
  if (path.length < 2) {
    return { minimumClearanceCm: 0, bottlenecks: [] };
  }

  let globalMin = Infinity;
  const bottlenecks: BottleneckEvidence[] = [];

  for (let segIdx = 0; segIdx < path.length - 1; segIdx++) {
    const segment: Segment2D = { start: path[segIdx], end: path[segIdx + 1] };

    // Check all obstacles
    for (const obs of obstacles) {
      const footprint = deriveWorldFootprint(obs);
      const { minDistanceCm, routePoint } = distanceSegmentToPolygon(segment, footprint);

      if (minDistanceCm < globalMin) {
        globalMin = minDistanceCm;
      }

      bottlenecks.push({
        position: routePoint,
        clearanceCm: minDistanceCm,
        obstacleId: obs.id,
        routeSegmentIndex: segIdx,
      });
    }

    // Check room boundary if provided
    if (roomBoundary && roomBoundary.length >= 3) {
      const edges = polygonEdges(roomBoundary);
      for (const edge of edges) {
        const res = closestPointsBetweenSegments(segment, edge);
        if (res.dist < globalMin) {
          globalMin = res.dist;
        }
        bottlenecks.push({
          position: res.p1,
          clearanceCm: res.dist,
          routeSegmentIndex: segIdx,
        });
      }
    }
  }

  // Sort bottlenecks from narrowest to widest clearance
  bottlenecks.sort((a, b) => a.clearanceCm - b.clearanceCm);

  return {
    minimumClearanceCm: Number.isFinite(globalMin) ? globalMin : 0,
    bottlenecks: bottlenecks.slice(0, 5), // Return top narrowest bottlenecks
  };
}
