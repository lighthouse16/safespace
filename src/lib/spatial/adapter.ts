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
  SpatialFurniture,
  SpatialRoom,
} from "@/lib/spatial-model";

const DEFAULT_ROOM_BOUNDARY: Polygon2D = [
  { x: 0, y: 0 },
  { x: 800, y: 0 },
  { x: 800, y: 600 },
  { x: 0, y: 600 },
];

/**
 * Non-blocking furniture categories that do not obstruct floor walking clearance.
 * Mats are on-floor trip hazards, lights are overhead/wall fixtures, handrails are wall fixtures.
 */
const NON_BLOCKING_CATEGORIES = new Set(["mat", "light", "handrail"]);

/**
 * Converts spatial rooms or bounding vertices into a CanonicalRoom.
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
  let boundary: Polygon2D = DEFAULT_ROOM_BOUNDARY;

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
 * Converts UI MobilityProfileData into CanonicalMobilityProfile with sourced quantities.
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
        referenceId: `PROFILE-${(p.id || "default").toUpperCase()}`,
        verificationStatus: "verified",
      },
    },
    turningDiameterCm: {
      value: p.turningSpaceCm,
      unit: "cm",
      source: {
        type: "clinical-input",
        referenceId: `PROFILE-${(p.id || "default").toUpperCase()}`,
        verificationStatus: "verified",
      },
    },
  };
}
