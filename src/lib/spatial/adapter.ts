import type {
  AidType,
  CanonicalMobilityProfile,
  CanonicalObject,
  CanonicalRoom,
  Point2D,
  Polygon2D,
} from "./schema";
import type {
  MobilityProfileData,
  SpatialDoor,
  SpatialFurniture,
  SpatialRoom,
  SpatialWall,
} from "@/lib/spatial-model";

/**
 * Canonical floor envelope for the Queen Care Clinic demo fixture.
 * Encloses the interior room space [40, 760] × [40, 560] and includes
 * the exterior entrance doorway threshold landing [0, 40] × [190, 340]
 * so routes beginning at the entrance doorway (60, 240) remain within
 * the interior computational envelope without allowing shortcuts into exterior margins.
 */
export const DEMO_CLINIC_ENVELOPE: Polygon2D = [
  { x: 40, y: 40 },
  { x: 760, y: 40 },
  { x: 760, y: 560 },
  { x: 40, y: 560 },
  { x: 40, y: 340 },
  { x: 0, y: 340 },
  { x: 0, y: 190 },
  { x: 40, y: 190 },
];

/**
 * Non-blocking furniture categories that do not obstruct floor walking clearance.
 * Mats are on-floor trip hazards, lights are overhead/wall fixtures, handrails are wall fixtures.
 */
const NON_BLOCKING_CATEGORIES = new Set(["mat", "light", "handrail"]);

/**
 * Converts spatial rooms or bounding vertices into a CanonicalRoom.
 * Explicitly falls back to DEMO_CLINIC_ENVELOPE for demo fixture room arrays or omitted inputs.
 */
export function toCanonicalRoom(
  roomsOrBoundary?:
    | readonly SpatialRoom[]
    | readonly Point2D[]
    | { boundary: readonly Point2D[] }
    | null,
  id = "clinic-room",
  name = "Queen Care Clinic"
): CanonicalRoom {
  let boundary: Polygon2D = DEMO_CLINIC_ENVELOPE;

  const isRoomList =
    Array.isArray(roomsOrBoundary) &&
    roomsOrBoundary.length > 0 &&
    ("width" in roomsOrBoundary[0] || "category" in roomsOrBoundary[0]);

  if (!isRoomList && Array.isArray(roomsOrBoundary) && roomsOrBoundary.length >= 3 && "x" in roomsOrBoundary[0]) {
    boundary = (roomsOrBoundary as readonly Point2D[]).map((p) => ({ x: p.x, y: p.y }));
  } else if (
    roomsOrBoundary &&
    "boundary" in roomsOrBoundary &&
    Array.isArray(roomsOrBoundary.boundary) &&
    roomsOrBoundary.boundary.length >= 3
  ) {
    boundary = (roomsOrBoundary.boundary as readonly Point2D[]).map((p) => ({ x: p.x, y: p.y }));
  }

  return {
    id,
    floorId: "floor-1",
    name,
    boundary,
  };
}

/**
 * Converts UI SpatialFurniture array into CanonicalObject array for routing and clearance.
 * Non-blocking items (mats, lights, handrails) are excluded from physical route collision.
 */
export function toCanonicalObjects(
  furniture: readonly SpatialFurniture[],
  roomId = "clinic-room"
): CanonicalObject[] {
  if (!Array.isArray(furniture)) return [];

  return furniture
    .filter((f) => !NON_BLOCKING_CATEGORIES.has(f.category))
    .map((f) => ({
      id: f.id,
      roomId: f.roomId || roomId,
      name: f.name,
      category: f.category,
      position: {
        x: f.x + f.width / 2,
        y: f.y + f.depth / 2,
      },
      dimensionsCm: {
        width: f.width,
        depth: f.depth,
        height: f.height,
      },
      rotationDeg: f.rotation || 0,
      isFixed: f.isFixed,
      loadBearingSupport: f.isStableSupport,
      confidence: f.detectionConfidence,
    }));
}

/**
 * Converts internal SpatialWall structures into CanonicalObject obstacle polygons for computeRoute,
 * splitting continuous walls around known opening/door spans so doorways remain traversable.
 * Exterior perimeter walls are excluded as they are defined by the canonical room boundary.
 */
export function toCanonicalWallObstacles(
  walls: readonly SpatialWall[],
  doors: readonly SpatialDoor[] = [],
  roomId = "clinic-room"
): CanonicalObject[] {
  if (!Array.isArray(walls)) return [];

  const wallObstacles: CanonicalObject[] = [];

  for (const wall of walls) {
    // Exterior perimeter is constrained by canonical room boundary
    if (wall.isExterior) continue;

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) continue;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    // Detect openings on this wall segment
    const openings: { start: number; end: number }[] = [];
    for (const door of doors) {
      const distToLine = Math.abs(
        (door.position.x - wall.start.x) * nx + (door.position.y - wall.start.y) * ny
      );
      if (distToLine <= wall.thickness + 5) {
        const t1 = (door.position.x - wall.start.x) * ux + (door.position.y - wall.start.y) * uy;
        const t2 = t1 + door.width;
        const openStart = Math.max(0, Math.min(len, Math.min(t1, t2)));
        const openEnd = Math.max(0, Math.min(len, Math.max(t1, t2)));
        if (openEnd - openStart > 1) {
          openings.push({ start: openStart, end: openEnd });
        }
      }
    }

    openings.sort((a, b) => a.start - b.start);

    // Segment solid portions between openings
    const solidSpans: { start: number; end: number }[] = [];
    let cur = 0;
    for (const op of openings) {
      if (op.start > cur + 1) {
        solidSpans.push({ start: cur, end: op.start });
      }
      cur = Math.max(cur, op.end);
    }
    if (cur + 1 < len) {
      solidSpans.push({ start: cur, end: len });
    }

    solidSpans.forEach((span, idx) => {
      const p1 = { x: wall.start.x + ux * span.start, y: wall.start.y + uy * span.start };
      const p2 = { x: wall.start.x + ux * span.end, y: wall.start.y + uy * span.end };
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const pieceLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angleDeg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

      wallObstacles.push({
        id: `wall-obstacle-${wall.id}-${idx}`,
        roomId,
        name: `Wall Segment (${wall.id} part ${idx + 1})`,
        category: "wall",
        position: { x: midX, y: midY },
        dimensionsCm: {
          width: pieceLen,
          depth: wall.thickness,
          height: 240,
        },
        rotationDeg: angleDeg,
        isFixed: true,
        loadBearingSupport: true,
      });
    });
  }

  return wallObstacles;
}

/**
 * Converts UI MobilityProfileData into CanonicalMobilityProfile with truthful unverified provenance.
 * Presets from demo fixtures are marked unverified to avoid claiming clinical or statutory authority.
 */
export function toCanonicalProfile(
  profile: MobilityProfileData | CanonicalMobilityProfile
): CanonicalMobilityProfile {
  if (
    "preferredClearanceCm" in profile &&
    typeof profile.preferredClearanceCm === "object" &&
    profile.preferredClearanceCm !== null
  ) {
    return profile as CanonicalMobilityProfile;
  }

  const p = profile as MobilityProfileData;
  let aidType: AidType = "none";
  if (p.id === "walker") aidType = "rollator-walker";
  else if (p.id === "wheelchair") aidType = "manual-wheelchair";
  else if (p.id === "cane") aidType = "walking-stick";
  else if (p.id === "independent") aidType = "none";
  else if (p.id === "limited-vision") aidType = "none";

  return {
    id: p.id || "profile-default",
    name: p.name || "Default Profile",
    aidType,
    preferredClearanceCm: {
      value: p.minClearanceCm,
      unit: "cm",
      source: {
        type: "clinical-input",
        referenceId: `DEMO-PRESET-${(p.id || "default").toUpperCase()}`,
        verificationStatus: "unverified",
      },
    },
    turningDiameterCm: {
      value: p.turningSpaceCm,
      unit: "cm",
      source: {
        type: "clinical-input",
        referenceId: `DEMO-PRESET-${(p.id || "default").toUpperCase()}`,
        verificationStatus: "unverified",
      },
    },
  };
}
