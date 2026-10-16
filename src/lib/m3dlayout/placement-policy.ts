import type { SpatialFurniture } from "@/lib/spatial-model";
import type { LayoutFrame } from "./scene-adapter";
import type { Polygon2D } from "@/lib/spatial";
import { furnitureToWorldFootprint, findFeasibleFootprintPlacement, type ObstacleFootprint } from "@/lib/spatial/geometry/placement";

/**
 * Placement is a separate, deterministic gate after Colab inference.
 * Never mark an overlapping or out-of-bounds arrangement as generated successfully.
 * These gaps are geometric demo clearances, NOT accessibility compliance checks.
 */
export function placeModelFurniture(
  items: SpatialFurniture[],
  frame: LayoutFrame,
  options?: { roomBoundary?: Polygon2D; fixedObstacles?: readonly ObstacleFootprint[] },
): { furniture: SpatialFurniture[]; unplaced: SpatialFurniture[] } {
  const wallInsetCm = 8;
  const objectGapCm = 6;
  const left = frame.centerX - frame.maxWidthCm / 2 + wallInsetCm;
  const top = frame.centerY - frame.maxDepthCm / 2 + wallInsetCm;
  const right = frame.centerX + frame.maxWidthCm / 2 - wallInsetCm;
  const bottom = frame.centerY + frame.maxDepthCm / 2 - wallInsetCm;
  if (right <= left || bottom <= top) return { furniture: [], unplaced: [...items] };

  const boundary = [
    { x: left, y: top }, { x: right, y: top },
    { x: right, y: bottom }, { x: left, y: bottom },
  ];
  const obstacles: ObstacleFootprint[] = [...(options?.fixedObstacles ?? [])];
  const effectiveBoundary = options?.roomBoundary && options.roomBoundary.length >= 3 ? options.roomBoundary : boundary;
  const accepted = new Map<string, SpatialFurniture>();
  const unplaced: SpatialFurniture[] = [];

  // Larger footprints have fewer valid positions; insert those first.
  const ranked = [...items].sort((a, b) =>
    b.width * b.depth - a.width * a.depth || a.id.localeCompare(b.id),
  );

  for (const item of ranked) {
    if (![item.x, item.y, item.width, item.depth, item.rotation].every(Number.isFinite) ||
        item.width <= 0 || item.depth <= 0) {
      unplaced.push(item);
      continue;
    }
    const preferredPoint = { x: item.x + item.width / 2, y: item.y + item.depth / 2 };
    const placement = findFeasibleFootprintPlacement(
      { width: item.width, depth: item.depth },
      effectiveBoundary,
      obstacles,
      { preferredPoint, rotations: [item.rotation], stepCm: 10 },
    );
    if (!placement) {
      unplaced.push(item);
      continue;
    }

    const positioned: SpatialFurniture = {
      ...item,
      x: placement.position.x - item.width / 2,
      y: placement.position.y - item.depth / 2,
      rotation: placement.rotationDeg,
    };
    accepted.set(item.id, positioned);

    const polygon = furnitureToWorldFootprint(positioned).footprint;
    const xs = polygon.map((point) => point.x);
    const ys = polygon.map((point) => point.y);
    const minX = Math.min(...xs) - objectGapCm;
    const maxX = Math.max(...xs) + objectGapCm;
    const minY = Math.min(...ys) - objectGapCm;
    const maxY = Math.max(...ys) + objectGapCm;
    // Conservative envelope. Prevents collisions for arbitrary yaw angles.
    obstacles.push({
      id: positioned.id,
      footprint: [
        { x: minX, y: minY }, { x: maxX, y: minY },
        { x: maxX, y: maxY }, { x: minX, y: maxY },
      ],
    });
  }

  // Keep the response ordering stable for UI selection / review.
  return {
    furniture: items.filter((item) => accepted.has(item.id)).map((item) => accepted.get(item.id)!),
    unplaced,
  };
}
