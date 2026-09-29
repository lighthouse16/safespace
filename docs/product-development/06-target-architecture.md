# SafeSpace Target Technical Architecture

## 1. Architectural Blueprint & Layer Separation

The target architecture for SafeSpace separates deterministic spatial geometry and rule-based compliance calculations from generative AI assistance and presentation state.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Presentation & UI Layer                         │
│   Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Zustand 5     │
│   • Top Navigation & Stepper State     • Hazard Queue & Inspector      │
│   • Calibration & Toolbars             • OT Decision & Report Modals   │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
         ┌─────────▼────────┐              ┌─────────▼────────┐
         │ 2D Canvas Engine │              │ 3D Twin Engine   │
         │ (Unified Canvas) │              │ (Three.js / R3F) │
         └─────────┬────────┘              └─────────┬────────┘
                   │                                 │
┌──────────────────▼─────────────────────────────────▼───────────────────┐
│                     Canonical Scene Graph & State                      │
│   • Single Source of Truth (Zustand + Zod Schema Validation)          │
│   • Entity Graph: Rooms, Openings, Objects, Waypoints, Hazards         │
│   • Unit Standards: All coordinates in cm (2D) / meters (3D)           │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
┌──────────────────▼─────────────────┐     ┌─────────▼──────────────────┐
│   Deterministic Geometry Engine    │     │    Compliance & Rule Engine│
│   • Minkowski Dilation Corridor    │     │   • Standard Rule Registry │
│   • Polygon-Line Intersections     │     │   • HK BFA 2008 & CIBSE LG2│
│   • Dynamic A* Pathfinding         │     │   • Environmental Hazard   │
│   • Door-Swing Clearance Sweeps    │     │     Score (EHS) Formulation│
└──────────────────┬─────────────────┘     └─────────┬──────────────────┘
                   │                                 │
┌──────────────────▼─────────────────────────────────▼───────────────────┐
│                 Constraint-Based Layout Optimiser                      │
│   • Heuristic Penalty Minimiser: Clearance, Moves, Hardware Cost       │
│   • Generates 3 Tiers: Min-Cost, Balanced, Maximum Safety              │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
┌──────────────────▼─────────────────┐     ┌─────────▼──────────────────┐
│        AI Integration Layer        │     │  Persistence & Org Layer   │
│   • Multimodal Vision Extraction   │     │  • Client-side IndexedDB   │
│   • Plain-Language Report Drafting │     │  • Cloud Database (PG)     │
│   • Mandatory Human Review Gate    │     │  • Multi-tenant Accounts   │
└────────────────────────────────────┘     └────────────────────────────┘
```

---

## 2. Hosting & Backend Architecture: Evaluation of Options

The current repository build produces a static HTML/JS export (`output: "export"` in `next.config.ts`) hosted on GitHub Pages via `.github/workflows/deploy.yml`. 
> [!IMPORTANT]
> **Static Export Reality**: In a static export deployment, **Next.js Server Actions and Route Handlers cannot execute at runtime**. There is no Node.js server to run server-side code. Therefore, two distinct architectural paths exist for future backend and AI integration:

### Option A: Retain Static Frontend + External Backend / Serverless API
- **Architecture**:
  - Frontend remains statically compiled on GitHub Pages (or static CDN / Cloudflare Pages / AWS S3).
  - All interactive spatial math, 2D/3D rendering, and IndexedDB persistence run purely on the client.
  - An independent, authenticated external API (e.g. Python FastAPI on Cloud Run, Node.js serverless functions, or Edge functions) handles private operations: AI vision calls, report PDF generation, and multi-tenant cloud persistence.
  - **Secret Management**: Cloud provider API keys (e.g., vision/LLM keys) reside exclusively on the external backend. The static frontend never contains private secrets.
- **Trade-offs**:
  - *Pros*: Preserves free, zero-maintenance GitHub Pages deployment; clean architectural decoupling between frontend and compute backend; backend stack (e.g., Python for computer vision) is unconstrained by Next.js.
  - *Cons*: Introduces cross-origin resource sharing (CORS), separate deployment pipelines, and dual CI/CD configuration.

### Option B: Migrate to Full-Stack Next.js Hosting (Server Runtime)
- **Architecture**:
  - Remove `output: "export"` and deploy to a host supporting the full Next.js Node.js/Edge server runtime (e.g., Vercel, AWS ECS/Amplify, GCP Cloud Run, or custom Docker container).
  - Use native Next.js Server Actions and Route Handlers for AI orchestration, database queries, and session management.
- **Trade-offs**:
  - *Pros*: Single repository, unified build pipeline, zero CORS configuration, native Next.js 16 server actions.
  - *Cons*: Cannot be hosted on standard GitHub Pages; requires paid or cloud infrastructure tier post-hackathon.

### Recommendation for Hackathon MVP
**Recommendation: Retain Option A (Static Export with Client-Side IndexedDB) for Stages 1–6, and connect a lightweight serverless endpoint for Stage 7.**
- *Rationale*: SafeSpace's core value is deterministic local spatial assessment. Stages 1–5 (intake, calibration, pathfinding, risk rules, and layout optimization) can run 100% in-browser without server dependencies. Keeping the frontend static on GitHub Pages guarantees instant demonstration reliability without cloud container startup lag or server cold-starts. When AI features are added in Stage 7, a dedicated external serverless function can securely proxy AI requests without forcing a full hosting overhaul.

---

## 3. Technology & Vendor Interchangeability

To prevent vendor lock-in, external service providers are treated as interchangeable implementation candidates:

| Architectural Component | Candidate Implementations | Selection Criteria & Abstraction Strategy |
| :--- | :--- | :--- |
| **Multimodal Vision & LLM** | Google Gemini API, Anthropic Claude, OpenAI Vision | Abstracted via a generic `AIExtractionProvider` interface. The system passes base64 image data and receives validated GeoJSON/canonical objects. Provider keys remain server-side. |
| **Cloud Database & Auth** | Supabase (PostgreSQL), Firebase, Neon + Auth0 | Abstracted via repository interfaces (`AssessmentRepository`). Local IndexedDB serves as the offline-first ground truth; cloud DB acts as a remote synchronization target. |
| **Client Persistence** | Dexie.js (IndexedDB wrapper), Native `idb` | Lightweight client persistence implemented in Stage 1 to eliminate the refresh data-loss vulnerability. |

---

## 4. Core Subsystem Architectural Specifications

### 1. Canonical State & Unified Scene Graph
- Single store: Consolidate `safespace-store.ts` and `assessment-store.ts` into a unified `useSpatialStore`.
- Strict schema validation with Zod on all ingest/export boundaries.
- Consistent coordinate mapping: Centimeters (cm) in 2D plan space with top-left origin `(0, 0)`; Meters (m) in 3D scene space via `toM = (cm) => cm / 100`.

### 2. Deterministic Computational Geometry Engine
- **Corridor Dilation (Minkowski Sum)**: Construct walking corridor envelopes by expanding route polylines by the profile clearance radius (e.g., $r = 45\text{ cm}$ for a $90\text{ cm}$ walker).
- **Obstacle Collisions**: Intersect furniture bounding polygons with the dilated corridor.
- **Dynamic Obstacle-Avoidance Pathfinding**: Implement an A* grid pathfinder ($5\text{ cm}$ resolution) across walkable floor polygons to compute true navigable paths around moved objects.
- **Door-Swing Egress Arc**: Calculate circular sector polygons representing door-swing trajectories; flag furniture intersections as door-swing hazards.

### 3. Compliance & Fall Risk Rule Engine
- Implement a decoupled rules registry (`src/lib/rules/`) referencing established building design manuals (HK BFA 2008) and lighting guidelines (CIBSE LG02, subject to primary text verification).
- Primary engine output: transparent individual rule compliance results with exact physical measurements, provenance, and severity ratings.
- Composite score designated as an optional, experimental **Environmental Hazard Score (EHS)**, representing environmental guideline deviation density, **not** an individual's personal probability of falling, and not validated as a clinical prediction.

### 4. Constraint-Based Layout Optimiser
- Deterministic heuristic solver: Evaluate candidate furniture translations and rotations against room boundaries and clearance corridors.
- Objective function: Minimize $\text{EHS} + \lambda_1 \cdot \text{Moves} + \lambda_2 \cdot \text{Cost}$.
- Generates 3 discrete alternatives:
  1. *Minimum Cost*: Zero-hardware operational moves only.
  2. *Balanced*: High-leverage operational moves + minimal targeted hardware (grab rails).
  3. *Maximum Safety*: Full barrier-free architectural reconfiguration.

### 5. Role-Bounded AI Integration
- AI is restricted to two isolated stages:
  - *Optional Floorplan Drafting (Stage 7)*: Extracts draft geometry with confidence ratings; requires mandatory human confirmation before analysis.
  - *Report Authoring (Stage 7)*: Drafts plain-language clinical notes and contractor task lists using calculated metrics only.
- AI is strictly prohibited from inventing dimensions, calculating clearances, or generating risk numbers.

### 6. Unified 2D & Synchronized 3D Digital Twin
- Consolidate 2D canvas into a single high-performance engine consuming the canonical scene graph.
- Wrap 3D canvas in `Spatial3DErrorBoundary` with automatic 2D fallback.
- In Stage 5 Before/After views, utilize a single WebGL canvas with split viewports to prevent context loss.
