import {
  isSimplePolygon,
  polygonArea,
  validatePolygon2D,
  type Polygon2D,
} from "@/lib/spatial";
import type { SpatialFurniture, RouteWaypoint, SpatialWall } from "@/lib/spatial-model";

export interface GeometryValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateSceneGeometry(params: {
  boundary?: Polygon2D | null;
  furniture?: SpatialFurniture[];
  waypoints?: RouteWaypoint[];
  walls?: SpatialWall[];
}): GeometryValidationResult {
  const errors: string[] = [];

  // 1. Boundary validation
  if (params.boundary) {
    const polygonCheck = validatePolygon2D(params.boundary);
    if (!polygonCheck.valid) {
      errors.push(...polygonCheck.errors);
    } else {
      const area = polygonArea(params.boundary);
      if (area <= 0) {
        errors.push(`Boundary polygon area must be positive, got ${area}`);
      }
      if (!isSimplePolygon(params.boundary)) {
        errors.push("Boundary polygon must not be self-intersecting");
      }
    }
  }

  // 2. Furniture validation
  if (params.furniture) {
    for (const f of params.furniture) {
      if (f.width <= 0 || !Number.isFinite(f.width)) {
        errors.push(`Furniture "${f.name || f.id}" width must be positive finite number`);
      }
      if (f.depth <= 0 || !Number.isFinite(f.depth)) {
        errors.push(`Furniture "${f.name || f.id}" depth must be positive finite number`);
      }
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) {
        errors.push(`Furniture "${f.name || f.id}" coordinates must be finite`);
      }
    }
  }

  // 3. Waypoint validation
  if (params.waypoints) {
    for (const wp of params.waypoints) {
      if (!Number.isFinite(wp.x) || !Number.isFinite(wp.y)) {
        errors.push(`Waypoint "${wp.name || wp.id}" coordinates must be finite`);
      }
    }
  }

  // Walls must have physical thickness and two distinct finite endpoints.
  for (const wall of params.walls ?? []) {
    const valid = Number.isFinite(wall?.start?.x) &&
      Number.isFinite(wall?.start?.y) &&
      Number.isFinite(wall?.end?.x) &&
      Number.isFinite(wall?.end?.y) &&
      Number.isFinite(wall?.thickness) &&
      wall.thickness > 0 && wall.thickness <= 200 &&
      Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) >= 1;
    if (!valid) errors.push(`Wall "${wall?.id || "unknown"}" has invalid segment endpoints or thickness`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
