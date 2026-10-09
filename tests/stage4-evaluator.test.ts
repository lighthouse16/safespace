import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSpatialScene } from "../src/lib/spatial/analysis/evaluator";
import { resolveReportStatus } from "../src/components/workflow/ReportModal";
import type { SpatialFurniture, MobilityProfileData } from "../src/lib/spatial-model";
import type { Polygon2D } from "../src/lib/spatial";
import { useSafeSpaceStore } from "../src/store/safespace-store";

type Waypoint = { id: string; x: number; y: number };

// Mock localStorage for Node test environment
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MockLocalStorage(),
    writable: true,
    configurable: true,
  });
}

// Helper fixture creators
function createRectBoundary(widthCm: number, heightCm: number): Polygon2D {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, y: heightCm },
    { x: 0, y: heightCm },
  ];
}

const defaultProfile: MobilityProfileData = {
  id: "walker",
  name: "Rollator Walker",
  description: "Standard mobility walker",
  minClearanceCm: 90, // Corridor width requirement => 45 cm radius
  turningSpaceCm: 150,
  fallHistory: false,
  requiresSupport: true,
  lowLightSensitivity: "Moderate",
};

test("Stage 4 Evaluator: unconfigured route when fewer than 2 waypoints", () => {
  const boundary = createRectBoundary(600, 400);
  const furniture: SpatialFurniture[] = [];
  const waypoints: Waypoint[] = [{ id: "wp-1", x: 100, y: 100 }];

  const result = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture,
    routeWaypoints: waypoints,
    profile: defaultProfile,
  });

  assert.equal(result.summary.routeFeasibility, "unconfigured");
  assert.equal(result.summary.actionableDeficitsCount, 0);
  assert.equal(result.summary.pathLengthM ?? 0, 0);

  const unconfiguredFinding = result.findings.find((f) => f.id === "finding-route-unconfigured");
  assert.ok(unconfiguredFinding, "Should generate an unconfigured route observation");
  assert.equal(unconfiguredFinding?.classification, "advisory-observation");
  assert.equal(unconfiguredFinding?.evidence.source, "authoring-state");
});

test("Stage 4 Evaluator: clearance deficit detected on constrained route", () => {
  const boundary = createRectBoundary(800, 600);
  // Route from (100, 300) to (700, 300)
  // Two obstacles leave a 60 cm gap at x=350..450 (clearance radius 30 cm < required 45 cm)
  const furniture: SpatialFurniture[] = [
    {
      id: "f-top",
      name: "Top Cabinet",
      category: "cabinet",
      roomId: "room-1",
      x: 350,
      y: 170,
      width: 100,
      depth: 100,
      height: 80,
      rotation: 0,
      isFixed: false,
      isStableSupport: false,
      isConfirmed: true,
    },
    {
      id: "f-bottom",
      name: "Bottom Desk",
      category: "desk",
      roomId: "room-1",
      x: 350,
      y: 330,
      width: 100,
      depth: 100,
      height: 75,
      rotation: 0,
      isFixed: false,
      isStableSupport: false,
      isConfirmed: true,
    },
  ];

  const waypoints: Waypoint[] = [
    { id: "wp-start", x: 100, y: 300 },
    { id: "wp-mid", x: 400, y: 300 },
    { id: "wp-end", x: 700, y: 300 },
  ];

  const result = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: boundary,
    furniture,
    routeWaypoints: waypoints,
    profile: defaultProfile, // minClearanceCm: 90 => required radius 45 cm
  });

  assert.equal(result.summary.routeFeasibility, "clearance-deficit");
  assert.ok(result.summary.actionableDeficitsCount >= 1);
  assert.equal(result.summary.minimumClearanceCm, null);
  assert.equal(result.summary.pathLengthM, null);

  const deficitFinding = result.findings.find((f) => f.id === "finding-route-deficit");
  assert.ok(deficitFinding, "Should have route-deficit finding");
  assert.equal(deficitFinding?.classification, "actionable-deficit");
  assert.equal(deficitFinding?.evidence.source, "computed-geometry");
  assert.ok(deficitFinding?.evidence.failureReason);
  assert.equal(deficitFinding?.evidence.measuredQuantity, undefined);
  assert.equal(deficitFinding?.evidence.margin, undefined);
});

test("Stage 4 Evaluator: adequate corridor clearance on unblocked path", () => {
  const boundary = createRectBoundary(800, 600);
  const furniture: SpatialFurniture[] = [
    {
      id: "wall-cabinet",
      name: "Wall Cabinet",
      category: "cabinet",
      roomId: "room-1",
      x: 350,
      y: 50,
      width: 150,
      depth: 40,
      height: 90,
      rotation: 0,
      isFixed: false,
      isStableSupport: false,
      isConfirmed: true,
    },
  ];

  const waypoints: Waypoint[] = [
    { id: "wp-1", x: 100, y: 300 },
    { id: "wp-2", x: 700, y: 300 },
  ];

  const result = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: boundary,
    furniture,
    routeWaypoints: waypoints,
    profile: defaultProfile,
  });

  assert.equal(result.summary.routeFeasibility, "adequate");
  assert.equal(result.summary.actionableDeficitsCount, 0);
  assert.ok((result.summary.minimumClearanceCm ?? 0) >= 45);

  const adequateFinding = result.findings.find((f) => f.id === "finding-route-adequate");
  assert.ok(adequateFinding, "Should record adequate route observation");
  assert.equal(adequateFinding?.classification, "advisory-observation");
  assert.equal(adequateFinding?.evidence.source, "computed-geometry");
});

test("Stage 4 Evaluator: impassable route with diagnostic failure reason", () => {
  const boundary = createRectBoundary(800, 600);
  // Completely block room across vertical span with full barrier
  const furniture: SpatialFurniture[] = [
    {
      id: "wall-barr",
      name: "Full Divider Wall",
      category: "cabinet",
      roomId: "room-1",
      x: 350,
      y: 0,
      width: 100,
      depth: 600,
      height: 200,
      rotation: 0,
      isFixed: true,
      isStableSupport: false,
      isConfirmed: true,
    },
  ];

  const waypoints: Waypoint[] = [
    { id: "wp-start", x: 100, y: 300 },
    { id: "wp-end", x: 700, y: 300 },
  ];

  const result = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture,
    routeWaypoints: waypoints,
    profile: defaultProfile,
  });

  assert.equal(result.summary.routeFeasibility, "unreachable");
  const unreachableFinding = result.findings.find((f) => f.id === "finding-route-unreachable");
  assert.ok(unreachableFinding, "Must flag unreachable route deficit");
  assert.equal(unreachableFinding?.classification, "actionable-deficit");
  assert.equal(unreachableFinding?.severity, "critical");
  assert.ok(unreachableFinding?.evidence.failureReason);
});

test("Stage 4 Evaluator: physical obstacle overlap and boundary overhang detection", () => {
  const boundary = createRectBoundary(500, 500);

  // Two overlapping pieces of furniture
  const furniture: SpatialFurniture[] = [
    {
      id: "desk-1",
      name: "Desk 1",
      category: "desk",
      roomId: "room-1",
      x: 100,
      y: 100,
      width: 120,
      depth: 80,
      height: 75,
      rotation: 0,
      isFixed: false,
      isStableSupport: true,
      isConfirmed: true,
    },
    {
      id: "desk-2",
      name: "Desk 2",
      category: "desk",
      roomId: "room-1",
      x: 150, // Overlaps with desk-1 in x: [100..220] and y: [100..180]
      y: 120,
      width: 100,
      depth: 80,
      height: 75,
      rotation: 0,
      isFixed: false,
      isStableSupport: true,
      isConfirmed: true,
    },
    {
      id: "overhang-chair",
      name: "Out-of-bounds Chair",
      category: "chair",
      roomId: "room-1",
      x: 480, // Boundary is 500 wide; with width 60, extends to 540 cm (outside boundary)
      y: 200,
      width: 60,
      depth: 60,
      height: 80,
      rotation: 0,
      isFixed: false,
      isStableSupport: false,
      isConfirmed: true,
    },
  ];

  const result = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture,
    routeWaypoints: [],
    profile: defaultProfile,
  });

  // Verify collision finding
  const collisionFinding = result.findings.find(
    (f) => f.id === "finding-collision-desk-1-desk-2" || f.id === "finding-collision-desk-2-desk-1"
  );
  assert.ok(collisionFinding, "Must detect physical overlap between desk-1 and desk-2");
  assert.equal(collisionFinding?.classification, "actionable-deficit");
  assert.deepEqual(collisionFinding?.entityIds?.sort(), ["desk-1", "desk-2"].sort());

  // Verify overhang finding
  const overhangFinding = result.findings.find((f) => f.id === "finding-boundary-encroach-overhang-chair");
  assert.ok(overhangFinding, "Must detect furniture protruding beyond room boundary");
  assert.equal(overhangFinding?.classification, "actionable-deficit");
});

test("Stage 4 Evaluator: mandates 4 explicit unassessed scope boundaries", () => {
  const boundary = createRectBoundary(500, 500);
  const result = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: [],
    profile: defaultProfile,
  });

  const unassessed = result.findings.filter((f) => f.classification === "unassessed-scope");
  assert.equal(unassessed.length, 4);

  const ids = unassessed.map((u) => u.id).sort();
  assert.deepEqual(ids, [
    "finding-unassessed-anchorage",
    "finding-unassessed-flooring",
    "finding-unassessed-lighting",
    "finding-unassessed-moisture",
  ]);

  for (const item of unassessed) {
    assert.equal(item.evidence.source, "unassessed");
    assert.equal(item.location, undefined, "Unassessed scope cannot have fake floorplan coordinates");
  }
});

test("Stage 4 Store Reactivity: updating furniture or mobility profile updates findings", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }
  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(800, 600);
  const nowIso = new Date().toISOString();
  const createResult = store.createAndLoadUserAssessment({
    metadata: {
      id: "test-user-space",
      name: "Test Space",
      facilityName: "Test Clinic",
      spaceName: "Reactivity Room",
      environmentType: "clinic",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    boundaryCm: boundary,
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 100,
      unit: "cm",
      pixelDistance: 100,
      originPolicy: "canvas-origin-0-0",
    },
  });
  assert.equal(createResult.success, true);

  // Add 2 waypoints
  store.addRouteWaypoint("Start", 100, 300);
  store.addRouteWaypoint("End", 700, 300);

  // Initial findings with no obstacles
  const initial = store.getSpatialFindings();
  assert.equal(initial.summary.routeFeasibility, "adequate");
  const initialClearance = initial.summary.minimumClearanceCm;

  // Add furniture
  store.addFurniture("cabinet");
  const currentFurniture = useSafeSpaceStore.getState().furniture;
  const addedItem = currentFurniture[currentFurniture.length - 1];
  assert.ok(addedItem, "Cabinet should be added to store");

  // Move it right near the route at (400, 220) where it creates a bottleneck
  store.moveFurniture(addedItem.id, 400, 220);
  const afterObstacle = store.getSpatialFindings();

  assert.notEqual(
    afterObstacle.summary.minimumClearanceCm,
    initialClearance,
    "Minimum clearance must reactively recompute when furniture moves"
  );

  // Change profile clearance requirement
  store.updateProfile({ minClearanceCm: 120 });
  const afterProfile = store.getSpatialFindings();
  assert.equal(
    afterProfile.summary.corridorWidthCm,
    120,
    "Required corridor width must update from mobility profile"
  );

  // Clean up store
  store.resetToDemo();
});

test("Stage 4 Regression: zero measurement fabrication on clearance-insufficient route failure", () => {
  const boundary = createRectBoundary(800, 600);
  const failureReasons = [
    "Path requires 45 cm clearance, but narrowest passage provides only 24 cm at obstacle 12 and 18 cm at wall",
    "Clearance deficit along transit passage without explicit numbers",
    "Arbitrary failure message with numbers 123 and 456 cm",
  ];

  for (const reason of failureReasons) {
    const result = evaluateSpatialScene({
      canonicalBoundary: boundary,
      furniture: [],
      routeWaypoints: [
        { id: "w1", x: 100, y: 300 },
        { id: "w2", x: 700, y: 300 },
      ],
      routeResult: {
        status: "clearance-insufficient",
        reason,
      },
      profile: defaultProfile,
    });

    assert.equal(result.summary.routeFeasibility, "clearance-deficit");
    assert.equal(result.summary.minimumClearanceCm, null, "Failure route must never report a fabricated clearance value");
    assert.equal(result.summary.pathLengthM, null, "Failure route must never report a fabricated path length");

    const finding = result.findings.find((f) => f.kind === "route-deficit");
    assert.ok(finding);
    assert.equal(finding?.evidence.measuredQuantity, undefined, "No measuredQuantity on route failure");
    assert.equal(finding?.evidence.margin, undefined, "No margin on route failure");
    assert.equal(finding?.evidence.failureReason, reason, "Preserves exact engine failure reason");
  }
});

test("Stage 4 Regression: routing failure semantics are preserved without conflation", () => {
  const boundary = createRectBoundary(800, 600);
  const waypoints = [
    { id: "w1", x: 100, y: 300 },
    { id: "w2", x: 700, y: 300 },
  ];

  // 1. start-out-of-bounds
  const outOfBoundsResult = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: waypoints,
    routeResult: {
      status: "start-out-of-bounds",
      reason: "Start point lies outside the walkable room boundary",
    },
    profile: defaultProfile,
  });
  assert.equal(outOfBoundsResult.summary.routeFeasibility, "out-of-bounds");
  assert.ok(outOfBoundsResult.findings.some((f) => f.kind === "route-out-of-bounds"));
  assert.equal(outOfBoundsResult.summary.minimumClearanceCm, null);

  // 2. invalid-geometry
  const invalidGeomResult = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: waypoints,
    routeResult: {
      status: "invalid-geometry",
      reason: "Start point coordinates must be valid finite numbers",
    },
    profile: defaultProfile,
  });
  assert.equal(invalidGeomResult.summary.routeFeasibility, "invalid-geometry");
  assert.ok(invalidGeomResult.findings.some((f) => f.kind === "route-invalid-geometry"));

  // 3. start-blocked
  const startBlockedResult = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: waypoints,
    routeResult: {
      status: "start-blocked",
      reason: "Start point is blocked inside obstacle footprint",
    },
    profile: defaultProfile,
  });
  assert.equal(startBlockedResult.summary.routeFeasibility, "unreachable");
  assert.ok(startBlockedResult.findings.some((f) => f.kind === "route-endpoint-blocked"));

  // 4. unreachable
  const unreachableResult = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: waypoints,
    routeResult: {
      status: "unreachable",
      reason: "No traversable grid path exists",
    },
    profile: defaultProfile,
  });
  assert.equal(unreachableResult.summary.routeFeasibility, "unreachable");
  assert.ok(unreachableResult.findings.some((f) => f.kind === "route-unreachable"));
});

test("Stage 4 Regression: user scene missing boundary does not fall back to DEMO_CLINIC_ENVELOPE", () => {
  const result = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: null,
    rooms: [],
    furniture: [],
    routeWaypoints: [
      { id: "w1", x: 100, y: 100 },
      { id: "w2", x: 300, y: 300 },
    ],
    profile: defaultProfile,
  });

  assert.equal(result.summary.routeFeasibility, "invalid-geometry");
  assert.ok(result.findings.some((f) => f.kind === "route-invalid-geometry"));
  // Boundary encroachment should not fire against demo envelope
  assert.equal(result.findings.some((f) => f.kind === "boundary-encroachment"), false);
});

test("Stage 4 Regression: invalid mobility profile clearance does not default to 90 cm", () => {
  const invalidProfile: MobilityProfileData = {
    ...defaultProfile,
    minClearanceCm: -10,
  };

  const result = evaluateSpatialScene({
    canonicalBoundary: createRectBoundary(800, 600),
    furniture: [],
    routeWaypoints: [
      { id: "w1", x: 100, y: 100 },
      { id: "w2", x: 300, y: 300 },
    ],
    profile: invalidProfile,
  });

  assert.equal(result.summary.corridorWidthCm, null);
  assert.equal(result.summary.requiredClearanceRadiusCm, null);
  assert.equal(result.summary.routeFeasibility, "invalid-geometry");
});

test("Stage 4 Regression: concave L-shaped room detects furniture edge crossing into exterior notch", () => {
  // L-shaped room:
  // [0..1000] x [0..500] and [0..500] x [500..1000]
  // Notch is [500..1000] x [500..1000] (exterior void)
  const lShapedRoom: Polygon2D = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 500 },
    { x: 500, y: 500 },
    { x: 500, y: 1000 },
    { x: 0, y: 1000 },
  ];

  // A table placed with center at (650, 650) in the notch, rotated 45 degrees:
  // Corners reach into the wings (inside room), but edges cross through the exterior notch
  // Center is (650, 650) in the notch, width: 400, depth: 40, rotation: 135 deg:
  // endpoints: roughly (791, 508) in horizontal wing and (508, 791) in vertical wing!
  // Midpoint of the long edge crosses through (650, 650) which is in the void notch.
  const diagonalBridgeTable: SpatialFurniture = {
    id: "bridge-table",
    name: "Diagonal Bridge Table",
    category: "table",
    roomId: "room-1",
    x: 650,
    y: 650,
    width: 400,
    depth: 40,
    height: 75,
    rotation: 135,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
  };

  const result = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: lShapedRoom,
    furniture: [diagonalBridgeTable],
    routeWaypoints: [],
    profile: defaultProfile,
  });

  const overhangFinding = result.findings.find(
    (f) => f.id === "finding-boundary-encroach-bridge-table"
  );
  assert.ok(overhangFinding, "Must detect boundary overhang when edge crosses exterior concave notch");
  assert.equal(overhangFinding?.classification, "actionable-deficit");
});

test("Stage 4 Regression: removes unsupported 1.1 kN claims and claims of regulatory compliance", () => {
  const result = evaluateSpatialScene({
    canonicalBoundary: createRectBoundary(800, 600),
    furniture: [],
    routeWaypoints: [],
    profile: defaultProfile,
  });

  const anchorageFinding = result.findings.find((f) => f.id === "finding-unassessed-anchorage");
  assert.ok(anchorageFinding);
  assert.equal(
    anchorageFinding?.description.includes("1.1 kN"),
    false,
    "Must not claim 1.1 kN load requirement"
  );
  assert.equal(
    anchorageFinding?.evidence.rawEvidenceString.includes("1.1"),
    false,
    "Evidence must not claim 1.1 kN"
  );
});

test("Stage 4 Regression: invalid inputs and out-of-bounds are validation observations without physical severity", () => {
  const boundary = createRectBoundary(800, 600);

  // 1. Invalid geometry from non-positive profile clearance
  const invalidProfile: MobilityProfileData = {
    ...defaultProfile,
    minClearanceCm: 0,
  };
  const geomResult = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: [
      { id: "w1", x: 100, y: 100 },
      { id: "w2", x: 500, y: 500 },
    ],
    profile: invalidProfile,
  });

  assert.equal(geomResult.summary.routeFeasibility, "invalid-geometry");
  assert.equal(geomResult.summary.actionableDeficitsCount, 0, "Invalid geometry must not inflate actionable deficit count");
  const geomFinding = geomResult.findings.find((f) => f.kind === "route-invalid-geometry");
  assert.ok(geomFinding);
  assert.equal(geomFinding?.classification, "advisory-observation");
  assert.equal(geomFinding?.status, "needs-review");
  assert.equal(geomFinding?.severity, undefined, "Validation issue must have no physical/clinical severity");

  // 2. Out of bounds waypoint
  const oobResult = evaluateSpatialScene({
    canonicalBoundary: boundary,
    furniture: [],
    routeWaypoints: [
      { id: "w1", x: 100, y: 100 },
      { id: "w2", x: 900, y: 900 }, // outside 800x600 boundary
    ],
    profile: defaultProfile,
  });

  assert.equal(oobResult.summary.routeFeasibility, "out-of-bounds");
  assert.equal(oobResult.summary.actionableDeficitsCount, 0, "Out of bounds waypoint must not count as physical obstacle hazard");
  const oobFinding = oobResult.findings.find((f) => f.kind === "route-out-of-bounds");
  assert.ok(oobFinding);
  assert.equal(oobFinding?.classification, "advisory-observation");
  assert.equal(oobFinding?.status, "needs-review");
  assert.equal(oobFinding?.severity, undefined, "Out of bounds waypoint must not have physical severity");
});

test("Stage 4 Regression: Report status truthfulness across assessment scenarios", () => {
  // Scenario 1: New user scene with 0 waypoints (unconfigured)
  const unconfiguredResult = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: createRectBoundary(600, 400),
    furniture: [],
    routeWaypoints: [],
    profile: defaultProfile,
  });
  const unconfiguredStatus = resolveReportStatus(unconfiguredResult.summary);
  assert.equal(unconfiguredStatus.isClear, false);
  assert.equal(unconfiguredStatus.isAmber, true);
  assert.equal(unconfiguredStatus.statusLabel, "Incomplete — Transit Route Unconfigured");
  assert.equal(unconfiguredStatus.statusBadgeClass, "text-amber-700");
  assert.equal(unconfiguredStatus.deficitsBadgeLabel, "Route Unconfigured");
  assert.notEqual(unconfiguredStatus.statusLabel, "Passage Clear");
  assert.notEqual(unconfiguredStatus.deficitsBadgeLabel, "No Geometric Deficits");

  // Scenario 2: Invalid geometry
  const invalidGeomResult = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: null,
    furniture: [],
    routeWaypoints: [
      { id: "w1", x: 100, y: 100 },
      { id: "w2", x: 300, y: 300 },
    ],
    profile: defaultProfile,
  });
  const invalidStatus = resolveReportStatus(invalidGeomResult.summary);
  assert.equal(invalidStatus.isClear, false);
  assert.equal(invalidStatus.isAmber, true);
  assert.equal(invalidStatus.statusLabel, "Incomplete — Invalid Geometry / Input Validation");
  assert.equal(invalidStatus.deficitsBadgeLabel, "Invalid Geometry");

  // Scenario 3: Route clearance deficit failure
  const deficitResult = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: createRectBoundary(800, 600),
    furniture: [
      {
        id: "f-top",
        name: "Top Cabinet",
        category: "cabinet",
        roomId: "room-1",
        x: 350,
        y: 170,
        width: 100,
        depth: 100,
        height: 80,
        rotation: 0,
        isFixed: false,
        isStableSupport: false,
        isConfirmed: true,
      },
      {
        id: "f-bottom",
        name: "Bottom Desk",
        category: "desk",
        roomId: "room-1",
        x: 350,
        y: 330,
        width: 100,
        depth: 100,
        height: 75,
        rotation: 0,
        isFixed: false,
        isStableSupport: false,
        isConfirmed: true,
      },
    ],
    routeWaypoints: [
      { id: "w1", x: 100, y: 300 },
      { id: "w2", x: 400, y: 300 },
      { id: "w3", x: 700, y: 300 },
    ],
    profile: defaultProfile,
  });
  const deficitStatus = resolveReportStatus(deficitResult.summary);
  assert.equal(deficitStatus.isClear, false);
  assert.equal(deficitStatus.isRed, true);
  assert.equal(deficitStatus.deficitsBadgeLabel, "Action Required");
  assert.equal(deficitStatus.clearanceBadgeLabel, "Clearance Deficit");

  // Scenario 4: Adequate route with no physical deficits
  const adequateResult = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: createRectBoundary(800, 600),
    furniture: [],
    routeWaypoints: [
      { id: "w1", x: 100, y: 300 },
      { id: "w2", x: 700, y: 300 },
    ],
    profile: defaultProfile,
  });
  const adequateStatus = resolveReportStatus(adequateResult.summary);
  assert.equal(adequateStatus.isClear, true);
  assert.equal(adequateStatus.statusLabel, "Configured route target satisfied (limited 2D scope)");
  assert.equal(adequateStatus.statusBadgeClass, "text-emerald-700");
  assert.equal(adequateStatus.deficitsBadgeLabel, "No Detected Deficits (2D Scope)");
  assert.equal(adequateStatus.clearanceBadgeLabel, "Target Satisfied (2D Scope)");

  // Scenario 5: Demo fixture initial state
  const demoResult = evaluateSpatialScene({
    assessmentType: "demo",
    routeWaypoints: [
      { id: "dw1", x: 120, y: 360 },
      { id: "dw2", x: 400, y: 320 },
      { id: "dw3", x: 620, y: 200 },
      { id: "dw4", x: 720, y: 200 },
    ],
    profile: defaultProfile,
  });
  const demoStatus = resolveReportStatus(demoResult.summary);
  assert.equal(demoStatus.isClear, false);
  assert.equal(demoStatus.isRed, true);
  assert.ok(demoStatus.statusLabel.includes("Deficit"));
});
