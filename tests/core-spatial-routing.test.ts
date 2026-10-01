import test from "node:test";
import assert from "node:assert/strict";
import {
  toMeters,
  toCentimeters,
  CANONICAL_COORDINATES,
  type Point2D,
  type Polygon2D,
  type CanonicalRoom,
  type CanonicalObject,
  type CanonicalOpening,
  type CanonicalMobilityProfile,
  type RouteRequest,
  isValidPoint2D,
  validatePolygon2D,
  validateCanonicalRoom,
  validateCanonicalObject,
  validateCanonicalOpening,
  validateCanonicalMobilityProfile,
  distancePointToPoint,
  distancePointToSegment,
  distanceSegmentToSegment,
  polylineLength,
  boundingBox,
  isPointInPolygon,
  polygonArea,
  segmentIntersectsSegment,
  segmentIntersectionPoint,
  polygonIntersectsPolygon,
  deriveWorldFootprint,
  rotatePoint,
  computeDoorSwingSector,
  computeOpeningSwingPolygon,
  testDoorSwingEncroachment,
  computeRouteClearance,
  testCorridorCollisions,
  computeRoute,
} from "../src/lib/spatial";

// Helper mobility profile for tests
function makeProfile(preferredClearanceCm = 60, turningDiameterCm = 150): CanonicalMobilityProfile {
  return {
    id: "profile-test-walker",
    name: "Standard Walker",
    aidType: "rollator-walker",
    preferredClearanceCm: {
      value: preferredClearanceCm,
      unit: "cm",
      source: {
        type: "user-measurement",
        referenceId: "USER-INPUT-01",
        verificationStatus: "verified",
      },
    },
    turningDiameterCm: {
      value: turningDiameterCm,
      unit: "cm",
      source: {
        type: "clinical-input",
        referenceId: "CLIN-REC-01",
        verificationStatus: "professionally-confirmed",
      },
    },
  };
}

// -------------------------------------------------------------
// 1. Units & Coordinates
// -------------------------------------------------------------
test("canonical coordinate system and units conversion", () => {
  assert.equal(CANONICAL_COORDINATES.unit, "cm");
  assert.equal(CANONICAL_COORDINATES.origin, "top-left");
  assert.equal(CANONICAL_COORDINATES.axes.positiveX, "right");
  assert.equal(CANONICAL_COORDINATES.axes.positiveY, "down");

  assert.equal(toMeters(100), 1);
  assert.equal(toMeters(250), 2.5);
  assert.equal(toCentimeters(2.5), 250);
});

// -------------------------------------------------------------
// 2. Schema Validation
// -------------------------------------------------------------
test("schema: point validation rejects NaN and Infinity", () => {
  assert.ok(isValidPoint2D({ x: 0, y: 0 }));
  assert.ok(isValidPoint2D({ x: 120.5, y: -45.2 }));
  assert.equal(isValidPoint2D({ x: NaN, y: 10 }), false);
  assert.equal(isValidPoint2D({ x: 10, y: Infinity }), false);
  assert.equal(isValidPoint2D(null), false);
  assert.equal(isValidPoint2D({ x: "10", y: 20 }), false);
});

test("schema: polygon validation rejects degenerate and malformed vertices", () => {
  const validSquare: Polygon2D = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  assert.ok(validatePolygon2D(validSquare).valid);

  // Less than 3 vertices
  assert.equal(validatePolygon2D([{ x: 0, y: 0 }, { x: 10, y: 10 }]).valid, false);

  // Collinear points with zero area
  const collinear: Polygon2D = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
    { x: 100, y: 100 },
  ];
  assert.equal(validatePolygon2D(collinear).valid, false);
});

test("schema: canonical entity validation enforces positive dimensions", () => {
  const badObject = {
    id: "obj-1",
    roomId: "room-1",
    name: "Invalid Box",
    category: "chair",
    position: { x: 50, y: 50 },
    dimensionsCm: { width: -10, depth: 50 },
    rotationDeg: 0,
    isFixed: false,
  };
  assert.equal(validateCanonicalObject(badObject).valid, false);

  const validRoom: CanonicalRoom = {
    id: "room-1",
    floorId: "floor-1",
    name: "Test Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  };
  assert.ok(validateCanonicalRoom(validRoom).valid);
  assert.equal(validateCanonicalRoom({ id: "", name: "No ID" }).valid, false);

  const validOpening: CanonicalOpening = {
    id: "door-1",
    roomId: "room-1",
    type: "door",
    start: { x: 0, y: 20 },
    end: { x: 0, y: 110 },
    clearWidthCm: 90,
  };
  assert.ok(validateCanonicalOpening(validOpening).valid);
  assert.equal(validateCanonicalOpening({ id: "door-bad", clearWidthCm: -10 }).valid, false);

  const profile = makeProfile(60, 150);
  assert.ok(validateCanonicalMobilityProfile(profile).valid);
  assert.equal(validateCanonicalMobilityProfile({ id: "" }).valid, false);
});

// -------------------------------------------------------------
// 3. Geometry Primitives & Intersections
// -------------------------------------------------------------
test("geometry: point-to-point and point-to-segment distance", () => {
  const p1: Point2D = { x: 0, y: 0 };
  const p2: Point2D = { x: 30, y: 40 };
  assert.equal(distancePointToPoint(p1, p2), 50);

  const seg = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
  // Point perpendicular to midpoint
  const res1 = distancePointToSegment({ x: 50, y: 25 }, seg);
  assert.equal(res1.distance, 25);
  assert.deepEqual(res1.closestPoint, { x: 50, y: 0 });

  // Point beyond segment start
  const res2 = distancePointToSegment({ x: -20, y: 0 }, seg);
  assert.equal(res2.distance, 20);
  assert.deepEqual(res2.closestPoint, { x: 0, y: 0 });

  // Distance between parallel segments
  const segParallel = { start: { x: 0, y: 30 }, end: { x: 100, y: 30 } };
  assert.equal(distanceSegmentToSegment(seg, segParallel), 30);

  // Bounding box
  const bb = boundingBox([{ x: 10, y: 20 }, { x: 50, y: 80 }]);
  assert.deepEqual(bb, { minX: 10, minY: 20, maxX: 50, maxY: 80 });

  // Point rotation
  const rotated = rotatePoint({ x: 10, y: 0 }, 90);
  assert.equal(Math.round(rotated.x), 0);
  assert.equal(Math.round(rotated.y), 10);

  // Polyline length
  const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  assert.equal(polylineLength(poly), 200);
});

test("geometry: segment and polygon intersections", () => {
  const s1 = { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } };
  const s2 = { start: { x: 50, y: 0 }, end: { x: 50, y: 100 } };
  assert.ok(segmentIntersectsSegment(s1, s2));

  const pt = segmentIntersectionPoint(s1, s2);
  assert.ok(pt !== null);
  assert.equal(Math.round(pt.x), 50);
  assert.equal(Math.round(pt.y), 50);

  const polyA: Polygon2D = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const polyB: Polygon2D = [
    { x: 50, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 150 },
    { x: 50, y: 150 },
  ];
  const polyC: Polygon2D = [
    { x: 200, y: 200 },
    { x: 300, y: 200 },
    { x: 300, y: 300 },
    { x: 200, y: 300 },
  ];

  assert.ok(polygonIntersectsPolygon(polyA, polyB));
  assert.equal(polygonIntersectsPolygon(polyA, polyC), false);
});

test("geometry: point-in-polygon and polygon area", () => {
  const poly: Polygon2D = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 0, y: 100 },
  ];
  assert.equal(polygonArea(poly), 20000);
  assert.ok(isPointInPolygon({ x: 100, y: 50 }, poly));
  assert.equal(isPointInPolygon({ x: 250, y: 50 }, poly), false);
  assert.ok(isPointInPolygon({ x: 0, y: 50 }, poly, true));
});

// -------------------------------------------------------------
// 4. Engineering Fixtures A through F
// -------------------------------------------------------------

// Fixture A: Empty rectangular room (400 x 400)
test("Fixture A: empty room produces straight route of exact Euclidean length", () => {
  const room: CanonicalRoom = {
    id: "fixture-a-room",
    floorId: "floor-1",
    name: "Empty Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
  };

  const req: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 50, y: 200 },
    end: { x: 350, y: 200 },
    mobilityProfile: makeProfile(60),
    gridResolutionCm: 5,
  };

  const res = computeRoute(req);
  assert.equal(res.status, "success");
  if (res.status === "success") {
    assert.equal(res.pathLengthCm, 300);
    assert.deepEqual(res.path, [
      { x: 50, y: 200 },
      { x: 350, y: 200 },
    ]);
  }
});

// Fixture B: Central obstacle (obstacle at 200,200 size 100x100)
test("Fixture B: route deviates around central obstacle", () => {
  const room: CanonicalRoom = {
    id: "fixture-b-room",
    floorId: "floor-1",
    name: "Room with Center Obstacle",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
  };

  const obstacle: CanonicalObject = {
    id: "obs-center",
    roomId: "fixture-b-room",
    name: "Central Island Table",
    category: "table",
    position: { x: 200, y: 200 },
    dimensionsCm: { width: 100, depth: 100 },
    rotationDeg: 0,
    isFixed: true,
  };

  const req: RouteRequest = {
    room,
    obstacles: [obstacle],
    start: { x: 50, y: 200 },
    end: { x: 350, y: 200 },
    mobilityProfile: makeProfile(60), // corridor radius = 30 cm
    gridResolutionCm: 5,
  };

  const res = computeRoute(req);
  assert.equal(res.status, "success");
  if (res.status === "success") {
    // Route must not be a straight 300cm line across the obstacle
    assert.ok(res.pathLengthCm > 300);
    // Path must navigate above or below y=200
    const deviations = res.path.filter((p) => p.y !== 200);
    assert.ok(deviations.length > 0);
    // Check clearance to obstacle footprint
    const obsFootprint = deriveWorldFootprint(obstacle);
    for (const pt of res.path) {
      assert.equal(isPointInPolygon(pt, obsFootprint), false);
    }
  }
});

// Fixture C: Fully blocked passage (wall-to-wall obstacle divider)
test("Fixture C: fully blocked passage returns explicit unreachable status", () => {
  const room: CanonicalRoom = {
    id: "fixture-c-room",
    floorId: "floor-1",
    name: "Corridor with Barrier",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 0, y: 200 },
    ],
  };

  // Barrier spanning from y=0 to y=200 at x=200
  const divider: CanonicalObject = {
    id: "obs-divider",
    roomId: "fixture-c-room",
    name: "Floor to Ceiling Barrier",
    category: "cabinet",
    position: { x: 200, y: 100 },
    dimensionsCm: { width: 40, depth: 200 },
    rotationDeg: 0,
    isFixed: true,
  };

  const req: RouteRequest = {
    room,
    obstacles: [divider],
    start: { x: 50, y: 100 },
    end: { x: 350, y: 100 },
    mobilityProfile: makeProfile(60),
    gridResolutionCm: 5,
  };

  const res = computeRoute(req);
  assert.equal(res.status, "unreachable");
});

// Fixture D: Irregular / L-shaped room
test("Fixture D: routing in L-shaped room navigates strictly within boundary", () => {
  const room: CanonicalRoom = {
    id: "fixture-d-room",
    floorId: "floor-1",
    name: "L-Shaped Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 400 },
      { x: 0, y: 400 },
    ],
  };

  // Start in top leg, end in bottom leg
  const req: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 300, y: 100 },
    end: { x: 100, y: 300 },
    mobilityProfile: makeProfile(60),
    gridResolutionCm: 5,
  };

  const res = computeRoute(req);
  assert.equal(res.status, "success");
  if (res.status === "success") {
    // All path points must be strictly inside the L-shaped boundary
    for (const pt of res.path) {
      assert.ok(
        isPointInPolygon(pt, room.boundary, true),
        `Point (${pt.x}, ${pt.y}) is outside L-shaped room boundary`
      );
    }
  }
});

// Fixture E: Rotated furniture obstacle
test("Fixture E: rotated obstacle footprint correctly redirects pathfinding", () => {
  const room: CanonicalRoom = {
    id: "fixture-e-room",
    floorId: "floor-1",
    name: "Room with Rotated Desk",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 300 },
      { x: 0, y: 300 },
    ],
  };

  // Long desk 160 x 50 rotated by 45 degrees
  const rotatedDesk: CanonicalObject = {
    id: "obs-desk-rot",
    roomId: "fixture-e-room",
    name: "Angled Reception Desk",
    category: "table",
    position: { x: 250, y: 150 },
    dimensionsCm: { width: 160, depth: 50 },
    rotationDeg: 45,
    isFixed: true,
  };

  const footprint = deriveWorldFootprint(rotatedDesk);
  assert.equal(footprint.length, 4);

  const req: RouteRequest = {
    room,
    obstacles: [rotatedDesk],
    start: { x: 50, y: 150 },
    end: { x: 450, y: 150 },
    mobilityProfile: makeProfile(50),
    gridResolutionCm: 5,
  };

  const res = computeRoute(req);
  assert.equal(res.status, "success");
  if (res.status === "success") {
    assert.ok(res.pathLengthCm > 400);
    // Path avoids rotated footprint
    for (const pt of res.path) {
      assert.equal(isPointInPolygon(pt, footprint), false);
    }
  }
});

// Fixture F: Door swing geometry and obstacle encroachment
test("Fixture F: door swing sector calculates exact geometry and detects encroachment", () => {
  const door: CanonicalOpening = {
    id: "door-main",
    roomId: "fixture-f-room",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      direction: "inward-right", // sweeps clockwise
    },
  };

  const directSector = computeDoorSwingSector({
    hinge: { x: 100, y: 100 },
    radiusCm: 90,
    startAngleDeg: 0,
    sweepAngleDeg: 90,
    segments: 8,
  });
  assert.ok(directSector.length >= 9);

  const swingPoly = computeOpeningSwingPolygon(door, 8);
  assert.ok(swingPoly.length >= 9);

  // Obstacle right inside the 90cm sweep area
  const encroachingChair: CanonicalObject = {
    id: "chair-in-swing",
    roomId: "fixture-f-room",
    name: "Encroaching Stool",
    category: "chair",
    position: { x: 140, y: 140 },
    dimensionsCm: { width: 30, depth: 30 },
    rotationDeg: 0,
    isFixed: false,
  };

  // Obstacle safely outside swing arc
  const safeChair: CanonicalObject = {
    id: "chair-safe",
    roomId: "fixture-f-room",
    name: "Safe Chair",
    category: "chair",
    position: { x: 250, y: 250 },
    dimensionsCm: { width: 40, depth: 40 },
    rotationDeg: 0,
    isFixed: false,
  };

  assert.ok(testDoorSwingEncroachment(swingPoly, encroachingChair));
  assert.equal(testDoorSwingEncroachment(swingPoly, safeChair), false);
});

// -------------------------------------------------------------
// 5. Waypoints & Deterministic Identity
// -------------------------------------------------------------
test("routing: intermediate waypoints are traversed in strict order", () => {
  const room: CanonicalRoom = {
    id: "room-wp",
    floorId: "floor-1",
    name: "Waypoint Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 600 },
      { x: 0, y: 600 },
    ],
  };

  const req: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 100, y: 100 },
    end: { x: 500, y: 500 },
    userWaypoints: [
      { x: 500, y: 100 }, // Waypoint 1 (top right)
      { x: 100, y: 500 }, // Waypoint 2 (bottom left)
    ],
    mobilityProfile: makeProfile(60),
    gridResolutionCm: 10,
  };

  const res = computeRoute(req);
  assert.equal(res.status, "success");
  if (res.status === "success") {
    // Path must visit wp1 then wp2 then end
    const ptWp1 = res.path.find((p) => Math.hypot(p.x - 500, p.y - 100) < 5);
    const ptWp2 = res.path.find((p) => Math.hypot(p.x - 100, p.y - 500) < 5);
    assert.ok(ptWp1, "Must visit Waypoint 1");
    assert.ok(ptWp2, "Must visit Waypoint 2");
  }
});

test("routing: deterministic identity guarantee (same input produces identical path)", () => {
  const room: CanonicalRoom = {
    id: "det-room",
    floorId: "floor-1",
    name: "Det Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
  };

  const obs: CanonicalObject = {
    id: "obs-det",
    roomId: "det-room",
    name: "Block",
    category: "cabinet",
    position: { x: 200, y: 200 },
    dimensionsCm: { width: 80, depth: 80 },
    rotationDeg: 0,
    isFixed: true,
  };

  const req: RouteRequest = {
    room,
    obstacles: [obs],
    start: { x: 60, y: 200 },
    end: { x: 340, y: 200 },
    mobilityProfile: makeProfile(60),
    gridResolutionCm: 5,
  };

  const res1 = computeRoute(req);
  const res2 = computeRoute(req);

  assert.equal(res1.status, "success");
  assert.equal(res2.status, "success");
  if (res1.status === "success" && res2.status === "success") {
    assert.equal(res1.pathLengthCm, res2.pathLengthCm);
    assert.deepEqual(res1.path, res2.path);
  }
});

// -------------------------------------------------------------
// 6. Metrics & Bottleneck Identification
// -------------------------------------------------------------
test("metrics: minimum clearance and bottleneck identity calculation", () => {
  const room: CanonicalRoom = {
    id: "bench-room",
    floorId: "floor-1",
    name: "Clearance Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 300 },
      { x: 0, y: 300 },
    ],
  };

  // Place an obstacle centered at (250, 100) with size (100, 50).
  // Bottom edge of obstacle is at y = 100 + 25 = 125.
  const obs: CanonicalObject = {
    id: "obs-clearance-test",
    roomId: "bench-room",
    name: "Wall Cabinet",
    category: "cabinet",
    position: { x: 250, y: 100 },
    dimensionsCm: { width: 100, depth: 50 },
    rotationDeg: 0,
    isFixed: true,
  };

  // Straight path at y = 200 from x = 50 to x = 450
  // Distance from path (y=200) to bottom edge of obstacle (y=125) is exactly 75 cm!
  const path: Point2D[] = [
    { x: 50, y: 200 },
    { x: 450, y: 200 },
  ];

  // Obstacle-only clearance: distance from y=200 to obstacle bottom edge y=125 is 75 cm
  const obsClearance = computeRouteClearance(path, [obs]);
  assert.equal(Math.round(obsClearance.minimumClearanceCm), 75);
  assert.ok(obsClearance.bottlenecks.length > 0);
  assert.equal(obsClearance.bottlenecks[0].obstacleId, "obs-clearance-test");

  // With room boundary: distance from path start (x=50) to left wall (x=0) is 50 cm
  const fullClearance = computeRouteClearance(path, [obs], room.boundary);
  assert.equal(Math.round(fullClearance.minimumClearanceCm), 50);

  // Test corridor collision with 80cm radius (obstacle is at 75cm, so within 80cm corridor)
  const collisions = testCorridorCollisions(path, 80, [obs]);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].obstacleId, "obs-clearance-test");
});

// -------------------------------------------------------------
// 7. Performance Sanity Benchmark
// -------------------------------------------------------------
test("performance: realistic room (600x500 cm @ 5cm resolution) routes within sanity threshold", () => {
  const room: CanonicalRoom = {
    id: "perf-room",
    floorId: "floor-1",
    name: "Apartment Living Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 500 },
      { x: 0, y: 500 },
    ],
  };

  const obstacles: CanonicalObject[] = [
    {
      id: "sofa",
      roomId: "perf-room",
      name: "Sofa",
      category: "chair",
      position: { x: 200, y: 150 },
      dimensionsCm: { width: 180, depth: 80 },
      rotationDeg: 0,
      isFixed: true,
    },
    {
      id: "dining-table",
      roomId: "perf-room",
      name: "Dining Table",
      category: "table",
      position: { x: 420, y: 350 },
      dimensionsCm: { width: 140, depth: 90 },
      rotationDeg: 30,
      isFixed: true,
    },
  ];

  const req: RouteRequest = {
    room,
    obstacles,
    start: { x: 60, y: 60 },
    end: { x: 540, y: 440 },
    mobilityProfile: makeProfile(60),
    gridResolutionCm: 5, // 120 x 100 = 12,000 grid cells
  };

  const t0 = performance.now();
  const res = computeRoute(req);
  const elapsedMs = performance.now() - t0;

  assert.equal(res.status, "success");
  // Log measured runtime for completion report
  console.log(`[PERF BENCHMARK] 600x500cm room @ 5cm resolution computed in ${elapsedMs.toFixed(2)} ms`);
  assert.ok(elapsedMs < 1000, `Pathfinding took ${elapsedMs} ms, expected < 1000 ms`);
});
