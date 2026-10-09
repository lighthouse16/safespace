import test from "node:test";
import assert from "node:assert/strict";
import { optimizeLayout, computeSceneFingerprint } from "../src/lib/spatial/optimization";
import { useSafeSpaceStore, computeStoreRoute } from "../src/store/safespace-store";
import type { SpatialFurniture, MobilityProfileData } from "../src/lib/spatial-model";
import {
  INITIAL_FURNITURE,
  INITIAL_ROOMS,
  INITIAL_WALLS,
  INITIAL_DOORS,
  INITIAL_ROUTE,
  MOBILITY_PROFILES,
} from "../src/lib/spatial-model";
import type { Polygon2D } from "../src/lib/spatial";
import { SAFESPACE_STORAGE_KEY } from "../src/lib/storage/persistence";

// Mock localStorage for node test runner
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

const defaultProfile: MobilityProfileData = {
  id: "walker",
  name: "Rollator Walker",
  description: "Standard mobility walker",
  minClearanceCm: 90,
  turningSpaceCm: 150,
  fallHistory: false,
  requiresSupport: true,
  lowLightSensitivity: "Moderate",
};

function createRectBoundary(widthCm: number, heightCm: number): Polygon2D {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, heightCm: heightCm, y: heightCm },
    { x: 0, y: heightCm },
  ].map((p) => ({ x: p.x, y: p.y }));
}

// ---------------------------------------------------------------------------
// 1. Rectangular room: movable obstacle resolved, fixed obstacle infeasible
// ---------------------------------------------------------------------------

test("Stage 5 Optimizer: rectangular room with movable obstacle generates verified clearance improvement", () => {
  const boundary = createRectBoundary(600, 600);
  const movableChair: SpatialFurniture = {
    id: "chair-blocking",
    name: "Blocking Armchair",
    category: "chair",
    roomId: "room-1",
    x: 300,
    y: 275,
    width: 60,
    depth: 60,
    height: 80,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
  };

  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 300 },
    { id: "w2", name: "Mid", x: 300, y: 300 },
    { id: "w3", name: "End", x: 500, y: 300 },
  ];

  const result = optimizeLayout({
    furniture: [movableChair],
    waypoints,
    profile: defaultProfile,
    boundary,
    assessmentType: "user",
  });

  assert.equal(result.status, "improved");
  assert.ok(result.candidates.length >= 1, "Must generate at least 1 verified alternative");
  assert.ok(result.candidates.length <= 3, "Must not exceed 3 candidates");

  const top = result.candidates[0];
  assert.ok(top.moves.length >= 1);
  assert.equal(top.moves[0].furnitureId, "chair-blocking");
  assert.notEqual(top.moves[0].toPosition.y, 275, "Obstacle must be moved away from transit centerline");

  // Verified candidate must have fewer or equal deficits and valid route
  assert.ok(top.metrics.actionableDeficitsDelta <= 0);
  assert.ok(
    top.metrics.routeFeasibility === "adequate" ||
      (top.metrics.clearanceGainCm !== null && top.metrics.clearanceGainCm > 0)
  );
  assert.ok(!top.moves.some((m) => m.distanceCm <= 0));
});

test("Stage 5 Optimizer: rectangular room with fixed obstacle returns infeasible status and 0 candidates", () => {
  const boundary = createRectBoundary(600, 600);
  const fixedObstacle: SpatialFurniture = {
    id: "cabinet-fixed",
    name: "Built-in Cabinet",
    category: "cabinet",
    roomId: "room-1",
    x: 300,
    y: 275,
    width: 60,
    depth: 60,
    height: 120,
    rotation: 0,
    isFixed: true, // Fixed fixture cannot be moved
    isStableSupport: true,
    isConfirmed: true,
  };

  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 300 },
    { id: "w2", name: "Mid", x: 300, y: 300 },
    { id: "w3", name: "End", x: 500, y: 300 },
  ];

  const result = optimizeLayout({
    furniture: [fixedObstacle],
    waypoints,
    profile: defaultProfile,
    boundary,
    assessmentType: "user",
  });

  assert.equal(result.status, "infeasible");
  assert.equal(result.candidates.length, 0);
  assert.match(result.message, /fixed/i);
  assert.equal(result.movableFurnitureCount, 0);
  assert.equal(result.unmovableFurnitureCount, 1);
});

// ---------------------------------------------------------------------------
// 2. Empty room & already optimal baseline
// ---------------------------------------------------------------------------

test("Stage 5 Optimizer: empty room with adequate route returns already_optimal with 0 candidates", () => {
  const boundary = createRectBoundary(600, 600);
  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 300 },
    { id: "w2", name: "End", x: 500, y: 300 },
  ];

  const result = optimizeLayout({
    furniture: [],
    waypoints,
    profile: defaultProfile,
    boundary,
    assessmentType: "user",
  });

  assert.equal(result.status, "already_optimal");
  assert.equal(result.candidates.length, 0);
  assert.match(result.message, /no clearance deficits detected/i);
});

// ---------------------------------------------------------------------------
// 3. Unconfigured route and missing boundary validation
// ---------------------------------------------------------------------------

test("Stage 5 Optimizer: unconfigured route with fewer than 2 waypoints returns unconfigured status", () => {
  const boundary = createRectBoundary(600, 600);
  const result = optimizeLayout({
    furniture: [],
    waypoints: [{ id: "w1", name: "Start", x: 100, y: 300 }],
    profile: defaultProfile,
    boundary,
    assessmentType: "user",
  });

  assert.equal(result.status, "unconfigured");
  assert.equal(result.candidates.length, 0);
  assert.match(result.message, /at least 2.*waypoints/i);
});

test("Stage 5 Optimizer: user assessment without boundary returns unconfigured status", () => {
  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 300 },
    { id: "w2", name: "End", x: 500, y: 300 },
  ];

  const result = optimizeLayout({
    furniture: [],
    waypoints,
    profile: defaultProfile,
    boundary: null,
    assessmentType: "user",
  });

  assert.equal(result.status, "unconfigured");
  assert.equal(result.candidates.length, 0);
  assert.match(result.message, /boundary is required/i);
});

// ---------------------------------------------------------------------------
// 4. L-shaped concave room: rejects candidate protruding into exterior notch
// ---------------------------------------------------------------------------

test("Stage 5 Optimizer: L-shaped room rejects candidates that would penetrate exterior concavity", () => {
  // L-shaped room: 600x600 with top-right exterior cutout [300, 600] x [0, 300]
  const lBoundary: Polygon2D = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 300 },
    { x: 600, y: 300 },
    { x: 600, y: 600 },
    { x: 0, y: 600 },
  ];

  const chairNearCutout: SpatialFurniture = {
    id: "chair-l",
    name: "Lounge Chair",
    category: "chair",
    roomId: "room-1",
    x: 220,
    y: 200,
    width: 60,
    depth: 60,
    height: 80,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
  };

  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 150 },
    { id: "w2", name: "Corner", x: 200, y: 250 },
    { id: "w3", name: "End", x: 200, y: 500 },
  ];

  const result = optimizeLayout({
    furniture: [chairNearCutout],
    waypoints,
    profile: defaultProfile,
    boundary: lBoundary,
    assessmentType: "user",
  });

  if (result.status === "improved") {
    // If candidate found, assert every moved footprint is strictly inside L-boundary
    for (const cand of result.candidates) {
      for (const f of cand.furniture) {
        // x must not be in the exterior cutout [300, 600] when y < 300
        const rightEdge = f.x + f.width;
        const topEdge = f.y;
        if (topEdge < 300) {
          assert.ok(rightEdge <= 300, `Furniture ${f.id} must not encroach exterior notch (x: ${rightEdge}, y: ${topEdge})`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Queen Care Clinic Demo Fixture: deterministic candidate generation
// ---------------------------------------------------------------------------

test("Stage 5 Optimizer: Queen Care Clinic generates verified alternatives reducing baseline deficits", () => {
  const result = optimizeLayout({
    furniture: INITIAL_FURNITURE,
    rooms: INITIAL_ROOMS,
    walls: INITIAL_WALLS,
    doors: INITIAL_DOORS,
    waypoints: INITIAL_ROUTE,
    profile: MOBILITY_PROFILES[0],
    assessmentType: "demo",
  });

  assert.equal(result.status, "improved");
  assert.ok(result.candidates.length >= 1, "Must generate at least 1 candidate for Queen Care demo");
  assert.ok(result.candidates.length <= 3, "Must not return more than 3 candidates");

  // Assert candidates are unique
  const ids = result.candidates.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "All candidate IDs must be unique");

  // Assert no immutable fixtures were moved
  const fixedIds = new Set(INITIAL_FURNITURE.filter((f) => f.isFixed).map((f) => f.id));
  for (const cand of result.candidates) {
    for (const move of cand.moves) {
      assert.ok(!fixedIds.has(move.furnitureId), `Fixed fixture ${move.furnitureId} must never be moved`);
      assert.ok(move.distanceCm > 0, "Move distance must be positive");
    }
    // Actionable deficits must be reduced
    assert.ok(
      cand.metrics.actionableDeficitsDelta < 0,
      `Candidate ${cand.id} must reduce actionable deficits (delta: ${cand.metrics.actionableDeficitsDelta})`
    );
  }
});

// ---------------------------------------------------------------------------
// 6. Store Reactivity, Apply Candidate, and Revert Lifecycle
// ---------------------------------------------------------------------------

test("Stage 5 Store: applying a layout candidate persists changes and allows clean revert", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  assert.ok(optResult.candidates.length >= 1);

  const candidateToApply = optResult.candidates[0];
  const initialDoctorChairPos = store.furniture.find((f) => f.id === "chair-doctor");
  assert.ok(initialDoctorChairPos);
  assert.equal(initialDoctorChairPos?.x, 630);

  // Apply candidate
  const applyRes = store.applyLayoutCandidate(candidateToApply.id);
  assert.equal(applyRes.success, true);
  // P0 B: User accepted layout must not imply clinical OT sign-off
  assert.equal(useSafeSpaceStore.getState().approvalStatus, "draft");
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, candidateToApply.id);

  const updatedDoctorChairPos = useSafeSpaceStore.getState().furniture.find((f) => f.id === "chair-doctor");
  assert.notEqual(updatedDoctorChairPos?.x, 630, "Doctor chair must have new position after applying candidate");
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null, "Baseline snapshot must be preserved");

  // Revert back to baseline
  store.revertLayoutCandidate();
  assert.equal(useSafeSpaceStore.getState().approvalStatus, "draft");
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);
  assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null);

  const revertedChairPos = useSafeSpaceStore.getState().furniture.find((f) => f.id === "chair-doctor");
  assert.equal(revertedChairPos?.x, 630, "Doctor chair must be reverted to baseline coordinate 630");

  store.resetToDemo();
});

test("Stage 5 Store: user assessment layout candidate application triggers durable persistence", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "user-stage5-test",
      name: "Stage 5 Suite Space",
      facilityName: "Test Clinic",
      spaceName: "Consultation 3",
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

  store.addRouteWaypoint("Start", 100, 350);
  store.addRouteWaypoint("Mid", 350, 350);
  store.addRouteWaypoint("End", 600, 350);

  // Add movable furniture right at Mid (350, 350)
  store.addFurniture("chair");
  const addedChair = useSafeSpaceStore.getState().furniture[0];
  assert.ok(addedChair);
  store.moveFurniture(addedChair.id, 350, 330);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  assert.ok(optResult.candidates.length >= 1);

  // Apply candidate
  const applyRes = store.applyLayoutCandidate(optResult.candidates[0].id);
  assert.equal(applyRes.success, true);
  assert.equal(useSafeSpaceStore.getState().storageStatus, "saved");

  // Check localStorage contains the updated coordinates
  const storedJson = globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY);
  assert.ok(storedJson);
  const parsed = JSON.parse(storedJson!);
  const persistedChair = parsed.furniture.find((f: { id: string; x: number; y: number }) => f.id === addedChair.id);
  assert.ok(persistedChair);
  assert.ok(
    persistedChair.x !== 350 || persistedChair.y !== 330,
    "Persisted furniture must have candidate position different from baseline"
  );

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 7. Gate 3 Review Hardening: P0 A - Candidate Preview Isolation & Cache Invalidation
// ---------------------------------------------------------------------------

test("Stage 5 Review Hardening: candidate preview isolates routeResult and Stage 4 findings", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  assert.ok(optResult.candidates.length >= 1);

  const baselineRouteBefore = useSafeSpaceStore.getState().routeResult;
  const baselineEvalBefore = store.getSpatialFindings();

  // Preview candidate 0
  const candidate = optResult.candidates[0];
  store.selectCandidate(candidate.id);

  assert.equal(useSafeSpaceStore.getState().selectedCandidateId, candidate.id);
  // Canonical routeResult must remain strictly baseline!
  assert.deepEqual(useSafeSpaceStore.getState().routeResult, baselineRouteBefore);
  // getSpatialFindings must evaluate canonical furniture and canonical routeResult!
  const evalAfterPreview = store.getSpatialFindings();
  assert.equal(
    evalAfterPreview.summary.actionableDeficitsCount,
    baselineEvalBefore.summary.actionableDeficitsCount
  );

  // Deselect candidate
  store.selectCandidate(null);
  assert.equal(useSafeSpaceStore.getState().selectedCandidateId, null);

  store.resetToDemo();
});

test("Stage 5 Review Hardening: scene and profile mutations invalidate optimization cache", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  assert.ok(useSafeSpaceStore.getState().activeOptimizationResult !== null);

  // Changing mobility profile invalidates optimization cache
  store.setProfile("cane");
  assert.equal(useSafeSpaceStore.getState().activeOptimizationResult, null);
  assert.equal(useSafeSpaceStore.getState().selectedCandidateId, null);

  // Attempting to apply stale candidate from old optResult must be rejected
  const applyRes = store.applyLayoutCandidate(optResult.candidates[0].id);
  assert.equal(applyRes.success, false);
  assert.match(applyRes.error || "", /No active optimization result/i);

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 8. Gate 3 Review Hardening: P0 B - Storage Failure & Reload Revert Durability
// ---------------------------------------------------------------------------

test("Stage 5 Review Hardening: storage failure on Apply and Revert prevents deceptive success", () => {
  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "storage-fail-test",
      name: "Storage Failure Space",
      facilityName: "Test Clinic",
      spaceName: "Room 1",
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

  store.addRouteWaypoint("Start", 100, 350);
  store.addRouteWaypoint("Mid", 350, 350);
  store.addRouteWaypoint("End", 600, 350);

  store.addFurniture("chair");
  const addedChair = useSafeSpaceStore.getState().furniture[0];
  store.moveFurniture(addedChair.id, 350, 330);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const candidateId = optResult.candidates[0].id;

  // Mock localStorage.setItem failure
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError: storage is full");
  };

  try {
    const applyRes = store.applyLayoutCandidate(candidateId);
    assert.equal(applyRes.success, false);
    assert.ok(applyRes.error);
    assert.equal(useSafeSpaceStore.getState().storageStatus, "error");
    // Furniture was not committed
    assert.equal(useSafeSpaceStore.getState().furniture[0].x, 350);
    assert.equal(useSafeSpaceStore.getState().furniture[0].y, 330);
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }

  store.resetToDemo();
});

test("Stage 5 Review Hardening: reload restores accepted layout and baseline for durable revert", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "durable-revert-test",
      name: "Durable Space",
      facilityName: "Test Clinic",
      spaceName: "Consult 1",
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

  store.addRouteWaypoint("Start", 100, 350);
  store.addRouteWaypoint("Mid", 350, 350);
  store.addRouteWaypoint("End", 600, 350);

  store.addFurniture("chair");
  const chair = useSafeSpaceStore.getState().furniture[0];
  store.moveFurniture(chair.id, 350, 330);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  // Apply candidate
  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, cand.id);
  assert.equal(useSafeSpaceStore.getState().approvalStatus, "draft");

  const acceptedX = useSafeSpaceStore.getState().furniture[0].x;
  const acceptedY = useSafeSpaceStore.getState().furniture[0].y;
  assert.ok(acceptedX !== 350 || acceptedY !== 330);

  // Simulate hard browser reload by hydrating from storage
  store.hydrateFromStorage();

  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, cand.id);
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);
  assert.equal(useSafeSpaceStore.getState().furniture[0].x, acceptedX);
  assert.equal(useSafeSpaceStore.getState().furniture[0].y, acceptedY);
  assert.equal(useSafeSpaceStore.getState().approvalStatus, "draft");

  // Revert back to baseline after reload
  const revRes = store.revertLayoutCandidate();
  assert.equal(revRes.success, true);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);
  assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null);
  assert.equal(useSafeSpaceStore.getState().furniture[0].x, 350);
  assert.equal(useSafeSpaceStore.getState().furniture[0].y, 330);

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 9. Gate 3 Review Hardening: P0 C - Null Metric Preservation & New Deficit Rejection
// ---------------------------------------------------------------------------

test("Stage 5 Review Hardening: null baseline clearance yields clearanceGainCm null", () => {
  const boundary = createRectBoundary(600, 600);
  // Movable chair directly on top of waypoint -> baseline has route clearance failure (null clearance)
  const blockingChair: SpatialFurniture = {
    id: "chair-tight",
    name: "Tight Chair",
    category: "chair",
    roomId: "room-1",
    x: 300,
    y: 275,
    width: 60,
    depth: 60,
    height: 80,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
  };

  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 300 },
    { id: "w2", name: "Mid", x: 300, y: 300 },
    { id: "w3", name: "End", x: 500, y: 300 },
  ];

  const result = optimizeLayout({
    furniture: [blockingChair],
    waypoints,
    profile: defaultProfile,
    boundary,
    assessmentType: "user",
  });

  assert.equal(result.status, "improved");
  assert.equal(result.baselineEvaluation.summary.minimumClearanceCm, null);

  for (const cand of result.candidates) {
    // When baseline clearance is null, clearanceGainCm must remain null (no fabricated gain!)
    assert.equal(cand.metrics.clearanceGainCm, null);
    // Improvement must be marked via becameFeasible
    assert.equal(cand.metrics.becameFeasible, true);
  }
});

test("Stage 5 Review Hardening: candidate introducing new collision is rejected", () => {
  const boundary = createRectBoundary(600, 600);
  // chair-1 blocks route at (300, 300)
  const chair1: SpatialFurniture = {
    id: "chair-1",
    name: "Chair 1",
    category: "chair",
    roomId: "room-1",
    x: 300,
    y: 275,
    width: 60,
    depth: 60,
    height: 80,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
  };
  // fixed table sitting at (300, 345) where dy: 70 would shift chair-1
  const tableFixed: SpatialFurniture = {
    id: "table-fixed",
    name: "Fixed Wall Table",
    category: "table",
    roomId: "room-1",
    x: 300,
    y: 350,
    width: 60,
    depth: 60,
    height: 75,
    rotation: 0,
    isFixed: true,
    isStableSupport: false,
    isConfirmed: true,
  };

  const waypoints = [
    { id: "w1", name: "Start", x: 100, y: 300 },
    { id: "w2", name: "Mid", x: 300, y: 300 },
    { id: "w3", name: "End", x: 500, y: 300 },
  ];

  const result = optimizeLayout({
    furniture: [chair1, tableFixed],
    waypoints,
    profile: defaultProfile,
    boundary,
    assessmentType: "user",
  });

  if (result.status === "improved") {
    // No accepted candidate can collide with table-fixed
    for (const cand of result.candidates) {
      const collisions = cand.evaluation.findings.filter((f) => f.kind === "obstacle-collision");
      assert.equal(collisions.length, 0, "No candidate may introduce an obstacle collision");
    }
  }
});

// ---------------------------------------------------------------------------
// 10. Gate 3 Review Hardening: P1 E - Deterministic Hard Compute Budget
// ---------------------------------------------------------------------------

test("Stage 5 Review Hardening: evaluation count respects maxEvaluations cap deterministically", () => {
  const result = optimizeLayout({
    furniture: INITIAL_FURNITURE,
    rooms: INITIAL_ROOMS,
    walls: INITIAL_WALLS,
    doors: INITIAL_DOORS,
    waypoints: INITIAL_ROUTE,
    profile: MOBILITY_PROFILES[0],
    assessmentType: "demo",
    maxEvaluations: 20,
  });

  assert.ok(result.computeBudget.evaluatedCount <= 20);
  assert.equal(result.computeBudget.maxEvaluations, 20);
  assert.ok(typeof result.computeBudget.prunedCount === "number");
});

// ---------------------------------------------------------------------------
// 11. Gate 3 Focused Hardening: P0 1 - Isolation of getSpatialFindings in Stage 5
// ---------------------------------------------------------------------------

test("Stage 5 Focused Hardening P0 1: getSpatialFindings isolates canonical baseline and ignores proposedFurniture in Stage 5", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");

  const baselineFindings = store.getSpatialFindings();
  const baselineFurniture = store.furniture;

  // Run optimization and select candidate
  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const candId = optResult.candidates[0].id;
  store.selectCandidate(candId);

  // In Stage 5, candidate is selected -> proposedFurniture exists and differs from baseline
  assert.ok(useSafeSpaceStore.getState().proposedFurniture !== null);
  assert.notDeepEqual(useSafeSpaceStore.getState().proposedFurniture, baselineFurniture);

  // getSpatialFindings() MUST evaluate canonical baseline (store.furniture and store.routeResult)
  const findingsWithPreview = store.getSpatialFindings();
  assert.deepEqual(findingsWithPreview.findings, baselineFindings.findings);
  assert.deepEqual(findingsWithPreview.summary, baselineFindings.summary);

  // Switching candidate must also keep findings strictly on baseline
  if (optResult.candidates.length > 1) {
    store.selectCandidate(optResult.candidates[1].id);
    const findingsCand2 = store.getSpatialFindings();
    assert.deepEqual(findingsCand2.findings, baselineFindings.findings);
    assert.deepEqual(findingsCand2.summary, baselineFindings.summary);
  }

  // Deselecting candidate also preserves baseline findings
  store.selectCandidate(null);
  const findingsDeselected = store.getSpatialFindings();
  assert.deepEqual(findingsDeselected.findings, baselineFindings.findings);
  assert.deepEqual(findingsDeselected.summary, baselineFindings.summary);

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 12. Gate 3 Focused Hardening: P1 4 - moveProposedFurniture is Preview-Only
// ---------------------------------------------------------------------------

test("Stage 5 Focused Hardening P1 4: moveProposedFurniture is preview-only and never mutates global routeResult", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");

  const baselineRouteResult = store.routeResult;
  assert.ok(baselineRouteResult);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];
  store.selectCandidate(cand.id);

  const proposedFurn = useSafeSpaceStore.getState().proposedFurniture;
  assert.ok(proposedFurn && proposedFurn.length > 0);
  const targetItem = proposedFurn[0];

  // Move proposed furniture item
  store.moveProposedFurniture(targetItem.id, targetItem.x + 25, targetItem.y + 25);

  // Global routeResult must remain completely untouched
  const currentRouteResult = useSafeSpaceStore.getState().routeResult;
  assert.deepEqual(currentRouteResult, baselineRouteResult);

  // Global furniture must remain untouched
  assert.deepEqual(useSafeSpaceStore.getState().furniture, INITIAL_FURNITURE);

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 13. Gate 3 Focused Hardening: P0 2 - Baseline Route & Findings from Snapshot
// ---------------------------------------------------------------------------

test("Stage 5 Focused Hardening P0 2: baseline route and findings derived truthfully from baseline snapshot after apply and reload", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "baseline-truth-test",
      name: "Baseline Truth Space",
      facilityName: "Test Clinic",
      spaceName: "Consult 1",
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

  store.addRouteWaypoint("Start", 100, 350);
  store.addRouteWaypoint("Mid", 350, 350);
  store.addRouteWaypoint("End", 600, 350);

  store.addFurniture("chair");
  const chair = useSafeSpaceStore.getState().furniture[0];
  store.moveFurniture(chair.id, 350, 330);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);

  const baselineSnapshot = useSafeSpaceStore.getState().baselineFurnitureSnapshot;
  assert.ok(baselineSnapshot !== null);
  assert.equal(baselineSnapshot[0].x, 350);
  assert.equal(baselineSnapshot[0].y, 330);

  // Compute baseline route from baseline snapshot + current context
  const baselineRoute = computeStoreRoute(
    baselineSnapshot,
    [],
    useSafeSpaceStore.getState().activeProfile,
    useSafeSpaceStore.getState().routeWaypoints,
    [],
    [],
    boundary
  );
  assert.ok(baselineRoute);

  // Accepted candidate route differs from baseline route
  const acceptedRoute = useSafeSpaceStore.getState().routeResult;
  assert.ok(acceptedRoute);
  assert.notDeepEqual(acceptedRoute, baselineRoute);

  // Simulate reload
  store.hydrateFromStorage();
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, cand.id);

  // Revert succeeds
  const revRes = store.revertLayoutCandidate();
  assert.equal(revRes.success, true);
  assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);
  assert.equal(useSafeSpaceStore.getState().furniture[0].x, 350);
  assert.equal(useSafeSpaceStore.getState().furniture[0].y, 330);

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 14. Gate 3 Focused Hardening: P0 3 - Exact Scene Fingerprint & Invalidation
// ---------------------------------------------------------------------------

test("Stage 5 Focused Hardening P0 3: computeSceneFingerprint changes on sub-millimeter shift, dimensions, rotation, waypoints, profile", () => {
  const boundary = createRectBoundary(600, 600);
  const f: SpatialFurniture = {
    id: "f1",
    name: "Chair",
    category: "chair",
    roomId: "r1",
    x: 100.25,
    y: 200.5,
    width: 60,
    depth: 60,
    height: 80,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
  };
  const waypoints = [
    { id: "w1", name: "Start", x: 50.1, y: 50.2 },
    { id: "w2", name: "End", x: 400.3, y: 400.4 },
  ];

  const baseInput = {
    furniture: [f],
    waypoints,
    profile: defaultProfile,
    boundary,
  };

  const baseFp = computeSceneFingerprint(baseInput);

  // 1. Sub-millimeter position shift (+0.05 cm)
  const shiftFp = computeSceneFingerprint({
    ...baseInput,
    furniture: [{ ...f, x: 100.3 }],
  });
  assert.notEqual(shiftFp, baseFp, "Sub-millimeter position change must change fingerprint");

  // 2. Dimension change
  const dimFp = computeSceneFingerprint({
    ...baseInput,
    furniture: [{ ...f, width: 60.5 }],
  });
  assert.notEqual(dimFp, baseFp, "Furniture dimension change must change fingerprint");

  // 3. Rotation change
  const rotFp = computeSceneFingerprint({
    ...baseInput,
    furniture: [{ ...f, rotation: 15 }],
  });
  assert.notEqual(rotFp, baseFp, "Rotation change must change fingerprint");

  // 4. Waypoint change
  const wpFp = computeSceneFingerprint({
    ...baseInput,
    waypoints: [{ ...waypoints[0], x: 50.2 }, waypoints[1]],
  });
  assert.notEqual(wpFp, baseFp, "Waypoint change must change fingerprint");

  // 5. Profile change
  const profFp = computeSceneFingerprint({
    ...baseInput,
    profile: { ...defaultProfile, minClearanceCm: 95 },
  });
  assert.notEqual(profFp, baseFp, "Profile clearance change must change fingerprint");
});

test("Stage 5 Focused Hardening P0 3: applyLayoutCandidate rejects when scene or profile changed after optimization", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  // Modify scene after optimization was computed
  const chair = useSafeSpaceStore.getState().furniture.find((f) => !f.isFixed)!;
  store.moveFurniture(chair.id, chair.x + 5, chair.y + 5);

  // Attempting to apply stale candidate must fail
  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, false);
  assert.ok(applyRes.error);
  assert.match(applyRes.error, /scene has changed|no active optimization/i);

  store.resetToDemo();
});

test("Stage 5 Focused Hardening P0 3: intervening user edits after Apply invalidate baseline snapshot to prevent destructive rollback", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, cand.id);

  // User subsequently moves movable furniture (intervening edit)
  const chair = useSafeSpaceStore.getState().furniture.find((f) => !f.isFixed)!;
  store.moveFurniture(chair.id, chair.x + 10, chair.y + 10);

  // Baseline snapshot and appliedCandidateId must be invalidated to protect new work
  assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);
  assert.equal(useSafeSpaceStore.getState().appliedSceneFingerprint, null);

  // Attempting to revert must fail gracefully
  const revRes = store.revertLayoutCandidate();
  assert.equal(revRes.success, false);
  assert.match(revRes.error ?? "", /no baseline snapshot/i);

  store.resetToDemo();
});

test("Stage 5 Focused Hardening P0 3: storage failure on revert preserves current furniture and rolls back state", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "revert-storage-failure-test",
      name: "Revert Failure Space",
      facilityName: "Test Clinic",
      spaceName: "Consult 1",
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

  store.addRouteWaypoint("Start", 100, 350);
  store.addRouteWaypoint("Mid", 350, 350);
  store.addRouteWaypoint("End", 600, 350);

  store.addFurniture("chair");
  const chair = useSafeSpaceStore.getState().furniture[0];
  store.moveFurniture(chair.id, 350, 330);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);

  const acceptedFurniture = [...useSafeSpaceStore.getState().furniture];

  // Mock localStorage.setItem failure on revert
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error("Disk quota exhausted");
  };

  try {
    const revRes = store.revertLayoutCandidate();
    assert.equal(revRes.success, false);
    assert.ok(revRes.error);
    assert.equal(useSafeSpaceStore.getState().storageStatus, "error");
    // State rolled back: accepted furniture remains in place
    assert.deepEqual(useSafeSpaceStore.getState().furniture, acceptedFurniture);
    // Snapshot preserved so user can retry
    assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }

  store.resetToDemo();
});
