import type { Point } from "./editor-model";

export type DragBounds = {
  planWidth: number;
  planDepth: number;
  itemWidth: number;
  itemDepth: number;
  grid?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Snap top-left model coordinates, then keep the full footprint inside the plan. */
export function snapAndClampPosition(position: Point, bounds: DragBounds): Point {
  const grid = bounds.grid ?? 5;
  const snap = (value: number) => Math.round(value / grid) * grid;

  return {
    x: clamp(snap(position.x), 0, bounds.planWidth - bounds.itemWidth),
    y: clamp(snap(position.y), 0, bounds.planDepth - bounds.itemDepth),
  };
}
