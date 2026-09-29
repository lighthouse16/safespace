# Spatial Domain Model Audit & Target Schema Proposal

## 1. Domain Model Audit & Current State Analysis

### Current Canonical Data Model Status
**Verdict: Incomplete and Split Across Two Incompatible Representations.**

There is currently **no single canonical data model** in the repository. Instead, two divergent data models coexist:
1. **Model A (Primary Stepper SPA)**: `src/lib/spatial-model.ts` + `src/store/safespace-store.ts`.
2. **Model B (Multi-Page Route Architecture)**: `src/lib/types.ts` + `src/lib/mock-data.ts` + `src/components/editor/editor-model.ts`.

---

## 2. Entity-by-Entity Spatial Model Coverage Matrix

| Domain Entity | Status in Model A (`spatial-model.ts`) | Status in Model B (`types.ts` / `editor-model.ts`) | Evaluation & Architectural Gap |
| :--- | :--- | :--- | :--- |
| **Project / Site** | Implicit / Hardcoded ("Queen Care Clinic") | Defined (`Facility` in `types.ts:7`) | Model A lacks project entity; site name is a hardcoded string in UI headers. |
| **Floor** | Missing (single implicit ground floor) | Missing (single implicit level) | Multi-story buildings or split-level facilities cannot be represented. |
| **Room** | Defined (`SpatialRoom`, AABB rectangular: x, y, width, depth, color, lux) | Defined (`RoomGeometry`, widthCm, lengthCm, origin) | Both models only support axis-aligned bounding rectangles. **Cannot represent L-shaped, T-shaped, or irregular polygonal rooms.** |
| **Wall** | Defined (`SpatialWall`, start: Point2D, end: Point2D, thickness) | Computed dynamically from room bounding boxes in `editor-model.ts` | Model A has explicit wall segments; Model B calculates walls implicitly from rooms. Neither supports curved walls or material acoustic/structural properties. |
| **Door** | Defined (`SpatialDoor`, position, width, swingDeg, swingDirection, hinge) | Missing from `types.ts`; present in `editor-model.ts:clinicPlan.doors` | Door swing arc is defined in Model A, but clearance calculation does not compute the geometric sweep polygon. |
| **Window** | Missing | Missing | Glazing and natural daylighting vectors cannot be evaluated for glare or night-time disorientation. |
| **Furniture / Object** | Defined (`SpatialFurniture`, category, x, y, width, depth, height, rotation, isFixed, isStableSupport, isConfirmed) | Defined (`Furniture` in `types.ts:10`; `EditorFurniture` in `editor-model.ts:31`) | Category enums differ: Model A has 10 categories; Model B has 7 categories (`shelf`, `tv` vs `medical-fixture`, `mat`, `handrail`, `light`). |
| **Object Footprint** | Bounding box (width x depth) | Bounding box (width x depth) | Convex hull / polygon footprints missing. Chairs and tables are treated as solid rectangular blocks. |
| **Position / Rotation** | Centimeters; rotation in degrees | Centimeters; rotation in degrees | Coordinates specify top-left corner in Model B, but Model A mixes top-left and center representations. |
| **Unit & Scale** | Metric (cm). 1:50 scale display | Metric (cm). 1:50 scale display | Hardcoded 1 unit = 1 cm. Pixel conversion constant `SCALE = 0.85` or `S = 0.01` hardcoded. |
| **Mobility Profile** | Defined (`MobilityProfileData`: minClearanceCm, turningSpaceCm, fallHistory, requiresSupport, lowLightSensitivity) | Defined (`MobilityProfile`: minimumClearanceCm, turningDiameterCm, verified) | Key clinical parameters present, but wheelchair curb-climb, reach envelope, and transfer side (left/right) missing. |
| **Critical Route** | Polyline waypoints array (`RouteWaypoint[]`) | `Route` interface with `points: readonly Point[]` | Routes are represented as simple discrete node chains without lane width or dynamic corridor boundaries. |
| **Hazard** | Defined (`SpatialHazard`: severity, position, plainDescription, measuredEvidence, measuredClearanceCm, requiredClearanceCm) | Defined (`Hazard` in `types.ts:13` & `risk-analysis.tsx`) | Model A hazards carry positional coordinates and alternative links; Model B hazards carry clinical rationales and OT review statuses. |
| **Measurement & Rule Reference** | Static strings embedded in hazard objects | Missing | No formal guideline registry (e.g., standard code, clause number, authoring body). |
| **Recommendation** | Plain text string on hazard object | Plain text string on hazard object | Not linked to structured bill-of-materials or contractor task actions. |
| **Layout Alternative** | Defined (`LayoutAlternative`: min-cost, balanced, max-safety) | Defined (`Scenario` in `types.ts:15`) | Alternatives are hardcoded presets with pre-scripted moves targeting specific chair IDs. |
| **Cost Estimate** | Fixed integer (`costHkd: 180 / 850 / 2400`) | Fixed integer (`estimatedCostHkd`) | Not derived from labor, materials, or furniture unit pricing. |
| **Analysis Result** | Transient computed object from `calculateLiveMetrics` | Embedded in `Assessment.riskScore` | Not versioned; cannot compare historical assessment snapshots. |
| **Report** | Rendered via JSX component (`ReportModal.tsx`) | Defined (`Report` interface in `types.ts:17`) | No PDF generation engine or auditable JSON export format. |

---

## 3. Discrepancies, Conversions, and Data-Loss Failure Modes

### 1. Inconsistent Coordinate Systems
- **Model A (2D custom / 3D spatial)**:
  - 2D Canvas renders coordinates in plan space (0 to 800 cm horizontal, 0 to 600 cm vertical).
  - 3D Three.js converts via `(x - 400) / 100` and `(y - 300) / 100` to center the 8m x 6m scene around the Three.js world origin `(0, 0, 0)`.
- **Model B (Konva / Editor 3D)**:
  - 2D Konva places elements at absolute canvas pixels (`x * zoom + panOffset.x`).
  - 3D Three.js converts via `toM(v) = v * 0.01` and places the entire room group at offset `[-plan.width * 0.01 / 2, 0, -plan.depth * 0.01 / 2]`.
- **Impact**: Any attempt to transfer furniture coordinates directly between Model A and Model B results in position displacement and rotation inversion.

### 2. Missing Stable IDs
- Walls and doors in Model B do not have stable UUIDs; they are regenerated whenever the room array changes.
- In Model A, adding a new furniture item generates an ID via ``item-${Date.now()}`` (`safespace-store.ts:270`), which lacks cryptographic uniqueness and fails in collaborative environments.

### 3. Derived vs. Stored State Leakage
- In `spatial-model.ts`, hazard clearance numbers (e.g. `measuredClearanceCm: 54`) and route lengths (e.g. `10.4 m`) are stored as immutable static fields rather than dynamically derived from spatial geometry.
- If a user moves `chair-c04` in the editor, the visual clearance changes, but the hazard object's text description in the right sidebar continues to read: `"Waiting chair C-04 reduces walking clearance to 54 cm"` unless explicitly overwritten by hardcoded alternative switches.

### 4. Refresh Loss
- 100% of user modifications in both Model A and Model B are stored exclusively in Zustand store memory. Neither `localStorage` nor server persistence exists. Refreshing the browser instantly wipes all user work.

---

## 4. Proposed Canonical Spatial Domain Architecture (For Stage 1 Implementation)

The proposed domain schema must be unified, type-safe (validated with Zod), unit-consistent (millimeters/centimeters internally, converted to meters in 3D), and capable of representing arbitrary floorplans:

```
Facility (Site)
  └── Floor
        ├── Boundary Polygon (Exterior Walls)
        ├── Rooms[] (Polygonal Boundaries, Light Levels)
        ├── Walls[] (Segment ID, Thickness, Material, Structural)
        ├── Openings[] (Doors, Windows, Thresholds, Swing Arcs)
        ├── Objects[] (Furniture, Fixtures, Grab Bars, Sensors)
        │     ├── Footprint (2D Convex Polygon)
        │     ├── Spatial Transform (x, y, z, rotationDeg)
        │     ├── 3D Bounding Box (width, depth, height)
        │     ├── Stability & Load Rating
        │     └── Confirmation / Provenance Status
        ├── MobilityProfiles[] (Aid Envelopes, Clearances, Sensory Limits)
        ├── CriticalRoutes[] (Waypoints, Corridor Widths, Frequency)
        ├── HazardRegister[] (Detected Violations, Evidence, Geometry Ref)
        └── LayoutAlternatives[] (Computed Delta Sets, Cost Takeoff)
```

### Proposed Core TypeScript Interfaces (Target Specification)

```typescript
export type UUID = string;
export type Point2D = { readonly x: number; readonly y: number }; // cm
export type Polygon2D = readonly Point2D[];

export interface CanonicalRoom {
  id: UUID;
  floorId: UUID;
  name: string;
  category: "waiting" | "reception" | "corridor" | "bedroom" | "bathroom" | "consultation" | "general";
  boundary: Polygon2D; // Supports non-rectangular rooms
  targetIlluminanceLux: number;
  measuredIlluminanceLux?: number;
}

export interface CanonicalOpening {
  id: UUID;
  roomId: UUID;
  type: "door" | "window" | "archway";
  start: Point2D;
  end: Point2D;
  clearWidthCm: number;
  thresholdHeightMm: number; // For trip hazard detection
  swing?: {
    arcDeg: number;
    direction: "inward-left" | "inward-right" | "outward-left" | "outward-right";
    hinge: Point2D;
  };
}

export interface CanonicalObject {
  id: UUID;
  roomId: UUID;
  name: string;
  category: "chair" | "table" | "bed" | "cabinet" | "grab-rail" | "mat" | "plant" | "fixture" | "sensor";
  position: Point2D; // cm
  elevationCm: number;
  dimensionsCm: { width: number; depth: number; height: number };
  rotationDeg: number;
  footprint?: Polygon2D; // Optional irregular polygon footprint
  isFixed: boolean;
  loadBearingSupport: boolean; // Can user grab/lean safely?
  hasSharpEdges: boolean;
  confidence: number; // 0..1 from AI intake
  verifiedByHuman: boolean;
}

export interface CanonicalMobilityProfile {
  id: UUID;
  name: string;
  aidType: "none" | "walking-stick" | "quad-cane" | "rollator-walker" | "manual-wheelchair" | "power-wheelchair";
  envelopeWidthCm: number; // e.g. 70 cm for walker
  preferredClearanceCm: number; // e.g. 90 cm
  turningDiameterCm: number; // e.g. 150 cm
  maxUnsupportedWalkingSpanM: number; // e.g. 1.5 m
  minIlluminanceLux: number; // e.g. 200 Lux
  maxThresholdMm: number; // e.g. 6 mm
}

export interface CanonicalRoute {
  id: UUID;
  floorId: UUID;
  name: string;
  profileId: UUID;
  waypoints: readonly Point2D[];
  isEmergencyEgress: boolean;
  transitFrequency: "low" | "medium" | "high";
}

export interface CanonicalHazard {
  id: UUID;
  code: string; // e.g. HZ-01
  ruleId: string; // Standard reference, e.g. "HK-BFA-2008-DIV4-P12"
  severity: "low" | "medium" | "high" | "critical";
  position: Point2D;
  affectedObjectId?: UUID;
  affectedOpeningId?: UUID;
  measuredValue: number;
  requiredValue: number;
  unit: "cm" | "lux" | "mm" | "m";
  provenance: "deterministic-geometry" | "photometric-calc" | "manual-observation";
  reviewStatus: "pending" | "verified" | "waived" | "mitigated";
  clinicalRationale?: string;
}
```

*Note: This canonical specification will be implemented in Stage 1.*
