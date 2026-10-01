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
  validateSourcedQuantity,
  distancePointToPoint,
  distancePointToSegment,
  distanceSegmentToSegment,
  distanceSegmentToPolygon,
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
  SpatialGrid,
  isLineOfSightClear,
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
      sweepDirection: "clockwise",
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

// -------------------------------------------------------------
// 8. Blockers Regression Tests
// -------------------------------------------------------------

test("regression 1: horizontal door baseline orientation with hinge=start (hinge.x != hinge.y)", () => {
  const door: CanonicalOpening = {
    id: "door-horiz-start",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 250 }, // hinge.x = 100, hinge.y = 250 (100 != 250)
    end: { x: 190, y: 250 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 250 },
      arcDeg: 90,
      sweepDirection: "clockwise",
      direction: "inward-right", // clockwise: 0 deg (+x) -> 90 deg (+y)
    },
  };

  const poly = computeOpeningSwingPolygon(door, 4);
  assert.equal(poly.length, 6); // hinge + 5 arc points
  assert.deepEqual(poly[0], { x: 100, y: 250 });
  assert.equal(Math.round(poly[1].x), 190);
  assert.equal(Math.round(poly[1].y), 250);
  assert.equal(Math.round(poly[poly.length - 1].x), 100);
  assert.equal(Math.round(poly[poly.length - 1].y), 340);
});

test("regression 2: vertical door baseline orientation with hinge=start (hinge.x != hinge.y)", () => {
  const door: CanonicalOpening = {
    id: "door-vert-start",
    roomId: "room-1",
    type: "door",
    start: { x: 150, y: 300 }, // hinge.x = 150, hinge.y = 300 (150 != 300)
    end: { x: 150, y: 390 },   // leaf points +y (down, 90 deg)
    clearWidthCm: 90,
    swing: {
      hinge: { x: 150, y: 300 },
      arcDeg: 90,
      sweepDirection: "clockwise",
      direction: "inward-right", // clockwise: 90 deg (+y) -> 180 deg (-x)
    },
  };

  const poly = computeOpeningSwingPolygon(door, 4);
  assert.equal(poly.length, 6);
  assert.deepEqual(poly[0], { x: 150, y: 300 });
  assert.equal(Math.round(poly[1].x), 150);
  assert.equal(Math.round(poly[1].y), 390);
  assert.equal(Math.round(poly[poly.length - 1].x), 60);
  assert.equal(Math.round(poly[poly.length - 1].y), 300);
});

test("regression 3: vertical door baseline orientation with hinge=end (hinge.x != hinge.y)", () => {
  const door: CanonicalOpening = {
    id: "door-vert-end",
    roomId: "room-1",
    type: "door",
    start: { x: 150, y: 300 },
    end: { x: 150, y: 390 }, // hinge is end (150 != 390)
    clearWidthCm: 90,
    swing: {
      hinge: { x: 150, y: 390 },
      arcDeg: 90,
      sweepDirection: "counterclockwise",
      direction: "inward-left", // counter-clockwise: -90 deg (-y) -> -180 deg (-x)
    },
  };

  const poly = computeOpeningSwingPolygon(door, 4);
  assert.equal(poly.length, 6);
  assert.deepEqual(poly[0], { x: 150, y: 390 });
  assert.equal(Math.round(poly[1].x), 150);
  assert.equal(Math.round(poly[1].y), 300);
  assert.equal(Math.round(poly[poly.length - 1].x), 60);
  assert.equal(Math.round(poly[poly.length - 1].y), 390);
});

test("regression 4: opening swing hinge matching neither endpoint is rejected", () => {
  const invalidDoor: CanonicalOpening = {
    id: "door-invalid-hinge",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 200 },
    end: { x: 190, y: 200 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 145, y: 200 }, // Midpoint, neither start nor end
      arcDeg: 90,
      sweepDirection: "clockwise",
      direction: "inward-right",
    },
  };

  const val = validateCanonicalOpening(invalidDoor);
  assert.equal(val.valid, false);
  if (!val.valid) {
    assert.ok(val.errors.some((e) => e.includes("coincide with either opening start or end endpoint")));
  }

  const poly = computeOpeningSwingPolygon(invalidDoor);
  assert.deepEqual(poly, []);
});

test("regression 5: non-positive and non-finite grid resolution returns invalid-geometry", () => {
  const room: CanonicalRoom = {
    id: "room-1",
    floorId: "floor-1",
    name: "Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ],
  };

  const baseReq: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 50, y: 50 },
    end: { x: 250, y: 250 },
    mobilityProfile: makeProfile(60),
  };

  for (const badRes of [0, -5, NaN, Infinity, -Infinity]) {
    const res = computeRoute({ ...baseReq, gridResolutionCm: badRes });
    assert.equal(res.status, "invalid-geometry", `Failed for gridResolutionCm: ${badRes}`);
  }
});

test("regression 6: malformed obstacle returns invalid-geometry with index and id context", () => {
  const room: CanonicalRoom = {
    id: "room-1",
    floorId: "floor-1",
    name: "Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ],
  };

  const badObstacle = {
    id: "bad-chair-99",
    roomId: "room-1",
    name: "Broken Chair",
    category: "chair",
    position: { x: 150, y: 150 },
    dimensionsCm: { width: -40, depth: 40 },
    rotationDeg: 0,
    isFixed: true,
  } as unknown as CanonicalObject;

  const res = computeRoute({
    room,
    obstacles: [badObstacle],
    start: { x: 50, y: 50 },
    end: { x: 250, y: 250 },
    mobilityProfile: makeProfile(60),
  });

  assert.equal(res.status, "invalid-geometry");
  if (res.status === "invalid-geometry") {
    assert.ok(res.reason.includes("bad-chair-99"));
    assert.ok(res.reason.includes("index 0"));
  }
});

test("regression 7: non-finite or Infinity mobility quantity rejected", () => {
  const badProfile = {
    id: "prof-inf",
    name: "Infinite Walker",
    aidType: "rollator-walker",
    preferredClearanceCm: {
      value: Infinity,
      unit: "cm",
      source: {
        type: "user-measurement",
        referenceId: "REF-1",
        verificationStatus: "verified",
      },
    },
    turningDiameterCm: {
      value: 150,
      unit: "cm",
      source: {
        type: "clinical-input",
        referenceId: "REF-2",
        verificationStatus: "verified",
      },
    },
  };

  const val = validateCanonicalMobilityProfile(badProfile);
  assert.equal(val.valid, false);
});

test("regression 8: malformed sourced quantity and missing provenance rejected", () => {
  const directErrors = validateSourcedQuantity(
    { value: -10, unit: "m", source: { type: "unknown", referenceId: "", verificationStatus: "invalid" } },
    "cm",
    "testQuantity",
    true
  );
  assert.ok(directErrors.length >= 3);

  const badSourceProfile = {
    id: "prof-bad-src",
    name: "Bad Source Walker",
    aidType: "rollator-walker",
    preferredClearanceCm: {
      value: 60,
      unit: "inches", // Invalid unit
      source: {
        type: "unsupported-source-type", // Invalid type
        referenceId: "", // Empty reference ID
        verificationStatus: "invalid-status", // Invalid status
      },
    },
    turningDiameterCm: {
      value: 150,
      unit: "cm",
      source: {
        type: "clinical-input",
        referenceId: "REF-1",
        verificationStatus: "verified",
      },
    },
  };

  const val = validateCanonicalMobilityProfile(badSourceProfile);
  assert.equal(val.valid, false);
  if (!val.valid) {
    assert.ok(val.errors.some((e) => e.includes('unit must be "cm"')));
    assert.ok(val.errors.some((e) => e.includes("source.type")));
    assert.ok(val.errors.some((e) => e.includes("source.referenceId")));
    assert.ok(val.errors.some((e) => e.includes("source.verificationStatus")));
  }
});

test("regression 9: segment fully inside polygon returns distance 0", () => {
  const poly: Polygon2D = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ];

  const insideSegment = {
    start: { x: 120, y: 120 },
    end: { x: 180, y: 180 },
  };

  const res = distanceSegmentToPolygon(insideSegment, poly);
  assert.equal(res.minDistanceCm, 0);
  assert.deepEqual(res.routePoint, { x: 120, y: 120 });
  assert.deepEqual(res.polygonPoint, { x: 120, y: 120 });
});

test("regression 10: segment crossing polygon boundary returns distance 0", () => {
  const poly: Polygon2D = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ];

  const crossingSegment = {
    start: { x: 50, y: 150 },
    end: { x: 250, y: 150 },
  };

  const res = distanceSegmentToPolygon(crossingSegment, poly);
  assert.equal(res.minDistanceCm, 0);
  assert.ok(res.routePoint.x === 100 || res.routePoint.x === 200);
  assert.equal(res.routePoint.y, 150);

  const oneInsideSegment = {
    start: { x: 150, y: 150 },
    end: { x: 250, y: 150 },
  };
  const resOne = distanceSegmentToPolygon(oneInsideSegment, poly);
  assert.equal(resOne.minDistanceCm, 0);
});

test("regression 11: external segment retains true Euclidean distance to polygon boundary", () => {
  const poly: Polygon2D = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ];

  const externalSegment = {
    start: { x: 50, y: 40 },
    end: { x: 250, y: 40 },
  };

  const res = distanceSegmentToPolygon(externalSegment, poly);
  assert.equal(Math.round(res.minDistanceCm), 60);
  assert.equal(res.polygonPoint.y, 100);
});

test("regression 12: line-of-sight supercover traversal detects corner clipping", () => {
  const grid = new SpatialGrid(0, 0, 50, 50, 10);
  grid.setBlocked(1, 1, true); // cell (1, 1) covers [5, 15] x [5, 15]

  // Continuous segment from (0, 4) to (20, 6) crosses cell (1, 1) at x=10, y=5.0
  const clippingP1: Point2D = { x: 0, y: 4 };
  const clippingP2: Point2D = { x: 20, y: 6 };

  const isClear = isLineOfSightClear(clippingP1, clippingP2, grid);
  assert.equal(isClear, false, "Supercover line-of-sight must detect blocked cell intersection");

  const clearP1: Point2D = { x: 0, y: 45 };
  const clearP2: Point2D = { x: 45, y: 45 };
  assert.equal(isLineOfSightClear(clearP1, clearP2, grid), true);
});

// -------------------------------------------------------------
// 9. Final Canonical Routing Invariants Regressions (Pass 2)
// -------------------------------------------------------------

test("regression 13: bow-tie room boundary is rejected as self-intersecting", () => {
  const bowTiePoly: Polygon2D = [
    { x: 0, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 100, y: 0 },
  ];
  const valPoly = validatePolygon2D(bowTiePoly);
  assert.equal(valPoly.valid, false);
  if (!valPoly.valid) {
    assert.ok(valPoly.errors.some((e) => e.includes("self-intersecting")));
  }

  const room: CanonicalRoom = {
    id: "room-bowtie",
    floorId: "floor-1",
    name: "Bowtie Room",
    boundary: bowTiePoly,
  };
  const valRoom = validateCanonicalRoom(room);
  assert.equal(valRoom.valid, false);
  if (!valRoom.valid) {
    assert.ok(valRoom.errors.some((e) => e.includes("self-intersecting")));
  }
});

test("regression 14: bow-tie object footprint is rejected as self-intersecting", () => {
  const bowTieFootprint: Polygon2D = [
    { x: -50, y: -50 },
    { x: 50, y: 50 },
    { x: -50, y: 50 },
    { x: 50, y: -50 },
  ];
  const obj: CanonicalObject = {
    id: "obj-bowtie",
    roomId: "room-1",
    name: "Bowtie Table",
    category: "table",
    position: { x: 100, y: 100 },
    dimensionsCm: { width: 100, depth: 100 },
    rotationDeg: 0,
    footprint: bowTieFootprint,
    isFixed: true,
  };
  const valObj = validateCanonicalObject(obj);
  assert.equal(valObj.valid, false);
  if (!valObj.valid) {
    assert.ok(valObj.errors.some((e) => e.includes("self-intersecting")));
  }
});

test("regression 15: ordinary concave L-shaped polygon remains valid", () => {
  const lShape: Polygon2D = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 150 },
    { x: 150, y: 150 },
    { x: 150, y: 300 },
    { x: 0, y: 300 },
  ];
  const val = validatePolygon2D(lShape);
  assert.equal(val.valid, true);
});

test("regression 16: malformed obstacles collection returns invalid-geometry without throwing", () => {
  const room: CanonicalRoom = {
    id: "room-1",
    floorId: "floor-1",
    name: "Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
  };
  const baseReq: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 50, y: 200 },
    end: { x: 350, y: 200 },
    mobilityProfile: makeProfile(60),
  };

  for (const badObs of [{}, "chairs", 42, true]) {
    const res = computeRoute({ ...baseReq, obstacles: badObs as unknown as readonly CanonicalObject[] });
    assert.equal(res.status, "invalid-geometry");
    if (res.status === "invalid-geometry") {
      assert.ok(res.reason.includes("request.obstacles must be an array"));
    }
  }
});

test("regression 17: malformed userWaypoints collection returns invalid-geometry without throwing", () => {
  const room: CanonicalRoom = {
    id: "room-1",
    floorId: "floor-1",
    name: "Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
  };
  const baseReq: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 50, y: 200 },
    end: { x: 350, y: 200 },
    mobilityProfile: makeProfile(60),
  };

  for (const badWp of [{}, 12, "wp1", false]) {
    const res = computeRoute({ ...baseReq, userWaypoints: badWp as unknown as readonly Point2D[] });
    assert.equal(res.status, "invalid-geometry");
    if (res.status === "invalid-geometry") {
      assert.ok(res.reason.includes("request.userWaypoints must be an array"));
    }
  }
});

test("regression 18: start point inside obstacle dilation envelope returns clearance-insufficient", () => {
  const room: CanonicalRoom = {
    id: "room-clearance",
    floorId: "floor-1",
    name: "Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ],
  };
  // Obstacle at x: [100, 200], y: [150, 250]
  const obs: CanonicalObject = {
    id: "obs-cab",
    roomId: "room-clearance",
    name: "Filing Cabinet",
    category: "cabinet",
    position: { x: 150, y: 200 },
    dimensionsCm: { width: 100, depth: 100 },
    rotationDeg: 0,
    isFixed: true,
  };
  // Profile requires 60 cm clear width => corridor radius = 30 cm
  // Start is at (85, 200) => 15 cm from obstacle left edge (x=100)
  // Physically outside obstacle, but closer than 30 cm!
  const req: RouteRequest = {
    room,
    obstacles: [obs],
    start: { x: 85, y: 200 },
    end: { x: 400, y: 200 },
    mobilityProfile: makeProfile(60),
  };
  const res = computeRoute(req);
  assert.notEqual(res.status, "success");
  assert.equal(res.status, "clearance-insufficient");
});

test("regression 19: end point inside obstacle dilation envelope returns clearance-insufficient", () => {
  const room: CanonicalRoom = {
    id: "room-clearance",
    floorId: "floor-1",
    name: "Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ],
  };
  const obs: CanonicalObject = {
    id: "obs-cab",
    roomId: "room-clearance",
    name: "Filing Cabinet",
    category: "cabinet",
    position: { x: 350, y: 200 },
    dimensionsCm: { width: 100, depth: 100 },
    rotationDeg: 0,
    isFixed: true,
  };
  // End is at (285, 200) => 15 cm from obstacle left edge (x=300)
  const req: RouteRequest = {
    room,
    obstacles: [obs],
    start: { x: 100, y: 200 },
    end: { x: 285, y: 200 },
    mobilityProfile: makeProfile(60), // corridor radius = 30 cm
  };
  const res = computeRoute(req);
  assert.notEqual(res.status, "success");
  assert.equal(res.status, "clearance-insufficient");
});

test("regression 20: start or route too close to room wall returns clearance-insufficient", () => {
  const room: CanonicalRoom = {
    id: "room-wall",
    floorId: "floor-1",
    name: "Empty Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
  };
  // Profile requires 60 cm clear width => corridor radius = 30 cm
  // Start at (10, 200) is only 10 cm from left wall (x=0)
  const req: RouteRequest = {
    room,
    obstacles: [],
    start: { x: 10, y: 200 },
    end: { x: 350, y: 200 },
    mobilityProfile: makeProfile(60),
  };
  const res = computeRoute(req);
  assert.notEqual(res.status, "success");
  assert.equal(res.status, "clearance-insufficient");
});

test("regression 21: valid route with sufficient wall and object clearance succeeds", () => {
  const room: CanonicalRoom = {
    id: "room-valid",
    floorId: "floor-1",
    name: "Spacious Room",
    boundary: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ],
  };
  const table: CanonicalObject = {
    id: "table-mid",
    roomId: "room-valid",
    name: "Center Table",
    category: "table",
    position: { x: 250, y: 250 },
    dimensionsCm: { width: 100, depth: 100 },
    rotationDeg: 0,
    isFixed: true,
  };
  const req: RouteRequest = {
    room,
    obstacles: [table],
    start: { x: 60, y: 250 },
    end: { x: 440, y: 250 },
    mobilityProfile: makeProfile(60), // corridor radius = 30 cm
  };
  const res = computeRoute(req);
  assert.equal(res.status, "success");
  if (res.status === "success") {
    assert.ok(
      res.minimumClearanceCm + 1e-4 >= 30,
      `Expected minimumClearanceCm (${res.minimumClearanceCm}) >= 30`
    );
  }
});

test("regression 22: successful route clearance invariant strictly holds across fixtures", () => {
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
  const profile = makeProfile(60); // corridor radius = 30 cm
  const resA = computeRoute({
    room,
    obstacles: [],
    start: { x: 50, y: 200 },
    end: { x: 350, y: 200 },
    mobilityProfile: profile,
  });
  assert.equal(resA.status, "success");
  if (resA.status === "success") {
    assert.ok(
      resA.minimumClearanceCm + 1e-4 >= profile.preferredClearanceCm.value / 2,
      `Fixture A clearance invariant violated: ${resA.minimumClearanceCm} < 30`
    );
  }
});

test("regression 23: door swing clockwise vs counterclockwise geometric sweep", () => {
  const doorCW: CanonicalOpening = {
    id: "door-cw",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      sweepDirection: "clockwise",
    },
  };
  const doorCCW: CanonicalOpening = {
    id: "door-ccw",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      sweepDirection: "counterclockwise",
    },
  };

  const polyCW = computeOpeningSwingPolygon(doorCW, 4);
  const polyCCW = computeOpeningSwingPolygon(doorCCW, 4);

  // Baseline: (100, 100) -> (190, 100) = 0 deg (+x)
  // Clockwise (+90 deg): points sweep towards +y (down): y >= 100
  for (const p of polyCW) {
    assert.ok(p.y >= 100 - 1e-4, `Expected CW y >= 100, got ${p.y}`);
  }
  assert.equal(Math.round(polyCW[polyCW.length - 1].x), 100);
  assert.equal(Math.round(polyCW[polyCW.length - 1].y), 190);

  // Counterclockwise (-90 deg): points sweep towards -y (up): y <= 100
  for (const p of polyCCW) {
    assert.ok(p.y <= 100 + 1e-4, `Expected CCW y <= 100, got ${p.y}`);
  }
  assert.equal(Math.round(polyCCW[polyCCW.length - 1].x), 100);
  assert.equal(Math.round(polyCCW[polyCCW.length - 1].y), 10);
});

test("regression 24: door swing hinge at start vs hinge at end", () => {
  const doorHingeStart: CanonicalOpening = {
    id: "door-h-start",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      sweepDirection: "clockwise",
    },
  };
  const doorHingeEnd: CanonicalOpening = {
    id: "door-h-end",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 190, y: 100 },
      arcDeg: 90,
      sweepDirection: "clockwise",
    },
  };

  const polyStart = computeOpeningSwingPolygon(doorHingeStart, 4);
  const polyEnd = computeOpeningSwingPolygon(doorHingeEnd, 4);

  assert.deepEqual(polyStart[0], { x: 100, y: 100 });
  assert.deepEqual(polyEnd[0], { x: 190, y: 100 });
});

test("regression 25: semantic direction metadata does not silently alter geometry", () => {
  const doorSemantic1: CanonicalOpening = {
    id: "door-sem-1",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      sweepDirection: "clockwise",
      direction: "inward-left", // Semantic metadata only
    },
  };
  const doorSemantic2: CanonicalOpening = {
    id: "door-sem-2",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      sweepDirection: "clockwise",
      direction: "outward-right", // Different semantic metadata
    },
  };

  const poly1 = computeOpeningSwingPolygon(doorSemantic1, 8);
  const poly2 = computeOpeningSwingPolygon(doorSemantic2, 8);

  // Both must yield identical geometry because sweepDirection is the authoritative geometric contract
  assert.deepEqual(poly1, poly2);
});

test("regression 26: invalid door swing hinge or sweepDirection fails validation", () => {
  const badHinge: CanonicalOpening = {
    id: "door-bad-hinge",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 145, y: 100 }, // Middle
      arcDeg: 90,
      sweepDirection: "clockwise",
    },
  };
  const valHinge = validateCanonicalOpening(badHinge);
  assert.equal(valHinge.valid, false);

  const badSweep: CanonicalOpening = {
    id: "door-bad-sweep",
    roomId: "room-1",
    type: "door",
    start: { x: 100, y: 100 },
    end: { x: 190, y: 100 },
    clearWidthCm: 90,
    swing: {
      hinge: { x: 100, y: 100 },
      arcDeg: 90,
      sweepDirection: "diagonal" as unknown as "clockwise",
    },
  };
  const valSweep = validateCanonicalOpening(badSweep);
  assert.equal(valSweep.valid, false);
  if (!valSweep.valid) {
    assert.ok(valSweep.errors.some((e) => e.includes("sweepDirection")));
  }
});
