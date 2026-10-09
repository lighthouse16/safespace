import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Stage5Improve } from "../src/components/workflow/Stage5Improve";
import { useSafeSpaceStore } from "../src/store/safespace-store";
import type { Polygon2D } from "../src/lib/spatial";

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

// In Node SSR test environment, React's renderToStaticMarkup invokes getServerSnapshot,
// which defaults to Zustand's initial state instead of current mutated store state.
// Bridge useSyncExternalStore to evaluate getSnapshot() in the test runner.
(React as unknown as { useSyncExternalStore: (subscribe: unknown, getSnapshot: () => unknown) => unknown }).useSyncExternalStore = (
  _subscribe: unknown,
  getSnapshot: () => unknown
) => getSnapshot();

function createRectBoundary(widthCm: number, heightCm: number): Polygon2D {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, y: heightCm },
    { x: 0, y: heightCm },
  ];
}

// ---------------------------------------------------------------------------
// 1. Proposal Mode UI Contract
// ---------------------------------------------------------------------------

test("Stage 5 UI: Proposal Mode displays candidate alternatives and Apply action, no Revert", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  store.runOptimization();

  const html = renderToStaticMarkup(React.createElement(Stage5Improve));

  // Toolbar
  assert.ok(html.includes("Improve Layout · Alternative Proposals"), "Shows proposals title");
  assert.ok(!html.includes("Applied Layout Review"), "Does not show review mode title");

  // Ribbon
  assert.ok(html.includes("Alternatives ("), "Shows alternatives count ribbon");
  assert.ok(html.includes("Apply This Layout"), "Shows Apply action button");
  assert.ok(html.includes("Re-optimize"), "Shows Re-optimize action button");
  assert.ok(!html.includes("Revert to Original Baseline"), "Must not show Revert in proposal mode");

  // Panes
  assert.ok(html.includes("Before: Current Layout"), "Left pane shows Current Layout");
  assert.ok(html.includes("Proposed:"), "Right pane shows Proposed alternative");
  assert.ok(html.includes("Candidate (Unverified)"), "Shows truthful unverified proposal badge");
  assert.ok(!html.includes(">Verified<"), "Must not claim clinical verification");

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 2. Applied-Layout Review Mode UI Contract
// ---------------------------------------------------------------------------

test("Stage 5 UI: Apply transitions UI to Applied-Layout Review Mode, pauses proposals, shows Revert", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const candidateId = optResult.candidates[0].id;

  // Apply candidate
  const applyRes = store.applyLayoutCandidate(candidateId);
  assert.equal(applyRes.success, true);
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);
  assert.equal(useSafeSpaceStore.getState().activeOptimizationResult, null, "Proposals cleared after Apply");

  const html = renderToStaticMarkup(React.createElement(Stage5Improve));

  // Toolbar
  assert.ok(html.includes("Improve Layout · Applied Layout Review"), "Shows review mode title");
  assert.ok(!html.includes("Improve Layout · Alternative Proposals"), "Does not show proposal mode title");

  // Ribbon
  assert.ok(html.includes("Applied Layout Review"), "Shows review mode banner");
  assert.ok(html.includes("Revert to Original Baseline"), "Shows Revert to Original Baseline button");
  assert.ok(!html.includes("Apply This Layout"), "Must not show Apply action in review mode");
  assert.ok(!html.includes("Alternatives ("), "Must not expose proposal selector in review mode");
  assert.ok(!html.includes("Re-optimize"), "Must not show Re-optimize button in review mode");

  // Panes
  assert.ok(html.includes("Before: Original Baseline"), "Left pane shows Original Baseline");
  assert.ok(html.includes("After: Accepted Layout (Draft)"), "Right pane shows Accepted Layout");
  assert.ok(html.includes("Applied (Draft)"), "Shows truthful applied draft badge");
  assert.ok(!html.includes(">Verified<"), "Must not claim clinical verification");

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 3. Lifecycle: Apply -> Hard Refresh -> Stage 5 -> Revert
// ---------------------------------------------------------------------------

test("Stage 5 UI Lifecycle: Apply -> Hard Refresh -> Stage 5 preserves review mode without re-optimizing -> Revert restores proposal mode", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "lifecycle-ui-test",
      name: "Lifecycle UI Space",
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
  const chair = useSafeSpaceStore.getState().furniture[0];
  store.moveFurniture(chair.id, 350, 330);

  // 1. Run optimization in proposal mode
  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  // 2. Apply candidate
  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);

  // 3. Simulate hard page refresh / reload: hydrate from storage
  store.hydrateFromStorage();
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null, "Baseline snapshot survives reload");
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, cand.id, "Applied candidate survives reload");
  assert.equal(useSafeSpaceStore.getState().activeOptimizationResult, null, "Optimization result not re-created");

  // 4. Render Stage 5 UI after reload
  const reloadHtml = renderToStaticMarkup(React.createElement(Stage5Improve));
  assert.ok(reloadHtml.includes("Improve Layout · Applied Layout Review"), "Renders applied review mode after reload");
  assert.ok(reloadHtml.includes("Revert to Original Baseline"), "Revert button is immediately visible after reload");
  assert.ok(!reloadHtml.includes("Apply This Layout"), "No Apply button after reload");
  assert.ok(reloadHtml.includes("Before: Original Baseline"), "Left pane shows original baseline");
  assert.ok(reloadHtml.includes("After: Accepted Layout (Draft)"), "Right pane shows accepted layout");

  // 5. Revert back to original baseline
  const revRes = store.revertLayoutCandidate();
  assert.equal(revRes.success, true);
  assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);
  assert.equal(useSafeSpaceStore.getState().furniture[0].x, 350, "Furniture coordinates restored to baseline");

  // 6. After revert, UI returns to Proposal Mode
  store.runOptimization();
  const revertedHtml = renderToStaticMarkup(React.createElement(Stage5Improve));
  assert.ok(revertedHtml.includes("Improve Layout · Alternative Proposals"), "Returns to proposal mode after revert");
  assert.ok(revertedHtml.includes("Apply This Layout"), "Apply action returns after revert");
  assert.ok(!revertedHtml.includes("Revert to Original Baseline"), "Revert button hidden in proposal mode");

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 4. Storage Failure Resilience in UI
// ---------------------------------------------------------------------------

test("Stage 5 UI: Storage failure on Apply does not switch mode to review; storage failure on Revert keeps review mode", () => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === "function") {
    globalThis.localStorage.clear();
  }

  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  store.createAndLoadUserAssessment({
    metadata: {
      id: "storage-failure-ui-test",
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
  const chair = useSafeSpaceStore.getState().furniture[0];
  store.moveFurniture(chair.id, 350, 330);

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  // Mock storage failure
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError: disk is full");
  };

  try {
    // 1. Apply fails due to storage
    const applyRes = store.applyLayoutCandidate(cand.id);
    assert.equal(applyRes.success, false);
    assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null, "Baseline snapshot was not created");

    // UI MUST remain in Proposal Mode!
    const failedApplyHtml = renderToStaticMarkup(React.createElement(Stage5Improve));
    assert.ok(failedApplyHtml.includes("Improve Layout · Alternative Proposals"), "Stays in proposal mode on storage error");
    assert.ok(!failedApplyHtml.includes("Applied Layout Review"), "Does not deceptively enter review mode");
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }

  // 2. Successful Apply
  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);

  // 3. Mock storage failure on Revert
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError: disk is full");
  };

  try {
    const revRes = store.revertLayoutCandidate();
    assert.equal(revRes.success, false);
    assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null, "Baseline snapshot remains intact");

    // UI MUST remain in Applied Review Mode!
    const failedRevertHtml = renderToStaticMarkup(React.createElement(Stage5Improve));
    assert.ok(failedRevertHtml.includes("Improve Layout · Applied Layout Review"), "Stays in review mode when revert fails");
    assert.ok(failedRevertHtml.includes("Revert to Original Baseline"), "Revert button still available for retry");
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }

  store.resetToDemo();
});

// ---------------------------------------------------------------------------
// 5. Intervening Edits Invalidate Applied Review Mode
// ---------------------------------------------------------------------------

test("Stage 5 UI: Intervening manual edits safely exit applied review mode without destroying new work", () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const optResult = store.runOptimization();
  assert.equal(optResult.status, "improved");
  const cand = optResult.candidates[0];

  const applyRes = store.applyLayoutCandidate(cand.id);
  assert.equal(applyRes.success, true);
  assert.ok(useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null);

  // User subsequently makes a manual edit (e.g. moves movable furniture)
  const movableChair = useSafeSpaceStore.getState().furniture.find((f) => !f.isFixed)!;
  store.moveFurniture(movableChair.id, movableChair.x + 10, movableChair.y + 10);

  // Invalidation clears baseline snapshot and applied candidate
  assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null);
  assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);

  // UI safely returns to Proposal Mode on the new manual scene
  store.runOptimization();
  const html = renderToStaticMarkup(React.createElement(Stage5Improve));
  assert.ok(html.includes("Improve Layout · Alternative Proposals"), "Proposal mode restored after manual edit");
  assert.ok(!html.includes("Applied Layout Review"), "Applied review mode cleared");
  assert.ok(!html.includes("Revert to Original Baseline"), "Stale historical revert action removed");

  store.resetToDemo();
});
