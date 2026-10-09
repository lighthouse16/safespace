import test from "node:test";
import assert from "node:assert/strict";
import {
  convertPixelPointToCm,
  convertCmPointToPixels,
  convertPixelPolygonToCm,
  convertCmPolygonToPixels,
  computePolygonShoelaceAreaCm2,
  computePolygonBoundsCm,
  isSimplePolygon,
  validateIntakeBoundary,
  INTAKE_ORIGIN_POLICY,
  resolveCanonicalRoom,
  DEMO_CLINIC_ENVELOPE,
  type Point2D,
  type Polygon2D,
} from "../src/lib/spatial";
import {
  savePersistedAssessment,
  loadPersistedAssessment,
  clearPersistedAssessment,
  validatePersistedPayload,
  SAFESPACE_STORAGE_VERSION,
  SAFESPACE_STORAGE_KEY,
  type PersistedAssessmentState,
} from "../src/lib/storage/persistence";
import { useSafeSpaceStore } from "../src/store/safespace-store";
import { MOBILITY_PROFILES } from "../src/lib/spatial-model";

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

// 1. Scale Conversion and Geometry Tests
test("pixel-to-cm conversion: 800 px line to 400 cm yields exact 2 px/cm scale", () => {
  const pixelsPerCm = 2.0; // 800 px / 400 cm = 2.0 px/cm
  const originPx = { x: 0, y: 0 };

  const ptPx: Point2D = { x: 800, y: 600 };
  const ptCm = convertPixelPointToCm(ptPx, pixelsPerCm, originPx);

  assert.equal(ptCm.x, 400);
  assert.equal(ptCm.y, 300);

  // Round-trip back to pixels
  const roundTripPx = convertCmPointToPixels(ptCm, pixelsPerCm, originPx);
  assert.equal(roundTripPx.x, 800);
  assert.equal(roundTripPx.y, 600);
});

test("pixel-to-cm polygon conversion preserves exact vertex ordering and coordinates", () => {
  const pixelsPerCm = 2.5; // 2.5 px per cm
  const polyPx: Polygon2D = [
    { x: 50, y: 50 },
    { x: 550, y: 50 },
    { x: 550, y: 450 },
    { x: 50, y: 450 },
  ];

  const polyCm = convertPixelPolygonToCm(polyPx, pixelsPerCm);
  assert.equal(polyCm.length, 4);
  assert.deepEqual(polyCm, [
    { x: 20, y: 20 },
    { x: 220, y: 20 },
    { x: 220, y: 180 },
    { x: 20, y: 180 },
  ]);

  const roundTripPx = convertCmPolygonToPixels(polyCm, pixelsPerCm);
  assert.deepEqual(roundTripPx, polyPx);

  const bounds = computePolygonBoundsCm(polyCm);
  assert.equal(bounds.minX, 20);
  assert.equal(bounds.minY, 20);
  assert.equal(bounds.maxX, 220);
  assert.equal(bounds.maxY, 180);
  assert.equal(bounds.widthCm, 200);
  assert.equal(bounds.heightCm, 160);

  const area = computePolygonShoelaceAreaCm2(polyCm);
  assert.equal(area, 200 * 160); // 32,000 cm² (3.2 m²)
});

test("concave L-shaped polygon conversion preserves concave geometry and passes simple polygon check", () => {
  // L-shaped concave room
  const lShapePx: Polygon2D = [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 250 },
    { x: 250, y: 250 },
    { x: 250, y: 400 },
    { x: 100, y: 400 },
  ];

  const pixelsPerCm = 1.0;
  const validation = validateIntakeBoundary(lShapePx, true, pixelsPerCm);
  assert.equal(validation.isValid, true);
  assert.equal(isSimplePolygon(lShapePx), true);

  const polyCm = validation.polygonCm!;
  assert.equal(polyCm.length, 6);
  assert.equal(polyCm[3].x, 250);
  assert.equal(polyCm[3].y, 250);

  // Shoelace area of L-shape: 300x150 + 150x150 = 45000 + 22500 = 67500 cm²
  const expectedArea = 300 * 150 + 150 * 150;
  assert.equal(computePolygonShoelaceAreaCm2(polyCm), expectedArea);
});

test("self-intersecting bowtie polygon fails simple polygon check and intake validation", () => {
  // Bowtie (figure-8 / self-intersecting polygon)
  const bowtiePx: Polygon2D = [
    { x: 100, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 },
    { x: 300, y: 100 },
  ];

  assert.equal(isSimplePolygon(bowtiePx), false);

  const validation = validateIntakeBoundary(bowtiePx, true, 2.0);
  assert.equal(validation.isValid, false);
  assert.match(validation.error || "", /self-intersects/i);
});

test("invalid calibration scale or unclosed boundary fails intake validation", () => {
  const squarePx: Polygon2D = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ];

  // Zero scale
  assert.equal(validateIntakeBoundary(squarePx, true, 0).isValid, false);
  // Negative scale
  assert.equal(validateIntakeBoundary(squarePx, true, -1.5).isValid, false);
  // Infinite scale
  assert.equal(validateIntakeBoundary(squarePx, true, Infinity).isValid, false);
  // Null scale
  assert.equal(validateIntakeBoundary(squarePx, true, null).isValid, false);
  // Unclosed loop
  assert.equal(validateIntakeBoundary(squarePx, false, 2.0).isValid, false);
  // Fewer than 3 vertices
  assert.equal(validateIntakeBoundary([{ x: 0, y: 0 }, { x: 10, y: 10 }], true, 2.0).isValid, false);
});

// 2. Spatial Engine Adapter & Canonical Room Override Tests
test("resolveCanonicalRoom with boundary override creates user CanonicalRoom without DEMO_CLINIC_ENVELOPE", () => {
  const userPolyCm: Polygon2D = [
    { x: 50, y: 50 },
    { x: 350, y: 50 },
    { x: 350, y: 300 },
    { x: 50, y: 300 },
  ];

  const canonical = resolveCanonicalRoom(userPolyCm, null, "canonical-user-room");
  assert.equal(canonical.id, "canonical-user-room");
  assert.equal(canonical.boundary.length, 4);
  const userBounds = computePolygonBoundsCm(canonical.boundary);
  assert.equal(userBounds.widthCm, 300);
  assert.equal(userBounds.heightCm, 250);

  // DEMO_CLINIC_ENVELOPE interior is 720x520 — verify user room is completely distinct
  const demoBounds = computePolygonBoundsCm(DEMO_CLINIC_ENVELOPE);
  assert.notEqual(userBounds.widthCm, demoBounds.widthCm);
  assert.notEqual(userBounds.heightCm, demoBounds.heightCm);
});

test("resolveCanonicalRoom without override falls back to legacy rooms or demo envelope", () => {
  const fallback = resolveCanonicalRoom(null, null);
  const fallbackBounds = computePolygonBoundsCm(fallback.boundary);
  const demoBounds = computePolygonBoundsCm(DEMO_CLINIC_ENVELOPE);
  assert.equal(fallbackBounds.widthCm, demoBounds.widthCm);
  assert.equal(fallbackBounds.heightCm, demoBounds.heightCm);
});

// 3. User Assessment Store & Routing Tests
test("createAndLoadUserAssessment initializes honest 0 furniture, 0 doors, 0 hazards, and 0 route", () => {
  const store = useSafeSpaceStore.getState();

  const userBoundaryCm: Polygon2D = [
    { x: 100, y: 100 },
    { x: 500, y: 100 },
    { x: 500, y: 400 },
    { x: 100, y: 400 },
  ];

  store.createAndLoadUserAssessment({
    metadata: {
      id: "test-assessment-01",
      name: "St. Jude Clinic",
      facilityName: "St. Jude Rehabilitation",
      spaceName: "Consultation Suite",
      environmentType: "clinic",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: userBoundaryCm,
    calibration: {
      pixelsPerCm: 2.0,
      realLength: 400,
      unit: "cm",
      pixelDistance: 800,
      originPolicy: INTAKE_ORIGIN_POLICY,
    },
  });

  const state = useSafeSpaceStore.getState();
  assert.equal(state.assessmentType, "user");
  assert.equal(state.assessmentId, "test-assessment-01");
  assert.equal(state.canonicalBoundary?.length, 4);
  assert.equal(state.furniture.length, 0);
  assert.equal(state.doors.length, 0);
  assert.equal(state.walls.length, 0);
  assert.equal(state.hazards.length, 0);
  assert.equal(state.routeWaypoints.length, 0);
  assert.equal(state.routeResult, null);

  // Live metrics must report 0 hazards and low/pending risk
  const metrics = state.getLiveMetrics();
  assert.equal(metrics.activeHazardsCount, 0);
  assert.equal(metrics.highPriorityHazardsCount, 0);
  assert.equal(metrics.riskIndex, 0);
});

test("route generation: 0 or 1 waypoint produces null route; 2 waypoints computes valid path", () => {
  const store = useSafeSpaceStore.getState();

  // Reset to empty user assessment
  const userBoundaryCm: Polygon2D = [
    { x: 50, y: 50 },
    { x: 450, y: 50 },
    { x: 450, y: 350 },
    { x: 50, y: 350 },
  ];

  store.createAndLoadUserAssessment({
    metadata: {
      id: "test-assessment-02",
      name: "Residential Bedroom",
      facilityName: "Home Suite",
      spaceName: "Master Bedroom",
      environmentType: "residential",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: userBoundaryCm,
    calibration: {
      pixelsPerCm: 2.0,
      realLength: 400,
      unit: "cm",
      pixelDistance: 800,
      originPolicy: INTAKE_ORIGIN_POLICY,
    },
  });

  // 0 waypoints: routeResult is null
  assert.equal(useSafeSpaceStore.getState().routeResult, null);

  // Add 1st waypoint: routeResult remains null
  store.addRouteWaypoint("Start Door", 100, 200);
  assert.equal(useSafeSpaceStore.getState().routeWaypoints.length, 1);
  assert.equal(useSafeSpaceStore.getState().routeResult, null);

  // Add 2nd waypoint: route calculation executes deterministically
  store.addRouteWaypoint("Destination Bed", 400, 200);
  const state = useSafeSpaceStore.getState();
  assert.equal(state.routeWaypoints.length, 2);
  assert.notEqual(state.routeResult, null);
  assert.equal(state.routeResult?.status, "success");
  assert.equal(state.routeResult!.path.length >= 2, true);

  // Route length should approximate straight-line 300 cm distance
  assert.equal(state.routeResult!.pathLengthCm >= 300, true);
  assert.equal(state.routeResult!.minimumClearanceCm > 0, true);

  // Verify all path points lie inside user boundary bounds
  const bounds = computePolygonBoundsCm(userBoundaryCm);
  for (const pt of state.routeResult!.path) {
    assert.equal(pt.x >= bounds.minX - 5 && pt.x <= bounds.maxX + 5, true);
    assert.equal(pt.y >= bounds.minY - 5 && pt.y <= bounds.maxY + 5, true);
  }
});

// 4. Persistence Round-Trip & Defensive Recovery Tests
test("persistence: save, load, and clear round-trip using mock localStorage", () => {
  const originalLocalStorage = globalThis.localStorage;
  const mockStorage = new MockLocalStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  try {
    const payload: PersistedAssessmentState = {
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: "user",
      metadata: {
        id: "persist-test-1",
        name: "Geriatric Assessment Suite",
        facilityName: "Metropolitan Care",
        spaceName: "Consultation Room 1",
        environmentType: "hospital",
        createdAt: "2026-10-09T08:00:00.000Z",
        updatedAt: "2026-10-09T08:30:00.000Z",
      },
      canonicalBoundary: [
        { x: 20, y: 20 },
        { x: 300, y: 20 },
        { x: 300, y: 250 },
        { x: 20, y: 250 },
      ],
      calibration: {
        pixelsPerCm: 1.8,
        realLength: 500,
        unit: "cm",
        pixelDistance: 900,
        originPolicy: INTAKE_ORIGIN_POLICY,
      },
      activeProfileId: MOBILITY_PROFILES[0].id,
      routeWaypoints: [
        { id: "wp-1", name: "Entry", x: 60, y: 100, isMandatory: true },
        { id: "wp-2", name: "Exam Table", x: 250, y: 100, isMandatory: true },
      ],
      furniture: [],
    };

    assert.equal(validatePersistedPayload(payload).isValid, true);
    const saveSuccess = savePersistedAssessment(payload);
    assert.equal(saveSuccess.success, true);

    const loadResult = loadPersistedAssessment();
    assert.equal(loadResult.success, true);
    if (loadResult.success) {
      assert.equal(loadResult.data.schemaVersion, SAFESPACE_STORAGE_VERSION);
      assert.equal(loadResult.data.assessmentType, "user");
      assert.equal(loadResult.data.metadata?.facilityName, "Metropolitan Care");
      assert.equal(loadResult.data.canonicalBoundary?.length, 4);
      assert.equal(loadResult.data.routeWaypoints.length, 2);
    }

    // Verify clear
    clearPersistedAssessment();
    assert.equal(mockStorage.getItem(SAFESPACE_STORAGE_KEY), null);
    assert.equal(loadPersistedAssessment().success, false);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  }
});

test("persistence: corrupt JSON payload or schema mismatch fails safely with isCorrupted flag", () => {
  const originalLocalStorage = globalThis.localStorage;
  const mockStorage = new MockLocalStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  try {
    // 1. Corrupt JSON syntax
    mockStorage.setItem(SAFESPACE_STORAGE_KEY, "this-is-not-valid-json{{{");
    const corruptJson = loadPersistedAssessment();
    assert.equal(corruptJson.success, false);
    assert.equal(corruptJson.isCorrupted, true);

    // 2. Missing schemaVersion
    mockStorage.setItem(SAFESPACE_STORAGE_KEY, JSON.stringify({ assessmentType: "user" }));
    const missingVersion = loadPersistedAssessment();
    assert.equal(missingVersion.success, false);
    assert.equal(missingVersion.isCorrupted, true);

    // 3. Invalid schema version
    mockStorage.setItem(SAFESPACE_STORAGE_KEY, JSON.stringify({ schemaVersion: 999, assessmentType: "user" }));
    const invalidVersion = loadPersistedAssessment();
    assert.equal(invalidVersion.success, false);
    assert.equal(invalidVersion.isCorrupted, true);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  }
});

// 5. Strict Demo Clinic vs User Assessment Isolation Tests
test("demo clinic isolation: resetToDemo loads Queen Care Clinic without pollution from user session", () => {
  const store = useSafeSpaceStore.getState();

  // Reset to demo clinic
  store.resetToDemo();
  const demoState = useSafeSpaceStore.getState();

  assert.equal(demoState.assessmentType, "demo");
  assert.equal(demoState.assessmentId, "demo-queen-care");
  assert.equal(demoState.canonicalBoundary, null); // Demo clinic has no user polygon override
  assert.equal(demoState.rooms.length > 0, true);
  assert.equal(demoState.furniture.length > 0, true);
  assert.equal(demoState.walls.length > 0, true);
  assert.equal(demoState.doors.length > 0, true);
  assert.equal(demoState.hazards.length, 7);
  assert.equal(demoState.routeWaypoints.length, 8);

  const demoMetrics = demoState.getLiveMetrics();
  assert.equal(demoMetrics.riskIndex, 68);
  assert.equal(demoMetrics.minClearanceCm, 54);
  assert.equal(demoMetrics.activeHazardsCount, 7);
});
