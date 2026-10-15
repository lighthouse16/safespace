import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSpatialScene, computeSceneFingerprint } from "../src/lib/spatial";
import { runServerEvaluation } from "../src/lib/server/spatial/evaluator-service";
import { runServerOptimization } from "../src/lib/server/spatial/optimizer-service";
import type { MobilityProfileData, RouteWaypoint, SpatialFurniture } from "../src/lib/spatial-model";
import type { Polygon2D } from "../src/lib/spatial";

const mockProfile: MobilityProfileData = {
  id: "manual-wheelchair",
  name: "Manual Wheelchair",
  description: "Standard active manual wheelchair user",
  minClearanceCm: 85,
  turningSpaceCm: 150,
  fallHistory: false,
  requiresSupport: false,
  lowLightSensitivity: "Moderate",
};

const mockBoundary: Polygon2D = [
  { x: 0, y: 0 },
  { x: 600, y: 0 },
  { x: 600, y: 500 },
  { x: 0, y: 500 },
];

const mockFurniture: SpatialFurniture[] = [
  {
    id: "bed-1",
    name: "Hospital Bed",
    category: "medical-fixture",
    roomId: "user-space",
    x: 100,
    y: 100,
    width: 200,
    depth: 100,
    height: 80,
    rotation: 0,
    isFixed: false,
    isConfirmed: true,
    isStableSupport: false,
  },
  {
    id: "table-1",
    name: "Bedside Table",
    category: "table",
    roomId: "user-space",
    x: 320,
    y: 100,
    width: 60,
    depth: 60,
    height: 70,
    rotation: 0,
    isFixed: false,
    isConfirmed: true,
    isStableSupport: false,
  },
];

const mockWaypoints: RouteWaypoint[] = [
  { id: "wp-1", name: "Entry", x: 50, y: 250, isMandatory: true },
  { id: "wp-2", name: "Bed Access", x: 200, y: 250, isMandatory: true },
  { id: "wp-3", name: "Exit", x: 550, y: 250, isMandatory: true },
];

test("Spatial Parity: Server evaluation output numerically equals client evaluation", async () => {
  // 1. Direct client evaluation
  const clientEval = evaluateSpatialScene({
    assessmentType: "user",
    canonicalBoundary: mockBoundary,
    furniture: mockFurniture,
    profile: mockProfile,
    routeWaypoints: mockWaypoints,
  });

  // 2. Server evaluation service
  const serverRes = await runServerEvaluation({
    assessmentType: "user",
    boundary: mockBoundary,
    furniture: mockFurniture,
    waypoints: mockWaypoints,
    profile: mockProfile,
    persistResult: false,
  });

  assert.equal(serverRes.success, true);
  assert.ok(serverRes.result);

  const serverEval = serverRes.result;

  // Verify numerical parity
  assert.equal(serverEval.summary.routeFeasibility, clientEval.summary.routeFeasibility);
  assert.equal(serverEval.summary.minimumClearanceCm, clientEval.summary.minimumClearanceCm);
  assert.equal(serverEval.summary.actionableDeficitsCount, clientEval.summary.actionableDeficitsCount);
  assert.equal(serverEval.summary.pathLengthM, clientEval.summary.pathLengthM);
  assert.equal(serverEval.findings.length, clientEval.findings.length);

  for (let i = 0; i < clientEval.findings.length; i++) {
    const cf = clientEval.findings[i];
    const sf = serverEval.findings[i];
    assert.equal(sf.id, cf.id);
    assert.equal(sf.kind, cf.kind);
    assert.equal(sf.status, cf.status);
    assert.equal(sf.severity, cf.severity);
  }
});

test("Spatial Parity: Server optimizer output and fingerprint match client optimizer", async () => {
  // 1. Client fingerprint
  const clientFingerprint = computeSceneFingerprint({
    furniture: mockFurniture,
    waypoints: mockWaypoints,
    boundary: mockBoundary,
    profile: mockProfile,
  });

  // 2. Server optimizer
  const serverRes = await runServerOptimization({
    boundary: mockBoundary,
    furniture: mockFurniture,
    waypoints: mockWaypoints,
    profile: mockProfile,
    persistResult: false,
  });

  assert.equal(serverRes.success, true);
  assert.ok(serverRes.result);
  assert.equal(serverRes.sceneFingerprint, clientFingerprint);
  assert.equal(serverRes.result.status, "already_optimal");
});
