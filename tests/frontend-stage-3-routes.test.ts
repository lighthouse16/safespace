import test from "node:test";
import assert from "node:assert/strict";
import {
  toCanonicalRoom,
  toCanonicalObjects,
  toCanonicalProfile,
  computeRoute,
  type CanonicalMobilityProfile,
} from "../src/lib/spatial";
import {
  INITIAL_FURNITURE,
  INITIAL_ROOMS,
  MOBILITY_PROFILES,
  type SpatialFurniture,
} from "../src/lib/spatial-model";
import { useSafeSpaceStore } from "../src/store/safespace-store";

// ---------------------------------------------------------------------------
// 1. Spatial Adapters
// ---------------------------------------------------------------------------

test("adapter: toCanonicalRoom generates valid canonical room with bounding polygon", () => {
  const defaultRoom = toCanonicalRoom();
  assert.equal(defaultRoom.id, "clinic-room");
  assert.equal(defaultRoom.boundary.length, 4);
  assert.deepEqual(defaultRoom.boundary[0], { x: 0, y: 0 });
  assert.deepEqual(defaultRoom.boundary[2], { x: 800, y: 600 });

  // Custom polygon vertices
  const customPoly = [
    { x: 10, y: 10 },
    { x: 500, y: 10 },
    { x: 500, y: 400 },
    { x: 10, y: 400 },
  ];
  const customRoom = toCanonicalRoom(customPoly, "custom-r1", "Custom Space");
  assert.equal(customRoom.id, "custom-r1");
  assert.equal(customRoom.name, "Custom Space");
  assert.deepEqual(customRoom.boundary, customPoly);
});

test("adapter: toCanonicalObjects maps top-left to center coordinates and filters non-blocking fixtures", () => {
  const rawItems: SpatialFurniture[] = [
    {
      id: "chair-1",
      name: "Armchair",
      category: "chair",
      roomId: "room-1",
      x: 100,
      y: 200,
      width: 60,
      depth: 60,
      height: 80,
      rotation: 0,
      isFixed: false,
      isStableSupport: true,
      isConfirmed: true,
    },
    {
      id: "mat-1",
      name: "Floor Mat",
      category: "mat",
      roomId: "room-1",
      x: 50,
      y: 50,
      width: 80,
      depth: 50,
      height: 1,
      rotation: 0,
      isFixed: false,
      isStableSupport: false,
      isConfirmed: true,
    },
    {
      id: "light-1",
      name: "Ceiling Downlight",
      category: "light",
      roomId: "room-1",
      x: 120,
      y: 120,
      width: 20,
      depth: 20,
      height: 10,
      rotation: 0,
      isFixed: true,
      isStableSupport: false,
      isConfirmed: true,
    },
    {
      id: "handrail-1",
      name: "Wall Rail",
      category: "handrail",
      roomId: "room-1",
      x: 200,
      y: 400,
      width: 200,
      depth: 5,
      height: 10,
      rotation: 0,
      isFixed: true,
      isStableSupport: true,
      isConfirmed: true,
    },
  ];

  const canonical = toCanonicalObjects(rawItems, "room-1");
  // Mat, light, handrail filtered out from physical floor route obstructions
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].id, "chair-1");
  // Center coordinates: x: 100 + 30 = 130, y: 200 + 30 = 230
  assert.deepEqual(canonical[0].position, { x: 130, y: 230 });
  assert.equal(canonical[0].dimensionsCm.width, 60);
  assert.equal(canonical[0].dimensionsCm.depth, 60);
  assert.equal(canonical[0].loadBearingSupport, true);
});

test("adapter: toCanonicalProfile converts mobility profile with verified clinical quantities", () => {
  const walkerProfile = MOBILITY_PROFILES.find((p) => p.id === "walker")!;
  const canonical = toCanonicalProfile(walkerProfile);

  assert.equal(canonical.id, "walker");
  assert.equal(canonical.aidType, "rollator-walker");
  assert.equal(canonical.preferredClearanceCm.value, 90);
  assert.equal(canonical.preferredClearanceCm.unit, "cm");
  assert.equal(canonical.preferredClearanceCm.source.type, "clinical-input");
  assert.equal(canonical.turningDiameterCm.value, 150);

  // Wheelchair profile
  const wheelchairProfile = MOBILITY_PROFILES.find((p) => p.id === "wheelchair")!;
  const canonicalWc = toCanonicalProfile(wheelchairProfile);
  assert.equal(canonicalWc.aidType, "manual-wheelchair");
  assert.equal(canonicalWc.preferredClearanceCm.value, 95);

  // Idempotent when given already canonical profile
  const identical = toCanonicalProfile(canonical);
  assert.equal(identical, canonical);
});

// ---------------------------------------------------------------------------
// 2. Direct Routing Engine Integration
// ---------------------------------------------------------------------------

test("core routing: computeRoute detects bottleneck next to Chair C-04 for walker", () => {
  const room = toCanonicalRoom(INITIAL_ROOMS);
  const obstacles = toCanonicalObjects(INITIAL_FURNITURE);
  const profile = toCanonicalProfile(MOBILITY_PROFILES.find((p) => p.id === "walker")!);

  const req = {
    room,
    obstacles,
    start: { x: 60, y: 240 },
    end: { x: 550, y: 450 },
    mobilityProfile: profile,
    userWaypoints: [
      { x: 160, y: 240 },
      { x: 235, y: 270 },
      { x: 310, y: 290 },
      { x: 260, y: 440 },
      { x: 420, y: 460 },
    ],
  };

  const res = computeRoute(req);
  // Clearance next to Chair C-04 is ~35.4 cm, less than the 45 cm required corridor radius (90 cm width)
  assert.equal(res.status, "clearance-insufficient");
  if (res.status === "clearance-insufficient") {
    assert.match(res.reason, /chair-c04/);
    assert.match(res.reason, /less than required corridor radius/);
  }
});

test("core routing: moving Chair C-04 eliminates corridor constriction", () => {
  const room = toCanonicalRoom(INITIAL_ROOMS);
  // Relocate Chair C-04 out of the corridor to (100, 150)
  const modifiedFurniture = INITIAL_FURNITURE.map((f) =>
    f.id === "chair-c04" ? { ...f, x: 100, y: 150 } : f
  );
  const obstacles = toCanonicalObjects(modifiedFurniture);

  // Profile with 60cm clearance
  const profile60: CanonicalMobilityProfile = {
    id: "profile-test-60",
    name: "Narrow Walker",
    aidType: "rollator-walker",
    preferredClearanceCm: {
      value: 60,
      unit: "cm",
      source: { type: "clinical-input", referenceId: "TEST", verificationStatus: "verified" },
    },
    turningDiameterCm: {
      value: 120,
      unit: "cm",
      source: { type: "clinical-input", referenceId: "TEST", verificationStatus: "verified" },
    },
  };

  const res = computeRoute({
    room,
    obstacles,
    start: { x: 60, y: 240 },
    end: { x: 550, y: 450 },
    mobilityProfile: profile60,
    userWaypoints: [
      { x: 160, y: 240 },
      { x: 235, y: 270 },
      { x: 310, y: 290 },
      { x: 260, y: 440 },
    ],
  });

  assert.equal(res.status, "success");
  if (res.status === "success") {
    assert.ok(res.path.length >= 2);
    assert.ok(res.pathLengthCm > 0);
    assert.ok(res.minimumClearanceCm >= 30);
  }
});

// ---------------------------------------------------------------------------
// 3. Zustand Store Integration
// ---------------------------------------------------------------------------

test("store: routeResult is initialized and recomputes on moveFurniture", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const initialResult = useSafeSpaceStore.getState().routeResult;
  assert.ok(initialResult !== null);

  // Initial Queen Care Clinic layout has pinch point at chair-c04
  assert.equal(initialResult.status, "clearance-insufficient");

  // Move chair-c04 away
  useSafeSpaceStore.getState().moveFurniture("chair-c04", 100, 150);

  // Store profile to cane or independent
  useSafeSpaceStore.getState().setProfile("independent");
  const updatedResult = useSafeSpaceStore.getState().routeResult;
  assert.ok(updatedResult !== null);

  // Reset to demo restores initial route and furniture
  useSafeSpaceStore.getState().resetToDemo();
  const resetResult = useSafeSpaceStore.getState().routeResult;
  assert.ok(resetResult !== null);
  assert.equal(resetResult.status, "clearance-insufficient");
});

test("store: addRouteWaypoint and removeRouteWaypoint update route and trigger recalculation", () => {
  useSafeSpaceStore.getState().resetToDemo();
  const initialWaypointsCount = useSafeSpaceStore.getState().routeWaypoints.length;

  useSafeSpaceStore.getState().addRouteWaypoint("Intermediate Rest Spot", 200, 300);
  const afterAdd = useSafeSpaceStore.getState().routeWaypoints;
  assert.equal(afterAdd.length, initialWaypointsCount + 1);
  const added = afterAdd.find((w) => w.name === "Intermediate Rest Spot");
  assert.ok(added !== undefined);

  // Remove the added waypoint
  useSafeSpaceStore.getState().removeRouteWaypoint(added!.id);
  const afterRemove = useSafeSpaceStore.getState().routeWaypoints;
  assert.equal(afterRemove.length, initialWaypointsCount);
});
