# Stage Implementation Plan & Gated Roadmap

## Overview & Execution Policy

This implementation plan defines the gated roadmap for SafeSpace from Stage 1 through Stage 9.
**Execution Rule**: Each stage must satisfy its exact acceptance criteria, pass all automated test suites, and produce verifiable review evidence before the subsequent stage may commence. **Do not begin Stage 1 until Stage 0 is reviewed and approved.**

---

## Stage 1: Canonical Domain Model & Data Persistence

- **Goal**: Establish a single canonical TypeScript spatial domain model validated with Zod, consolidate duplicate state stores, and implement durable client-side IndexedDB persistence to eliminate refresh data loss.
- **In Scope**:
  - Unified TypeScript domain types (`CanonicalRoom`, `CanonicalOpening`, `CanonicalObject`, `CanonicalMobilityProfile`, `CanonicalRoute`, `CanonicalHazard`).
  - Runtime validation schemas using Zod.
  - Client-side persistence engine via IndexedDB (offline-first).
  - Deprecation of parallel `assessment-store.ts` in favor of a consolidated `useSpatialStore`.
  - Automatic migration for Queen Care Clinic initial fixture.
- **Out of Scope**:
  - Cloud backend / PostgreSQL authentication (deferred to Stage 8).
  - Computer vision floorplan ingestion (deferred to Stage 2).
  - Automatic layout solving (deferred to Stage 5).
- **Dependencies**: Stage 0 audit approval.
- **Major Implementation Tasks**:
  1. Author `src/lib/domain/` containing canonical entity definitions and Zod schemas.
  2. Implement `src/lib/storage/indexed-db.ts` with auto-save debounce (300ms) and versioned schema migrations.
  3. Refactor `useSafeSpaceStore` to bind to IndexedDB on mount and sync state updates.
  4. Replace false "All changes saved" header badge with real save lifecycle indicators ("Unsaved changes...", "Saving...", "Saved to local storage").
- **Required Tests**:
  - Unit tests verifying Zod serialization/deserialization of full facility models.
  - Persistence test: modify furniture position -> simulate browser reload -> verify state restored exactly.
  - Fixture backward-compatibility test for Queen Care Clinic demo plan.
- **Acceptance Criteria**:
  - Refreshing the browser preserves 100% of user-modified room geometry, furniture positions, and active stage without resetting.
  - Zero TypeScript or lint errors.
  - Legacy `src/lib/types.ts` and `src/lib/mock-data.ts` merged into canonical schema.
- **Risks**: State migration edge cases when schema versions evolve.
- **Suggested Branch Name**: `stage-1-domain-model-persistence`
- **Expected Review Evidence**: Automated test suite passing; screen recording demonstrating state persistence across hard browser reloads.

---

## Stage 2: Real Floorplan Intake & Calibrated 2D Editor

- **Goal**: Enable real floorplan intake (image/PDF upload and manual drawing), scale calibration, and interactive 2D editing with human confirmation gates.
- **In Scope**:
  - File uploader accepting PNG, JPEG, SVG, and PDF.
  - Scale calibration tool (user draws a line between two points and inputs real-world dimension in meters/cm).
  - Interactive 2D editor for drawing/editing room polygons, placing doors, and arranging furniture.
  - Human verification checklist for newly added or imported objects.
  - Dynamic grid snapping, coordinate readout, and pan/zoom boundaries.
- **Out of Scope**:
  - Automatic AI vision extraction (AI parsing is introduced as an optional accelerator in Stage 2/7, but manual calibrated intake must work deterministically first).
  - 3D rendering updates (deferred to Stage 6).
- **Dependencies**: Stage 1 (Canonical Domain Model & Persistence).
- **Major Implementation Tasks**:
  1. Implement `FloorplanUploader.tsx` with local image rendering and canvas overlay.
  2. Implement `CalibrationRuler.tsx` computing pixels-per-centimeter ratio.
  3. Build polygon editor for arbitrary room boundaries (supporting non-rectangular rooms).
  4. Consolidate 2D canvas into a single unified high-performance component.
- **Required Tests**:
  - Scale calibration unit tests (pixel-to-cm transformation math).
  - Polygon boundary containment and vertex editing tests.
  - Grid snap and boundary clamp assertion suite.
- **Acceptance Criteria**:
  - A user can upload an arbitrary floorplan image, calibrate a known doorway to 90 cm, draw an L-shaped room, place furniture, and save.
- **Risks**: High-resolution image canvas memory consumption on lower-end devices.
- **Suggested Branch Name**: `stage-2-floorplan-intake-2d-editor`
- **Expected Review Evidence**: Interactive intake demo uploading and calibrating a blank test floorplan.

---

## Stage 3: Mobility Profile, Critical Routes & Geometry Engine

- **Goal**: Implement dynamic mobility profile parameters, critical route formulation, Minkowski corridor dilation, and obstacle-avoidance pathfinding.
- **In Scope**:
  - Mobility profile editor (wheelchair, walker, cane, unassisted) configuring clear width, turning diameter, and sensory limits.
  - Critical route polyline authoring between custom functional points.
  - Deterministic geometry engine:
    - Minkowski sum route dilation computing exact clearance corridors.
    - Polygon-line intersection algorithms detecting furniture encroachments.
    - Door swing arc calculation.
  - Dynamic A* pathfinding around obstacle bounding boxes.
- **Out of Scope**:
  - Formal clinical risk scoring (deferred to Stage 4).
  - Layout alternative generation (deferred to Stage 5).
- **Dependencies**: Stage 2 (Calibrated 2D Floorplan & Objects).
- **Major Implementation Tasks**:
  1. Author `src/lib/geometry/minkowski.ts` and `src/lib/geometry/intersections.ts`.
  2. Implement A* grid pathfinding on the 2D spatial model.
  3. Implement real route length calculation (replacing hardcoded ternary returns).
  4. Update walker animation to follow dynamic path curves and respect `prefers-reduced-motion`.
- **Required Tests**:
  - Geometric intersection test suite with known polygon test fixtures.
  - Pathfinding test verifying route automatically routes around newly placed obstacles.
  - Corridor clearance math verification against manual benchmarks.
- **Acceptance Criteria**:
  - Moving any furniture piece across the walking path immediately triggers dynamic route deviation or visual obstruction highlight.
  - Route length and narrowest clearance update in real time with geometric precision.
- **Risks**: Pathfinding performance bottlenecks on large floorplans with fine grids.
- **Suggested Branch Name**: `stage-3-routes-geometry-engine`
- **Expected Review Evidence**: Mathematical test report comparing calculated clearances against CAD ground truth.

---

## Stage 4: Evidence-Backed Fall Risk Engine

- **Goal**: Replace hardcoded risk numbers (68, 41, 27) with an empirical, multi-factor fall risk scoring engine mapped to official building and clinical standards.
- **In Scope**:
  - Standard rule registry (`RuleRegistry.ts`) referencing HK BFD 2008, ADA 2010, CIBSE LG2, and CDC STEADI.
  - Continuous Environmental Fall Risk Index calculation ($0\dots100$).
  - Dynamic hazard generation: identifies pinch points, sharp corners, lighting deficits, unsupported spans, and trip thresholds from real geometry.
  - Hazard queue sorting, severity grading (Critical, High, Medium, Low), and measured evidence formatting.
- **Out of Scope**:
  - Layout alternative optimization (deferred to Stage 5).
  - Sensor hardware procurement or procurement pricing (deferred to Stage 7).
- **Dependencies**: Stage 3 (Geometry Engine & Dynamic Clearances).
- **Major Implementation Tasks**:
  1. Author rule evaluation modules for clearance, corner proximity, lighting, thresholds, and support gaps.
  2. Implement multi-factor weighted risk formula: $\text{Risk} = \min(100, \sum w_i \cdot P_i)$.
  3. Replace `INITIAL_HAZARDS` and `calculateLiveMetrics` in `spatial-model.ts`.
  4. Connect Stage 4 hazard list directly to live evaluation output.
- **Required Tests**:
  - Deterministic evaluation test suite verifying that placing a barrier produces the exact expected hazard code and severity.
  - Sensitivity analysis tests ensuring risk index scales smoothly without discrete jumps.
- **Acceptance Criteria**:
  - Placing, removing, or resizing any object immediately generates or resolves the corresponding hazard in the live UI with verifiable evidence citations.
- **Risks**: Weight tuning controversy between clinical guidelines.
- **Suggested Branch Name**: `stage-4-evidence-risk-engine`
- **Expected Review Evidence**: Traceability matrix proving every displayed hazard originates from an evaluated rule.

---

## Stage 5: Algorithmic Layout Optimisation (Improve)

- **Goal**: Replace hardcoded layout presets with a constraint-based heuristic optimizer that calculates Minimum Cost, Balanced, and Maximum Safety alternatives.
- **In Scope**:
  - Constraint solver evaluating candidate furniture translations and rotations within room boundaries.
  - Generation of three distinct alternatives:
    - **Minimum Cost**: Zero-hardware operational moves only.
    - **Balanced**: 1–2 high-leverage moves + minimal targeted safety hardware.
    - **Maximum Safety**: Comprehensive barrier-free layout reconfiguration + full retrofit.
  - Real material takeoff and cost estimation (HKD) based on transparent unit-rate tables.
  - Interactive Before/After comparison in 2D (side-by-side and split slider).
- **Out of Scope**:
  - 3D rendering updates (deferred to Stage 6).
  - LLM text summaries (deferred to Stage 7).
- **Dependencies**: Stage 4 (Evidence-Backed Risk Engine).
- **Major Implementation Tasks**:
  1. Implement heuristic layout generator (`src/lib/optimizer/layout-solver.ts`).
  2. Implement material pricing catalog (`src/lib/pricing/unit-rates.ts`).
  3. Connect Stage 5 alternative selection buttons to the computed alternative sets.
  4. Enable manual fine-tuning of proposed furniture with real-time constraint warnings.
- **Required Tests**:
  - Solver convergence tests ensuring generated layouts never place furniture outside walls or into door swings.
  - Cost computation tests verifying bill of materials matches published unit rates.
- **Acceptance Criteria**:
  - On an arbitrary room layout, the optimizer successfully generates three valid, collision-free alternatives that demonstrably reduce the risk score.
- **Risks**: Heuristic solver getting trapped in local minima on dense floorplans.
- **Suggested Branch Name**: `stage-5-layout-optimization`
- **Expected Review Evidence**: Benchmark report demonstrating risk index reduction across 5 distinct test floorplans.

---

## Stage 6: Production-Quality 3D Digital Twin Synchronised with 2D

- **Goal**: Fix the 3D rendering crash, harden Three.js / R3F against context loss and font issues, and synchronize the 3D digital twin to the canonical scene model.
- **In Scope**:
  - Implement `Spatial3DErrorBoundary` with graceful 2D fallback.
  - Resolve Three.js r186 deprecations (`Clock` -> `Timer`, explicit shadow map configuration).
  - Replace remote Drei `<Text>` font downloads with local 2D canvas billboard sprites.
  - Refactor Stage 5 comparison views to use a single shared WebGL canvas with viewports/scissor test.
  - Implement procedural 3D meshes for all missing categories (handrails, grab bars, downlights, non-standard furniture).
  - Synchronize 2D and 3D camera and selection states.
- **Out of Scope**:
  - Photorealistic offline raytracing or VR headsets.
- **Dependencies**: Stage 1 (Canonical Model) and Stage 5 (Layout Alternatives).
- **Major Implementation Tasks**:
  1. Refactor `Floorplan3D.tsx` to consume canonical scene graph entities.
  2. Implement `Spatial3DErrorBoundary.tsx` wrapping all Canvas mounts.
  3. Replace Drei font loader with local sprite canvas texture for hazard markers.
  4. Build single-canvas split renderer for Stage 5 before/after comparison.
- **Required Tests**:
  - 3D mount/unmount endurance test (50 consecutive toggles without memory leak or context loss).
  - Offline network test verifying 3D loads without internet access.
- **Acceptance Criteria**:
  - Switching between 2D Plan and 3D Iso in Stage 4 and Stage 5 never throws console errors or crashes the workspace.
  - 3D accurately renders all room shapes, walls, doors, handrails, and furniture models.
- **Risks**: Low-end GPU driver incompatibilities.
- **Suggested Branch Name**: `stage-6-synchronised-3d-twin`
- **Expected Review Evidence**: Screen recording of 100 consecutive 2D/3D toggles under simulated 3G and offline network conditions without errors.

---

## Stage 7: AI Assistance, Professional Report & Sensor Recommendations

- **Goal**: Integrate role-bounded LLM assistance for plain-language explanations, clinical report generation, and environmental sensor recommendations, backed by verifiable human review.
- **In Scope**:
  - Multimodal Vision API integration for optional initial floorplan drafting (with mandatory human confirmation).
  - LLM report authoring: drafts clinical executive summary, OT rationales, and contractor scopes using calculated metrics only.
  - Environmental sensor recommendation engine (radar fall detectors, night-path motion beacons, door contact sensors) placed at high-risk coordinates.
  - Printable and exportable audit report (PDF / HTML) with explicit provenance disclaimers and human signature capture.
- **Out of Scope**:
  - Allowing AI to calculate dimensions, distances, or risk scores.
  - Commercial billing or paid subscription gates.
- **Dependencies**: Stage 4 (Risk Engine) and Stage 5 (Layout Optimizer).
- **Major Implementation Tasks**:
  1. Implement AI server actions invoking Gemini API with strict structured JSON output schemas.
  2. Implement sensor placement heuristics targeting unmonitored high-risk zones.
  3. Build PDF generation pipeline (`@react-pdf/renderer` or server-side headless Chromium print).
  4. Connect OT review sign-off modal with digital signature and license verification fields.
- **Required Tests**:
  - Prompt injection and hallucination test: verify LLM never fabricates measurements differing from the spatial store.
  - PDF generation snapshot test.
- **Acceptance Criteria**:
  - An OT can review findings, add clinical notes, sign off with their registration number, and download an audit-grade PDF report.
- **Risks**: AI API latency and rate limits.
- **Suggested Branch Name**: `stage-7-ai-report-sensor-engine`
- **Expected Review Evidence**: Exported sample clinical report demonstrating exact metric alignment with calculated spatial facts.

---

## Stage 8: Resident Tier & Multi-Tenant Organization Accounts

- **Goal**: Implement user authentication, role separation (Resident vs. Professional/Organization), multi-facility management, and cloud database persistence.
- **In Scope**:
  - Authentication (Email, Magic Link, OAuth) via Supabase Auth.
  - Multi-tenant data model with PostgreSQL and Row Level Security (RLS).
  - Facility workspace management: create, rename, archive, and share assessment projects.
  - Role-based access control (Caregiver, Occupational Therapist, Clinic Admin, Contractor).
  - Free resident tier vs. professional organization workspace separation.
- **Out of Scope**:
  - Commercial payment gateways (Stripe) and subscription billing (deferred to post-pilot).
- **Dependencies**: Stage 1 through Stage 7.
- **Major Implementation Tasks**:
  1. Author Supabase database schema and RLS policies.
  2. Implement Next.js auth middleware and protected routes.
  3. Create organization dashboard for multi-bed or multi-room facilities.
- **Required Tests**:
  - RLS security audit verifying Tenant A cannot access Tenant B's assessments.
  - Auth session lifecycle tests.
- **Acceptance Criteria**:
  - Multiple registered users can log in, manage distinct facility assessments, and collaborate on layout reviews securely.
- **Risks**: Database synchronization conflicts during simultaneous online editing.
- **Suggested Branch Name**: `stage-8-accounts-organizations`
- **Expected Review Evidence**: Automated security penetration test verifying zero unauthorized data exposure between tenants.

---

## Stage 9: Hardening, Accessibility, Privacy & Demo Readiness

- **Goal**: Harden the complete application for public release, achieve WCAG 2.1 AA accessibility compliance, ensure patient data privacy, optimize performance, and achieve production demo readiness.
- **In Scope**:
  - Full keyboard accessibility (focus traps, roving tab indexes, canvas keyboard controls).
  - Screen reader semantic descriptions for 2D/3D spatial hazards.
  - High-contrast clinical typography and WCAG AA color validation.
  - Privacy compliance: anonymization of residential addresses, local-only processing toggles.
  - Bundle optimization: code-splitting Three.js and Konva to achieve `< 200KB` initial JS load.
  - Comprehensive end-to-end testing with Playwright.
- **Out of Scope**:
  - New functional features or architectural redesigns.
- **Dependencies**: Stages 1 through 8.
- **Major Implementation Tasks**:
  1. Run Lighthouse accessibility audits and resolve all contrast/aria issues.
  2. Implement keyboard navigation for spatial canvas selection and waypoint inspection.
  3. Author full end-to-end Playwright test suite covering the entire 6-stage journey.
  4. Finalize demo presets and self-guided onboarding tour.
- **Required Tests**:
  - Playwright E2E test running the full flow from upload to report export.
  - Lighthouse Accessibility score $\ge 98$.
- **Acceptance Criteria**:
  - Zero critical security, accessibility, or rendering defects; clean production build; ready for clinical trials and public launch.
- **Suggested Branch Name**: `stage-9-hardening-demo-readiness`
- **Expected Review Evidence**: Full Playwright test run recording and Lighthouse audit report.
