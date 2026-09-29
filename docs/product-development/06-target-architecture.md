# SafeSpace Target Technical Architecture

## 1. Architectural Blueprint & Layer Separation

The target architecture for SafeSpace separates deterministic spatial physics and rule-based clinical calculations from generative AI and user interaction.

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
│   Deterministic Geometry Engine    │     │   Evidence & Risk Engine   │
│   • Minkowski Dilation Corridor    │     │   • Standard Rule Registry │
│   • Polygon-Line Intersections     │     │   • STEADI Multi-factor    │
│   • Dynamic A* Pathfinding         │     │   • Illuminance & Support  │
│   • Door-Swing Clearance Sweeps    │     │   • Auditable Provenance   │
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
│   • Vision API Floorplan Extraction│     │  • Client-side IndexedDB   │
│   • Plain-Language Report Authoring│     │  • Supabase / PostgreSQL   │
│   • Human Confirmation Gate        │     │  • Multi-tenant Accounts   │
└────────────────────────────────────┘     └────────────────────────────┘
```

---

## 2. Core Architectural Subsystems

### 1. Canonical Spatial Data Model & State Layer
- **Schema Validation**: Define all domain entities in strict TypeScript with runtime validation using Zod.
- **Single Source of Truth**: Eliminate dual Zustand stores. Consolidate `safespace-store.ts` and `assessment-store.ts` into a unified `useSpatialStore`.
- **Coordinate Standard**:
  - Global Plan Space: Centimeters (cm), 2D origin at top-left `(0, 0)`.
  - 3D Twin Space: Meters (m) via deterministic conversion `toM = (cm) => cm / 100`, centered via scene bounding box offset.
  - Rotations: Clockwise degrees `[0, 360)`.

### 2. Deterministic Computational Geometry & Pathfinding Engine
- **Footprints & Collisions**: Model furniture footprints as 2D convex polygons. Compute distance to walking paths using point-to-segment perpendicular distance algorithms.
- **Route Corridor (Minkowski Sum)**: Dilate the center polyline by the mobility profile envelope radius (e.g. $r = 45\text{ cm}$ for a $90\text{ cm}$ walker) to generate the transit corridor ribbon. Detect encroachments by intersecting obstacle polygons with the ribbon.
- **Dynamic Pathfinding (A* Grid / Navmesh)**: In Stage 3, replace hardcoded route reset with an A* obstacle-avoidance pathfinder on a 5 cm spatial grid. When furniture is moved, dynamically calculate the shortest safe barrier-free path from entrance to destination.
- **Door Swing Sweep**: Generate circular sector polygons representing the swing arc of each door. Flag furniture intersecting this sector as door-swing egress violations.

### 3. Rule-Based Fall Risk & Evidence Engine
- **Standard Registry**: A decoupled TypeScript rules registry where each rule maps to an empirical building or health standard (e.g. HK BFD 2008, CIBSE LG2, CDC STEADI).
- **Rule Evaluation**:
  - *Rule R-01 (Corridor Clearance)*: Flag any transit corridor narrowing $< 90\text{ cm}$ (Walker) or $< 100\text{ cm}$ (Wheelchair).
  - *Rule R-02 (Sharp Corner Proximity)*: Flag any rigid corner ($r < 5\text{ mm}$) within $60\text{ cm}$ of the critical route.
  - *Rule R-03 (Illuminance)*: Flag floor zones where lux levels fall below profile requirement (e.g. $< 200\text{ Lux}$).
  - *Rule R-04 (Support Continuity)*: Measure distance between fixed walls, handrails, or stable furniture. Flag gaps $> 1.5\text{ m}$.
  - *Rule R-05 (Trip Threshold)*: Flag floor coverings or thresholds with vertical edges $> 6\text{ mm}$.
- **Risk Score Calculation**: Compute continuous Environmental Fall Risk Index ($0\dots100$) using weighted factor penalties rather than arbitrary step numbers.
- **Explicit Provenance**: Every hazard must state its origin (`calculated-geometry`, `photometric-site-reading`, `ai-intake-flag`, or `clinician-manual-entry`).

### 4. Constraint-Based Layout Optimiser
- **Optimization Strategy**: Do not use LLMs to guess furniture positions. Use a deterministic heuristic constraint solver:
  - Objective: Minimize $\text{Risk} + \lambda_1 \cdot \text{Moves} + \lambda_2 \cdot \text{HardwareCost}$.
  - Constraints: Keep furniture inside room polygons, preserve minimum $90\text{ cm}$ clearance to walls, avoid blocking doors or windows.
  - Generates three distinct alternatives:
    1. **Minimum Cost**: Furniture translation only, 0 hardware cost.
    2. **Balanced**: 1–2 furniture translations, $+1$ handrail, $+1$ downlight.
    3. **Maximum Safety**: Recessed mats, dual handrails, full sensor and lighting retrofit.

### 5. Role-Bounded AI Integration
- **Floorplan Ingestion**: Multimodal Vision API (e.g., Google Gemini 2.5 Flash / Pro) receives uploaded floorplan images or architectural PDFs. Returns structured JSON containing room polygons, doors, and bounding boxes with confidence scores ($0\dots1$).
- **Mandatory Human Confirmation Gate**: AI extractions enter a "Draft / Unconfirmed" state. The user must explicitly confirm or calibrate boundaries and scales before risk analysis runs.
- **Report & Narrative Generation**: LLM drafts executive summaries, OT clinical justifications, and contractor implementation notes based exclusively on calculated numerical findings. The LLM is never prompted to calculate distances or invent hazards.

### 6. Persistence & Organization Infrastructure
- **Tier 1 (Client Offline)**: IndexedDB (via Dexie.js or native IDB) for instant client-side offline saving. Changes persist across browser refreshes automatically.
- **Tier 2 (Cloud / Multi-tenant)**: Supabase PostgreSQL backend with Row Level Security (RLS) for multi-facility management, OT audit signatures, and role-based access (caregivers, clinic managers, contractors).

### 7. Unified 2D & 3D Rendering Architecture
- **2D Canvas**: Consolidate into a single high-performance canvas engine (either optimized Konva or clean HTML5 Canvas) consuming the canonical scene graph.
- **3D Digital Twin**: Single `@react-three/fiber` canvas wrapped in a robust `Spatial3DErrorBoundary`. Eliminate remote font downloading in Drei `<Text>`. For Stage 5 comparisons, use WebGL viewport splitting on a single canvas context to prevent context exhaustion.

---

## 3. Technology Stack Evaluation & Recommendations

| Technology Component | Current Choice | Recommendation | Justification & Upgrade Path |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js 16.3.6 (App Router) | **Retain** | Next.js App Router with Turbopack builds fast and supports static export for GitHub Pages while allowing dynamic server routes for cloud APIs. |
| **Language** | TypeScript 6.0 | **Retain** | Strict type safety is essential for spatial math and clinical rules. |
| **UI Styling** | Tailwind CSS v4 | **Retain** | Modern, performant CSS engine. Retain clean clinical slate/teal aesthetic. |
| **State Management** | Zustand 5.0 | **Retain & Consolidate** | Zustand is ideal for high-frequency coordinate manipulation (dragging/panning). Unify into single store. |
| **2D Renderer** | Konva + Custom DOM | **Consolidate** | Migrate fully to clean Canvas/Konva model to avoid dual maintenance. Isolate Konva from Node test environments to prevent test slowdowns. |
| **3D Engine** | Three.js + R3F + Drei | **Retain with Hardening** | Keep Three.js r186 + R3F, but add explicit shadow map config, remove remote font fetching, and add error boundaries. |
| **Geometry Math** | Custom basic math | **Adopt Robust Lib** | Integrate lightweight computational geometry utilities (e.g., `polygon-clipping`, `earcut`, or `robust-point-in-polygon`). |
| **Client Storage** | None | **Add IndexedDB** | Add IndexedDB client persistence to eliminate the refresh data-loss blocker in Stage 1. |
| **Backend Storage** | None | **Add Supabase / PG** | Introduce in Stage 8 for multi-user organizational accounts and signed audit trails. |
| **AI Integration** | None | **Add Gemini API** | Introduce in Stage 2 (Floorplan Vision) and Stage 7 (Report Drafting) via secure server actions. |
