import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSpatialScene } from "../src/lib/spatial/analysis/evaluator";
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
  assert.ok((result.summary.minimumClearanceCm ?? 0) < 45);

  const deficitFinding = result.findings.find((f) => f.id === "finding-route-deficit");
  assert.ok(deficitFinding, "Should have route-deficit finding");
  assert.equal(deficitFinding?.classification, "actionable-deficit");
  assert.equal(deficitFinding?.evidence.source, "computed-geometry");
  assert.ok(deficitFinding?.evidence.measuredQuantity?.includes("clearance radius"));
  assert.ok(deficitFinding?.evidence.requiredQuantity?.includes("45 cm"));
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
