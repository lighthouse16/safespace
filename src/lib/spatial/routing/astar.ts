import type { Point2D } from "../schema";
import { SpatialGrid } from "./grid";

interface AStarNode {
  readonly index: number;
  readonly gx: number;
  readonly gy: number;
  g: number;
  h: number;
  f: number;
  parentIndex: number;
}

const SQRT2 = Math.SQRT2;

/**
 * Deterministic fixed 8-neighbour offsets and costs.
 * Stable ordering: North, East, South, West, NE, SE, SW, NW.
 */
const NEIGHBOURS: ReadonlyArray<{
  readonly dx: number;
  readonly dy: number;
  readonly cost: number;
}> = [
  { dx: 0, dy: -1, cost: 1 }, // N
  { dx: 1, dy: 0, cost: 1 }, // E
  { dx: 0, dy: 1, cost: 1 }, // S
  { dx: -1, dy: 0, cost: 1 }, // W
  { dx: 1, dy: -1, cost: SQRT2 }, // NE
  { dx: 1, dy: 1, cost: SQRT2 }, // SE
  { dx: -1, dy: 1, cost: SQRT2 }, // SW
  { dx: -1, dy: -1, cost: SQRT2 }, // NW
];

/**
 * Admissible Octile distance heuristic for 8-connected grid.
 */
function octileHeuristic(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Deterministic binary min-heap priority queue.
 * Strict tie-breaking:
 * 1. Lower f-score
 * 2. Lower h-score
 * 3. Lower gy
 * 4. Lower gx
 */
class DeterministicMinHeap {
  private readonly heap: AStarNode[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(node: AStarNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  private compare(a: AStarNode, b: AStarNode): number {
    if (Math.abs(a.f - b.f) > 1e-9) return a.f - b.f;
    if (Math.abs(a.h - b.h) > 1e-9) return a.h - b.h;
    if (a.gy !== b.gy) return a.gy - b.gy;
    return a.gx - b.gx;
  }

  private bubbleUp(n: number): void {
    const element = this.heap[n];
    while (n > 0) {
      const parentN = Math.floor((n - 1) / 2);
      const parent = this.heap[parentN];
      if (this.compare(element, parent) >= 0) break;
      this.heap[parentN] = element;
      this.heap[n] = parent;
      n = parentN;
    }
  }

  private sinkDown(n: number): void {
    const length = this.heap.length;
    const element = this.heap[n];

    while (true) {
      const child2N = (n + 1) * 2;
      const child1N = child2N - 1;
      let swap: number | null = null;

      if (child1N < length) {
        const child1 = this.heap[child1N];
        if (this.compare(child1, element) < 0) {
          swap = child1N;
        }
      }

      if (child2N < length) {
        const child2 = this.heap[child2N];
        if (
          this.compare(
            child2,
            swap === null ? element : this.heap[child1N]
          ) < 0
        ) {
          swap = child2N;
        }
      }

      if (swap === null) break;
      this.heap[n] = this.heap[swap];
      this.heap[swap] = element;
      n = swap;
    }
  }
}

/**
 * Finds shortest path on a 2D SpatialGrid using deterministic A*.
 * Returns world-space Point2D[] (grid cell centers) or null if unreachable.
 */
export function findAStarPath(
  grid: SpatialGrid,
  start: Point2D,
  end: Point2D
): Point2D[] | null {
  const startGrid = grid.worldToGrid(start);
  const endGrid = grid.worldToGrid(end);

  const startIdx = grid.getIndex(startGrid.gx, startGrid.gy);
  const endIdx = grid.getIndex(endGrid.gx, endGrid.gy);

  if (startIdx === endIdx) {
    return [{ ...start }, { ...end }];
  }

  if (!grid.isInsideGrid(startGrid.gx, startGrid.gy)) return null;
  if (!grid.isInsideGrid(endGrid.gx, endGrid.gy)) return null;

  // Grid node tracking arrays
  const totalCells = grid.cols * grid.rows;
  const gScore = new Float64Array(totalCells).fill(Infinity);
  const parentMap = new Int32Array(totalCells).fill(-1);
  const closedSet = new Uint8Array(totalCells);

  const openHeap = new DeterministicMinHeap();

  const startH = octileHeuristic(
    startGrid.gx,
    startGrid.gy,
    endGrid.gx,
    endGrid.gy
  );
  gScore[startIdx] = 0;

  openHeap.push({
    index: startIdx,
    gx: startGrid.gx,
    gy: startGrid.gy,
    g: 0,
    h: startH,
    f: startH,
    parentIndex: -1,
  });

  while (openHeap.size > 0) {
    const current = openHeap.pop()!;

    if (current.index === endIdx) {
      // Reconstruct path
      const pathIndices: number[] = [];
      let currIdx = current.index;
      while (currIdx !== -1) {
        pathIndices.push(currIdx);
        currIdx = parentMap[currIdx];
      }
      pathIndices.reverse();

      const worldPath: Point2D[] = [start];
      // Skip duplicate start if identical to first waypoint
      for (let i = 1; i < pathIndices.length - 1; i++) {
        const idx = pathIndices[i];
        const gx = idx % grid.cols;
        const gy = Math.floor(idx / grid.cols);
        worldPath.push(grid.gridToWorld(gx, gy));
      }
      worldPath.push(end);

      return worldPath;
    }

    if (closedSet[current.index] === 1) continue;
    closedSet[current.index] = 1;

    for (const { dx, dy, cost } of NEIGHBOURS) {
      const ngx = current.gx + dx;
      const ngy = current.gy + dy;

      if (!grid.isInsideGrid(ngx, ngy)) continue;
      if (!grid.isWalkable(ngx, ngy)) continue;

      // Prevent cutting across blocked diagonal corners
      if (dx !== 0 && dy !== 0) {
        const ortho1Walkable = grid.isWalkable(current.gx + dx, current.gy);
        const ortho2Walkable = grid.isWalkable(current.gx, current.gy + dy);
        if (!ortho1Walkable || !ortho2Walkable) {
          continue; // Diagonal blocked by corner
        }
      }

      const nIndex = grid.getIndex(ngx, ngy);
      if (closedSet[nIndex] === 1) continue;

      const tentativeG = current.g + cost;
      if (tentativeG < gScore[nIndex] - 1e-9) {
        gScore[nIndex] = tentativeG;
        parentMap[nIndex] = current.index;
        const h = octileHeuristic(ngx, ngy, endGrid.gx, endGrid.gy);
        openHeap.push({
          index: nIndex,
          gx: ngx,
          gy: ngy,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parentIndex: current.index,
        });
      }
    }
  }

  return null; // No path found (unreachable)
}
