/**
 * SafeSpace Canonical Spatial & Routing Module
 * Single public interface for Stage 3 geometry and pathfinding.
 */

// Units & Coordinates
export {
  CANONICAL_COORDINATES,
  toCentimeters,
  toMeters,
} from "./units";

// Canonical Domain Types & Validation
export type {
  AidType,
  BoundingBox2D,
  CanonicalMobilityProfile,
  CanonicalObject,
  CanonicalOpening,
  CanonicalRoom,
  CanonicalRoute,
  DoorSwingSpec,
  DoorSweepDirection,
  DoorSemanticDirection,
  ObjectDimensionsCm,
  Point2D,
  Polygon2D,
  RoutePurpose,
  Segment2D,
  SourcedQuantity,
  ThresholdSource,
  UUID,
  ValidationResult,
} from "./schema";

export {
  isValidPoint2D,
  validateCanonicalMobilityProfile,
  validateCanonicalObject,
  validateCanonicalOpening,
  validateCanonicalRoom,
  validatePolygon2D,
  validateSourcedQuantity,
} from "./schema";

// Geometry Primitives & Intersections
export {
  boundingBox,
  distancePointToPoint,
  distancePointToSegment,
  distanceSegmentToSegment,
  expandBoundingBox,
  polylineLength,
} from "./geometry/primitives";

export {
  distancePointToPolygon,
  distancePointToPolygonBoundary,
  isPointInPolygon,
  isPointOnPolygonBoundary,
  polygonArea,
  polygonEdges,
  polygonSignedArea,
} from "./geometry/polygons";

export {
  polygonIntersectsPolygon,
  segmentIntersectionPoint,
  segmentIntersectsPolygon,
  segmentIntersectsSegment,
} from "./geometry/intersections";

export {
  deriveWorldFootprint,
  rotatePoint,
} from "./geometry/footprints";

export {
  computeDoorSwingSector,
  computeOpeningSwingPolygon,
  testDoorSwingEncroachment,
} from "./geometry/door-swing";

export type {
  ExplicitDoorSwingParams,
} from "./geometry/door-swing";

export {
  computeRouteClearance,
  distanceSegmentToPolygon,
  testCorridorCollisions,
} from "./geometry/clearance";

export type {
  BottleneckEvidence,
  CorridorObstacleCollision,
} from "./geometry/clearance";

// Routing Engine
export {
  computeRoute,
} from "./routing/route-engine";

export {
  DEFAULT_GRID_RESOLUTION_CM,
  SpatialGrid,
  buildOccupancyGrid,
} from "./routing/grid";

export {
  findAStarPath,
} from "./routing/astar";

export {
  isLineOfSightClear,
  simplifyCollinear,
  simplifyLineOfSight,
} from "./routing/simplification";

export type {
  RouteFailureResult,
  RouteFailureStatus,
  RouteRequest,
  RouteResult,
  RouteSuccessResult,
} from "./routing/types";

// Domain Adapters
export {
  DEMO_CLINIC_ENVELOPE,
  toCanonicalObjects,
  toCanonicalProfile,
  toCanonicalRoom,
  toCanonicalWallObstacles,
} from "./adapter";
