import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

// Setup JSDOM environment so client hooks and mounted components function properly
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:3000",
});
(globalThis as unknown as Record<string, unknown>).window = dom.window;
(globalThis as unknown as Record<string, unknown>).self = dom.window;
(globalThis as unknown as Record<string, unknown>).document = dom.window.document;
(globalThis as unknown as Record<string, unknown>).localStorage = dom.window.localStorage;
(globalThis as unknown as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as Record<string, unknown>).SVGElement = dom.window.SVGElement;
(globalThis as unknown as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
(globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = (id: NodeJS.Timeout) => clearTimeout(id);
(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { useSafeSpaceStore, type WorkflowStage } from "../src/store/safespace-store";
import {
  savePersistedAssessment,
  loadPersistedAssessment,
  saveActiveWorkspace,
  loadActiveWorkspace,
  SAFESPACE_STORAGE_KEY,
  SAFESPACE_ACTIVE_WORKSPACE_KEY,
  SAFESPACE_STORAGE_VERSION,
  type PersistedAssessmentState,
} from "../src/lib/storage/persistence";
import { AnalysisTransition } from "../src/components/workflow/AnalysisTransition";
import { ReportModal } from "../src/components/workflow/ReportModal";
import { MOBILITY_PROFILES } from "../src/lib/spatial-model";
import AssessmentsPage from "../src/app/assessments/page";

// Retired page components
import RetiredAnalysisPage from "../src/app/assessments/queen-care-clinic/analysis/page";
import RetiredModelPage from "../src/app/assessments/queen-care-clinic/model/page";
import RetiredOptionsPage from "../src/app/assessments/queen-care-clinic/options/page";
import RetiredComparePage from "../src/app/assessments/queen-care-clinic/options/compare/page";
import RetiredReportPage from "../src/app/assessments/queen-care-clinic/report/page";
import RetiredLegacyReportPage from "../src/app/reports/queen-care-clinic/page";
import RetiredReviewsPage from "../src/app/reviews/page";
import RetiredClinicReviewPage from "../src/app/reviews/queen-care-clinic/page";

const RETIRED_ROUTES_FILES = [
  "src/app/assessments/queen-care-clinic/analysis/page.tsx",
  "src/app/assessments/queen-care-clinic/model/page.tsx",
  "src/app/assessments/queen-care-clinic/options/page.tsx",
  "src/app/assessments/queen-care-clinic/options/compare/page.tsx",
  "src/app/assessments/queen-care-clinic/report/page.tsx",
  "src/app/reports/queen-care-clinic/page.tsx",
  "src/app/reviews/page.tsx",
  "src/app/reviews/queen-care-clinic/page.tsx",
];

const RETIRED_COMPONENTS = [
  { name: "analysis", comp: RetiredAnalysisPage },
  { name: "model", comp: RetiredModelPage },
  { name: "options", comp: RetiredOptionsPage },
  { name: "compare", comp: RetiredComparePage },
  { name: "report", comp: RetiredReportPage },
  { name: "legacy-report", comp: RetiredLegacyReportPage },
  { name: "reviews", comp: RetiredReviewsPage },
  { name: "clinic-review", comp: RetiredClinicReviewPage },
];

const FABRICATED_MARKERS = [
  "Dr. Adrian Lau",
  "HKROT",
  "85 lux",
  "200 lux",
  "HK$850",
  "HK$4,600",
  "HK$4600",
];

// Helper to create valid user assessment payload
function createValidTestAssessment(): PersistedAssessmentState {
  return {
    schemaVersion: SAFESPACE_STORAGE_VERSION,
    assessmentType: "user",
    metadata: {
      id: "test-assessment-id",
      name: "Apartment 4B Living Room",
      facilityName: "Sunrise Senior Living",
      spaceName: "Apartment 4B Living Room",
      environmentType: "residence",
      notes: "Adversarial test payload",
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    },
    canonicalBoundary: [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 400 },
      { x: 0, y: 400 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 300,
      unit: "cm",
      pixelDistance: 300,
      originPolicy: "canvas-origin-0-0",
    },
    activeProfileId: "standard-walker",
    activeProfileSnapshot: {
      ...MOBILITY_PROFILES[0],
      minClearanceCm: 68,
      turningSpaceCm: 120,
    },
    furniture: [
      {
        id: "furn-user-1",
        name: "Coffee Table",
        category: "table",
        roomId: "room-1",
        x: 200,
        y: 150,
        width: 80,
        depth: 60,
        height: 45,
        rotation: 0,
        isFixed: false,
        isConfirmed: true,
        isStableSupport: false,
      },
    ],
    routeWaypoints: [
      { id: "wp-u1", name: "Door", x: 50, y: 200, isMandatory: true },
      { id: "wp-u2", name: "Bed", x: 500, y: 200, isMandatory: true },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. Retired Routes Decommissioning & Truthfulness
// ---------------------------------------------------------------------------

test("Adversarial QA: Retired routes do NOT contain Server Component redirect()", () => {
  for (const relPath of RETIRED_ROUTES_FILES) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `File exists: ${relPath}`);
    const code = fs.readFileSync(fullPath, "utf-8");
    assert.ok(
      !code.includes("redirect("),
      `Retired route ${relPath} must NOT call redirect()`
    );
    assert.ok(
      !code.includes("next/navigation"),
      `Retired route ${relPath} must NOT import next/navigation redirect`
    );
  }
});

test("Adversarial QA: Retired routes render truthful retirement notices and canonical links", () => {
  for (const { name, comp } of RETIRED_COMPONENTS) {
    const html = renderToStaticMarkup(React.createElement(comp));
    assert.ok(
      html.includes("Legacy Route Retired"),
      `Route ${name} must render 'Legacy Route Retired' badge`
    );
    assert.ok(
      html.includes("Legacy Demonstration Route Decommissioned"),
      `Route ${name} must announce decommissioned route`
    );
    assert.ok(
      html.includes('href="/"'),
      `Route ${name} must link to canonical workspace '/'`
    );
    assert.ok(
      html.includes('href="/assessments"'),
      `Route ${name} must link to '/assessments'`
    );
  }
});

test("Adversarial QA: Zero imports of legacy components or mock workflows from reachable app routes", () => {
  const appDir = path.resolve(process.cwd(), "src/app");
  const FORBIDDEN_IMPORT_PATTERNS = [
    "@/components/analysis",
    "@/components/options",
    "@/components/report",
    "@/components/review",
    "components/analysis",
    "components/options",
    "components/report",
    "components/review",
    "risk-analysis",
    "options-compare",
    "assessment-report",
    "review-workspace",
  ];

  function checkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(full);
      } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        const text = fs.readFileSync(full, "utf-8");
        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          assert.ok(
            !text.includes(pattern),
            `Reachable route file ${path.relative(process.cwd(), full)} imports legacy component pattern "${pattern}"`
          );
        }
      }
    }
  }
  checkDir(appDir);
});

test("Adversarial QA: handleOpenDemoAssessment in AssessmentsPage fails closed when saveActiveWorkspace fails", async () => {
  dom.window.localStorage.clear();
  const userAssessment = createValidTestAssessment();
  const saveRes = savePersistedAssessment(userAssessment);
  assert.equal(saveRes.success, true);
  saveActiveWorkspace("user");

  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AssessmentsPage));
  });

  const originalProtoSetItem = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    if (key === SAFESPACE_ACTIVE_WORKSPACE_KEY) {
      throw new Error("QuotaExceededError: simulated storage write error");
    }
    return originalProtoSetItem.call(this, key, value);
  };

  try {
    const links = Array.from(container.querySelectorAll("a"));
    const demoLink = links.find((l) => l.textContent?.includes("Open demo") || l.textContent?.includes("Open example clinic"));
    assert.ok(demoLink, "Demo link must exist in AssessmentsPage");

    const clickEvent = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    await act(async () => {
      demoLink.dispatchEvent(clickEvent);
    });

    // 1. Navigation must be prevented
    assert.equal(clickEvent.defaultPrevented, true, "clickEvent must be defaultPrevented on storage write failure");

    // 2. Visible error must be rendered in role=alert
    const alerts = Array.from(container.querySelectorAll("[role='alert']"));
    const hasExpectedError = alerts.some((a) =>
      a.textContent?.includes("Failed to switch workspace: storage write failed")
    );
    assert.ok(hasExpectedError, "Error alert must be visible on storage failure");

    // 3. User assessment in localStorage must NOT be deleted or corrupted
    const stored = loadPersistedAssessment();
    assert.equal(stored.success, true);
    if (stored.success) {
      assert.equal(stored.data.metadata?.facilityName, "Sunrise Senior Living");
    }
  } finally {
    dom.window.Storage.prototype.setItem = originalProtoSetItem;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
});

test("Adversarial QA: handleOpenDemoAssessment in AssessmentsPage switches active workspace when storage succeeds", async () => {
  dom.window.localStorage.clear();
  const userAssessment = createValidTestAssessment();
  savePersistedAssessment(userAssessment);
  saveActiveWorkspace("user");

  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AssessmentsPage));
  });

  try {
    const links = Array.from(container.querySelectorAll("a"));
    const demoLink = links.find((l) => l.textContent?.includes("Open demo") || l.textContent?.includes("Open example clinic"));
    assert.ok(demoLink, "Demo link must exist in AssessmentsPage");

    const clickEvent = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    await act(async () => {
      demoLink.dispatchEvent(clickEvent);
    });

    assert.equal(clickEvent.defaultPrevented, false, "clickEvent must NOT be defaultPrevented on success");
    assert.equal(loadActiveWorkspace(), "demo", "Active workspace must switch to demo");
    assert.equal(useSafeSpaceStore.getState().assessmentType, "demo");

    const stored = loadPersistedAssessment();
    assert.equal(stored.success, true);
    if (stored.success) {
      assert.equal(stored.data.metadata?.facilityName, "Sunrise Senior Living");
    }
  } finally {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
});

// ---------------------------------------------------------------------------
// 2. Zero Fabricated Risk Scores, Lux Readings, Quotes, or Clinician Sign-Offs
// ---------------------------------------------------------------------------

test("Adversarial QA: Zero fabricated markers in retired components markup", () => {
  for (const { name, comp } of RETIRED_COMPONENTS) {
    const html = renderToStaticMarkup(React.createElement(comp));
    for (const marker of FABRICATED_MARKERS) {
      assert.ok(
        !html.includes(marker),
        `Marker "${marker}" found in retired component ${name}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Demo / User Switching & Preservation of User Assessment
// ---------------------------------------------------------------------------

test("Adversarial QA: Switching to demo preserves existing saved user assessment in localStorage", () => {
  dom.window.localStorage.clear();
  useSafeSpaceStore.getState().resetToDemo();

  // Save real user assessment into localStorage
  const userAssessment = createValidTestAssessment();
  const saveResult = savePersistedAssessment(userAssessment);
  assert.equal(saveResult.success, true, `Save should succeed: ${saveResult.success ? "" : saveResult.error}`);
  saveActiveWorkspace("user");

  // Verify stored in localStorage
  const rawBefore = dom.window.localStorage.getItem(SAFESPESPACE_STORAGE_KEY_ALIAS);
  assert.ok(rawBefore !== null, "User assessment must exist in localStorage");

  // Hydrate store as user assessment
  useSafeSpaceStore.getState().hydrateFromStorage();
  assert.equal(useSafeSpaceStore.getState().assessmentType, "user");
  assert.equal(
    useSafeSpaceStore.getState().assessmentMetadata?.facilityName,
    "Sunrise Senior Living"
  );

  // Switch to demo preset (as done from /assessments or TopAppBar)
  saveActiveWorkspace("demo");
  useSafeSpaceStore.getState().resetToDemo("analysis");

  // Verify active workspace and store switched to demo
  assert.equal(loadActiveWorkspace(), "demo");
  assert.equal(useSafeSpaceStore.getState().assessmentType, "demo");
  assert.equal(useSafeSpaceStore.getState().activeStage, "analysis");

  // CRITICAL CHECK: User assessment in localStorage MUST BE INTACT
  const rawAfter = dom.window.localStorage.getItem(SAFESPESPACE_STORAGE_KEY_ALIAS);
  assert.ok(
    rawAfter !== null,
    "User assessment must NOT be deleted from localStorage when opening demo"
  );
  assert.equal(
    rawAfter,
    rawBefore,
    "User assessment in localStorage must NOT be modified or corrupted"
  );

  // Switch back to user workspace: re-hydrates identically
  saveActiveWorkspace("user");
  useSafeSpaceStore.getState().hydrateFromStorage();
  assert.equal(useSafeSpaceStore.getState().assessmentType, "user");
  assert.equal(
    useSafeSpaceStore.getState().assessmentMetadata?.facilityName,
    "Sunrise Senior Living"
  );
  assert.equal(useSafeSpaceStore.getState().furniture[0].name, "Coffee Table");
});

const SAFESPESPACE_STORAGE_KEY_ALIAS = SAFESPACE_STORAGE_KEY;

test("Adversarial QA: loadDemoAssessment does not delete localStorage user assessment", () => {
  dom.window.localStorage.clear();
  const userAssessment = createValidTestAssessment();
  const saveResult = savePersistedAssessment(userAssessment);
  assert.equal(saveResult.success, true);
  saveActiveWorkspace("user");

  useSafeSpaceStore.getState().loadDemoAssessment();

  assert.equal(useSafeSpaceStore.getState().assessmentType, "demo");
  const stored = loadPersistedAssessment();
  assert.equal(stored.success, true);
  if (stored.success) {
    assert.equal(stored.data.metadata?.facilityName, "Sunrise Senior Living");
  }
});

// ---------------------------------------------------------------------------
// 4. Analysis Transition: No Fake Timers or Simulated Scanning
// ---------------------------------------------------------------------------

test("Adversarial QA: runAnalysisTransition executes synchronously without timers or fake steps", () => {
  useSafeSpaceStore.setState({
    activeStage: "routes",
    isTransitioning: false,
    transitionStep: 0,
  });

  const startTime = Date.now();
  useSafeSpaceStore.getState().runAnalysisTransition();
  const elapsed = Date.now() - startTime;

  // Must complete in under 50ms (synchronous execution, not 2100ms)
  assert.ok(
    elapsed < 50,
    `Transition must be immediate (took ${elapsed}ms, expected < 50ms)`
  );

  const state = useSafeSpaceStore.getState();
  assert.equal(state.activeStage, "analysis");
  assert.equal(state.isTransitioning, false);
  assert.equal(state.transitionStep, 0);
});

test("Adversarial QA: AnalysisTransition component renders null and contains zero fake scanning elements", () => {
  // When isTransitioning is false
  useSafeSpaceStore.setState({ isTransitioning: false, transitionStep: 0 });
  const htmlInactive = renderToStaticMarkup(React.createElement(AnalysisTransition));
  assert.equal(htmlInactive, "");

  // When isTransitioning is true
  useSafeSpaceStore.setState({ isTransitioning: true, transitionStep: 1 });
  const htmlActive = renderToStaticMarkup(React.createElement(AnalysisTransition));
  assert.equal(htmlActive, "");

  // Ensure no fake scanning labels exist in component
  assert.ok(!htmlActive.includes("Scanning floorplan"));
  assert.ok(!htmlActive.includes("Simulating walker"));
  assert.ok(!htmlActive.includes("Computing heatmap"));
});

// ---------------------------------------------------------------------------
// 5. Canonical 5-Stage Workspace at '/' Remains Fully Functional
// ---------------------------------------------------------------------------

test("Adversarial QA: Stage navigation and store state transitions across all 5 stages", () => {
  useSafeSpaceStore.getState().resetToDemo();

  const stages: WorkflowStage[] = ["layout", "profile", "routes", "analysis", "improve"];
  for (const stage of stages) {
    useSafeSpaceStore.getState().setStage(stage);
    assert.equal(
      useSafeSpaceStore.getState().activeStage,
      stage,
      `Successfully navigated to stage ${stage}`
    );
  }
});

test("Adversarial QA: Stage 4 generates deterministic spatial findings without fabricated scores", () => {
  useSafeSpaceStore.getState().resetToDemo();
  useSafeSpaceStore.getState().recalculateRoute();

  const spatialResult = useSafeSpaceStore.getState().getSpatialFindings();
  assert.ok(spatialResult && Array.isArray(spatialResult.findings), "getSpatialFindings returns evaluation result with findings array");
  assert.ok(spatialResult.findings.length > 0, "Demo scene produces spatial findings");

  for (const f of spatialResult.findings) {
    assert.ok(f.id, "Finding has id");
    assert.ok(f.title, "Finding has title");
    assert.ok(
      ["actionable-deficit", "advisory-observation", "unassessed-category", "unassessed-scope"].includes(f.classification),
      `Valid classification: ${f.classification}`
    );
    // Findings must be based on physical measurements or clearance deficits
    assert.notEqual(f.title, "Risk Score 68");
  }
});

test("Adversarial QA: Stage 5 optimizer candidate generation, preview, apply, and revert lifecycle", () => {
  useSafeSpaceStore.getState().resetToDemo();
  useSafeSpaceStore.getState().setStage("improve");

  // Run optimization
  useSafeSpaceStore.getState().runOptimization();
  const optResult = useSafeSpaceStore.getState().activeOptimizationResult;
  assert.ok(optResult !== null, "Optimization result generated");
  assert.ok(
    ["improved", "infeasible", "already_optimal", "unconfigured"].includes(optResult.status),
    `Valid optimization status: ${optResult.status}`
  );

  if (optResult.status === "improved" && optResult.candidates.length > 0) {
    const candidate = optResult.candidates[0];
    const initialFurniture = [...useSafeSpaceStore.getState().furniture];

    // Select/preview candidate
    useSafeSpaceStore.getState().selectCandidate(candidate.id);
    assert.equal(useSafeSpaceStore.getState().selectedCandidateId, candidate.id);

    // Apply candidate
    const applyRes = useSafeSpaceStore.getState().applyLayoutCandidate(candidate.id);
    assert.equal(applyRes.success, true, `Candidate applied successfully: ${applyRes.error}`);
    assert.equal(useSafeSpaceStore.getState().appliedCandidateId, candidate.id);
    assert.ok(
      useSafeSpaceStore.getState().baselineFurnitureSnapshot !== null,
      "Baseline snapshot recorded for reversible apply"
    );

    // Revert candidate
    const revertRes = useSafeSpaceStore.getState().revertLayoutCandidate();
    assert.equal(revertRes.success, true, `Candidate reverted successfully: ${revertRes.error}`);
    assert.equal(useSafeSpaceStore.getState().appliedCandidateId, null);
    assert.equal(
      useSafeSpaceStore.getState().furniture.length,
      initialFurniture.length,
      "Furniture count restored after revert"
    );
  }
});

test("Adversarial QA: ReportModal renders truthful data without fabricated sign-offs or quotes", async () => {
  useSafeSpaceStore.getState().resetToDemo();
  useSafeSpaceStore.setState({ reportModalOpen: true });

  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(ReportModal));
  });

  const html = container.innerHTML;
  assert.ok(html.length > 0, "ReportModal renders markup in DOM");

  // Must NOT include fabricated markers
  for (const marker of FABRICATED_MARKERS) {
    assert.ok(
      !html.includes(marker),
      `ReportModal must NOT render fabricated marker: ${marker}`
    );
  }

  // Must include audit-truthful information
  assert.ok(
    html.includes("SafeSpace Assessment Summary Report"),
    "ReportModal renders title"
  );

  await act(async () => {
    root.unmount();
  });
  container.remove();
  useSafeSpaceStore.setState({ reportModalOpen: false });
});
