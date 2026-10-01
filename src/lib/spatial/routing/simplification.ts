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
 * Checks whether a direct line segment between two points is completely clear of blocked cells on grid.
 * Uses exact deterministic grid traversal (Amanatides-Woo / supercover) to inspect every cell
 * crossed or touched by the line segment.
 */
export function isLineOfSightClear(
  p1: Point2D,
  p2: Point2D,
  grid: SpatialGrid
): boolean {
  // Convert world coordinates to continuous normalized cell coordinate space
  // where cell (gx, gy) covers [gx, gx + 1) x [gy, gy + 1).
  const u1 = (p1.x - grid.originX) / grid.resolutionCm + 0.5;
  const v1 = (p1.y - grid.originY) / grid.resolutionCm + 0.5;
  const u2 = (p2.x - grid.originX) / grid.resolutionCm + 0.5;
  const v2 = (p2.y - grid.originY) / grid.resolutionCm + 0.5;

  let gx = Math.floor(u1);
  let gy = Math.floor(v1);
  const endGx = Math.floor(u2);
  const endGy = Math.floor(v2);

  // Check starting cell
  if (!grid.isWalkable(gx, gy)) {
    return false;
  }

  if (gx === endGx && gy === endGy) {
    return true;
  }

  const du = u2 - u1;
  const dv = v2 - v1;

  const stepX = du > 0 ? 1 : du < 0 ? -1 : 0;
  const stepY = dv > 0 ? 1 : dv < 0 ? -1 : 0;

  let tMaxX = Infinity;
  let tDeltaX = Infinity;
  if (stepX > 0) {
    tMaxX = (gx + 1 - u1) / du;
    tDeltaX = 1 / du;
  } else if (stepX < 0) {
    tMaxX = (gx - u1) / du;
    tDeltaX = -1 / du;
  }

  let tMaxY = Infinity;
  let tDeltaY = Infinity;
  if (stepY > 0) {
    tMaxY = (gy + 1 - v1) / dv;
    tDeltaY = 1 / dv;
  } else if (stepY < 0) {
    tMaxY = (gy - v1) / dv;
    tDeltaY = -1 / dv;
  }

  const EPSILON = 1e-9;
  let maxSteps = Math.abs(endGx - gx) + Math.abs(endGy - gy) + 8;

  while (maxSteps-- > 0) {
    if (gx === endGx && gy === endGy) {
      break;
    }

    const diff = tMaxX - tMaxY;

    if (diff < -EPSILON) {
      gx += stepX;
      tMaxX += tDeltaX;
      if (!grid.isWalkable(gx, gy)) {
        return false;
      }
    } else if (diff > EPSILON) {
      gy += stepY;
      tMaxY += tDeltaY;
      if (!grid.isWalkable(gx, gy)) {
        return false;
      }
    } else {
      // Ray passes through a corner point: supercover checks both orthogonal adjacent cells
      if (stepX !== 0 && !grid.isWalkable(gx + stepX, gy)) {
        return false;
      }
      if (stepY !== 0 && !grid.isWalkable(gx, gy + stepY)) {
        return false;
      }
      gx += stepX;
      gy += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
      if (!grid.isWalkable(gx, gy)) {
        return false;
      }
    }

    if (tMaxX >= 1 - EPSILON && tMaxY >= 1 - EPSILON) {
      break;
    }
  }

  // Final check on target cell
  return grid.isWalkable(endGx, endGy);
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
