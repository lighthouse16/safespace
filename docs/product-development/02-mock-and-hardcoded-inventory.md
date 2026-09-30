# Inventory of Mocks, Hardcoding, and Simulated Behaviors

## 1. Inventory Summary & Reconciliation Methodology

This inventory catalogues every verified mock, hardcoded metric, simulated workflow state, unbacked safety claim, and missing implementation identified in the SafeSpace codebase.
Per Stage 0 audit standards, **every finding counted in the summary totals is individually and completely documented below** with its unique identifier, category, severity, file location, exact code evidence, product impact, and future stage assignment.

### Reconciliation Proof Table
| Metric | Count | Reconciliation Check |
| :--- | :---: | :---: |
| **Total Catalogued Findings** | **24** | Base Total |
| **Sum by Category** | **24** | 6 Misleading + 8 Hardcoded + 5 Missing + 3 Temporary + 2 Dead = 24 (MATCH) |
| **Sum by Severity** | **24** | 9 Critical + 8 High + 6 Medium + 1 Low = 24 (MATCH) |
| **Detailed Documented Entries** | **24** | MOCK-01 through MOCK-24 (MATCH) |

### Breakdown by Category
- **Hardcoded business logic**: 8 findings
- **Misleading mock behavior**: 6 findings
- **Missing implementation**: 5 findings
- **Temporary prototype implementation**: 3 findings
- **Dead or unused code**: 2 findings
- **Total**: **24 findings**

### Breakdown by Severity
- **Critical**: 9 findings (Blocks clinical validity, endangers user data, or fakes core calculations)
- **High**: 8 findings (Blocks arbitrary floorplan support or multi-object analysis)
- **Medium**: 6 findings (Incomplete UI features, missing assets, or cosmetic stubs)
- **Low**: 1 finding (Test fixture artifacts)
- **Total**: **24 findings**

---

## 2. Complete Detailed Findings Register (MOCK-01 to MOCK-24)

### MOCK-01: Fake Floorplan Upload & Extraction State Transitions
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "Upload Plan (PDF, PNG, CAD)" / "Extracting architectural boundaries and interior fixtures..."
- **Actual Behavior**: Clicking the upload button triggers purely cosmetic UI state transitions (`setImportMode("uploading")` $\to$ `setImportMode("extracting")` $\to$ `setImportMode("ready")`). No file is ingested, no multipart data is parsed, and no computer vision backend is invoked.
- **Exact File & Symbol**: `src/store/safespace-store.ts:32-34` (`importMode`, `setImportMode`), `src/components/workflow/Stage1Layout.tsx:160-185`.
- **Evidence**:
  ```typescript
  importMode: "ready", // ready for demo clinic by default
  setImportMode: (mode) => set({ importMode: mode }),
  ```
- **Product Impact**: Users cannot import arbitrary spaces; only the pre-baked Queen Care Clinic geometry is ever available.
- **Assigned Future Stage**: Stage 2 (Real Floorplan Intake).
- **Status**: **Blocking**.

---

### MOCK-02: Non-Durable In-Memory State Claiming "All changes saved"
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "All changes saved" displayed with a green checkmark in the global top application bar.
- **Actual Behavior**: No persistence layer exists. State lives exclusively in volatile Zustand memory. Refreshing the browser instantly erases all changes.
- **Exact File & Symbol**: `src/components/workflow/TopAppBar.tsx:50` (`TopAppBar`).
- **Evidence**:
  ```tsx
  <span className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
    All changes saved
  </span>
  ```
- **Product Impact**: False assurance of persistence leads to immediate data loss upon accidental refresh.
- **Assigned Future Stage**: Stage 1 (Canonical Domain Model & Persistence).
- **Status**: **Blocking**.

---

### MOCK-03: Sub-Page Header "Saved" Persistence Badge
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "Saved" status pill in sub-route headers.
- **Actual Behavior**: Status badge renders static string `"Saved"` without checking database write acknowledgments.
- **Exact File & Symbol**: `src/components/ui/status.tsx:7` (`StatusPill`), `src/app/assessments/queen-care-clinic/model/page.tsx:11`.
- **Evidence**:
  ```tsx
  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
    Saved
  </span>
  ```
- **Product Impact**: Reinforces false persistence claim in multi-page routes.
- **Assigned Future Stage**: Stage 1 (Canonical Domain Model & Persistence).
- **Status**: **Blocking**.

---

### MOCK-04: Metric Engine Tied Exclusively to `chair-c04`
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: "Environmental Risk Index" dynamically evaluates scene clearances.
- **Actual Behavior**: `calculateLiveMetrics` explicitly searches for `item.id === "chair-c04"`. Clearance is only evaluated relative to this specific object ID and a magic coordinate `(235, 260)`. All other 17 objects are ignored.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:893-913` (`calculateLiveMetrics`).
- **Evidence**:
  ```typescript
  const chair4 = furniture.find((f) => f.id === "chair-c04");
  const mat = furniture.find((f) => f.id === "mat-entrance");
  if (chair4) {
    const distToRoute = Math.hypot(chair4.x + chair4.width / 2 - 235, chair4.y + chair4.depth / 2 - 260);
    const effectiveClearance = Math.round(Math.max(45, Math.min(120, distToRoute * 1.4)));
    if (distToRoute < 50) minClearance = Math.min(minClearance, 54);
    else minClearance = Math.min(minClearance, effectiveClearance);
  }
  ```
- **Product Impact**: Zero multi-object geometric awareness. Deleting `chair-c04` permanently locks the system into a "safe" state regardless of actual room obstructions.
- **Assigned Future Stage**: Stage 3 (Geometry Engine) & Stage 4 (Environmental Hazard Rule Engine).
- **Status**: **Blocking**.

---

### MOCK-05: Discrete Stepped Risk Indices (68, 41, 27)
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: Continuous numerical risk index ($0\dots100$).
- **Actual Behavior**: The score is not computed from an epidemiological or spatial formula; it is hard-clamped to three discrete step numbers (`68`, `41`, or `27`).
- **Exact File & Symbol**: `src/lib/spatial-model.ts:934-946` (`calculateLiveMetrics`).
- **Evidence**:
  ```typescript
  if (minClearance <= 60) { risk = 68; highHazards = 3; totalHazards = 7; }
  else if (minClearance < 90) { risk = 41; highHazards = 1; totalHazards = 4; }
  else { risk = 27; highHazards = 0; totalHazards = 2; }
  ```
- **Product Impact**: Gives illusion of mathematical precision while running a rudimentary 3-step switch.
- **Assigned Future Stage**: Stage 4 (Evidence-Backed Environmental Hazard Rule Engine).
- **Status**: **Blocking**.

---

### MOCK-06: Hardcoded Route Length Constants (10.4 m, 10.0 m, 11.8 m)
- **Category**: Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: "Route Length: 10.4 m" / "11.8 m".
- **Actual Behavior**: If the route has 8 waypoints starting at $x=60$, the function overrides geometric line summation and returns hardcoded literals.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:920-927` (`calculateLiveMetrics`).
- **Evidence**:
  ```typescript
  const isDefaultRoute = route.length === 8 && route[0].x === 60;
  const routeLengthM = isDefaultRoute
    ? activeAlternativeId === "balanced" ? 10.4 : activeAlternativeId === "max-safety" ? 10.0 : 11.8
    : Number((totalLengthCm / 100).toFixed(1));
  ```
- **Product Impact**: Distorts spatial facts; prevents verification of actual walking distances.
- **Assigned Future Stage**: Stage 3 (Geometry Engine).
- **Status**: **Non-blocking**.

---

### MOCK-07: Fake Route Recalculation Resetting to Initial Fixture
- **Category**: Misleading mock behavior
- **Severity**: High
- **User-Facing Claim**: "Recalculate Route" button computes obstacle-avoiding trajectory.
- **Actual Behavior**: Clicking the button resets waypoints to the hardcoded `INITIAL_ROUTE` constant. No A*, Dijkstra, or navmesh algorithm runs.
- **Exact File & Symbol**: `src/store/safespace-store.ts:344-346` (`recalculateRoute`), `src/components/workflow/Stage3Routes.tsx:120`.
- **Evidence**:
  ```typescript
  recalculateRoute: () => {
    set({ routeWaypoints: INITIAL_ROUTE });
  },
  ```
- **Product Impact**: Route does not adjust to newly placed furniture; user-customized routes are erased.
- **Assigned Future Stage**: Stage 3 (Geometry Engine & Pathfinding).
- **Status**: **Blocking**.

---

### MOCK-08: Simulated 2-Second Analysis Progress Timer
- **Category**: Misleading mock behavior
- **Severity**: Medium
- **User-Facing Claim**: "Running AI fall-risk simulation: Rasterizing corridor, Detecting pinch points..."
- **Actual Behavior**: A JavaScript `setInterval` timer ticks 4 cosmetic steps every 450ms (`transitionStep: 0..4`) purely to fake computation time before setting `activeStage: "analysis"`.
- **Exact File & Symbol**: `src/store/safespace-store.ts:353-366` (`runAnalysisTransition`), `src/components/workflow/AnalysisTransition.tsx:15-35`.
- **Evidence**:
  ```typescript
  runAnalysisTransition: () => {
    set({ isTransitioning: true, transitionStep: 0 });
    const interval = setInterval(() => {
      const current = get().transitionStep;
      if (current < 4) set({ transitionStep: current + 1 });
      else {
        clearInterval(interval);
        setTimeout(() => set({ isTransitioning: false, activeStage: "analysis" }), 400);
      }
    }, 450);
  }
  ```
- **Product Impact**: Violates product principle banning fake loading states.
- **Assigned Future Stage**: Stage 4 (Environmental Hazard Rule Engine).
- **Status**: **Non-blocking**.

---

### MOCK-09: Hardcoded Primary Hazard Fixture Array (Model A: 7 Hazards)
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: "Identified Hazards (7) · Deterministic rule-based scan".
- **Actual Behavior**: All 7 hazards (`hz-01` to `hz-07`) are hardcoded objects with fixed titles, static evidence strings, and hardcoded resolution lists (`resolvedInAlternative: ["balanced", "max-safety"]`). None are generated by evaluating furniture positions against profile thresholds.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:565-673` (`INITIAL_HAZARDS`).
- **Evidence**:
  ```typescript
  export const INITIAL_HAZARDS: SpatialHazard[] = [
    {
      id: "hz-01",
      code: "HZ-01",
      title: "Insufficient Walker Route Clearance",
      severity: "high",
      position: { x: 235, y: 220 },
      relatedFurnitureId: "chair-c04",
      measuredEvidence: "Measured clearance: 54 cm (Profile requirement: ≥ 90 cm, Deficit: 36 cm).",
      measuredClearanceCm: 54,
      requiredClearanceCm: 90,
      detectionConfidence: 0.96,
      ...
  ```
- **Product Impact**: Hazards never update when rooms are modified; cannot evaluate any new layout.
- **Assigned Future Stage**: Stage 4 (Evidence-Backed Environmental Hazard Rule Engine).
- **Status**: **Blocking**.

---

### MOCK-10: Divergent Secondary Hazard Fixture Array (Model B: 4 Hazards)
- **Category**: Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: "4 Hazards requiring review · Deterministic rule-based scan".
- **Actual Behavior**: `risk-analysis.tsx` in the multi-page route defines an independent array of 4 hazards (`HZ-001` to `HZ-004`) with conflicting clearances (e.g. `HZ-002`: "68 cm clearance" vs Model A's `hz-02`: "28 cm clearance") and illuminance levels (`85 lux` vs `110 Lux`).
- **Exact File & Symbol**: `src/components/analysis/risk-analysis.tsx:21-86` (`hazards`).
- **Evidence**:
  ```typescript
  export const hazards: Hazard[] = [
    { id: "HZ-001", severity: "Critical", title: "Waiting chair obstructing the route", ... measured: "54 cm" },
    { id: "HZ-002", severity: "High", title: "Sharp furniture corner close to the route", ... measured: "68 cm clearance" },
    { id: "HZ-003", severity: "Medium", title: "Poor lighting near doorway", ... measured: "85 lux" },
    { id: "HZ-004", severity: "Medium", title: "2.1-metre route section without stable support", ... measured: "2.1 m span" }
  ];
  ```
- **Product Impact**: Clinical contradictions between two views in the same application.
- **Assigned Future Stage**: Stage 1 & Stage 4 (Domain Model Consolidation).
- **Status**: **Non-blocking**.

---

### MOCK-11: Hardcoded Pre-Scripted Layout Alternatives
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: "Layout Optimisation Engine: Minimum Cost, Balanced, Maximum Safety".
- **Actual Behavior**: Alternatives are static dictionaries containing pre-scripted manual moves explicitly targeting `chair-c04` and `chair-c05`.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:752-872` (`LAYOUT_ALTERNATIVES`), `src/store/safespace-store.ts:136-166` (`generateProposedFurniture`).
- **Evidence**:
  ```typescript
  export const LAYOUT_ALTERNATIVES: Record<string, LayoutAlternative> = {
    "min-cost": { costHkd: 180, riskIndex: 41, minClearanceCm: 82, ... },
    balanced: { costHkd: 850, riskIndex: 27, minClearanceCm: 96, isRecommended: true, ... },
    "max-safety": { costHkd: 2400, riskIndex: 19, minClearanceCm: 110, ... }
  };
  ```
- **Product Impact**: No optimization algorithm exists; cannot generate alternatives for any new floorplan.
- **Assigned Future Stage**: Stage 5 (Layout Optimisation).
- **Status**: **Blocking**.

---

### MOCK-12: Hardcoded Cost Estimates (HK$180, HK$850, HK$2400)
- **Category**: Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: Accurate retrofit cost estimation for implementation.
- **Actual Behavior**: Cost numbers are hardcoded integers not derived from itemized material takeoffs, hardware pricing, or labor rates.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:759, 787, 834`.
- **Evidence**:
  ```typescript
  costHkd: 180, // min-cost
  costHkd: 850, // balanced
  costHkd: 2400, // max-safety
  ```
- **Product Impact**: Misleading cost projections for healthcare facility operators and contractors.
- **Assigned Future Stage**: Stage 5 (Layout Optimisation & Pricing).
- **Status**: **Non-blocking**.

---

### MOCK-13: Prewritten Fictitious Occupational Therapy Sign-Off
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "Professional review completed by Dr. Adrian Lau, HKROT (Reg. #OT2018-0442)".
- **Actual Behavior**: Review approval status, reviewer identity, professional credentials, and rationale are hardcoded static strings.
- **Exact File & Symbol**: `src/lib/mock-data.ts:145-155` (`mockData.reviews`), `src/components/workflow/ReportModal.tsx:112-125`.
- **Evidence**:
  ```tsx
  <p className="text-xs font-semibold text-slate-800">Dr. Adrian Lau, HKROT</p>
  <p className="text-[10px] text-slate-500">Senior Occupational Therapist · Reg #OT2018-0442</p>
  ```
- **Product Impact**: Fabricated clinical sign-off creates legal and ethical liability.
- **Assigned Future Stage**: Stage 6 & Stage 7 (Professional Review).
- **Status**: **Non-blocking**.

---

### MOCK-14: Hardcoded Photometric Illuminance Values
- **Category**: Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: "Photometric reading: 110 Lux (Standard: ≥ 200 Lux)".
- **Actual Behavior**: Fixed numbers placed in fixture files (`lightLevelLux: 160` in `INITIAL_ROOMS`, `110 Lux` in `INITIAL_HAZARDS`, `85 lux` in `risk-analysis.tsx`). No photometric raycasting or light simulation exists.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:163, 609`, `src/components/analysis/risk-analysis.tsx:62`.
- **Product Impact**: Inability to assess real lighting conditions or glare in user spaces.
- **Assigned Future Stage**: Stage 4 (Environmental Hazard Rule Engine).
- **Status**: **Non-blocking**.

---

### MOCK-15: Hardcoded "Unconfirmed Detections" Checklist (3 Items)
- **Category**: Temporary prototype implementation
- **Severity**: Medium
- **User-Facing Claim**: "3 unconfirmed detected items requiring boundary verification".
- **Actual Behavior**: The three items (`chair-c04`, `table-sharp`, `mat-entrance`) have `isConfirmed: false` hardcoded into the initial fixture array.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:337, 356, 392`.
- **Evidence**:
  ```typescript
  isConfirmed: false, // 1st unconfirmed: chair-c04
  isConfirmed: false, // 2nd unconfirmed: chair-c05 / table-sharp
  isConfirmed: false, // 3rd unconfirmed: mat-entrance
  ```
- **Product Impact**: Effective for demoing human confirmation gates, but cannot ingest unverified user models.
- **Assigned Future Stage**: Stage 2 (Floorplan Intake).
- **Status**: **Non-blocking**.

---

### MOCK-16: Fabricated Detection Confidence Decimals
- **Category**: Temporary prototype implementation
- **Severity**: Medium
- **User-Facing Claim**: AI confidence scores (`0.81`, `0.78`, `0.96`).
- **Actual Behavior**: Arbitrary decimal values assigned manually to fixture objects.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:249, 268, 338, 393`.
- **Evidence**:
  ```typescript
  detectionConfidence: 0.81, // chair-c04
  detectionConfidence: 0.78, // table-sharp
  ```
- **Product Impact**: Telemetry appears AI-generated but is static.
- **Assigned Future Stage**: Stage 7 (AI Floorplan Extraction).
- **Status**: **Non-blocking**.

---

### MOCK-17: Missing 3D Geometries for Handrail and Light Fixtures
- **Category**: Missing implementation
- **Severity**: Medium
- **User-Facing Claim**: 3D Digital Twin renders all proposed modifications (handrails, LED downlights).
- **Actual Behavior**: In `src/components/spatial/Floorplan3D.tsx`, `furniture.map` only renders branches for `chair`, `desk`, `table`, `bench`, `plant`, `mat`, and `cabinet`. Categories `handrail` and `light` render empty groups.
- **Exact File & Symbol**: `src/components/spatial/Floorplan3D.tsx:349-374`.
- **Evidence**:
  ```typescript
  {item.category === "chair" && <Chair3D ... />}
  {item.category === "desk" && <Desk3D ... />}
  // handrail and light categories have no render branch
  ```
- **Product Impact**: Visual discrepancy between 2D floorplan and 3D digital twin.
- **Assigned Future Stage**: Stage 6 (Synchronised 3D).
- **Status**: **Non-blocking**.

---

### MOCK-18: Parallel Decoupled Zustand State Stores
- **Category**: Dead or unused code
- **Severity**: High
- **User-Facing Claim**: Single cohesive application state.
- **Actual Behavior**: `src/store/safespace-store.ts` manages the SPA stepper on `/`; `src/store/assessment-store.ts` manages the multi-page routes on `/assessments/*`. They do not share state.
- **Exact File & Symbol**: `src/store/assessment-store.ts`, `src/store/safespace-store.ts`.
- **Product Impact**: State divergence, double bug surface, and developer confusion.
- **Assigned Future Stage**: Stage 1 (Domain Model Consolidation).
- **Status**: **Non-blocking**.

---

### MOCK-19: Orphaned Options Compare Sub-Route
- **Category**: Dead or unused code
- **Severity**: Medium
- **User-Facing Claim**: Multi-scenario comparison table.
- **Actual Behavior**: Route `/assessments/queen-care-clinic/options/compare` renders a static table disconnected from both stores.
- **Exact File & Symbol**: `src/app/assessments/queen-care-clinic/options/compare/page.tsx:1-40`.
- **Product Impact**: Dead code cluttering route tree.
- **Assigned Future Stage**: Stage 1 (Cleanup & Consolidation).
- **Status**: **Non-blocking**.

---

### MOCK-20: Missing Dynamic A* Pathfinding Engine
- **Category**: Missing implementation
- **Severity**: High
- **User-Facing Claim**: Critical routes dynamically trace step-free passage around room fixtures.
- **Actual Behavior**: Routes are static waypoint arrays. No computational pathfinder exists to compute routes through walkable space.
- **Exact File & Symbol**: `src/components/workflow/Stage3Routes.tsx:115-130`.
- **Product Impact**: Routes cannot adapt to new rooms or rearranged furniture.
- **Assigned Future Stage**: Stage 3 (Routes & Geometry Engine).
- **Status**: **Blocking**.

---

### MOCK-21: Total Absence of Durable Client or Cloud Persistence
- **Category**: Missing implementation
- **Severity**: Critical
- **User-Facing Claim**: System saves user work.
- **Actual Behavior**: No IndexedDB, localStorage, or remote database client is configured.
- **Exact File & Symbol**: `src/store/safespace-store.ts:1-435`.
- **Product Impact**: Complete data loss upon browser navigation or refresh.
- **Assigned Future Stage**: Stage 1 (Domain Model & Persistence).
- **Status**: **Blocking**.

---

### MOCK-22: Absence of Floorplan Ingestion & Parsing Engine
- **Category**: Missing implementation
- **Severity**: High
- **User-Facing Claim**: User can import architectural PDFs or floorplan photos.
- **Actual Behavior**: No image parsing, PDF vector extraction, or scale calibration canvas exists.
- **Exact File & Symbol**: `src/components/workflow/Stage1Layout.tsx:160-190`.
- **Product Impact**: Inability to ingest any new floorplan.
- **Assigned Future Stage**: Stage 2 (Floorplan Intake & Calibration).
- **Status**: **Blocking**.

---

### MOCK-23: Missing Native PDF Generation Engine
- **Category**: Missing implementation
- **Severity**: Medium
- **User-Facing Claim**: "Download Official Assessment Report (PDF)".
- **Actual Behavior**: Clicking print/download calls `window.print()` without formatting dedicated CSS print stylesheets or generating standalone vector PDF files.
- **Exact File & Symbol**: `src/components/workflow/ReportModal.tsx:150-165`.
- **Product Impact**: Inconsistent printed report formatting across different browsers.
- **Assigned Future Stage**: Stage 7 (Professional Report Generation).
- **Status**: **Non-blocking**.

---

### MOCK-24: Hardcoded Demo Identifiers in Test Fixtures
- **Category**: Temporary prototype implementation
- **Severity**: Low
- **User-Facing Claim**: Internal test automation.
- **Actual Behavior**: Tests reference hardcoded fixture IDs (`demoIds.balancedScenario`, `demoIds.route`) in `mock-data.ts`.
- **Exact File & Symbol**: `src/lib/mock-data.ts:18-28`, `tests/domain.test.ts:1-4`.
- **Product Impact**: Tests only validate the demo fixture, not general domain operations.
- **Assigned Future Stage**: Stage 1 (Testing Framework).
- **Status**: **Non-blocking**.
