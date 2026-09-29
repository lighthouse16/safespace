# Current Technical Architecture Audit

## 1. Technical Baseline Summary

| Parameter | Specification in Codebase | Verification Status |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.3.6 (App Router, Turbopack) | Verified via `package.json` and build logs |
| **Runtime / Language** | Node.js v20+ / TypeScript 6.0.3 (ESNext Modules) | Verified via `tsconfig.json` & `typecheck` |
| **UI Library** | React 19.3.0, React DOM 19.3.0 | Verified via `package.json` |
| **Package Manager** | npm (with `package-lock.json` v3) | Verified via npm lockfile |
| **CSS & Design System** | Tailwind CSS v4.3.3 (`@tailwindcss/postcss`), PostCSS 8.5.28 | Verified via `postcss.config.mjs` |
| **Icons** | `@phosphor-icons/react` 2.1.10, `lucide-react` 1.48.0 | Verified |
| **2D Spatial Canvas** | Konva 10.7.0 / `react-konva` 19.3.0 + Custom SVG/DOM | Verified |
| **3D Engine** | Three.js 0.186.1, `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9 | Verified |
| **State Management** | Zustand 5.0.15 (Dual independent stores) | Verified |
| **Test Runner** | Native Node.js test runner via `tsx` 4.23.15 | Verified via `package.json` |
| **Build Target** | Static HTML Export (`output: "export"`) | Verified via `next.config.ts` |
| **Hosting Target** | GitHub Pages (`https://lighthouse16.github.io/safespace`) | Verified via `.github/workflows/deploy.yml` |

---

## 2. Directory Structure & Key Entry Points

```
d:\projects\hack4sdg\
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages CI/CD workflow
├── docs/
│   └── product-development/    # Product architecture & audit records
├── src/
│   ├── app/                    # Next.js App Router entry points
│   │   ├── layout.tsx          # Root layout (Inter font, metadata)
│   │   ├── globals.css         # Global Tailwind directives & color tokens
│   │   ├── page.tsx            # Main Single-Page 5-Stage Stepper Workspace
│   │   ├── error.tsx           # Global fallback error page
│   │   ├── loading.tsx         # Workspace loading boundary
│   │   ├── not-found.tsx       # 404 page
│   │   ├── assessments/        # Multi-page assessment routes (Legacy/Parallel)
│   │   │   ├── page.tsx        # Assessments index table
│   │   │   ├── new/page.tsx    # New assessment form
│   │   │   └── queen-care-clinic/
│   │   │       ├── model/page.tsx      # Space model verification (2D/3D editor)
│   │   │       ├── analysis/page.tsx   # Risk analysis page
│   │   │       ├── options/page.tsx    # Layout options comparison page
│   │   │       │   └── compare/page.tsx
│   │   │       └── report/page.tsx     # Implementation report page
│   │   ├── reports/
│   │   │   └── queen-care-clinic/page.tsx # Standalone report view
│   │   └── reviews/
│   │       ├── page.tsx        # Reviews list
│   │       └── queen-care-clinic/page.tsx # Occupational Therapist review workspace
│   ├── components/
│   │   ├── analysis/           # Legacy risk analysis & hazard triage components
│   │   │   ├── hazard-detail.tsx
│   │   │   ├── risk-analysis.tsx
│   │   │   └── index.ts
│   │   ├── editor/             # Multi-page 2D/3D Konva & Three.js editor
│   │   │   ├── editor-controls.tsx
│   │   │   ├── editor-model.ts # Editor types, clinicPlan fixture
│   │   │   ├── editor-shell.tsx
│   │   │   ├── floorplan-2d.tsx # Konva-based 2D editor
│   │   │   ├── floorplan-3d.tsx # Three.js editor with CameraControls & Environment
│   │   │   ├── floorplan-drag.ts # Grid snapping & boundary clamping logic
│   │   │   └── index.ts
│   │   ├── options/            # Options comparison components
│   │   ├── report/             # Report layout and data models
│   │   ├── review/             # OT decision modal and review workspace
│   │   ├── shell/              # Navigation shells (AppShell, WorkspaceShell)
│   │   ├── spatial/            # Primary SPA 2D/3D rendering engines
│   │   │   ├── Floorplan2D.tsx # Primary custom SVG/DOM/Canvas interactive plan
│   │   │   └── Floorplan3D.tsx # Primary R3F 3D spatial visualizer
│   │   ├── ui/                 # Reusable primitive UI buttons, fields, overlays
│   │   └── workflow/           # 5-Stage Stepper workspace views
│   │       ├── TopAppBar.tsx
│   │       ├── Stage1Layout.tsx
│   │       ├── Stage2Profile.tsx
│   │       ├── Stage3Routes.tsx
│   │       ├── Stage4Analysis.tsx
│   │       ├── Stage5Improve.tsx
│   │       ├── AnalysisTransition.tsx
│   │       └── ReportModal.tsx
│   ├── lib/
│   │   ├── mock-data.ts        # Legacy normalized domain fixtures
│   │   ├── spatial-model.ts    # Primary 5-stage spatial geometry & metric definitions
│   │   └── types.ts            # Legacy domain interfaces (Assessment, Facility, RoomGeometry)
│   └── store/
│       ├── assessment-store.ts # Zustand store for /assessments multi-page route
│       └── safespace-store.ts  # Zustand store for primary 5-stage stepper SPA
└── tests/
    ├── domain.test.ts          # Checks mockData scenario risk and profile mapping
    ├── floorplan-drag.test.ts  # Checks 5cm grid snapping and clamping
    ├── risk-analysis.test.ts   # Checks reviewed count and hazard fixture invariants
    └── safespace-workflow.test.ts # Checks calculateLiveMetrics and Queen Care fixtures
```

---

## 3. Structural Routing & State Management Duplication

The audit reveals an important architectural fact: **the repository contains two distinct, parallel application architectures**:

### Architecture A: Primary Single-Page Stepper Workspace (`src/app/page.tsx`)
- **State Store**: `src/store/safespace-store.ts` (`useSafeSpaceStore`).
- **Data Domain**: `src/lib/spatial-model.ts`.
- **Renderers**: `src/components/spatial/Floorplan2D.tsx` (custom SVG/Canvas) and `src/components/spatial/Floorplan3D.tsx` (R3F).
- **Navigation**: Client-side state stepper (`layout` → `profile` → `routes` → `analysis` → `improve`).
- **Target Experience**: Demonstrates the smooth, cohesive 5-stage workflow with animated walker routes, live clearance meters, and before/after layout comparison.

### Architecture B: Multi-Page Routing Workspace (`src/app/assessments/*`, `src/app/reviews/*`)
- **State Store**: `src/store/assessment-store.ts` (`useAssessmentStore`).
- **Data Domain**: `src/lib/types.ts`, `src/lib/mock-data.ts`, `src/components/editor/editor-model.ts`.
- **Renderers**: `src/components/editor/floorplan-2d.tsx` (React-Konva) and `src/components/editor/floorplan-3d.tsx` (R3F CameraControls).
- **Navigation**: Next.js App Router URLs (`/assessments`, `/assessments/queen-care-clinic/model`, `/analysis`, `/options`, `/report`).
- **Target Experience**: Models a multi-facility dashboard with formal Occupational Therapist review queues and multi-page workflow steps.

### Impact of Architectural Divergence
- **Divergent Data Schemas**: Architecture A models 18 furniture items and 7 hazards (`hz-01` to `hz-07`). Architecture B models 15 furniture items and 4 hazards (`HZ-001` to `HZ-004`).
- **Code Maintenance Overhead**: Changes in 2D or 3D rendering are implemented twice in completely different component trees.
- **Cognitive Confusion**: A developer or tester landing on `/assessments` sees different risk scores, hazard IDs, and review buttons than a user on `/`.
- **Target Resolution**: Later stages must consolidate both into a single canonical domain model, persistent database, and unified rendering layer.

---

## 4. Persistence & Storage Audit
- **Database / API**: None. No relational database, document store, or REST/GraphQL backend is connected.
- **Client-Side Storage**: Neither `localStorage`, `sessionStorage`, nor `indexedDB` is utilised.
- **Runtime Lifecycle**: All state modifications exist purely in browser memory via Zustand.
- **Refresh Failure**: Refreshing any page immediately wipes all user edits, furniture repositioning, route waypoints, and review decisions, resetting state back to the hardcoded fixture constants.
- **False State Claims**:
  - `TopAppBar.tsx` line 50 displays `<span className="text-[11px] text-emerald-800 font-medium">All changes saved</span>`.
  - `status.tsx` line 7 renders a badge claiming `"Saved"`.
  Both claims are non-factual in the current codebase.

---

## 5. Verification Commands Baseline

All safe verification commands were executed directly against the repository at branch base `5ecb626396f15262e893bb01f7a12f73a870f3e1`.

| Command | Exit Code | Result | Duration | Error / Warning Summary | Pre-existing? |
| :--- | :---: | :--- | :---: | :--- | :---: |
| `npm run typecheck` (`tsc --noEmit`) | **0** | **PASS** | ~10s | None. Zero TypeScript compilation errors. | Yes |
| `npm run lint` (`eslint .`) | **0** | **PASS** | ~45s | None. Zero ESLint errors or warnings. | Yes |
| `npm test` (`tsx --test tests/**/*.test.ts`) | **0** | **PASS** (9/9 tests pass) | ~5.3s | None. Note: importing Konva inside `tests/risk-analysis.test.ts` incurs a ~5-second delay due to headless DOM checks in Node.js. | Yes |
| `npm run build` (`next build`) | **0** | **PASS** (13 static routes generated) | ~18s | Compiled successfully via Turbopack. Generates static exports into `out/`. | Yes |

### Detailed Test Execution Breakdown
```
TAP version 13
# Subtest: balanced sample improves risk with two furniture moves (tests/domain.test.ts)
ok 1 - balanced sample improves risk with two furniture moves
# Subtest: walker route and hazards reference existing profile (tests/domain.test.ts)
ok 2 - walker route and hazards reference existing profile
# Subtest: snaps furniture top-left position to 5 cm grid (tests/floorplan-drag.test.ts)
ok 3 - snaps furniture top-left position to 5 cm grid
# Subtest: keeps the full furniture footprint inside plan bounds (tests/floorplan-drag.test.ts)
ok 4 - keeps the full furniture footprint inside plan bounds
# Subtest: review progress counts only recorded professional decisions (tests/risk-analysis.test.ts)
ok 5 - review progress counts only recorded professional decisions
# Subtest: Queen Care Clinic route findings use canonical measurements (tests/risk-analysis.test.ts)
ok 6 - Queen Care Clinic route findings use canonical measurements
# Subtest: initial Queen Care Clinic condition evaluates to high risk 68 with 54cm clearance (tests/safespace-workflow.test.ts)
ok 7 - initial Queen Care Clinic condition evaluates to high risk 68 with 54cm clearance
# Subtest: balanced layout reduces risk to 27 and achieves 96cm minimum clearance (tests/safespace-workflow.test.ts)
ok 8 - balanced layout reduces risk to 27 and achieves 96cm minimum clearance
# Subtest: dynamic constraint warning fires when chair C-04 is placed dangerously close to route (tests/safespace-workflow.test.ts)
ok 9 - dynamic constraint warning fires when chair C-04 is placed dangerously close to route
1..9
# tests 9 | suites 0 | pass 9 | fail 0 | duration_ms 5263
```

---

## 6. External Integrations & Configuration

- **Environment Variables**:
  - File: `.env.local` contains dummy or local development placeholders.
  - No active runtime secrets are required or invoked by client code.
- **External Services**:
  - Zero external APIs are called during application runtime.
  - Zero AI client libraries (`@google/genai`, `openai`, `anthropic`) are installed in `package.json`.
- **Deployment Pipeline**:
  - `.github/workflows/deploy.yml` triggers on push to `main`.
  - Runs `npm ci` and `npm run build` on `ubuntu-latest` with `GITHUB_ACTIONS: "true"`.
  - Publishes static bundle from `./out` to GitHub Pages at base path `/safespace`.
