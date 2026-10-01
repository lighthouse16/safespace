import type {
  CanonicalMobilityProfile,
  CanonicalObject,
  CanonicalRoom,
  Point2D,
} from "../schema";
import type { BottleneckEvidence } from "../geometry/clearance";

/**
 * Public deterministic route request contract.
 * All spatial coordinates and dimensions are in centimetres (cm).
 */
export interface RouteRequest {
  readonly room: CanonicalRoom;
  readonly obstacles: readonly CanonicalObject[];
  /** Route starting position (cm) in world plan coordinates */
  readonly start: Point2D;
  /** Route destination position (cm) in world plan coordinates */
  readonly end: Point2D;
  /** Mobility profile defining clear width requirement */
  readonly mobilityProfile: CanonicalMobilityProfile;
  /** Optional sequence of ordered intermediate waypoints (cm) */
  readonly userWaypoints?: readonly Point2D[];
  /** Optional grid resolution in centimetres (default: 5 cm) */
  readonly gridResolutionCm?: number;
}

export interface RouteSuccessResult {
  readonly status: "success";
  readonly path: readonly Point2D[];
  readonly pathLengthCm: number;
  readonly minimumClearanceCm: number;
  readonly bottlenecks: readonly BottleneckEvidence[];
}

export type RouteFailureStatus =
  | "unreachable"
  | "start-out-of-bounds"
  | "end-out-of-bounds"
  | "start-blocked"
  | "end-blocked"
  | "invalid-geometry"
  | "insufficient-input";

export interface RouteFailureResult {
  readonly status: RouteFailureStatus;
  readonly reason: string;
}

/**
 * Discriminated union of route computation outcome.
 * Never returns partial or fabricated path when routing fails.
 */
export type RouteResult = RouteSuccessResult | RouteFailureResult;
