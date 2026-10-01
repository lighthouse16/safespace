import type { Point2D } from "../schema";
import {
  isValidPoint2D,
  validateCanonicalMobilityProfile,
  validateCanonicalObject,
  validateCanonicalRoom,
} from "../schema";
import {
  distancePointToPolygon,
  distancePointToPolygonBoundary,
  isPointInPolygon,
} from "../geometry/polygons";
import { deriveWorldFootprint } from "../geometry/footprints";
import { polylineLength } from "../geometry/primitives";
import { computeRouteClearance } from "../geometry/clearance";
import {
  DEFAULT_GRID_RESOLUTION_CM,
  buildOccupancyGrid,
} from "./grid";
import { findAStarPath } from "./astar";
import { simplifyLineOfSight } from "./simplification";
import type { RouteRequest, RouteResult } from "./types";

/**
 * Deterministic spatial routing engine.
 * Computes obstacle-avoiding paths respecting room boundaries and mobility envelopes.
 */
export function computeRoute(request: RouteRequest): RouteResult {
  // 1. Basic input presence checks
  if (!request || !request.room || !request.start || !request.end || !request.mobilityProfile) {
    return {
      status: "insufficient-input",
      reason: "Missing mandatory fields in route request (room, start, end, or mobilityProfile)",
    };
  }

  // 2. Validate collection shapes fail-closed before iterating or spreading
  if (request.obstacles !== undefined && !Array.isArray(request.obstacles)) {
    return {
      status: "invalid-geometry",
      reason: "request.obstacles must be an array if supplied",
    };
  }

  if (request.userWaypoints !== undefined && !Array.isArray(request.userWaypoints)) {
    return {
      status: "invalid-geometry",
      reason: "request.userWaypoints must be an array if supplied",
    };
  }

  // 3. Validate grid resolution if supplied
  if (request.gridResolutionCm !== undefined) {
    if (
      typeof request.gridResolutionCm !== "number" ||
      !Number.isFinite(request.gridResolutionCm) ||
      request.gridResolutionCm <= 0
    ) {
      return {
        status: "invalid-geometry",
        reason: "gridResolutionCm must be a positive finite number",
      };
    }
  }

  // 3. Validate geometry coordinates
  if (!isValidPoint2D(request.start)) {
    return {
      status: "invalid-geometry",
      reason: "Start point coordinates must be valid finite numbers",
    };
  }

  if (!isValidPoint2D(request.end)) {
    return {
      status: "invalid-geometry",
      reason: "End point coordinates must be valid finite numbers",
    };
  }

  const roomValidation = validateCanonicalRoom(request.room);
  if (!roomValidation.valid) {
    return {
      status: "invalid-geometry",
      reason: `Invalid room geometry: ${roomValidation.errors.join("; ")}`,
    };
  }

  const profileValidation = validateCanonicalMobilityProfile(request.mobilityProfile);
  if (!profileValidation.valid) {
    return {
      status: "invalid-geometry",
      reason: `Invalid mobility profile: ${profileValidation.errors.join("; ")}`,
    };
  }

  // 4. Validate all obstacles before deriving footprints
  const obstacles = request.obstacles ?? [];
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const obsVal = validateCanonicalObject(obs);
    if (!obsVal.valid) {
      const obsId =
        typeof obs === "object" && obs !== null && "id" in obs
          ? String((obs as { id: unknown }).id)
          : "unknown";
      return {
        status: "invalid-geometry",
        reason: `Invalid obstacle at index ${i} (id: ${obsId}): ${obsVal.errors.join("; ")}`,
      };
    }
  }

  // 5. Verify start and end relative to room boundary
  if (!isPointInPolygon(request.start, request.room.boundary, true)) {
    return {
      status: "start-out-of-bounds",
      reason: "Start point lies outside the walkable room boundary",
    };
  }

  if (!isPointInPolygon(request.end, request.room.boundary, true)) {
    return {
      status: "end-out-of-bounds",
      reason: "End point lies outside the walkable room boundary",
    };
  }

  // 6. Verify start and end relative to actual obstacle footprints
  for (const obs of obstacles) {
    const footprint = deriveWorldFootprint(obs);
    if (isPointInPolygon(request.start, footprint, true)) {
      return {
        status: "start-blocked",
        reason: `Start point is blocked inside obstacle footprint (${obs.id}: ${obs.name})`,
      };
    }
    if (isPointInPolygon(request.end, footprint, true)) {
      return {
        status: "end-blocked",
        reason: `End point is blocked inside obstacle footprint (${obs.id}: ${obs.name})`,
      };
    }
  }

  // 5. Verify intermediate waypoints if provided
  const waypoints = request.userWaypoints ?? [];
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!isValidPoint2D(wp)) {
      return {
        status: "invalid-geometry",
        reason: `Waypoint at index ${i} coordinates must be valid finite numbers`,
      };
    }
    if (!isPointInPolygon(wp, request.room.boundary, true)) {
      return {
        status: "invalid-geometry",
        reason: `Waypoint at index ${i} lies outside the walkable room boundary`,
      };
    }
    for (const obs of obstacles) {
      const footprint = deriveWorldFootprint(obs);
      if (isPointInPolygon(wp, footprint, true)) {
        return {
          status: "unreachable",
          reason: `Waypoint at index ${i} is obstructed by obstacle (${obs.id}: ${obs.name})`,
        };
      }
    }
  }

  // 7. Verify start, end, and waypoints clearance envelope (corridorRadiusCm)
  const clearanceRadiusCm = request.mobilityProfile.preferredClearanceCm.value / 2;

  // Start clearance checks
  const distStartWall = distancePointToPolygonBoundary(request.start, request.room.boundary);
  if (distStartWall < clearanceRadiusCm - 1e-4) {
    return {
      status: "clearance-insufficient",
      reason: `Start point clearance to room boundary (${distStartWall.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
    };
  }
  for (const obs of obstacles) {
    const footprint = deriveWorldFootprint(obs);
    const distStartObs = distancePointToPolygon(request.start, footprint);
    if (distStartObs < clearanceRadiusCm - 1e-4) {
      return {
        status: "clearance-insufficient",
        reason: `Start point clearance to obstacle (${obs.id}: ${obs.name}, ${distStartObs.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
      };
    }
  }

  // End clearance checks
  const distEndWall = distancePointToPolygonBoundary(request.end, request.room.boundary);
  if (distEndWall < clearanceRadiusCm - 1e-4) {
    return {
      status: "clearance-insufficient",
      reason: `End point clearance to room boundary (${distEndWall.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
    };
  }
  for (const obs of obstacles) {
    const footprint = deriveWorldFootprint(obs);
    const distEndObs = distancePointToPolygon(request.end, footprint);
    if (distEndObs < clearanceRadiusCm - 1e-4) {
      return {
        status: "clearance-insufficient",
        reason: `End point clearance to obstacle (${obs.id}: ${obs.name}, ${distEndObs.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
      };
    }
  }

  // Waypoints clearance checks
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const distWpWall = distancePointToPolygonBoundary(wp, request.room.boundary);
    if (distWpWall < clearanceRadiusCm - 1e-4) {
      return {
        status: "clearance-insufficient",
        reason: `Waypoint at index ${i} clearance to room boundary (${distWpWall.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
      };
    }
    for (const obs of obstacles) {
      const footprint = deriveWorldFootprint(obs);
      const distWpObs = distancePointToPolygon(wp, footprint);
      if (distWpObs < clearanceRadiusCm - 1e-4) {
        return {
          status: "clearance-insufficient",
          reason: `Waypoint at index ${i} clearance to obstacle (${obs.id}: ${obs.name}, ${distWpObs.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
        };
      }
    }
  }

  // 8. Build occupancy grid with preferred clearance dilation radius
  // Note: mobilityProfile.turningDiameterCm is validated and preserved in canonical contract,
  // but non-holonomic turning radius constraints are not modeled by this 2D grid pathfinder.
  const resolutionCm = request.gridResolutionCm ?? DEFAULT_GRID_RESOLUTION_CM;
  const routeCheckpoints: Point2D[] = [request.start, ...waypoints, request.end];

  const grid = buildOccupancyGrid(
    request.room,
    obstacles,
    clearanceRadiusCm,
    resolutionCm
  );

  // 9. Route sequentially through checkpoints and simplify each leg
  const simplifiedPath: Point2D[] = [];

  for (let i = 0; i < routeCheckpoints.length - 1; i++) {
    const legStart = routeCheckpoints[i];
    const legEnd = routeCheckpoints[i + 1];

    const legPath = findAStarPath(grid, legStart, legEnd);
    if (!legPath) {
      return {
        status: "unreachable",
        reason: `No traversable path exists between checkpoint ${i} and ${i + 1}`,
      };
    }

    const simplifiedLeg = simplifyLineOfSight(legPath, grid);

    if (i === 0) {
      simplifiedPath.push(...simplifiedLeg);
    } else {
      // Avoid duplicate consecutive checkpoint point
      simplifiedPath.push(...simplifiedLeg.slice(1));
    }
  }

  // 10. Compute real metrics (length, clearance, bottlenecks)
  const pathLengthCm = polylineLength(simplifiedPath);
  const { minimumClearanceCm, bottlenecks } = computeRouteClearance(
    simplifiedPath,
    obstacles,
    request.room.boundary
  );

  // Invariant: RouteSuccessResult must strictly satisfy the requested clearance envelope
  if (minimumClearanceCm < clearanceRadiusCm - 1e-4) {
    return {
      status: "clearance-insufficient",
      reason: `Route minimum clearance (${minimumClearanceCm.toFixed(1)} cm) is less than required corridor radius (${clearanceRadiusCm.toFixed(1)} cm)`,
    };
  }

  return {
    status: "success",
    path: simplifiedPath,
    pathLengthCm,
    minimumClearanceCm,
    bottlenecks,
  };
}
