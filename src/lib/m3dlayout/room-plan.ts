import type { Polygon2D } from "@/lib/spatial";
import type { RoomCategory, SpatialRoom, SpatialWall } from "@/lib/spatial-model";
import type { LayoutFrame } from "./scene-adapter";
import type { PromptTranslation, RoomType } from "./prompt-agent";

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

export function composeRoomFrames(requests: PromptTranslation[], outer?: OuterBounds): GeneratedPlan | null {
  const ready = requests.filter((request) => request.ready && request.roomType);
  if (ready.length === 0) return null;

  const specs = ready.map((request) => ROOM_SPEC[request.roomType as RoomType] ?? ROOM_SPEC["living room"]);
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
