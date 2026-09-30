# Stage Implementation Plan & Gated Roadmap

## Overview & Execution Policy

This implementation plan defines the gated roadmap for SafeSpace from Stage 1 through Stage 9.
**Execution Rule**: Each stage must satisfy its exact acceptance criteria, pass all automated test suites, and produce verifiable review evidence before the subsequent stage may commence. **Do not begin Stage 1 until Stage 0 is reviewed and approved.**

---

## Stage 1: Canonical Domain Model & Data Persistence

- **Goal**: Establish a single canonical TypeScript spatial domain model validated with Zod, consolidate duplicate state stores, implement durable client-side IndexedDB persistence to eliminate refresh data loss, and introduce minimal defensive runtime-stability protection for 3D views.
- **In Scope**:
  - Unified TypeScript domain types (`CanonicalRoom`, `CanonicalOpening`, `CanonicalObject`, `CanonicalMobilityProfile`, `CanonicalRoute`, `CanonicalHazard`).
  - Runtime validation schemas using Zod.
  - Client-side persistence engine via IndexedDB (offline-first).
  - Deprecation of parallel `assessment-store.ts` in favor of a consolidated `useSpatialStore`.
  - Automatic migration for Queen Care Clinic initial fixture.
  - Minimal defensive 3D runtime-stability isolation: wrap 3D canvas mount points in defensive isolation with automatic fallback to 2D Plan view so that 3D failures do not trigger the global "Workspace could not load" error boundary or block core user flows.
- **Out of Scope**:
  - Cloud backend / PostgreSQL authentication (deferred to Stage 8).
  - Computer vision floorplan ingestion (deferred to Stage 7; Stage 2 is 100% manual).
  - Automatic layout solving (deferred to Stage 5).
  - Full 3D digital twin overhaul, asset expansion, or shadow-map refactoring (deferred to Stage 6).
- **Dependencies**: Stage 0 audit approval.
- **Major Implementation Tasks**:
  1. Author `src/lib/domain/` containing canonical entity definitions and Zod schemas.
  2. Implement `src/lib/storage/indexed-db.ts` with auto-save debounce (300ms) and versioned schema migrations.
  3. Refactor `useSafeSpaceStore` to bind to IndexedDB on mount and sync state updates.
  4. Replace false "All changes saved" header badge with real save lifecycle indicators ("Unsaved changes...", "Saving...", "Saved to local storage").
  5. Add defensive error boundary / safe fallback toggle around 3D canvas component to protect the main workspace from catastrophic crashes while root cause investigation continues in Stage 6.
- **Required Tests**:
  - Unit tests verifying Zod serialization/deserialization of full facility models.
  - Persistence test: modify furniture position -> simulate browser reload -> verify state restored exactly.
  - Fixture backward-compatibility test for Queen Care Clinic demo plan.
  - Defensive fallback test: verify that a 3D mount failure falls back to 2D Plan without crashing the global workspace.
- **Acceptance Criteria**:
  - Refreshing the browser preserves 100% of user-modified room geometry, furniture positions, and active stage without resetting.
  - Zero TypeScript or lint errors.
  - Legacy `src/lib/types.ts` and `src/lib/mock-data.ts` merged into canonical schema.
  - 3D view toggle failure cannot take down the global application shell.
- **Risks**: State migration edge cases when schema versions evolve.
- **Suggested Branch Name**: `stage-1-domain-model-persistence`
- **Expected Review Evidence**: Automated test suite passing; screen recording demonstrating state persistence across hard browser reloads and graceful 3D fallback.

---

## Stage 2: Real Floorplan Intake & Calibrated 2D Editor

- **Goal**: Enable real floorplan intake (image/PDF upload and manual drawing), scale calibration, and interactive 2D editing with human confirmation gates.
- **In Scope**:
  - File uploader accepting PNG, JPEG, SVG, and PDF.
  - Scale calibration tool (user draws a reference line between two known points and inputs real-world dimension in meters/cm).
  - Interactive 2D editor for drawing/editing room polygons, placing doors/windows, and arranging furniture.
  - Human verification checklist for newly added or imported objects.
  - Dynamic grid snapping, coordinate readout, and pan/zoom boundaries.
- **Out of Scope**:
  - AI vision extraction or automated floorplan interpretation (Stage 2 operates 100% manually without any AI dependencies: upload, calibration, polygon drawing, and item placement are entirely deterministic user actions).
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
  - A user can upload an arbitrary floorplan image, calibrate a doorway using its user-entered ground-truth measurement (e.g. 90 cm on test fixture), draw an L-shaped room, place furniture, and save without AI involvement.
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

## Stage 4: Evidence-Backed Environmental Hazard Rule Engine

- **Goal**: Replace hardcoded risk numbers (68, 41, 27) with a deterministic compliance and hazard engine whose primary output is transparent individual rule violations, exact physical measurements, provenance, and severity. An optional, experimental Environmental Hazard Score (EHS) is a reserved, disabled experimental concept, strictly separated from clinical patient screening (CDC STEADI).
- **In Scope**:
  - Standard rule registry (`RuleRegistry.ts`) referencing HK BFA 2008 (statutory provisions) and CIBSE LG02 (lighting guidance; CIBSE LG02 recommendations remain inactive until their exact clauses and thresholds are verified from the licensed primary CIBSE document and confirmed applicable to the relevant environment).
  - Explicit separation between spatial environmental hazard identification and clinical patient fall screening (CDC STEADI). CDC STEADI does not validate spatial formulas.
  - Primary engine output: transparent individual rule violations, measured dimensions, provenance, and severity grading.
  - Dynamic hazard generation: identifies pinch points, sharp corners, lighting deficits, unsupported spans, and trip thresholds from real geometry.
  - Clear flagging of unvalidated thresholds as "TBD — requires OT/building-code validation".
  - Composite Environmental Hazard Score (EHS) remains a reserved, disabled experimental concept: completely disabled, not calculated, not displayed, and not used in analysis, optimization, ranking, reports, or UI until separately validated and approved by relevant occupational therapy and architectural consensus; never described as validated by BFA, CIBSE, or CDC STEADI.
- **Out of Scope**:
  - Implementing unverified CIBSE lighting rules (200/300/500 lux) before full licensed document verification.
  - Calculating, displaying, or utilizing any composite risk score or index.
  - Layout alternative optimization (deferred to Stage 5).
  - Sensor hardware procurement or procurement pricing (deferred to Stage 7).
- **Dependencies**: Stage 3 (Geometry Engine & Dynamic Clearances).
- **Major Implementation Tasks**:
  1. Author rule evaluation modules for corridor clearance, door width, corner proximity, thresholds, and support gaps, focusing strictly on individual rule evaluations, exact measurements, required versus measured values, provenance, severity, professional review status (`pending`, `verified`, `waived`), and resolution status (`open`, `mitigated`, `resolved`).
  2. Document EHS as a deferred product hypothesis only. Do not create a runtime interface, formula, calculation path, stored field, API field, or UI component for EHS during Stage 4.
  3. Replace `INITIAL_HAZARDS` and `calculateLiveMetrics` in `spatial-model.ts` with dynamic individual rule evaluation output.
  4. Connect Stage 4 hazard list directly to live individual rule evaluation output.
- **Required Tests**:
  - Deterministic evaluation test suite verifying that placing a barrier produces the exact expected hazard code, required vs. measured value, provenance, and severity.
  - Individual rule violation assertion suite checking measured vs. required physical dimensions.
- **Acceptance Criteria**:
  - Placing, removing, or resizing any object immediately generates or resolves the corresponding individual hazard in the live UI with verifiable evidence citations, exact physical measurements, required versus measured values, provenance, severity, professional review status, and resolution status.
  - Stage 4 passes cleanly without calculating or displaying any composite risk score.
- **Risks**: Premature reintroduction of an unvalidated composite score or arbitrary severity weights.
- **Suggested Branch Name**: `stage-4-evidence-hazard-engine`
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
  - Real material takeoff and cost estimation (HKD) based on transparent unit-rate tables. Every unit rate must include source, jurisdiction, currency, effective date, and last verified date. Do not present invented or unsourced prices as real estimates.
  - Interactive Before/After comparison in 2D (side-by-side and split slider).
- **Out of Scope**:
  - 3D rendering updates (deferred to Stage 6).
  - LLM text summaries (deferred to Stage 7).
- **Dependencies**: Stage 4 (Evidence-Backed Environmental Hazard Rule Engine).
- **Major Implementation Tasks**:
  1. Implement heuristic layout generator (`src/lib/optimizer/layout-solver.ts`).
  2. Implement material pricing catalog (`src/lib/pricing/unit-rates.ts`) requiring source, jurisdiction, currency, effective date, and last verified date for every item.
  3. Connect Stage 5 alternative selection buttons to the computed alternative sets.
  4. Enable manual fine-tuning of proposed furniture with real-time constraint warnings.
- **Required Tests**:
  - Solver convergence tests ensuring generated layouts never place furniture outside walls or into door swings.
  - Cost computation tests verifying bill of materials matches published unit rates with complete date, jurisdiction, and source provenance.
- **Acceptance Criteria**:
  - On an arbitrary room layout, the optimizer successfully generates three valid alternatives, where every alternative:
    - reduces the number, severity, or measured magnitude of verified individual violations;
    - provides exact before/after measurements for every affected rule;
    - introduces no new critical or high-severity violation;
    - remains collision-free;
    - remains inside room boundaries;
    - respects protected routes and door constraints.
- **Risks**: Heuristic solver getting trapped in local minima on dense floorplans.
- **Suggested Branch Name**: `stage-5-layout-optimization`
- **Expected Review Evidence**: A benchmark report showing per-rule before/after measurements, resolved and remaining violations, newly introduced violations, move count, and verified cost estimate across at least five distinct test floorplans.

---

## Stage 6: Production-Quality 3D Digital Twin Synchronised with 2D

- **Goal**: Complete root cause isolation and resolution for the 3D rendering crash, harden Three.js / R3F against context loss and font issues, and synchronize the 3D digital twin to the canonical scene model.
- **In Scope**:
  - Comprehensive 3D root cause investigation and fix across GPU configurations.
  - Implement full `Spatial3DErrorBoundary` with graceful 2D fallback.
  - Resolve Three.js r186 deprecations (`Clock` -> `Timer`, explicit shadow map configuration).
  - Replace remote Drei `<Text>` font downloads with local 2D canvas billboard sprites.
  - Refactor Stage 5 comparison views to use a single shared WebGL canvas with viewports/scissor test.
  - Implement procedural 3D meshes for all missing categories (handrails, grab bars, downlights, non-standard furniture).
  - Synchronize 2D and 3D camera and selection states.
- **Out of Scope**:
  - Photorealistic offline raytracing or VR headsets.
- **Dependencies**: Stage 1 (Canonical Model & 3D isolation) and Stage 5 (Layout Alternatives).
- **Major Implementation Tasks**:
  1. Isolate and eliminate the WebGL crash trigger observed in deployed environments.
  2. Refactor `Floorplan3D.tsx` to consume canonical scene graph entities.
  3. Implement `Spatial3DErrorBoundary.tsx` wrapping all Canvas mounts.
  4. Replace Drei font loader with local sprite canvas texture for hazard markers.
  5. Build single-canvas split renderer for Stage 5 before/after comparison.
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

- **Goal**: Integrate role-bounded LLM assistance for plain-language explanations, clinical report generation, and environmental sensor recommendations, backed by verifiable human review, with optional AI floorplan drafting.
- **In Scope**:
  - Optional AI floorplan drafting accelerator:
    - Vision model processes uploaded floorplan image to suggest candidate room boundaries and furniture bounding boxes.
    - Draft geometry only; outputs explicit confidence scores and provenance metadata for each detected entity.
    - Mandatory human interactive confirmation and correction in the 2D editor before any geometry enters the spatial model.
    - AI never determines scale, dimensions, obstacle clearances, or safety scores independently.
  - LLM report authoring: drafts clinical executive summary, OT rationales, and contractor scopes using calculated metrics only.
  - Environmental sensor recommendation engine (radar fall detectors, night-path motion beacons, door contact sensors) placed at high-risk coordinates.
  - Printable and exportable audit report (PDF / HTML) with explicit provenance disclaimers and human signature capture.
  - API architecture: lightweight serverless function (Option A for static GitHub Pages) or Next.js server actions (Option B for full-stack host).
- **Out of Scope**:
  - Allowing AI to calculate dimensions, distances, or risk scores independently.
  - Commercial billing or paid subscription gates.
- **Dependencies**: Stage 4 (Environmental Hazard Rule Engine) and Stage 5 (Layout Optimizer).
- **Major Implementation Tasks**:
  1. Implement an AIExtractionProvider adapter and configure one approved multimodal provider through the external serverless backend. (Candidate providers such as Google Gemini, OpenAI, or Anthropic Claude may be considered; no provider has been selected by the team yet).
  2. Implement draft geometry preview and human confirmation workflow in 2D editor.
  3. Implement sensor placement heuristics targeting unmonitored high-risk zones.
  4. Build PDF generation pipeline (`@react-pdf/renderer` or server-side headless Chromium print).
  5. Connect OT review sign-off modal with digital signature and license verification fields.
- **Required Tests**:
  - Prompt injection and hallucination test: verify LLM never fabricates measurements differing from the spatial store.
  - AI floorplan drafting test: verify geometry requires human acceptance before persisting.
  - PDF generation snapshot test.
- **Acceptance Criteria**:
  - An OT can review findings, add clinical notes, sign off with their registration number, and download an audit-grade PDF report.
  - AI-generated floorplan drafts can be rejected, accepted, or corrected by the user.
- **Risks**: AI API latency and rate limits.
- **Suggested Branch Name**: `stage-7-ai-report-sensor-engine`
- **Expected Review Evidence**: Exported sample clinical report demonstrating exact metric alignment with calculated spatial facts.

---

## Stage 8: Resident Tier & Multi-Tenant Organization Accounts

- **Goal**: Implement user authentication, role separation (Resident vs. Professional/Organization), multi-facility management, and cloud database persistence.
- **In Scope**:
  - Authentication (Email, Magic Link, OAuth) via Supabase Auth or equivalent.
  - Multi-tenant data model with PostgreSQL and Row Level Security (RLS).
  - Facility workspace management: create, rename, archive, and share assessment projects.
  - Role-based access control (Caregiver, Occupational Therapist, Clinic Admin, Contractor).
  - Free resident tier vs. professional organization workspace separation.
- **Out of Scope**:
  - Commercial payment gateways (Stripe) and subscription billing (deferred to post-pilot).
- **Dependencies**: Stage 1 through Stage 7.
- **Major Implementation Tasks**:
  1. Author database schema and RLS policies.
  2. Implement auth middleware and protected routes.
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

## Stage 9: Hardening, Accessibility, Privacy & Staged Release Readiness

- **Goal**: Harden the complete application, achieve WCAG 2.1 AA accessibility compliance, ensure patient data privacy, optimize performance, and satisfy formal staged release criteria across four distinct operational gates.
- **In Scope**:
  - Full keyboard accessibility (focus traps, roving tab indexes, canvas keyboard controls).
  - Screen reader semantic descriptions for 2D/3D spatial hazards.
  - High-contrast clinical typography and WCAG AA color validation.
  - Privacy compliance: anonymization of residential addresses, local-only processing toggles.
  - Bundle optimization: code-splitting Three.js and Konva to achieve `< 200KB` initial JS load.
  - Comprehensive end-to-end testing with Playwright.
  - Staged readiness gate validation and documentation.
- **Out of Scope**:
  - New functional features or architectural redesigns.
- **Dependencies**: Stages 1 through 8.
- **Major Implementation Tasks**:
  1. Run Lighthouse accessibility audits and resolve all contrast/aria issues.
  2. Implement keyboard navigation for spatial canvas selection and waypoint inspection.
  3. Author full end-to-end Playwright test suite covering the entire 6-stage journey.
  4. Finalize demo presets and self-guided onboarding tour.
  5. Audit and document compliance against the 4 operational readiness gates.
- **Required Tests**:
  - Playwright E2E test running the full flow from upload to report export.
  - Lighthouse Accessibility score $\ge 98$.

### Staged Operational Readiness Gates

SafeSpace replaces generic "ready for clinical trials and public launch" claims with four strictly separated operational readiness tiers:

```
[ Gate 1: Hackathon Demo ] ──> [ Gate 2: Controlled Pilot ] ──> [ Gate 3: Public Release ] ──> [ Gate 4: Regulatory & Clinical Assessment ]
  - Simulated fixtures           - Real client floorplans       - General public               - Intended-use assessment
  - Synthetic data disclaimer    - Human OT in the loop         - Multi-tenant accounts        - Conditional SaMD / ethics review
  - Zero fatal unhandled crash   - Statutory code alignment     - WCAG 2.1 AA & PII scrubbed   - Decision support vs medical device
```

#### Gate 1: Hackathon Demo Readiness
- **Intended Use**: Live conference and hackathon demonstration only.
- **Requirements**:
  - Zero fatal unhandled runtime exceptions or white-screen errors across the 6-stage demo flow.
  - Prominent UI disclaimer: "Demonstration prototype with synthetic data. Not for clinical or diagnostic use."
  - Deterministic calculations verified against baseline test fixtures.
- **Restrictions**: Cannot be used with real patient floorplans or unmanaged users.

#### Gate 2: Controlled Clinical Pilot Readiness
- **Intended Use**: Supervised pilot deployments in partnering clinics, NGOs, or care homes.
- **Requirements**:
  - 100% of spatial assessments must be reviewed and confirmed by a certified Occupational Therapist.
  - Real floorplan intake and calibrated measurements verified against physical ground truth (measurement accuracy must meet a documented acceptance tolerance established through calibration testing and professional review).
  - Statutory alignment with primary local building standards (HK BFA 2008 for HK facilities).
  - Informed participant consent and facility data-sharing agreement executed.
- **Restrictions**: Limited to controlled pilot cohorts under direct clinician oversight.

#### Gate 3: Public Release Readiness
- **Intended Use**: Open web deployment for residents, caregivers, and independent organizations.
- **Requirements**:
  - Multi-tenant data isolation with cryptographically verified Row Level Security (RLS).
  - Automated PII stripping (removing resident names, unit numbers, floor levels from cloud transmission).
  - WCAG 2.1 AA accessibility compliance across all interactive canvases and forms.
  - Comprehensive legal terms of service, privacy policy, and liability disclaimers stating the system provides spatial decision support, not medical diagnosis.
- **Restrictions**: Cannot claim certified medical device or clinical diagnostic efficacy.

#### Gate 4: Intended-Use & Regulatory-Classification Assessment
- **Intended Use**: Determine formal regulatory status and clinical evidence requirements based on product positioning.
- **Requirements**:
  - Conduct intended-use and regulatory-classification assessment first.
  - **If SafeSpace makes clinical efficacy, diagnostic, or medical-device claims**: Determine the required clinical study (e.g. prospective trial or RCT), Institutional Review Board (IRB) / ethics approval, quality-management system (e.g. ISO 13485), risk management system (ISO 14971), and regulatory route under Software as a Medical Device (SaMD) frameworks (e.g. US FDA, EU MDR, HK MDCO).
  - **If SafeSpace remains environmental decision support**: Document applicable building standards, data privacy, consumer protection, and professional clinical-review obligations without presenting or regulating the software as a medical device.
- **Restrictions**: Do not make clinical fall-reduction or medical diagnostic claims that the team has not adopted or validated through the required regulatory pathway.

- **Suggested Branch Name**: `stage-9-hardening-demo-readiness`
- **Expected Review Evidence**: Full Playwright test run recording, Lighthouse audit report, and Stage Gate Verification Dossier.
