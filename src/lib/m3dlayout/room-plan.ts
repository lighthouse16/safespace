import type { Polygon2D } from "@/lib/spatial";
import { isPointInPolygon } from "@/lib/spatial/geometry/polygons";
import type { Point2D, RoomCategory, SpatialRoom, SpatialWall } from "@/lib/spatial-model";
import type { LayoutFrame } from "./scene-adapter";
import type { PromptTranslation, RoomType } from "./prompt-agent";
import { pieceFootprint } from "./arrange";

export type FramedRoom = {
  id: string;
  name: string;
  roomType: string;
  prompt: string;
  note: string;
  frame: LayoutFrame;
  rect: { x: number; y: number; width: number; depth: number };
};

export type GeneratedPlan = {
  rooms: SpatialRoom[];
  walls: SpatialWall[];
  boundary: Polygon2D;
  framed: FramedRoom[];
};

const ROOM_SPEC: Record<RoomType, { width: number; depth: number; label: string; color: string; category: RoomCategory }> = {
  "living room": { width: 500, depth: 420, label: "Living room", color: "#f3eee4", category: "living" },
  kitchen: { width: 360, depth: 300, label: "Kitchen", color: "#f6f1d4", category: "kitchen" },
  bathroom: { width: 240, depth: 220, label: "Bathroom", color: "#e4f0f3", category: "bathroom" },
  bedroom: { width: 420, depth: 380, label: "Bedroom", color: "#f1eaf4", category: "bedroom" },
  "dining room": { width: 400, depth: 320, label: "Dining room", color: "#f7eee6", category: "dining" },
  office: { width: 340, depth: 300, label: "Office", color: "#e8eef2", category: "office" },
};

const ORIGIN = 40;
const INSET = 28;
const WALL = 12;
const DOOR = 90;

function slug(room: string, index: number): string {
  return `m3d-room-${index}-${room.replace(/\s+/g, "-")}`;
}

function gapSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < DOOR + 80) {
    return [{ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }];
  }
  const inset = (length - DOOR) / 2 / length;
  const point = (t: number) => ({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  return [
    { start: point(0), end: point(inset) },
    { start: point(1 - inset), end: point(1) },
  ];
}

export type OuterBounds = { x: number; y: number; width: number; depth: number };
export type ComposeOptions = { polygon?: Polygon2D; bounds?: OuterBounds };

type GridCell = {
  col: number;
  row: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  area: number;
};

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    if (unique.length === 0 || Math.abs(value - unique[unique.length - 1]) > 0.5) unique.push(value);
  }
  return unique;
}

function isOrthogonal(polygon: Polygon2D): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    const next = polygon[(index + 1) % polygon.length];
    const dx = Math.abs(next.x - polygon[index].x);
    const dy = Math.abs(next.y - polygon[index].y);
    if (dx > 0.5 && dy > 0.5) return false;
  }
  return true;
}

function interiorCells(polygon: Polygon2D): GridCell[] {
  const boundsX = uniqueSorted(polygon.map((point) => point.x));
  const boundsY = uniqueSorted(polygon.map((point) => point.y));
  const minX = boundsX[0];
  const maxX = boundsX[boundsX.length - 1];
  const minY = boundsY[0];
  const maxY = boundsY[boundsY.length - 1];
  const span = Math.max(maxX - minX, maxY - minY);
  const step = Math.max(24, Math.min(80, span / 12));
  const xs = isOrthogonal(polygon)
    ? boundsX
    : Array.from({ length: Math.ceil((maxX - minX) / step) + 1 }, (_, index) => Math.min(maxX, minX + index * step));
  const ys = isOrthogonal(polygon)
    ? boundsY
    : Array.from({ length: Math.ceil((maxY - minY) / step) + 1 }, (_, index) => Math.min(maxY, minY + index * step));
  const cells: GridCell[] = [];
  for (let col = 0; col < xs.length - 1; col += 1) {
    for (let row = 0; row < ys.length - 1; row += 1) {
      const x0 = xs[col];
      const x1 = xs[col + 1];
      const y0 = ys[row];
      const y1 = ys[row + 1];
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      const center = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      const corners = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      const orthogonal = isOrthogonal(polygon);
      const inside = orthogonal
        ? isPointInPolygon(center, polygon, true)
        : corners.every((corner) => isPointInPolygon(corner, polygon, true));
      if (!inside) continue;
      cells.push({
        col,
        row,
        x0,
        y0,
        x1,
        y1,
        cx: center.x,
        cy: center.y,
        area: (x1 - x0) * (y1 - y0),
      });
    }
  }
  return cells;
}

function cellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`;
}

function contentWeight(request: PromptTranslation, spec: (typeof ROOM_SPEC)[RoomType]): number {
  const pieces = request.pieces ?? [];
  if (pieces.length === 0) return spec.width * spec.depth;
  let area = 0;
  for (const piece of pieces) {
    const size = pieceFootprint(piece.className);
    const count = Math.max(1, Math.min(piece.count, 10));
    const around = piece.className.includes("chair") ? 2 : 2.6;
    area += size.width * size.depth * count * around;
  }
  return Math.max(area, 20000);
}

function assignByShare(
  cells: GridCell[],
  indices: number[],
  weights: number[],
  roomOffset: number,
  owners: number[],
) {
  if (indices.length === 0) return;
  if (weights.length <= 1 || indices.length === 1) {
    indices.forEach((index) => {
      owners[index] = roomOffset;
    });
    return;
  }
  const share = weights[0] / weights.reduce((sum, weight) => sum + weight, 0);
  const minX = Math.min(...indices.map((index) => cells[index].x0));
  const maxX = Math.max(...indices.map((index) => cells[index].x1));
  const minY = Math.min(...indices.map((index) => cells[index].y0));
  const maxY = Math.max(...indices.map((index) => cells[index].y1));
  const axis: "x" | "y" = maxX - minX >= maxY - minY ? "x" : "y";
  const edges = uniqueSorted(
    indices.flatMap((index) => (axis === "x" ? [cells[index].x0, cells[index].x1] : [cells[index].y0, cells[index].y1])),
  );
  const total = indices.reduce((sum, index) => sum + cells[index].area, 0);
  let bestScore = Infinity;
  let bestLeft: number[] = [];
  let bestRight: number[] = [];
  for (const edge of edges) {
    const left = indices.filter((index) => (axis === "x" ? cells[index].cx : cells[index].cy) < edge);
    const right = indices.filter((index) => (axis === "x" ? cells[index].cx : cells[index].cy) >= edge);
    if (left.length === 0 || right.length === 0) continue;
    const leftArea = left.reduce((sum, index) => sum + cells[index].area, 0);
    const score = Math.abs(leftArea / total - share);
    if (score < bestScore) {
      bestScore = score;
      bestLeft = left;
      bestRight = right;
    }
  }
  if (bestLeft.length === 0 || bestRight.length === 0) {
    const ordered = [...indices].sort((a, b) => cells[a].cx - cells[b].cx || cells[a].cy - cells[b].cy);
    const midpoint = Math.max(1, Math.min(ordered.length - 1, Math.round(ordered.length * share)));
    bestLeft = ordered.slice(0, midpoint);
    bestRight = ordered.slice(midpoint);
  }
  assignByShare(cells, bestLeft, [weights[0]], roomOffset, owners);
  assignByShare(cells, bestRight, weights.slice(1), roomOffset + 1, owners);
}

function ownersByContent(cells: GridCell[], weights: number[]): number[] {
  const owners = cells.map(() => 0);
  assignByShare(cells, cells.map((_, index) => index), weights, 0, owners);
  return owners;
}

function simplifyOutline(points: Point2D[]): Point2D[] {
  const cleaned: Point2D[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (previous && Math.abs(previous.x - point.x) < 0.5 && Math.abs(previous.y - point.y) < 0.5) continue;
    cleaned.push(point);
  }
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first && last && Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) cleaned.pop();
  const simplified: Point2D[] = [];
  for (let index = 0; index < cleaned.length; index += 1) {
    const previous = cleaned[(index + cleaned.length - 1) % cleaned.length];
    const current = cleaned[index];
    const next = cleaned[(index + 1) % cleaned.length];
    const collinear =
      (Math.abs(previous.x - current.x) < 0.5 && Math.abs(current.x - next.x) < 0.5) ||
      (Math.abs(previous.y - current.y) < 0.5 && Math.abs(current.y - next.y) < 0.5);
    if (!collinear) simplified.push(current);
  }
  return simplified.length >= 3 ? simplified : cleaned;
}

function outlineOf(cells: GridCell[]): Point2D[] {
  const open = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const forward = `${x1},${y1}>${x2},${y2}`;
    const back = `${x2},${y2}>${x1},${y1}`;
    if (open.has(back)) open.delete(back);
    else open.set(forward, { x1, y1, x2, y2 });
  };
  for (const cell of cells) {
    add(cell.x0, cell.y0, cell.x1, cell.y0);
    add(cell.x1, cell.y0, cell.x1, cell.y1);
    add(cell.x1, cell.y1, cell.x0, cell.y1);
    add(cell.x0, cell.y1, cell.x0, cell.y0);
  }
  const next = new Map<string, Array<{ x: number; y: number }>>();
  for (const edge of open.values()) {
    const key = `${edge.x1},${edge.y1}`;
    const list = next.get(key) ?? [];
    list.push({ x: edge.x2, y: edge.y2 });
    next.set(key, list);
  }
  const loops: Point2D[][] = [];
  const unused = new Set(open.keys());
  for (const edge of open.values()) {
    const startKey = `${edge.x1},${edge.y1}>${edge.x2},${edge.y2}`;
    if (!unused.has(startKey)) continue;
    const start = { x: edge.x1, y: edge.y1 };
    const loop = [start];
    let current = start;
    for (let step = 0; step < open.size + 2; step += 1) {
      const options = next.get(`${current.x},${current.y}`);
      const following = options?.pop();
      if (!following) break;
      unused.delete(`${current.x},${current.y}>${following.x},${following.y}`);
      if (following.x === start.x && following.y === start.y) break;
      loop.push(following);
      current = following;
    }
    if (loop.length >= 3) loops.push(simplifyOutline(loop));
  }
  return loops.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))[0] ?? [];
}

function signedArea(points: Point2D[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return area / 2;
}

function largestRectangle(cells: GridCell[]): { x: number; y: number; width: number; depth: number } {
  const xAt = new Map<number, { x0: number; x1: number }>();
  const yAt = new Map<number, { y0: number; y1: number }>();
  const present = new Set<string>();
  for (const cell of cells) {
    xAt.set(cell.col, { x0: cell.x0, x1: cell.x1 });
    yAt.set(cell.row, { y0: cell.y0, y1: cell.y1 });
    present.add(cellKey(cell));
  }
  const minCol = Math.min(...cells.map((cell) => cell.col));
  const maxCol = Math.max(...cells.map((cell) => cell.col));
  const minRow = Math.min(...cells.map((cell) => cell.row));
  const maxRow = Math.max(...cells.map((cell) => cell.row));
  const heights = Array.from({ length: maxCol - minCol + 1 }, () => 0);
  let best = { area: 0, x: cells[0].x0, y: cells[0].y0, width: cells[0].x1 - cells[0].x0, depth: cells[0].y1 - cells[0].y0 };
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const index = col - minCol;
      heights[index] = present.has(`${col},${row}`) ? heights[index] + 1 : 0;
    }
    for (let start = 0; start < heights.length; start += 1) {
      let minHeight = heights[start];
      for (let end = start; end < heights.length && heights[end] > 0; end += 1) {
        minHeight = Math.min(minHeight, heights[end]);
        const col0 = minCol + start;
        const col1 = minCol + end;
        const row0 = row - minHeight + 1;
        const left = xAt.get(col0);
        const right = xAt.get(col1);
        const top = yAt.get(row0);
        const bottom = yAt.get(row);
        if (!left || !right || !top || !bottom) continue;
        const width = right.x1 - left.x0;
        const depth = bottom.y1 - top.y0;
        if (width * depth > best.area) best = { area: width * depth, x: left.x0, y: top.y0, width, depth };
      }
    }
  }
  return { x: best.x, y: best.y, width: best.width, depth: best.depth };
}

function partitionWalls(cells: GridCell[], owners: number[]): SpatialWall[] {
  const byKey = new Map(cells.map((cell, index) => [cellKey(cell), index]));
  const horizontal = new Map<number, Array<{ x0: number; x1: number }>>();
  const vertical = new Map<number, Array<{ y0: number; y1: number }>>();
  const addSpan = (bucket: Map<number, Array<{ x0: number; x1: number }>>, at: number, x0: number, x1: number) => {
    const list = bucket.get(at) ?? [];
    list.push({ x0, x1 });
    bucket.set(at, list);
  };
  cells.forEach((cell, index) => {
    const right = byKey.get(`${cell.col + 1},${cell.row}`);
    if (right !== undefined && owners[right] !== owners[index]) {
      const list = vertical.get(cell.x1) ?? [];
      list.push({ y0: cell.y0, y1: cell.y1 });
      vertical.set(cell.x1, list);
    }
    const below = byKey.get(`${cell.col},${cell.row + 1}`);
    if (below !== undefined && owners[below] !== owners[index]) addSpan(horizontal, cell.y1, cell.x0, cell.x1);
  });
  const merge = (spans: Array<{ x0: number; x1: number }>) => {
    const ordered = [...spans].sort((a, b) => a.x0 - b.x0);
    const merged: Array<{ x0: number; x1: number }> = [];
    for (const span of ordered) {
      const last = merged[merged.length - 1];
      if (last && span.x0 <= last.x1 + 0.5) last.x1 = Math.max(last.x1, span.x1);
      else merged.push({ ...span });
    }
    return merged;
  };
  const lines: Array<{ start: Point2D; end: Point2D }> = [];
  for (const [y, spans] of horizontal) {
    for (const span of merge(spans)) lines.push(...gapSegments(span.x0, y, span.x1, y));
  }
  for (const [x, spans] of vertical) {
    for (const span of merge(spans.map((span) => ({ x0: span.y0, x1: span.y1 })))) {
      lines.push(...gapSegments(x, span.x0, x, span.x1));
    }
  }
  return lines.map((line, index) => ({
    id: `m3d-wall-${index}`,
    start: line.start,
    end: line.end,
    thickness: WALL,
    isExterior: false,
  }));
}

function composeInsidePolygon(ready: PromptTranslation[], specs: Array<(typeof ROOM_SPEC)[RoomType]>, polygon: Polygon2D): GeneratedPlan | null {
  const cells = interiorCells(polygon);
  if (cells.length === 0) return null;
  const weights = ready.map((request, index) => contentWeight(request, specs[index]));
  const owners = ownersByContent(cells, weights);
  const groups = ready.map((_, index) => cells.filter((_, cellIndex) => owners[cellIndex] === index));
  const framed: FramedRoom[] = ready.map((request, index) => {
    const spec = specs[index];
    const group = groups[index].length > 0 ? groups[index] : [cells[index % cells.length]];
    const rect = largestRectangle(group);
    const id = slug(request.roomType, index);
    return {
      id,
      name: spec.label,
      roomType: request.roomType,
      prompt: request.prompt,
      note: request.note,
      rect,
      frame: {
        roomId: id,
        centerX: rect.x + rect.width / 2,
        centerY: rect.y + rect.depth / 2,
        maxWidthCm: Math.max(80, rect.width - INSET * 2),
        maxDepthCm: Math.max(80, rect.depth - INSET * 2),
      },
    };
  });
  const rooms: SpatialRoom[] = framed.map((room, index) => {
    const group = groups[index].length > 0 ? groups[index] : [cells[index % cells.length]];
    return {
      id: room.id,
      name: room.name,
      category: specs[index].category,
      x: room.rect.x,
      y: room.rect.y,
      width: room.rect.width,
      depth: room.rect.depth,
      color: specs[index].color,
      lightLevelLux: room.roomType === "bathroom" ? 180 : 320,
      polygon: outlineOf(group),
    };
  });
  return { rooms, walls: partitionWalls(cells, owners), boundary: polygon, framed };
}

export function composeRoomFrames(requests: PromptTranslation[], options?: ComposeOptions): GeneratedPlan | null {
  const ready = requests.filter((request) => request.ready && request.roomType);
  if (ready.length === 0) return null;

  const specs = ready.map((request) => ROOM_SPEC[request.roomType as RoomType] ?? ROOM_SPEC["living room"]);
  if (options?.polygon && options.polygon.length >= 3) {
    const inside = composeInsidePolygon(ready, specs, options.polygon);
    if (inside) return inside;
  }
  const outer = options?.bounds;
  const primary = specs[0];
  const rest = specs.slice(1);
  const rightWidth = rest.reduce((widest, spec) => Math.max(widest, spec.width), 0);
  const rightDepth = rest.reduce((sum, spec) => sum + spec.depth, 0);
  const leftDepth = Math.max(primary.depth, rightDepth || primary.depth);
  const extra = rest.length > 0 && rightDepth < leftDepth ? leftDepth - rightDepth : 0;
  const rightDepths = rest.map((spec) => spec.depth + (rightDepth > 0 ? (extra * spec.depth) / rightDepth : 0));
  const totalWidth = primary.width + (rest.length > 0 ? rightWidth : 0);
  const totalDepth = leftDepth;

  const rects = [
    { x: ORIGIN, y: ORIGIN, width: primary.width, depth: leftDepth },
    ...rest.map((spec, index) => {
      const y = ORIGIN + rightDepths.slice(0, index).reduce((sum, depth) => sum + depth, 0);
      return {
        x: ORIGIN + primary.width,
        y,
        width: rightWidth,
        depth: rightDepths[index],
      };
    }),
  ];

  if (outer && outer.width > 0 && outer.depth > 0 && totalWidth > 0 && totalDepth > 0) {
    const scale = Math.min(outer.width / totalWidth, outer.depth / totalDepth);
    const offsetX = outer.x + (outer.width - totalWidth * scale) / 2;
    const offsetY = outer.y + (outer.depth - totalDepth * scale) / 2;
    for (const rect of rects) {
      rect.x = offsetX + (rect.x - ORIGIN) * scale;
      rect.y = offsetY + (rect.y - ORIGIN) * scale;
      rect.width *= scale;
      rect.depth *= scale;
    }
  }

  const framed: FramedRoom[] = ready.map((request, index) => {
    const spec = specs[index];
    const rect = rects[index];
    const id = slug(request.roomType, index);
    return {
      id,
      name: spec.label,
      roomType: request.roomType,
      prompt: request.prompt,
      note: request.note,
      rect,
      frame: {
        roomId: id,
        centerX: rect.x + rect.width / 2,
        centerY: rect.y + rect.depth / 2,
        maxWidthCm: Math.max(80, rect.width - INSET * 2),
        maxDepthCm: Math.max(80, rect.depth - INSET * 2),
      },
    };
  });

  const rooms: SpatialRoom[] = framed.map((room, index) => ({
    id: room.id,
    name: room.name,
    category: specs[index].category,
    x: room.rect.x,
    y: room.rect.y,
    width: room.rect.width,
    depth: room.rect.depth,
    color: specs[index].color,
    lightLevelLux: room.roomType === "bathroom" ? 180 : 320,
  }));

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.depth));
  const boundary: Polygon2D = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];

  const solid = (x1: number, y1: number, x2: number, y2: number) => [{ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }];
  const lines: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [
    ...solid(minX, minY, maxX, minY),
    ...solid(maxX, minY, maxX, maxY),
    ...solid(maxX, maxY, minX, maxY),
    ...solid(minX, maxY, minX, minY),
  ];
  if (rects.length > 1) {
    const splitX = rects[1].x;
    lines.push(...gapSegments(splitX, minY, splitX, maxY));
    for (let index = 2; index < rects.length; index += 1) {
      const y = rects[index].y;
      lines.push(...gapSegments(splitX, y, maxX, y));
    }
  }

  const walls: SpatialWall[] = lines.map((line, index) => ({
    id: `m3d-wall-${index}`,
    start: line.start,
    end: line.end,
    thickness: WALL,
    isExterior: index < 4,
  }));

  return { rooms, walls, boundary, framed };
}
