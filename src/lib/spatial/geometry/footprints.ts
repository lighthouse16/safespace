import type { CanonicalObject, Point2D, Polygon2D } from "../schema";

/**
 * Rotates a 2D point around the origin (0, 0) by angleDeg in screen coordinates (+y down).
 */
export function rotatePoint(p: Point2D, angleDeg: number): Point2D {
  if (angleDeg === 0) return { x: p.x, y: p.y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  };
}

/**
 * Derives the world-space Polygon2D footprint for a CanonicalObject.
 *
 * If `object.footprint` is provided, its vertices are treated as local coordinates
 * relative to the object's anchor/center `object.position`.
 * If omitted, a rectangle of `width × depth` centered at `(0, 0)` is used.
 *
 * Vertices are rotated by `object.rotationDeg` and translated to `object.position`.
 */
export function deriveWorldFootprint(object: CanonicalObject): Polygon2D {
  const { position, dimensionsCm, rotationDeg, footprint } = object;
  const w = dimensionsCm.width;
  const d = dimensionsCm.depth;

  const localVertices: Point2D[] =
    footprint && footprint.length >= 3
      ? [...footprint]
      : [
          { x: -w / 2, y: -d / 2 },
          { x: w / 2, y: -d / 2 },
          { x: w / 2, y: d / 2 },
          { x: -w / 2, y: d / 2 },
        ];

  return localVertices.map((vertex) => {
    const rotated = rotatePoint(vertex, rotationDeg);
    return {
      x: position.x + rotated.x,
      y: position.y + rotated.y,
    };
  });
}
