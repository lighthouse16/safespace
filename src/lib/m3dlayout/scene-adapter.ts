import type { SpatialFurniture, SpatialRoom } from "@/lib/spatial-model";
import { computePolygonBoundsCm, type Polygon2D } from "@/lib/spatial";
import { titleNameForClass } from "./vocabulary";
import { resolveGeneratedFurniture } from "./collision-layout";

/** JSON body returned by the Colab FastAPI `/generate` route. */
export type M3DGenerateResponse = {
  text?: string;
  class_names?: string[];
  translations?: number[][];
  sizes?: number[][];
  angles?: Array<number | number[]>;
  time_elapsed?: number;
  object_count?: number;
};

export type LayoutFrame = {
  roomId: string;
  centerX: number;
  centerY: number;
  maxWidthCm: number;
  maxDepthCm: number;
};

type PlacedObject = {
  className: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function yawDegrees(angle: number | number[] | undefined): number {
  const raw = Array.isArray(angle) ? angle[0] : angle;
  if (!finite(raw)) return 0;
  const degrees = (raw * 180) / Math.PI;
  return Math.round(((degrees % 360) + 360) % 360);
}

export function furnitureCategoryForClass(className: string): SpatialFurniture["category"] {
  const name = className.toLowerCase();
  if (["toilet", "sink", "bathtub", "shower", "standing_sink"].includes(name)) return "medical-fixture";
  if (name.includes("lamp") || name === "lighting") return "light";
  if (name === "rug") return "mat";
  if (name.includes("plant")) return "plant";
  if (name === "desk" || name === "dressing_table") return "desk";
  if (name.includes("table") || name === "counter") return "table";
  if (name.includes("sofa") || name === "bed" || name === "kids_bed" || name === "seating") return "bench";
  if (name.includes("chair") || name === "stool") return "chair";
  if (
    name.includes("cabinet") ||
    name.includes("shelf") ||
    name === "wardrobe" ||
    name === "nightstand" ||
    name === "tv_stand" ||
    name === "chest_of_drawers"
  ) {
    return "cabinet";
  }
  return "cabinet";
}

function supportsLeaning(category: SpatialFurniture["category"]): boolean {
  return category === "desk" || category === "table" || category === "bench" || category === "cabinet";
}

/**
 * M3DLayout translations are meters with Y up. SafeSpace stores a top-left
 * corner in centimeters on the floor, so floor axes are X and Z.
 */
export function sceneToFurniture(
  scene: M3DGenerateResponse,
  frame: LayoutFrame,
  idPrefix = "m3d",
): SpatialFurniture[] {
  const names = scene.class_names ?? [];
  const count = Math.min(names.length, scene.translations?.length ?? 0, scene.sizes?.length ?? 0);
  const objects: PlacedObject[] = [];

  for (let i = 0; i < count; i += 1) {
    const className = String(names[i] ?? "").toLowerCase();
    if (!className || className === "start" || className === "end") continue;
    const translation = scene.translations?.[i] ?? [];
    const size = scene.sizes?.[i] ?? [];
    if (!finite(translation[0]) || !finite(translation[2]) || !finite(size[0]) || !finite(size[1]) || !finite(size[2])) {
      continue;
    }
    objects.push({
      className,
      centerX: translation[0] * 100,
      centerZ: translation[2] * 100,
      width: Math.max(20, Math.abs(size[0]) * 100),
      depth: Math.max(20, Math.abs(size[2]) * 100),
      height: Math.max(5, Math.abs(size[1]) * 100),
      rotation: yawDegrees(scene.angles?.[i]),
    });
  }

  if (objects.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const object of objects) {
    minX = Math.min(minX, object.centerX - object.width / 2);
    maxX = Math.max(maxX, object.centerX + object.width / 2);
    minZ = Math.min(minZ, object.centerZ - object.depth / 2);
    maxZ = Math.max(maxZ, object.centerZ + object.depth / 2);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanZ = Math.max(maxZ - minZ, 1);
  const scale = Math.min(1, frame.maxWidthCm / spanX, frame.maxDepthCm / spanZ);
  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterZ = (minZ + maxZ) / 2;

  const mapped = objects.map((object, index) => {
    const category = furnitureCategoryForClass(object.className);
    const width = Math.max(20, object.width * scale);
    const depth = Math.max(20, object.depth * scale);
    const centerX = frame.centerX + (object.centerX - bboxCenterX) * scale;
    const centerY = frame.centerY + (object.centerZ - bboxCenterZ) * scale;
    return {
      id: `${idPrefix}-${index}-${object.className}`,
      name: titleNameForClass(object.className),
      code: object.className.toUpperCase(),
      category,
      roomId: frame.roomId,
      x: centerX - width / 2,
      y: centerY - depth / 2,
      width,
      depth,
      height: Math.max(5, object.height * scale),
      rotation: object.rotation,
      isFixed: false,
      isStableSupport: supportsLeaning(category),
      isConfirmed: false,
      detectionConfidence: 0.7,
      notes: "Generated by M3DLayout. Confirm the position before analysis.",
    };
  });

  // The raw model may output intersecting boxes. Apply the same fail-closed
  // geometry policy as the text-driven furniture arranger, never clamp a
  // collision back into the room.
  return resolveGeneratedFurniture(mapped, {
    rect: {
      x: frame.centerX - frame.maxWidthCm / 2,
      y: frame.centerY - frame.maxDepthCm / 2,
      width: frame.maxWidthCm,
      depth: frame.maxDepthCm,
    },
  }).furniture;
}

export function layoutFrameFromWorkspace(input: {
  canonicalBoundary: Polygon2D | null;
  rooms: SpatialRoom[];
}): LayoutFrame {
  if (input.canonicalBoundary && input.canonicalBoundary.length >= 3) {
    const bounds = computePolygonBoundsCm(input.canonicalBoundary);
    return {
      roomId: "user-space",
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2,
      maxWidthCm: Math.max(80, bounds.widthCm - 80),
      maxDepthCm: Math.max(80, bounds.heightCm - 80),
    };
  }
  const room = input.rooms[0];
  if (room) {
    return {
      roomId: room.id,
      centerX: room.x + room.width / 2,
      centerY: room.y + room.depth / 2,
      maxWidthCm: Math.max(80, room.width - 40),
      maxDepthCm: Math.max(80, room.depth - 40),
    };
  }
  return {
    roomId: "room-waiting",
    centerX: 400,
    centerY: 300,
    maxWidthCm: 700,
    maxDepthCm: 500,
  };
}
