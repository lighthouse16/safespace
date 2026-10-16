import type { Polygon2D } from "@/lib/spatial";
import type { SpatialFurniture } from "@/lib/spatial-model";
import {
  findFeasibleFootprintPlacement,
  furnitureToWorldFootprint,
  isValidFootprintPlacement,
  type ObstacleFootprint,
} from "@/lib/spatial/geometry/placement";
import { polygonIntersectsPolygon } from "@/lib/spatial/geometry/intersections";

type Rect = { x: number; y: number; width: number; depth: number };

export type CollisionFreeLayout = {
  furniture: SpatialFurniture[];
  roomBoundary: Polygon2D;
};

/**
 * Fail-closed spatial post-processor for ALL generated room furniture.
 * Every item must fit. Nothing is silently clipped, deleted, or stacked.
 * Uses the same rotated footprints as the SafeSpace geometry engine.
 * The solver's sampling grid is internal — the UI's freehand calibration is unchanged.
 */
export function resolveGeneratedFurniture(
  proposed: readonly SpatialFurniture[],
  options: {
    rect: Rect;
    roomBoundary?: Polygon2D;
    obstacles?: readonly ObstacleFootprint[];
    clearanceCm?: number;
  },
): CollisionFreeLayout {
  const rect = options.rect;
  const margin = 12;
  const clearanceCm = Math.max(0, options.clearanceCm ?? 3);

  if (![rect.x, rect.y, rect.width, rect.depth].every(Number.isFinite) ||
      rect.width <= margin * 2 || rect.depth <= margin * 2) {
    throw new Error("The room is too small to place furniture.");
  }
  const rectangle: Polygon2D = [
    { x: rect.x + margin, y: rect.y + margin },
    { x: rect.x + rect.width - margin, y: rect.y + margin },
    { x: rect.x + rect.width - margin, y: rect.y + rect.depth - margin },
    { x: rect.x + margin, y: rect.y + rect.depth - margin },
  ];
  const boundary = options.roomBoundary && options.roomBoundary.length >= 3
    ? options.roomBoundary : rectangle;
  if (proposed.length > 100) {
    throw new Error("Too many objects in one room. Split the room into smaller requests.");
  }

  const invalid = proposed.find((item) =>
    ![item.x, item.y, item.width, item.depth, item.rotation].every(Number.isFinite) ||
    item.width <= 0 || item.depth <= 0,
  );
  if (invalid) throw new Error(`Invalid dimensions for ${invalid.name}. The layout was not applied.`);

  // Large items first, but preserve output order after placement. Deterministic
  // fallback order avoids random layouts when the user repeats the same request.
  const ranked = proposed
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => (b.item.width * b.item.depth) - (a.item.width * a.item.depth) ||
      a.originalIndex - b.originalIndex);
  const accepted: SpatialFurniture[] = [];
  const occupied: ObstacleFootprint[] = [...(options.obstacles ?? [])];

  for (const { item } of ranked) {
    const desired = { x: item.x + item.width / 2, y: item.y + item.depth / 2 };
    const dims = { width: item.width, depth: item.depth };
    const rotations = [item.rotation];
    const placement = findFeasibleFootprintPlacement(dims, boundary, occupied, {
      preferredPoint: desired,
      rotations,
      stepCm: 7,
    });
    if (!placement) {
      throw new Error(`Cannot fit ${item.name} without overlapping another item, a wall, or the room boundary. Use fewer objects or enlarge the room. No layout was applied.`);
    }
    const next: SpatialFurniture = {
      ...item,
      x: placement.position.x - item.width / 2,
      y: placement.position.y - item.depth / 2,
      rotation: placement.rotationDeg,
    };

    // Check the full footprint one final time; not just the axis-aligned
    // view box. Rotation is important in 2D and 3D.
    const candidate = { position: placement.position, dimensionsCm: dims, rotationDeg: next.rotation };
    if (!isValidFootprintPlacement(candidate, boundary, occupied)) {
      throw new Error("Could not validate the generated furniture position. No layout was applied.");
    }
    accepted.push(next);

    // Padding also prevents edge-touching and visible model clipping. The
    // padded AABB is deliberately conservative for rotated furniture.
    const footprint = furnitureToWorldFootprint(next).footprint;
    const minX = Math.min(...footprint.map((point) => point.x)) - clearanceCm;
    const minY = Math.min(...footprint.map((point) => point.y)) - clearanceCm;
    const maxX = Math.max(...footprint.map((point) => point.x)) + clearanceCm;
    const maxY = Math.max(...footprint.map((point) => point.y)) + clearanceCm;
    occupied.push({
      id: next.id,
      footprint: [
        { x: minX, y: minY }, { x: maxX, y: minY },
        { x: maxX, y: maxY }, { x: minX, y: maxY },
      ],
    });
  }

  // Explicit pairwise audit before returning, independent of greedy search.
  for (let a = 0; a < accepted.length; a++) {
    for (let b = a + 1; b < accepted.length; b++) {
      const left = furnitureToWorldFootprint(accepted[a]).footprint;
      const right = furnitureToWorldFootprint(accepted[b]).footprint;
      if (polygonIntersectsPolygon(left, right)) {
        throw new Error("Collision remained after layout generation. No layout was applied.");
      }
    }
  }

  const arrangedById = new Map(accepted.map((item) => [item.id, item]));
  if (arrangedById.size !== proposed.length) {
    throw new Error("Duplicate furniture IDs; cannot safely generate this layout.");
  }
  return {
    furniture: proposed.map((item) => arrangedById.get(item.id)!),
    roomBoundary: boundary,
  };
}
