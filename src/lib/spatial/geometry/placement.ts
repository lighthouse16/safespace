import type { CanonicalObject, Point2D, Polygon2D } from "../schema";
import { deriveWorldFootprint } from "./footprints";
import { isFootprintContainedInBoundary, polygonIntersectsPolygon } from "./intersections";
import { computePolygonBoundsCm } from "../intake-conversion";
import { distancePointToPoint } from "./primitives";

export interface PlacementCandidate {
  position: Point2D;
  dimensionsCm: { width: number; depth: number };
  rotationDeg: number;
}

export interface ObstacleFootprint {
  id?: string;
  footprint: Polygon2D;
}

/**
 * Derives the world-space Polygon2D footprint for a UI SpatialFurniture item
 * accounting for its center position and rotation angle.
 */
export function furnitureToWorldFootprint(f: {
  id?: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation?: number;
}): ObstacleFootprint {
  return {
    id: f.id,
    footprint: deriveWorldFootprint({
      id: f.id || "furniture-fp",
      roomId: "user-space",
      name: "furniture",
      category: "furniture",
      position: {
        x: f.x + f.width / 2,
        y: f.y + f.depth / 2,
      },
      dimensionsCm: {
        width: f.width,
        depth: f.depth,
      },
      rotationDeg: f.rotation || 0,
      isFixed: false,
    }),
  };
}

/**
 * Converts a SpatialWall into a rectangular obstacle footprint based on its line segment and thickness.
 */
export function wallToObstacleFootprint(wall: {
  id?: string;
  start: Point2D;
  end: Point2D;
  thickness: number;
}): ObstacleFootprint {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) {
    return {
      id: wall.id,
      footprint: [wall.start, wall.start, wall.start],
    };
  }
  const halfT = Math.max(wall.thickness / 2, 2);
  const nx = (-dy / len) * halfT;
  const ny = (dx / len) * halfT;
  return {
    id: wall.id,
    footprint: [
      { x: wall.start.x + nx, y: wall.start.y + ny },
      { x: wall.end.x + nx, y: wall.end.y + ny },
      { x: wall.end.x - nx, y: wall.end.y - ny },
      { x: wall.start.x - nx, y: wall.start.y - ny },
    ],
  };
}

/**
 * Converts a SpatialDoor into an obstacle footprint accounting for its leaf and position.
 */
export function doorToObstacleFootprint(door: {
  id?: string;
  position: Point2D;
  width: number;
  swingDeg?: number;
}): ObstacleFootprint {
  const halfW = Math.max(door.width / 2, 10);
  const depth = 15;
  return {
    id: door.id,
    footprint: [
      { x: door.position.x - halfW, y: door.position.y - depth / 2 },
      { x: door.position.x + halfW, y: door.position.y - depth / 2 },
      { x: door.position.x + halfW, y: door.position.y + depth / 2 },
      { x: door.position.x - halfW, y: door.position.y + depth / 2 },
    ],
  };
}

/**
 * Validates whether a proposed furniture footprint is strictly contained within
 * the room boundary and does not collide with any existing furniture or physical obstacles.
 */
export function isValidFootprintPlacement(
  candidate: PlacementCandidate,
  roomBoundary: Polygon2D | null,
  obstacles: readonly ObstacleFootprint[],
  ignoreId?: string
): boolean {
  const dummyObj: CanonicalObject = {
    id: ignoreId || "candidate",
    roomId: "user-space",
    name: "candidate",
    category: "furniture",
    position: candidate.position,
    dimensionsCm: candidate.dimensionsCm,
    rotationDeg: candidate.rotationDeg,
    isFixed: false,
  };
  const fp = deriveWorldFootprint(dummyObj);

  // 1. Boundary containment check if boundary is defined
  if (roomBoundary && roomBoundary.length >= 3) {
    if (!isFootprintContainedInBoundary(fp, roomBoundary)) {
      return false;
    }
  }

  // 2. Collision check against existing obstacles
  for (const obs of obstacles) {
    if (obs.id && obs.id === ignoreId) continue;
    if (polygonIntersectsPolygon(fp, obs.footprint)) {
      return false;
    }
  }

  return true;
}

/**
 * Searches for a collision-free placement position for a furniture item within the room boundary.
 * Tests preferred location first, then performs deterministic bounded search.
 * Returns null if the item cannot fit without violating boundaries or colliding with fixtures.
 */
export function findFeasibleFootprintPlacement(
  dimensionsCm: { width: number; depth: number },
  roomBoundary: Polygon2D,
  existingObstacles: readonly ObstacleFootprint[],
  options?: {
    preferredPoint?: Point2D;
    stepCm?: number;
    rotations?: number[];
  }
): { position: Point2D; rotationDeg: number } | null {
  if (!roomBoundary || roomBoundary.length < 3) return null;

  const rotations = options?.rotations ?? [0, 90, 180, 270];

  // 1. Fast-path: Check preferredPoint directly if provided
  if (options?.preferredPoint) {
    for (const rot of rotations) {
      const candidate: PlacementCandidate = {
        position: options.preferredPoint,
        dimensionsCm,
        rotationDeg: rot,
      };
      if (isValidFootprintPlacement(candidate, roomBoundary, existingObstacles)) {
        return { position: options.preferredPoint, rotationDeg: rot };
      }
    }
  }

  // 2. Bounded search within room boundary extent
  const bounds = computePolygonBoundsCm(roomBoundary);
  const step = options?.stepCm ?? 20;

  // Search expanding outwards from preferredPoint or center
  const center: Point2D = options?.preferredPoint ?? {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };

  let bestMatch: { position: Point2D; rotationDeg: number; dist: number } | null = null;

  for (const rot of rotations) {
    // Width and depth along axes based on rotation
    const marginX = (rot === 90 || rot === 270 ? dimensionsCm.depth : dimensionsCm.width) / 2;
    const marginY = (rot === 90 || rot === 270 ? dimensionsCm.width : dimensionsCm.depth) / 2;

    for (let x = bounds.minX + marginX; x <= bounds.maxX - marginX; x += step) {
      for (let y = bounds.minY + marginY; y <= bounds.maxY - marginY; y += step) {
        const pos: Point2D = { x: Math.round(x), y: Math.round(y) };
        const candidate: PlacementCandidate = {
          position: pos,
          dimensionsCm,
          rotationDeg: rot,
        };

        if (isValidFootprintPlacement(candidate, roomBoundary, existingObstacles)) {
          const dist = distancePointToPoint(pos, center);
          if (!bestMatch || dist < bestMatch.dist) {
            bestMatch = { position: pos, rotationDeg: rot, dist };
            // If very close to center, accept immediately
            if (dist < step) {
              return { position: pos, rotationDeg: rot };
            }
          }
        }
      }
    }
  }

  return bestMatch ? { position: bestMatch.position, rotationDeg: bestMatch.rotationDeg } : null;
}
