import type { Point2D } from "../schema";
import type { SpatialGrid } from "./grid";

/**
 * Removes redundant consecutive collinear points along a polyline.
 */
export function simplifyCollinear(
  points: readonly Point2D[],
  tolerance = 1e-4
): Point2D[] {
  if (points.length <= 2) return [...points];

  const result: Point2D[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const cross = dx1 * dy2 - dy1 * dx2;
    const dot = dx1 * dx2 + dy1 * dy2;

    // If collinear and moving in the same direction, skip curr
    if (Math.abs(cross) < tolerance && dot > 0) {
      continue;
    }

    result.push(curr);
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Checks whether a direct line between two points is completely clear of blocked cells on grid.
 */
export function isLineOfSightClear(
  p1: Point2D,
  p2: Point2D,
  grid: SpatialGrid
): boolean {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (dist === 0) return true;

  // Sample along segment at half resolution intervals
  const stepSize = Math.max(1, grid.resolutionCm / 2);
  const steps = Math.ceil(dist / stepSize);

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const samplePt: Point2D = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };

    const g = grid.worldToGrid(samplePt);
    if (!grid.isWalkable(g.gx, g.gy)) {
      return false;
    }
  }

  return true;
}

/**
 * Simplifies a polyline path using deterministic line-of-sight string pulling.
 * Greedily advances to the furthest visible waypoint along the path that has
 * an unobstructed line of sight.
 */
export function simplifyLineOfSight(
  points: readonly Point2D[],
  grid: SpatialGrid
): Point2D[] {
  if (points.length <= 2) return [...points];

  const simplified: Point2D[] = [points[0]];
  let currentIndex = 0;

  while (currentIndex < points.length - 1) {
    let furthestIndex = currentIndex + 1;

    // Scan backwards from the end to find the furthest unobstructed point
    for (let testIndex = points.length - 1; testIndex > currentIndex + 1; testIndex--) {
      if (isLineOfSightClear(points[currentIndex], points[testIndex], grid)) {
        furthestIndex = testIndex;
        break;
      }
    }

    simplified.push(points[furthestIndex]);
    currentIndex = furthestIndex;
  }

  return simplifyCollinear(simplified);
}
