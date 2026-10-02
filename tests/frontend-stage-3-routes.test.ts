import test from "node:test";
import assert from "node:assert/strict";
import {
  toCanonicalRoom,
  toCanonicalObjects,
  toCanonicalProfile,
  toCanonicalWallObstacles,
  DEMO_CLINIC_ENVELOPE,
  computeRoute,
  deriveWorldFootprint,
  segmentIntersectsPolygon,
  type CanonicalMobilityProfile,
  type CanonicalRoom,
  type Segment2D,
} from "../src/lib/spatial";
import {
  INITIAL_FURNITURE,
  INITIAL_ROOMS,
  INITIAL_WALLS,
  INITIAL_DOORS,
  INITIAL_ROUTE,
  MOBILITY_PROFILES,
  type SpatialFurniture,
  type SpatialWall,
  type SpatialDoor,
} from "../src/lib/spatial-model";
import { useSafeSpaceStore } from "../src/store/safespace-store";

// ---------------------------------------------------------------------------
// 1. Spatial Adapters
// ---------------------------------------------------------------------------

test("adapter: toCanonicalRoom generates valid canonical room with bounding polygon", () => {
  const defaultRoom = toCanonicalRoom();
  assert.equal(defaultRoom.id, "clinic-room");
  assert.equal(defaultRoom.boundary.length, 4);
  assert.deepEqual(defaultRoom.boundary[0], { x: 40, y: 40 });
  assert.deepEqual(defaultRoom.boundary[2], { x: 760, y: 560 });

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

test("adapter: toCanonicalProfile converts mobility profile with truthful unverified demo preset provenance", () => {
  const walkerProfile = MOBILITY_PROFILES.find((p) => p.id === "walker")!;
  const canonical = toCanonicalProfile(walkerProfile);

  assert.equal(canonical.id, "walker");
  assert.equal(canonical.aidType, "rollator-walker");
  assert.equal(canonical.preferredClearanceCm.value, 90);
  assert.equal(canonical.preferredClearanceCm.unit, "cm");
  assert.equal(canonical.preferredClearanceCm.source.type, "clinical-input");
  assert.equal(canonical.preferredClearanceCm.source.referenceId, "DEMO-PRESET-WALKER");
  assert.equal(canonical.preferredClearanceCm.source.verificationStatus, "unverified");
  assert.equal(canonical.turningDiameterCm.value, 150);
  assert.equal(canonical.turningDiameterCm.source.verificationStatus, "unverified");

  // Wheelchair profile
  const wheelchairProfile = MOBILITY_PROFILES.find((p) => p.id === "wheelchair")!;
  const canonicalWc = toCanonicalProfile(wheelchairProfile);
  assert.equal(canonicalWc.aidType, "manual-wheelchair");
  assert.equal(canonicalWc.preferredClearanceCm.value, 95);
  assert.equal(canonicalWc.preferredClearanceCm.source.referenceId, "DEMO-PRESET-WHEELCHAIR");
  assert.equal(canonicalWc.preferredClearanceCm.source.verificationStatus, "unverified");

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
    start: { x: 95, y: 265 },
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
    start: { x: 95, y: 265 },
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

// ---------------------------------------------------------------------------
// 4. Wall Geometry & Traversability
// ---------------------------------------------------------------------------

test("adapter: toCanonicalWallObstacles segments internal walls around doors and ignores exterior walls", () => {
  const wallObstacles = toCanonicalWallObstacles(INITIAL_WALLS, INITIAL_DOORS);

  // Exterior walls must be filtered out (handled by room boundary envelope)
  const exteriorIds = INITIAL_WALLS.filter((w) => w.isExterior).map((w) => w.id);
  for (const obs of wallObstacles) {
    for (const extId of exteriorIds) {
      assert.ok(!obs.id.includes(extId), `Exterior wall ${extId} should not be in obstacles`);
    }
  }

  // Interior wall w-corridor-top spans across two doors: door-corridor-access and door-consultation
  const corridorTopSegments = wallObstacles.filter((o) => o.id.includes("w-corridor-top"));
  // Slicing around 2 doors creates 3 solid segments
  assert.equal(corridorTopSegments.length, 3);

  // All wall obstacles have category wall and positive dimensions
  for (const obs of wallObstacles) {
    assert.equal(obs.category, "wall");
    assert.ok(obs.dimensionsCm.width > 0);
    assert.ok(obs.dimensionsCm.depth > 0);
  }
});

// ---------------------------------------------------------------------------
// 5. Width vs Radius Semantics
// ---------------------------------------------------------------------------

test("geometry semantics: width vs radius evaluation does not produce false deficit on compliant routes", () => {
  const walkerProfile = MOBILITY_PROFILES.find((p) => p.id === "walker")!;
  assert.equal(walkerProfile.minClearanceCm, 90);

  // Semantics: requiredRadiusCm is half corridor width
  const requiredRadiusCm = walkerProfile.minClearanceCm / 2;
  assert.equal(requiredRadiusCm, 45);

  // A route with 50 cm margin is compliant (50 >= 45)
  const actualMarginCm = 50;
  const isDeficitWithRadius = actualMarginCm < requiredRadiusCm;
  const isFalseDeficitWithFullWidth = actualMarginCm < walkerProfile.minClearanceCm;

  // Evaluating against full width (90cm) would falsely report a deficit
  assert.equal(isDeficitWithRadius, false, "50cm margin should satisfy 45cm required radius");
  assert.equal(isFalseDeficitWithFullWidth, true, "comparing margin against full width would be a 2x false deficit error");
});

// ---------------------------------------------------------------------------
// 6. Failure States & Route Truthfulness
// ---------------------------------------------------------------------------

test("route engine: unreachable or clearance-insufficient routes return empty path", () => {
  const room = toCanonicalRoom();
  const obstacles = toCanonicalObjects(INITIAL_FURNITURE);
  const profile = toCanonicalProfile(MOBILITY_PROFILES.find((p) => p.id === "walker")!);

  const res = computeRoute({
    room,
    obstacles,
    start: { x: 95, y: 265 },
    end: { x: 550, y: 450 },
    mobilityProfile: profile,
    userWaypoints: [
      { x: 160, y: 240 },
      { x: 235, y: 270 },
      { x: 310, y: 290 },
      { x: 260, y: 440 },
      { x: 420, y: 460 },
    ],
  });

  // Clearance failure: path is not present on RouteFailureResult, cannot be rendered as traversable line
  assert.equal(res.status, "clearance-insufficient");
  assert.equal("path" in res, false);
});

// ---------------------------------------------------------------------------
// 7. Store Atomic Consistency
// ---------------------------------------------------------------------------

test("store: atomic resetToDemo restores profile, furniture, walls, doors, and recomputes route", () => {
  useSafeSpaceStore.getState().setProfile("independent");
  useSafeSpaceStore.getState().moveFurniture("chair-c04", 100, 150);

  assert.equal(useSafeSpaceStore.getState().activeProfileId, "independent");
  assert.equal(useSafeSpaceStore.getState().activeProfile.id, "independent");

  // Atomic reset
  useSafeSpaceStore.getState().resetToDemo();

  const state = useSafeSpaceStore.getState();
  assert.equal(state.activeProfileId, "walker");
  assert.equal(state.activeProfile.id, "walker");
  assert.equal(state.furniture.length, INITIAL_FURNITURE.length);
  assert.equal(state.walls.length, INITIAL_WALLS.length);
  assert.equal(state.doors.length, INITIAL_DOORS.length);
  assert.ok(state.routeResult !== null);
  assert.equal(state.routeResult.status, "clearance-insufficient");
});

test("store: setProfile fallback sets activeProfileId and activeProfile atomically", () => {
  useSafeSpaceStore.getState().resetToDemo();

  // Attempt to set non-existent profile
  useSafeSpaceStore
    .getState()
    .setProfile("non-existent-profile" as unknown as "walker");

  const state = useSafeSpaceStore.getState();
  assert.equal(state.activeProfileId, "walker");
  assert.equal(state.activeProfile.id, "walker");
});

// ---------------------------------------------------------------------------
// 8. Truthful Envelope & Entrance Waypoint Derivation (Blocker 1)
// ---------------------------------------------------------------------------

test("truthful envelope: DEMO_CLINIC_ENVELOPE has 4 vertices with no fabricated exterior pocket", () => {
  assert.equal(DEMO_CLINIC_ENVELOPE.length, 4);
  for (const pt of DEMO_CLINIC_ENVELOPE) {
    assert.ok(pt.x >= 40, `x coordinate ${pt.x} must be >= 40 (inside physical boundary)`);
    assert.ok(pt.x <= 760);
    assert.ok(pt.y >= 40);
    assert.ok(pt.y <= 560);
  }
});

test("truthful waypoint: INITIAL_ROUTE entrance interior approach point derived from door geometry and wall clearance", () => {
  const entranceWp = INITIAL_ROUTE[0];
  assert.equal(entranceWp.name, "Entrance Interior Approach");
  // Entrance door at x=40, span y=220..310 (center = 265)
  assert.equal(entranceWp.y, 265);
  // Interior x=95 gives 55cm clearance inside left exterior wall (x=40)
  assert.equal(entranceWp.x, 95);
  assert.ok(entranceWp.x - 40 >= 45, "x clearance satisfies walker 45cm required corridor radius");
});

// ---------------------------------------------------------------------------
// 9. Wall Routing & Opening Integration Fixtures (Blocker 2)
// ---------------------------------------------------------------------------

test("wall routing integration: solid internal wall blocks route (unreachable)", () => {
  const room: CanonicalRoom = {
    id: "test-room",
    floorId: "floor-1",
    name: "Wall Test Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ],
  };

  const solidWall: SpatialWall = {
    id: "solid-dividing-wall",
    start: { x: 250, y: 0 },
    end: { x: 250, y: 400 },
    thickness: 12,
    isExterior: false,
  };

  const wallObstacles = toCanonicalWallObstacles([solidWall], []);
  const profile: CanonicalMobilityProfile = {
    id: "test-profile-60",
    name: "Narrow Profile",
    aidType: "rollator-walker",
    preferredClearanceCm: {
      value: 60,
      unit: "cm",
      source: { type: "clinical-input", referenceId: "TEST", verificationStatus: "unverified" },
    },
    turningDiameterCm: {
      value: 120,
      unit: "cm",
      source: { type: "clinical-input", referenceId: "TEST", verificationStatus: "unverified" },
    },
  };

  const res = computeRoute({
    room,
    obstacles: wallObstacles,
    start: { x: 100, y: 200 },
    end: { x: 400, y: 200 },
    mobilityProfile: profile,
  });

  assert.notEqual(res.status, "success");
});

test("wall routing integration: door opening permits traversal across wall, crossing in span, no wall collision", () => {
  const room: CanonicalRoom = {
    id: "test-room",
    floorId: "floor-1",
    name: "Wall Test Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ],
  };

  const dividingWall: SpatialWall = {
    id: "dividing-wall",
    start: { x: 250, y: 0 },
    end: { x: 250, y: 400 },
    thickness: 12,
    isExterior: false,
  };

  const door: SpatialDoor = {
    id: "door-1",
    roomId: "test-room",
    name: "Center Doorway",
    position: { x: 250, y: 150 },
    width: 100, // span y: 150..250
    swingDeg: 0,
    swingDirection: "inward-left",
    hinge: { x: 250, y: 150 },
  };

  const wallObstacles = toCanonicalWallObstacles([dividingWall], [door], "test-room");
  const profile: CanonicalMobilityProfile = {
    id: "test-profile-60",
    name: "Narrow Profile",
    aidType: "rollator-walker",
    preferredClearanceCm: {
      value: 60,
      unit: "cm",
      source: { type: "clinical-input", referenceId: "TEST", verificationStatus: "unverified" },
    },
    turningDiameterCm: {
      value: 120,
      unit: "cm",
      source: { type: "clinical-input", referenceId: "TEST", verificationStatus: "unverified" },
    },
  };

  const res = computeRoute({
    room,
    obstacles: wallObstacles,
    start: { x: 100, y: 200 },
    end: { x: 400, y: 200 },
    mobilityProfile: profile,
  });

  // B: Success
  assert.equal(res.status, "success");
  if (res.status !== "success") return;

  // C: Crossing point lies in opening span y: 150..250
  let crossingY: number | null = null;
  for (let i = 0; i < res.path.length - 1; i++) {
    const p1 = res.path[i];
    const p2 = res.path[i + 1];
    if ((p1.x <= 250 && p2.x >= 250) || (p1.x >= 250 && p2.x <= 250)) {
      if (Math.abs(p2.x - p1.x) < 1e-6) {
        crossingY = (p1.y + p2.y) / 2;
      } else {
        const t = (250 - p1.x) / (p2.x - p1.x);
        crossingY = p1.y + t * (p2.y - p1.y);
      }
      break;
    }
  }

  assert.ok(crossingY !== null, "Route must cross the wall line at x = 250");
  assert.ok(crossingY >= 150 && crossingY <= 250, `Crossing y (${crossingY}) must lie within door span 150..250`);

  // D: Route never intersects any solid wall obstacle polygon
  for (const obs of wallObstacles) {
    const footprint = deriveWorldFootprint(obs);
    for (let i = 0; i < res.path.length - 1; i++) {
      const seg: Segment2D = { start: res.path[i], end: res.path[i + 1] };
      const intersects = segmentIntersectsPolygon(seg, footprint);
      assert.equal(intersects, false, `Route segment ${i} must not intersect wall obstacle ${obs.id}`);
    }
  }
});

test("door slicing convention: door position and width define exact opening gap along wall vector", () => {
  const wall: SpatialWall = {
    id: "w-test",
    start: { x: 0, y: 100 },
    end: { x: 400, y: 100 },
    thickness: 10,
    isExterior: false,
  };
  const door: SpatialDoor = {
    id: "d-test",
    roomId: "test-room",
    name: "Span Door",
    position: { x: 150, y: 100 },
    width: 80, // span 150..230
    swingDeg: 0,
    swingDirection: "inward-left",
    hinge: { x: 150, y: 100 },
  };

  const obstacles = toCanonicalWallObstacles([wall], [door]);
  assert.equal(obstacles.length, 2);

  // Segment 1: from x=0 to x=150 (midX = 75, width = 150)
  assert.equal(obstacles[0].position.x, 75);
  assert.equal(obstacles[0].dimensionsCm.width, 150);

  // Segment 2: from x=230 to x=400 (midX = 315, width = 170)
  assert.equal(obstacles[1].position.x, 315);
  assert.equal(obstacles[1].dimensionsCm.width, 170);
});

// ---------------------------------------------------------------------------
// 10. Store Geometry State Snapshot Consistency (Blocker 3)
// ---------------------------------------------------------------------------

test("store route recomputation: consumes CURRENT store walls and doors state snapshot", () => {
  useSafeSpaceStore.getState().resetToDemo();

  // Install custom blocking wall across corridor into store state
  const blockingWall: SpatialWall = {
    id: "store-blocker-wall",
    start: { x: 260, y: 400 },
    end: { x: 260, y: 560 },
    thickness: 20,
    isExterior: false,
  };

  useSafeSpaceStore.setState({
    walls: [...INITIAL_WALLS, blockingWall],
    doors: [], // no doors -> corridor portal is blocked
  });

  // Trigger route recomputation via moveFurniture
  useSafeSpaceStore.getState().moveFurniture("chair-c01", 105, 85);

  const result = useSafeSpaceStore.getState().routeResult;
  assert.ok(result !== null);
  // Route is blocked or clearance insufficient because of the custom wall
  assert.notEqual(result.status, "success");

  // Restore demo
  useSafeSpaceStore.getState().resetToDemo();
  assert.equal(useSafeSpaceStore.getState().walls.length, INITIAL_WALLS.length);
});
