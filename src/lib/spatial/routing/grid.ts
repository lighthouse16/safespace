import type { CanonicalObject, CanonicalRoom, Point2D } from "../schema";
import { boundingBox, expandBoundingBox } from "../geometry/primitives";
import { distancePointToPolygon, isPointInPolygon } from "../geometry/polygons";
import { deriveWorldFootprint } from "../geometry/footprints";

export const DEFAULT_GRID_RESOLUTION_CM = 5;

export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly originX: number;
  readonly originY: number;
  readonly resolutionCm: number;
  private readonly data: Uint8Array;

  constructor(
    originX: number,
    originY: number,
    widthCm: number,
    heightCm: number,
    resolutionCm: number = DEFAULT_GRID_RESOLUTION_CM
  ) {
    if (
      typeof resolutionCm !== "number" ||
      !Number.isFinite(resolutionCm) ||
      resolutionCm <= 0
    ) {
      throw new Error(
        `SpatialGrid resolutionCm must be a positive finite number, received: ${resolutionCm}`
      );
    }
    this.originX = originX;
    this.originY = originY;
    this.resolutionCm = resolutionCm;
    this.cols = Math.max(1, Math.ceil(widthCm / resolutionCm) + 1);
    this.rows = Math.max(1, Math.ceil(heightCm / resolutionCm) + 1);
    this.data = new Uint8Array(this.cols * this.rows);
  }

  getIndex(gx: number, gy: number): number {
    return gy * this.cols + gx;
  }

  isInsideGrid(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows;
  }

  isWalkable(gx: number, gy: number): boolean {
    if (!this.isInsideGrid(gx, gy)) return false;
    return this.data[this.getIndex(gx, gy)] === 0;
  }

  setBlocked(gx: number, gy: number, blocked: boolean): void {
    if (this.isInsideGrid(gx, gy)) {
      this.data[this.getIndex(gx, gy)] = blocked ? 1 : 0;
    }
  }

  worldToGrid(p: Point2D): { gx: number; gy: number } {
    return {
      gx: Math.round((p.x - this.originX) / this.resolutionCm),
      gy: Math.round((p.y - this.originY) / this.resolutionCm),
    };
  }

  gridToWorld(gx: number, gy: number): Point2D {
    return {
      x: this.originX + gx * this.resolutionCm,
      y: this.originY + gy * this.resolutionCm,
    };
  }
}

/**
 * Builds an occupancy grid for a room and set of obstacles.
 *
 * @param room Canonical room containing boundary Polygon2D
 * @param obstacles Obstacles to rasterize
 * @param clearanceRadiusCm Corridor dilation radius (preferredClearanceCm / 2)
 * @param resolutionCm Grid cell size (default 5 cm)
 * @param start World start point (cm)
 * @param end World end point (cm)
 */
export function buildOccupancyGrid(
  room: CanonicalRoom,
  obstacles: readonly CanonicalObject[],
  clearanceRadiusCm: number,
  resolutionCm: number = DEFAULT_GRID_RESOLUTION_CM,
  start?: Point2D,
  end?: Point2D
): SpatialGrid {
  const roomBounds = boundingBox(room.boundary);
  // Expand grid slightly around room bounds
  const expanded = expandBoundingBox(roomBounds, resolutionCm * 2);
  const widthCm = expanded.maxX - expanded.minX;
  const heightCm = expanded.maxY - expanded.minY;

  const grid = new SpatialGrid(
    expanded.minX,
    expanded.minY,
    widthCm,
    heightCm,
    resolutionCm
  );

  // 1. Mark cells outside room boundary as blocked
  for (let gy = 0; gy < grid.rows; gy++) {
    for (let gx = 0; gx < grid.cols; gx++) {
      const worldPt = grid.gridToWorld(gx, gy);
      if (!isPointInPolygon(worldPt, room.boundary, true)) {
        grid.setBlocked(gx, gy, true);
      }
    }
  }

  // 2. Mark obstacles dilated by clearance radius
  for (const obs of obstacles) {
    const footprint = deriveWorldFootprint(obs);
    const obsBounds = boundingBox(footprint);
    const dilatedBounds = expandBoundingBox(obsBounds, clearanceRadiusCm + resolutionCm);

    const minGrid = grid.worldToGrid({ x: dilatedBounds.minX, y: dilatedBounds.minY });
    const maxGrid = grid.worldToGrid({ x: dilatedBounds.maxX, y: dilatedBounds.maxY });

    const startGx = Math.max(0, minGrid.gx);
    const endGx = Math.min(grid.cols - 1, maxGrid.gx);
    const startGy = Math.max(0, minGrid.gy);
    const endGy = Math.min(grid.rows - 1, maxGrid.gy);

    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const pt = grid.gridToWorld(gx, gy);
        const dist = distancePointToPolygon(pt, footprint);
        if (dist <= clearanceRadiusCm) {
          grid.setBlocked(gx, gy, true);
        }
      }
    }
  }

  // 3. Ensure start and end cells are walkable if they do not lie inside an actual obstacle footprint
  if (start) {
    const sg = grid.worldToGrid(start);
    let startInsideObs = false;
    for (const obs of obstacles) {
      if (isPointInPolygon(start, deriveWorldFootprint(obs), true)) {
        startInsideObs = true;
        break;
      }
    }
    if (!startInsideObs && isPointInPolygon(start, room.boundary, true)) {
      grid.setBlocked(sg.gx, sg.gy, false);
    }
  }

  if (end) {
    const eg = grid.worldToGrid(end);
    let endInsideObs = false;
    for (const obs of obstacles) {
      if (isPointInPolygon(end, deriveWorldFootprint(obs), true)) {
        endInsideObs = true;
        break;
      }
    }
    if (!endInsideObs && isPointInPolygon(end, room.boundary, true)) {
      grid.setBlocked(eg.gx, eg.gy, false);
    }
  }

  return grid;
}
