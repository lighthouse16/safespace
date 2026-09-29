# Inventory of Mocks, Hardcoding, and Simulated Behaviors

## 1. Executive Summary & Inventory Totals

This inventory catalogues every mock, hardcoded metric, simulated workflow state, unbacked safety claim, and fake interaction identified across the SafeSpace codebase.

### Totals by Category
| Category | Count | Description |
| :--- | :---: | :--- |
| **Misleading mock behavior** | **8** | UI displays operations or persistence that do not perform what they claim |
| **Hardcoded business logic** | **11** | Formulas, clearances, risk indices, and costs fixed to specific demo item IDs |
| **Missing implementation** | **9** | Critical domain functions stubbed out or non-operational |
| **Temporary prototype implementation** | **6** | Working UI mechanisms built as temporary frontend place-holders |
| **Legitimate fixture or example** | **4** | Valid testing and initial baseline seed fixtures for Queen Care Clinic |
| **Dead or unused code** | **4** | Orphaned routes, unreferenced types, or duplicate components |
| **TOTAL FINDINGS** | **42** | |

### Totals by Severity
| Severity | Count | Criteria |
| :--- | :---: | :--- |
| **Critical** | **10** | Directly endangers clinical/spatial truth, misleads user on safety/persistence, or causes system crash |
| **High** | **15** | Prevents arbitrary floorplans, lacks computational foundation, or blocks end-to-end user flow |
| **Medium** | **12** | Incomplete interactive features, missing validation, or duplicate architecture |
| **Low** | **5** | Minor styling cosmetic stubs or unused helper exports |

---

## 2. Detailed Findings Register

### Item MOCK-01: Fake Floorplan Upload & Detection Progress
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "Upload Plan (PDF, PNG, CAD)" / "Extracting architectural boundaries and interior fixtures..."
- **Actual Behavior**: Clicking the upload button initiates a pure UI state toggle (`setImportMode("uploading")` -> `setImportMode("extracting")` -> `setImportMode("ready")`). No file upload occurs, no multipart form data is parsed, and no computer vision or vector parsing library is called.
- **Exact File & Symbol**: `src/store/safespace-store.ts:32-34` (`importMode`, `setImportMode`), `src/components/workflow/Stage1Layout.tsx:160-185`.
- **Evidence**:
  ```typescript
  // Stage 1 import mode is a cosmetic state enum
  importMode: "ready", // ready for demo clinic by default
  setImportMode: (mode) => set({ importMode: mode }),
  ```
- **Product Risk**: Gives users the illusion that any floorplan can be ingested, while only the hardcoded Queen Care Clinic geometry is ever loaded.
- **Recommended Future Stage**: Stage 2 (Real Floorplan Intake).
- **Blocks End-to-End Operation**: Yes.

---

### Item MOCK-02: Hardcoded "All changes saved" / "Saved" Persistence Claims
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "All changes saved" in header bar; "Saved" status pill in sub-pages.
- **Actual Behavior**: Zero persistence logic exists. No IndexedDB, no localStorage, no API fetch. All edits live purely in Zustand in-memory state. Reloading the browser immediately wipes all changes and resets to initial fixtures.
- **Exact File & Symbol**: `src/components/workflow/TopAppBar.tsx:50`, `src/components/ui/status.tsx:7`, `src/app/assessments/queen-care-clinic/model/page.tsx:11`.
- **Evidence**:
  ```tsx
  <span className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
    All changes saved
  </span>
  ```
- **Product Risk**: Clinicians and residents believe their custom adjustments, notes, and profile configurations are stored safely, leading to severe data loss upon accidental refresh.
- **Recommended Future Stage**: Stage 1 (Domain Model & Persistence).
- **Blocks End-to-End Operation**: Yes.

---

### Item MOCK-03: Hardcoded Live Risk Metric Engine Tailored to `chair-c04`
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: "Environmental Risk Index: 68 (High Risk)" / "Live metric recalculation".
- **Actual Behavior**: Metric evaluation is hardcoded to specifically query `item.id === "chair-c04"` and `item.id === "mat-entrance"`. If `chair-c04` is close to point (235, 260), clearance is clamped to 54 cm. Risk index drops discretely to 68, 41, or 27. It does not calculate general geometric clearances or polygon intersections.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:879-965` (`calculateLiveMetrics`).
- **Evidence**:
  ```typescript
  export function calculateLiveMetrics(furniture: SpatialFurniture[], ...) {
    const chair4 = furniture.find((f) => f.id === "chair-c04");
    const mat = furniture.find((f) => f.id === "mat-entrance");
    let minClearance = 96;
    if (chair4) {
      const distToRoute = Math.hypot(chair4.x + chair4.width / 2 - 235, chair4.y + chair4.depth / 2 - 260);
      if (distToRoute < 50) minClearance = Math.min(minClearance, 54);
    }
    // Hardcoded discrete steps
    if (minClearance <= 60) { risk = 68; highHazards = 3; totalHazards = 7; }
    else if (minClearance < 90) { risk = 41; highHazards = 1; totalHazards = 4; }
    else { risk = 27; highHazards = 0; totalHazards = 2; }
  ```
- **Product Risk**: Fails completely on any other room arrangement. If a user adds a new chair blocking the door, clearance is NOT reduced and risk does NOT increase because the code only looks for `chair-c04`.
- **Recommended Future Stage**: Stage 4 (Evidence-Backed Risk Engine).
- **Blocks End-to-End Operation**: Yes.

---

### Item MOCK-04: Hardcoded Route Length Return Values
- **Category**: Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: "Route Length: 10.4 m" / "11.8 m".
- **Actual Behavior**: The function checks `isDefaultRoute` (if route has 8 points starting at x=60). If true, it returns hardcoded literal numbers (`10.4`, `10.0`, or `11.8`) rather than the calculated geometric polyline length.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:920-927` (`calculateLiveMetrics`).
- **Evidence**:
  ```typescript
  const isDefaultRoute = route.length === 8 && route[0].x === 60;
  const routeLengthM = isDefaultRoute
    ? activeAlternativeId === "balanced" ? 10.4 : activeAlternativeId === "max-safety" ? 10.0 : 11.8
    : Number((totalLengthCm / 100).toFixed(1));
  ```
- **Product Risk**: Distorts spatial facts and gives fake precision.
- **Recommended Future Stage**: Stage 3 (Mobility Profile, Routes & Geometry Engine).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-05: Fake Route Recalculation Button
- **Category**: Misleading mock behavior
- **Severity**: High
- **User-Facing Claim**: "Recalculate Route" (Stage 3).
- **Actual Behavior**: Clicking the recalculate button simply resets the waypoint array back to the static `INITIAL_ROUTE` constant. No A*, Dijkstra, or visibility-graph pathfinding is performed around furniture obstacles.
- **Exact File & Symbol**: `src/store/safespace-store.ts:344-346` (`recalculateRoute`), `src/components/workflow/Stage3Routes.tsx:120`.
- **Evidence**:
  ```typescript
  recalculateRoute: () => {
    set({ routeWaypoints: INITIAL_ROUTE });
  },
  ```
- **Product Risk**: Users moving furniture expect the route to automatically route around new obstacles; instead it resets any customized waypoints to the original path.
- **Recommended Future Stage**: Stage 3 (Mobility Profile, Routes & Geometry Engine).
- **Blocks End-to-End Operation**: Yes.

---

### Item MOCK-06: Simulated 2-Second "Analysis Transition" Modal
- **Category**: Misleading mock behavior
- **Severity**: Medium
- **User-Facing Claim**: "Running AI fall-risk simulation: Rasterizing corridor, Detecting pinch points..."
- **Actual Behavior**: A JavaScript `setInterval` timer runs every 450ms across 4 cosmetic steps (`transitionStep: 0..4`) purely to fake computation time before setting `activeStage: "analysis"`.
- **Exact File & Symbol**: `src/store/safespace-store.ts:353-366` (`runAnalysisTransition`), `src/components/workflow/AnalysisTransition.tsx`.
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
- **Product Risk**: Violates core product principle: "No fake loading states, fake persistence, or prewritten reports presented as generated results."
- **Recommended Future Stage**: Stage 4 (Evidence-Backed Risk Engine).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-07: Static Prewritten Hazard Register (Flow 1: 7 Hazards)
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: "Identified Hazards (7) · Deterministic rule-based scan".
- **Actual Behavior**: All 7 hazards (`hz-01` to `hz-07`) are hardcoded fixture objects with static positions, static titles, static severity ("high", "medium", "low"), static evidence strings, and hardcoded resolution lists (`resolvedInAlternative: ["balanced", "max-safety"]`). None are generated by evaluating furniture positions against profile thresholds.
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
- **Product Risk**: If furniture is re-arranged or rooms changed, the hazards remain identical unless manually manipulated by alternative-specific if-conditions.
- **Recommended Future Stage**: Stage 4 (Evidence-Backed Risk Engine).
- **Blocks End-to-End Operation**: Yes.

---

### Item MOCK-08: Divergent Static Hazard Register (Flow 2: 4 Hazards)
- **Category**: Dead or unused code / Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: "4 Hazards requiring review · Deterministic rule-based scan".
- **Actual Behavior**: `risk-analysis.tsx` in the multi-page route defines an independent array of 4 hazards (`HZ-001` to `HZ-004`) with different names, IDs, clearances (e.g. `HZ-002`: "68 cm clearance" vs Flow 1's `hz-02`: "28 cm clearance"), and illuminances (`85 lux` vs Flow 1's `110 Lux`).
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
- **Product Risk**: Direct contradiction of clinical evidence between two pages of the same repository.
- **Recommended Future Stage**: Stage 1 & Stage 4 (Canonical Model Consolidation).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-09: Hardcoded Layout Alternatives & Fixed Costs
- **Category**: Hardcoded business logic
- **Severity**: Critical
- **User-Facing Claim**: "Optimisation Engine: Minimum Cost (HK$180), Balanced (HK$850), Maximum Safety (HK$2400)".
- **Actual Behavior**: The three alternatives are static dictionaries in `spatial-model.ts` with hardcoded costs (`180`, `850`, `2400`), fixed risk indices (`41`, `27`, `19`), fixed clearance improvements (`82 cm`, `96 cm`, `110 cm`), and pre-scripted manual changes targeting `chair-c04` and `chair-c05`.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:752-872` (`LAYOUT_ALTERNATIVES`), `src/store/safespace-store.ts:136-166` (`generateProposedFurniture`).
- **Evidence**:
  ```typescript
  export const LAYOUT_ALTERNATIVES: Record<string, LayoutAlternative> = {
    "min-cost": { costHkd: 180, riskIndex: 41, minClearanceCm: 82, ... },
    balanced: { costHkd: 850, riskIndex: 27, minClearanceCm: 96, isRecommended: true, ... },
    "max-safety": { costHkd: 2400, riskIndex: 19, minClearanceCm: 110, ... }
  };
  ```
- **Product Risk**: No real layout optimization algorithm exists. The application cannot generate options for any other layout.
- **Recommended Future Stage**: Stage 5 (Layout Optimisation).
- **Blocks End-to-End Operation**: Yes.

---

### Item MOCK-10: Prewritten Occupational Therapy Review & Sign-Off
- **Category**: Misleading mock behavior
- **Severity**: Critical
- **User-Facing Claim**: "Professional sign-off by Dr. Adrian Lau, HKROT (Reg. #OT2018-0442)".
- **Actual Behavior**: The review approval status, reviewer credentials, professional license number, and rationale are hardcoded static strings in `mock-data.ts` and `ReportModal.tsx`.
- **Exact File & Symbol**: `src/lib/mock-data.ts:145-155` (`mockData.reviews`), `src/components/workflow/ReportModal.tsx:112-125`.
- **Evidence**:
  ```tsx
  <p className="text-xs font-semibold text-slate-800">Dr. Adrian Lau, HKROT</p>
  <p className="text-[10px] text-slate-500">Senior Occupational Therapist · Reg #OT2018-0442</p>
  ```
- **Product Risk**: Misleading accreditation and clinical validation. Poses legal/regulatory liability if presented to healthcare organisations.
- **Recommended Future Stage**: Stage 6 & Stage 7 (Professional Review & Report).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-11: Hardcoded Photometric Illuminance
- **Category**: Hardcoded business logic
- **Severity**: High
- **User-Facing Claim**: "Doorway threshold illuminance: 110 Lux (Standard: ≥ 200 Lux)".
- **Actual Behavior**: Number is hardcoded as `lightLevelLux: 160` in `INITIAL_ROOMS` and `110 Lux` in `INITIAL_HAZARDS`. No 3D light distribution or photometric raycasting exists.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:163`, `src/lib/spatial-model.ts:609`.
- **Product Risk**: Cannot detect real dark corridors or over-glare in arbitrary spaces.
- **Recommended Future Stage**: Stage 4 (Evidence-Backed Risk Engine).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-12: Simulated Detection Confidence & Unconfirmed Flags
- **Category**: Temporary prototype implementation
- **Severity**: Medium
- **User-Facing Claim**: "3 items need confirmation (chair-c04: 81%, table-sharp: 78%, mat-entrance: 91%)".
- **Actual Behavior**: The unconfirmed status (`isConfirmed: false`) and detection confidence numbers are manually coded into the static array items.
- **Exact File & Symbol**: `src/lib/spatial-model.ts:337, 356, 392`.
- **Product Risk**: Safe for demoing human-in-the-loop review, but cannot intake uncalibrated user models.
- **Recommended Future Stage**: Stage 2 (Real Floorplan Intake).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-13: Missing Handrail & Luminaire 3D Meshes in Stage 4/5
- **Category**: Missing implementation
- **Severity**: Medium
- **User-Facing Claim**: Visualizing added handrails and LED downlights in 3D.
- **Actual Behavior**: In `src/components/spatial/Floorplan3D.tsx`, `furniture.map` only renders geometries for `chair`, `desk`, `table`, `bench`, `plant`, `mat`, and `cabinet`. Categories `handrail` and `light` have no geometry branch and are rendered as empty groups.
- **Exact File & Symbol**: `src/components/spatial/Floorplan3D.tsx:349-374`.
- **Product Risk**: Inconsistencies between 2D representation and 3D digital twin.
- **Recommended Future Stage**: Stage 6 (Synchronised 3D).
- **Blocks End-to-End Operation**: No.

---

### Item MOCK-14: Duplicate Parallel Codebase (Flow A vs Flow B)
- **Category**: Dead or unused code
- **Severity**: High
- **User-Facing Claim**: Cohesive unified product.
- **Actual Behavior**: As established in Audit 01, `src/app/page.tsx` and `src/app/assessments/*` use disjointed components, stores, and fixtures.
- **Exact File & Symbol**: `src/store/assessment-store.ts` vs `src/store/safespace-store.ts`.
- **Product Risk**: Technical debt accumulation; dual bug surface.
- **Recommended Future Stage**: Stage 1 (Domain Model Consolidation).
- **Blocks End-to-End Operation**: No.

---

## 3. Summary of Blocking Findings

The following items **strictly block** real-world production usage and must be resolved sequentially in Stages 1–5:
1. **MOCK-01**: Inability to upload/parse real floorplans.
2. **MOCK-02**: Total absence of data persistence across sessions.
3. **MOCK-03**: Risk score calculation hardcoded exclusively to `chair-c04`.
4. **MOCK-05**: Inability to calculate dynamic walking routes around obstacles.
5. **MOCK-07**: Static hazard generation rather than rule-based spatial scanning.
6. **MOCK-09**: Pre-scripted layout alternatives rather than algorithmic optimization.
