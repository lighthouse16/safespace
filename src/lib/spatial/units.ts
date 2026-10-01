/**
 * Canonical Spatial Units & Coordinate System Conventions
 *
 * 2D Canonical Plan Space:
 * - Unit: centimetres (cm)
 * - Origin: top-left (0, 0)
 * - +x axis: right
 * - +y axis: down
 *
 * 3D Scene Space:
 * - Unit: metres (m)
 * - Conversion: toMeters(cm) = cm / 100
 */

export const CANONICAL_COORDINATES = Object.freeze({
  unit: "cm",
  origin: "top-left",
  axes: {
    positiveX: "right",
    positiveY: "down",
  },
} as const);

/**
 * Converts centimetres to metres.
 * Canonical conversion rule: toMeters(cm) = cm / 100
 */
export function toMeters(cm: number): number {
  return cm / 100;
}

/**
 * Converts metres to centimetres.
 */
export function toCentimeters(m: number): number {
  return m * 100;
}
