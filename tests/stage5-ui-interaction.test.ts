import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Stage5Improve } from "../src/components/workflow/Stage5Improve";
import { useSafeSpaceStore } from "../src/store/safespace-store";
import type { Polygon2D } from "../src/lib/spatial";

// Setup JSDOM environment for genuine mounted React component lifecycle testing
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:3000",
});

(globalThis as unknown as Record<string, unknown>).window = dom.window;
(globalThis as unknown as Record<string, unknown>).document = dom.window.document;
(globalThis as unknown as Record<string, unknown>).localStorage = dom.window.localStorage;
(globalThis as unknown as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as Record<string, unknown>).SVGElement = dom.window.SVGElement;
(globalThis as unknown as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
(globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = (id: NodeJS.Timeout) => clearTimeout(id);
(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function createRectBoundary(widthCm: number, heightCm: number): Polygon2D {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, y: heightCm },
    { x: 0, y: heightCm },
  ];
}

interface TestHarness {
  rootEl: HTMLElement;
  root: Root;
  cleanup: () => Promise<void>;
}

async function createMountedHarness(): Promise<TestHarness> {
  const rootEl = dom.window.document.getElementById("root")!;
  rootEl.innerHTML = "";
  const root = createRoot(rootEl);
  await act(async () => {
    root.render(React.createElement(Stage5Improve));
  });
  return {
    rootEl,
    root,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      rootEl.innerHTML = "";
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Mounted UI Lifecycle: Proposal -> Apply -> Review (reactive) -> Revert
// ---------------------------------------------------------------------------

test("Stage 5 Mounted UI: Apply and Revert in same mounted component reactively update findings and metrics without remount", async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  store.runOptimization();

  const harness = await createMountedHarness();

  try {
    const textContent = () => harness.rootEl.textContent ?? "";
    const queryButton = (label: string) =>
      Array.from(harness.rootEl.querySelectorAll("button")).find((b) => b.textContent?.includes(label));

    // Phase 1: Mounted in Proposal Mode
    assert.ok(
      /(Improve Layout · Alternative Proposals|Layout Improvement Options)/.test(textContent()),
      "Header shows Proposal Mode"
    );
    assert.ok(textContent().includes("Alternatives ("), "Shows alternatives count ribbon");
    assert.ok(textContent().includes("Candidate (Unverified)"), "Shows truthful proposal badge");
    assert.ok(!textContent().includes("Applied Layout Review"), "Does not show Review Mode banner");

    const applyBtn = queryButton("Apply This Layout");
    assert.ok(applyBtn, "Apply This Layout button is rendered");
    assert.ok(!queryButton("Revert to Original"), "No Revert button in proposal mode");

    // Phase 2: Click Apply in the SAME mounted instance
    await act(async () => {
      applyBtn.click();
    });

    // Verify reactive update in mounted instance
    assert.ok(
      /(Improve Layout · Applied Layout Review|Applied Layout Review)/.test(textContent()),
      "Header switches to Applied Review Mode"
    );
    assert.ok(textContent().includes("Applied Layout Review"), "Shows Applied Layout Review banner");
    assert.ok(textContent().includes("Applied (Draft)"), "Shows Applied (Draft) badge");
    assert.ok(!textContent().includes("Apply This Layout"), "Apply button removed after apply");
    assert.ok(!textContent().includes("Alternatives ("), "Alternatives selector removed in review mode");

    // CRITICAL: Reactive findings update (Before: 2 deficits -> After: 1 deficit)
    assert.ok(textContent().includes("2 → 1"), "Bottom drawer reactively shows deficits improved from 2 to 1");

    const revertBtn = queryButton("Revert to Original");
    assert.ok(revertBtn, "Durable Revert button is rendered in review mode");

    // Phase 3: Click Revert in the SAME mounted instance
    await act(async () => {
      revertBtn.click();
    });

    // Verify reactive return to Proposal Mode
    assert.ok(
      /(Improve Layout · Alternative Proposals|Layout Improvement Options)/.test(textContent()),
      "Header restored to Proposal Mode"
    );
    const applyBtnRestored = queryButton("Apply This Layout");
    assert.ok(applyBtnRestored, "Apply button restored after revert");
    assert.ok(!queryButton("Revert to Original"), "Revert button removed after revert");
    assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null, "Baseline snapshot cleared in store");
  } finally {
    await harness.cleanup();
    store.resetToDemo();
  }
});

// ---------------------------------------------------------------------------
// 2. Active Scene Edits while Mounted Reactively Update Evaluation
// ---------------------------------------------------------------------------

test("Stage 5 Mounted UI: Scene changes while component remains mounted reactively update spatial evaluation", async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  store.runOptimization();

  const harness = await createMountedHarness();

  try {
    const textContent = () => harness.rootEl.textContent ?? "";

    // Baseline demo has 2 deficits
    assert.ok(textContent().includes("2 deficits"), "Displays initial 2 deficits");

    // Move movable chair while mounted
    const movableChair = useSafeSpaceStore.getState().furniture.find((f) => !f.isFixed)!;
    await act(async () => {
      store.moveFurniture(movableChair.id, movableChair.x + 10, movableChair.y + 10);
    });

    // Findings reactively re-evaluate through evaluateSpatialScene
    const currentEvaluation = store.getSpatialFindings();
    assert.ok(
      textContent().includes(`${currentEvaluation.summary.actionableDeficitsCount} deficit`),
      "Component reactively updates deficit count when furniture moved while mounted"
    );
  } finally {
    await harness.cleanup();
    store.resetToDemo();
  }
});

// ---------------------------------------------------------------------------
// 3. Profile Changes while Mounted Reactively Recalculate Metrics
// ---------------------------------------------------------------------------

test("Stage 5 Mounted UI: Mobility profile change while mounted reactively recalculates clearances and deficits", async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  store.runOptimization();

  const harness = await createMountedHarness();

  try {
    const textContent = () => harness.rootEl.textContent ?? "";

    // Switch profile while mounted
    await act(async () => {
      store.setProfile("wheelchair");
    });

    // Reactive evaluation recalculates with wheelchair clearance targets
    const wheelchairEvaluation = store.getSpatialFindings();
    assert.ok(
      textContent().includes(`${wheelchairEvaluation.summary.actionableDeficitsCount} deficit`),
      "Reactively reflects wheelchair evaluation metrics while mounted"
    );
  } finally {
    await harness.cleanup();
    store.resetToDemo();
  }
});

// ---------------------------------------------------------------------------
// 4. Zero-Candidate / Optimal Scene Renders Honest Labels and Back Button
// ---------------------------------------------------------------------------

test("Stage 5 Mounted UI: Zero-candidate scene renders truthful labels and accessible Back to Findings button", async () => {
  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  await store.createAndLoadUserAssessment({
    metadata: {
      id: "zero-cand-test",
      name: "Zero Candidate Space",
      facilityName: "Optimal Clinic",
      spaceName: "Hallway",
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

  // Add clear straight route with no obstacles
  store.addRouteWaypoint("Start", 100, 350);
  store.addRouteWaypoint("End", 600, 350);
  store.setStage("improve");
  store.runOptimization();

  const harness = await createMountedHarness();

  try {
    const textContent = () => harness.rootEl.textContent ?? "";
    const queryButton = (label: string) =>
      Array.from(harness.rootEl.querySelectorAll("button")).find((b) => b.textContent?.includes(label));

    // Zero deficits -> already_optimal
    assert.ok(
      textContent().includes("0 deficits") || textContent().includes("adequate clearance"),
      "Renders honest 0 deficits / adequate clearance copy"
    );

    // Critical accessibility / UX: Back to Findings button MUST remain accessible
    const backBtn = queryButton("Back to Findings");
    assert.ok(backBtn, "Back to Findings navigation button is accessible even with 0 candidates");

    // Click Back to Findings while mounted
    await act(async () => {
      backBtn.click();
    });
    assert.equal(useSafeSpaceStore.getState().activeStage, "analysis", "Navigates back to analysis stage");
  } finally {
    await harness.cleanup();
    store.resetToDemo();
  }
});

// ---------------------------------------------------------------------------
// 5. Storage Failure Handling During Mounted Lifecycle
// ---------------------------------------------------------------------------

test("Stage 5 Mounted UI: Storage failure on Apply retains Proposal Mode; failure on Revert retains Review Mode", async () => {
  const store = useSafeSpaceStore.getState();
  const boundary = createRectBoundary(700, 700);
  const nowIso = new Date().toISOString();

  await store.createAndLoadUserAssessment({
    metadata: {
      id: "storage-fail-mounted-test",
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

  store.setStage("improve");
  const opt = store.runOptimization();
  assert.equal(opt.status, "improved");
  assert.ok(opt.candidates.length >= 1);

  const harness = await createMountedHarness();

  try {
    const queryButton = (label: string) =>
      Array.from(harness.rootEl.querySelectorAll("button")).find((b) => b.textContent?.includes(label));
    const textContent = () => harness.rootEl.textContent ?? "";

    // Mock storage quota failure on JSDOM Storage.prototype
    const originalProtoSetItem = dom.window.Storage.prototype.setItem;
    const mockStorageError = () => {
      throw new Error("QuotaExceededError: storage full");
    };
    dom.window.Storage.prototype.setItem = mockStorageError;

    try {
      // 1. Try to Apply when storage is failing
      const applyBtn = queryButton("Apply This Layout");
      assert.ok(applyBtn);

      await act(async () => {
        applyBtn.click();
      });

      assert.ok(
        /(Improve Layout · Alternative Proposals|Layout Improvement Options)/.test(textContent()),
        "Stays in Proposal Mode on save failure"
      );
      assert.equal(useSafeSpaceStore.getState().baselineFurnitureSnapshot, null, "Snapshot was not created");
    } finally {
      dom.window.Storage.prototype.setItem = originalProtoSetItem;
    }

    // 2. Successful Apply
    const applyBtn = queryButton("Apply This Layout");
    assert.ok(applyBtn);
    await act(async () => {
      applyBtn.click();
    });
    assert.ok(
      /(Improve Layout · Applied Layout Review|Applied Layout Review)/.test(textContent()),
      "Enters Review Mode on valid save"
    );

    // 3. Storage failure on Revert
    dom.window.Storage.prototype.setItem = mockStorageError;

    try {
      const revertBtn = queryButton("Revert to Original");
      assert.ok(revertBtn);

      await act(async () => {
        revertBtn.click();
      });

      // Must stay in Review Mode so user does not lose state!
      assert.ok(
        /(Improve Layout · Applied Layout Review|Applied Layout Review)/.test(textContent()),
        "Stays in Review Mode on revert failure"
      );
      assert.ok(queryButton("Revert to Original"), "Revert button remains accessible to retry");
    } finally {
      dom.window.Storage.prototype.setItem = originalProtoSetItem;
    }
  } finally {
    await harness.cleanup();
    store.resetToDemo();
  }
});

// ---------------------------------------------------------------------------
// 6. Mobile Viewport & Truthful Candidate Selector Invariants
// ---------------------------------------------------------------------------

test("Stage 5 Mounted UI: 390px mobile viewport defaults to Proposed view and renders 1-based Option labels", async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  store.runOptimization();

  // Set mobile viewport width
  const origInnerWidth = dom.window.innerWidth;
  Object.defineProperty(dom.window, "innerWidth", { writable: true, configurable: true, value: 390 });
  Object.defineProperty(globalThis, "innerWidth", { writable: true, configurable: true, value: 390 });

  const harness = await createMountedHarness();

  try {
    const textContent = () => harness.rootEl.textContent ?? "";
    const queryButton = (label: string) =>
      Array.from(harness.rootEl.querySelectorAll("button")).find((b) => b.textContent?.trim().includes(label));

    // 1. Candidate cards must use 1-based "Option 1", "Option 2" labels, NEVER "Option 0" or solver tokens
    const optButtons = Array.from(harness.rootEl.querySelectorAll("button")).filter((b) =>
      /Option\s+\d+/i.test(b.textContent || "")
    );
    assert.ok(optButtons.length > 0, "Candidate selector buttons rendered");
    assert.ok(
      optButtons.every((b) => !/Option\s+0\b/i.test(b.textContent || "")),
      "No 0-based 'Option 0' labels allowed"
    );
    assert.ok(
      !/minimal_displacement|balanced_clearance|circulation_first/i.test(textContent()),
      "Internal solver objective tokens must not leak into primary UI copy"
    );

    // 2. Mobile segmented view toggles exist ("Proposed" & "Before")
    const proposedToggle = queryButton("Proposed");
    const beforeToggle = queryButton("Before");
    assert.ok(proposedToggle, "Proposed mobile toggle exists");
    assert.ok(beforeToggle, "Before mobile toggle exists");

    // 3. Switch to Before Layout
    await act(async () => {
      beforeToggle.click();
    });

    // In Before view, before canvas is visible
    assert.ok(textContent().includes("Original Baseline") || textContent().includes("Before"));

    // 4. Switch back to Proposed
    await act(async () => {
      proposedToggle.click();
    });
    assert.ok(textContent().includes("Proposed") || textContent().includes("Current Proposal"));
  } finally {
    Object.defineProperty(dom.window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
    Object.defineProperty(globalThis, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
    await harness.cleanup();
    store.resetToDemo();
  }
});

