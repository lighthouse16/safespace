# SafeSpace Product Scope & Operational Baseline

## 1. Product Mission & Purpose
SafeSpace is a specialised spatial decision-support system designed to evaluate and mitigate environmental fall risks for older adults. The product provides objective spatial analysis of physical living and care environments—identifying navigational pinch points, doorway bottlenecks, trip hazards, lighting deficits, and gaps in physical support—and computes actionable architectural and operational modifications to reduce fall risk.

### Core Value Proposition
- **Target Users**: Older residents, family caregivers, occupational therapists (OTs), clinical staff, non-governmental organisations (NGOs), property managers, housing organisations, insurers, and accessibility retrofit contractors.
- **Supported Environments (Team-Approved Scope)**:
  - Apartments and residential environments
  - Clinics, elderly-care, and rehabilitation environments
  - Shopping malls and other environments frequently used by older adults
- **Commercial Boundary (Stage 0 Baseline)**:
  - Resident tier: Free public accessibility evaluation.
  - Professional/Enterprise tier: Organisational multi-site management, clinical review workflows, contractor tender packs, and regulatory audit compliance (deferred to Stage 8). Pricing, licensing gates, and billing tiers are strictly excluded from current scope.

---

## 2. Core User Flow
The verified 6-stage end-to-end user journey agreed by product architecture:

```
[1. Layout & Floorplan Intake]
             │
             ▼
[2. Mobility Profile Definition]
             │
             ▼
[3. Critical Route Formulation]
             │
             ▼
[4. Deterministic Safety Analysis]
             │
             ▼
[5. Layout Optimisation (Improve)]
             │
             ▼
[6. Professional Review & Implementation Report]
```

### Stage Functional Breakdown
1. **Layout**: Ingest 2D floorplan (raster image, vector CAD, or manual drawing). Establish physical scale via two-point calibration. Define architectural boundaries (walls, doors, openings) and interior objects (furniture, fixtures). Require human confirmation for all geometry before analysis.
2. **Mobility Profile**: Model assistive aid envelope (walking stick, cane, rollator walker, manual wheelchair), turning space requirements, gait asymmetry, fall history, tactile support dependency, and contrast/illuminance thresholds.
3. **Critical Routes**: Map mandatory routine paths between functional destinations (e.g., Bed ↔ En-suite Bathroom, Entrance ↔ Reception ↔ Waiting Seat ↔ Consultation Room). Identify transit frequency and night-time transit risks.
4. **Safety Analysis**: Evaluate dynamic spatial clearances, collision envelopes, door swing encroachments, illuminance levels, and continuous grab-support spans against statutory and clinical guidelines. Generate ranked hazard register with measured evidence.
5. **Improve**: Generate three discrete optimisation tiers:
   - **Minimum Cost**: Non-structural operational re-arrangements (zero hardware spend).
   - **Balanced**: High-impact furniture shifts plus modest safety hardware (grab bars, downlights).
   - **Maximum Safety**: Comprehensive barrier-free architectural retrofit (recessed flooring, dual-sided handrails, automated lighting).
   Compare Before vs. After in synchronized 2D and 3D views.
6. **Professional Review & Report**: Occupational Therapist / clinical reviewer signs off on findings, triages exceptions ("site check needed", "verified", "waived"), records clinical rationale, and exports auditable implementation specifications for contractors and facility operators.

---

## 3. Product Principles & Non-Negotiables
To maintain clinical trust, regulatory defensibility, and user safety, all implementations must adhere to the following architectural laws:

1. **Environmental Fall Prevention Over Aesthetic Interior Design**: The software optimizes exclusively for biomechanical safety, assistive aid clearances, support continuity, and hazard eradication—never decorative aesthetics.
2. **Real Calculation Over Mocked Telemetry**: All measurements (clearance cm, turning radius cm, illuminance lux, route length m), hazard classifications, and layout delta percentages displayed to users must be calculated from runtime spatial geometry and profile constraints. Hardcoded scores, static lookup tables, and cosmetic loading delays are prohibited in production.
3. **Deterministic Spatial Geometry**: Spatial facts—including wall collisions, clearance gaps, polygon envelopes, Minkowski route dilations, and door-swing arcs—must be evaluated using deterministic computational geometry. AI models must never invent spatial dimensions, clearances, or risk numbers.
4. **Role-Bounded AI Integration**: AI is restricted to unstructured data interpretation (optional floorplan drafting assistance), conversational intake assistance, plain-language clinical explanations, and report authoring. Spatial metrics remain rule-governed.
5. **Canonical Scene Synchronization**: 2D floorplans and 3D digital twins must consume identical underlying scene graph entities (rooms, walls, openings, furniture coordinates, hazard vectors). Editing in 2D must immediately reflect in 3D without state drift.
6. **Professional Accountability & Provenance**: Every hazard and recommendation must display clear provenance (e.g., "Deterministic clearance engine · BFA 2008 Chapter 4 Division 4 Para 12(1)" vs. "OT site observation"). Clinical outputs must support human sign-off without replacing professional liability.
7. **Clean Clinical Design System**: Styling must remain functional, accessible, and high-contrast (WCAG AA minimum). No neon gradients, cyberpunk visual effects, decorative AI artifacts, or unreadable micro-typography.

---

## 4. Current Repository State Summary
The repository currently contains an early frontend prototype implemented in Next.js 16 (App Router) with React 19, Tailwind CSS v4, Zustand 5, Konva / React-Konva, and Three.js / React Three Fiber. 

The application currently operates with **deterministic sample data and hardcoded fixture metrics** tailored to a single clinic floorplan scenario ("Queen Care Clinic" / "Harmony Elder Care Centre"). Two parallel, decoupled implementations exist in the repository (a single-page 5-stage stepper on `/` and a multi-page routing structure under `/assessments/*`). Neither flow connects to a persistent database, computational geometry engine, or computer vision backend.

Stage 0 establishes the factual baseline of this codebase, logs every deviation from the target principles, diagnoses known rendering issues, and defines the gated implementation roadmap for subsequent stages.
