import type { CanonicalObject, CanonicalOpening, Point2D, Polygon2D } from "../schema";
import { deriveWorldFootprint } from "./footprints";
import { polygonIntersectsPolygon } from "./intersections";

export interface ExplicitDoorSwingParams {
  readonly hinge: Point2D;
  readonly radiusCm: number;
  readonly startAngleDeg: number;
  readonly sweepAngleDeg: number;
  readonly segments?: number;
}

/**
 * Computes a polygonal approximation of the swept door arc (circular sector).
 * The resulting polygon begins at the hinge, samples points along the circular arc,
 * and forms a closed 2D polygon.
 */
export function computeDoorSwingSector(params: ExplicitDoorSwingParams): Polygon2D {
  const { hinge, radiusCm, startAngleDeg, sweepAngleDeg, segments = 12 } = params;
  const numSteps = Math.max(4, Math.round(segments));
  const points: Point2D[] = [hinge];

  const startRad = (startAngleDeg * Math.PI) / 180;
  const sweepRad = (sweepAngleDeg * Math.PI) / 180;

  for (let i = 0; i <= numSteps; i++) {
    const angle = startRad + (sweepRad * i) / numSteps;
    points.push({
      x: hinge.x + radiusCm * Math.cos(angle),
      y: hinge.y + radiusCm * Math.sin(angle),
    });
  }

  return points;
}

/**
 * Computes door swing polygon from a CanonicalOpening if swing specifications are present.
 * If swing is not specified, returns an empty polygon.
 */
export function computeOpeningSwingPolygon(
  opening: CanonicalOpening,
  segments = 12
): Polygon2D {
  if (!opening.swing) {
    return [];
  }

  const { hinge, arcDeg, sweepDirection, direction } = opening.swing;
  const radiusCm = opening.clearWidthCm;

  // Determine whether hinge matches opening.start or opening.end
  const isHingeAtStart =
    Math.hypot(opening.start.x - hinge.x, opening.start.y - hinge.y) <= 1e-4;
  const isHingeAtEnd =
    Math.hypot(opening.end.x - hinge.x, opening.end.y - hinge.y) <= 1e-4;

  if (!isHingeAtStart && !isHingeAtEnd) {
    // Hinge matches neither endpoint; do not infer an arbitrary baseline
    return [];
  }

  // If hinge == start: baseline vector = end - hinge
  // If hinge == end:   baseline vector = start - hinge
  const leafEndpoint = isHingeAtStart ? opening.end : opening.start;
  const dx = leafEndpoint.x - hinge.x;
  const dy = leafEndpoint.y - hinge.y;

  const baselineAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Geometric sign convention in canonical coordinates (+x right, +y down):
  // - "clockwise": angle increases (+sweepAngleDeg)
  // - "counterclockwise": angle decreases (-sweepAngleDeg)
  // Optional architectural `direction` is semantic metadata only and does not alter geometry.
  const isClockwise =
    sweepDirection !== undefined
      ? sweepDirection === "clockwise"
      : direction === "inward-right" || direction === "outward-right";
  const sweepAngleDeg = isClockwise ? Math.abs(arcDeg) : -Math.abs(arcDeg);

  return computeDoorSwingSector({
    hinge,
    radiusCm,
    startAngleDeg: baselineAngleDeg,
    sweepAngleDeg,
    segments,
  });
}

/**
 * Tests whether a world object footprint intersects the door swing polygon.
 * Returns purely geometric evidence (boolean collision).
 */
export function testDoorSwingEncroachment(
  swingPolygon: Polygon2D,
  object: CanonicalObject
): boolean {
  if (swingPolygon.length < 3) return false;
  const footprint = deriveWorldFootprint(object);
  return polygonIntersectsPolygon(swingPolygon, footprint);
}
