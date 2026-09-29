# Analytical Integrity, Safety Claims & Evidence Audit

## 1. Executive Summary: Analytical Defense Posture

SafeSpace's value as a clinical and architectural decision-support tool rests entirely on its analytical defensibility. In healthcare and elderly residential fall prevention, recommending inadequate doorway clearances, inaccurate turning circles, or unjustified lighting levels directly increases the risk of physical injury, hospitalization, or wrongful death.

### Key Finding
**Almost all current measurements, risk indices, severity classifications, and improvement statistics shown in the UI are hardcoded fixtures, or use rudimentary linear approximations anchored to a single chair fixture (`chair-c04`). None of the current risk scores or percentages are computed from an epidemiological fall-risk model or building code standard.**

---

## 2. Traceability Matrix of Displayed Metrics & Claims

| Displayed Metric / Claim | UI Value / Display | Code Location / Symbol | True Computational Source | Recalculated Dynamically? | Independently Verifiable? | Misleading to Residents/Clinicians? |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Environmental Risk Index (Initial)** | `68 / 100 (High Risk)` | `spatial-model.ts:935`, `mock-data.ts:104` | Hardcoded literal `68`. Step logic clamps to 68 if clearance <= 60cm. | Pseudo (discrete step 68/41/27) | **No** (No formula provided) | **HIGH**: Appears as a continuous clinical index, but is a 3-step hardcoded switch. |
| **Narrowest Route Clearance** | `54 cm` | `spatial-model.ts:576, 905` | Hardcoded literal `54` if `chair-c04` is within 50cm of point (235, 260). | Partial (linear scale `dist * 1.4` clamped to 54) | **No** (Ignores other 17 items) | **HIGH**: If a user drags another chair into the path, clearance remains 96 cm. |
| **Sharp Corner Clearance** | `28 cm` (to table-sharp) | `spatial-model.ts:593` | Static string in `INITIAL_HAZARDS[1]`. | **No** (Static fixture) | **No** | **HIGH**: Value never recalculates when table is moved. |
| **Corridor Illuminance** | `110 Lux` / `85 Lux` | `spatial-model.ts:609`, `risk-analysis.tsx:62` | Static text in hazard evidence. Contradicts itself between files. | **No** (Static fixture) | **No** | **HIGH**: Fabricated sensor readings presented as real site photometer data. |
| **Unsupported Walking Span** | `2.1 m` | `spatial-model.ts:623`, `risk-analysis.tsx:78` | Static text in hazard evidence. | **No** (Static fixture) | **No** | **MEDIUM**: Fixed clinical claim not measured from floorplan walls. |
| **Entrance Mat Entrapment** | `12 mm height edge` | `spatial-model.ts:653` | Static text in hazard evidence. | **No** (Static fixture) | **No** | **MEDIUM**: Static trip hazard note. |
| **Tight S-Turn Curvature** | `42 cm radius` | `spatial-model.ts:667` | Static text in hazard evidence. | **No** (Static fixture) | **No** | **HIGH**: No spline curve or curvature analysis is performed on route waypoints. |
| **Minimum Cost Plan Risk** | `41 / 100` | `spatial-model.ts:757` | Hardcoded constant in `LAYOUT_ALTERNATIVES`. | **No** | **No** | **HIGH**: Pre-scripted score. |
| **Balanced Plan Risk** | `27 / 100` | `spatial-model.ts:785` | Hardcoded constant in `LAYOUT_ALTERNATIVES`. | **No** | **No** | **HIGH**: Pre-scripted score. |
| **Maximum Safety Plan Risk** | `19 / 100` | `spatial-model.ts:832` | Hardcoded constant in `LAYOUT_ALTERNATIVES`. | **No** | **No** | **HIGH**: Pre-scripted score. |
| **Balanced Clearance** | `96 cm` | `spatial-model.ts:788` | Hardcoded constant in `LAYOUT_ALTERNATIVES`. | **No** | **No** | **HIGH**: Pre-scripted score. |
| **Max Safety Clearance** | `110 cm` | `spatial-model.ts:835` | Hardcoded constant in `LAYOUT_ALTERNATIVES`. | **No** | **No** | **HIGH**: Pre-scripted score. |
| **Route Lengths** | `11.8 m` → `10.4 m` → `10.0 m` | `spatial-model.ts:923` | Hardcoded ternary checks on `activeAlternativeId`. | **No** | **No** | **HIGH**: Route lengths are hardcoded constants. |
| **Estimated Cost (Min-Cost)** | `HK$ 180` | `spatial-model.ts:759` | Hardcoded constant. | **No** | **No** | **HIGH**: No labor rate or material takeoff. |
| **Estimated Cost (Balanced)** | `HK$ 850` | `spatial-model.ts:787` | Hardcoded constant. | **No** | **No** | **HIGH**: Handrail (HK$620) + Downlight (HK$230) sum is hardcoded. |
| **Estimated Cost (Max Safety)** | `HK$ 2,400` | `spatial-model.ts:834` | Hardcoded constant. | **No** | **No** | **HIGH**: Fixed pricing not verifiable by contractors. |
| **Standard References** | "CIBSE/OT minimum: ≥ 200 Lux", "Profile target ≥ 90 cm" | `spatial-model.ts:609` | Text strings in hazard plain descriptions. | **No** (Text strings) | **Partial** (CIBSE guidelines exist, but are unlinked) | **MEDIUM**: Real standards cited as loose text without authoritative clause mapping. |
| **Professional Review Sign-Off** | "Dr. Adrian Lau, HKROT" | `mock-data.ts:147`, `ReportModal.tsx:112` | Hardcoded static string. | **No** | **No** | **CRITICAL**: Fictitious clinical accreditation. |

---

## 3. Dissection of the "Live Metric Engine" (`spatial-model.ts`)

Lines 879–965 of `src/lib/spatial-model.ts` contain the only runtime calculation in the entire system (`calculateLiveMetrics`). A thorough forensic code review reveals why this engine is an illusion of real calculation:

```typescript
// 1. Hardcoded Target IDs:
const chair4 = furniture.find((f) => f.id === "chair-c04");
const mat = furniture.find((f) => f.id === "mat-entrance");

// 2. Fixed Arbitrary Centerpoint:
// Distance is measured only from chair4 to a magic coordinate (235, 260)
const distToRoute = Math.hypot(chair4.x + chair4.width / 2 - 235, chair4.y + chair4.depth / 2 - 260);

// 3. Fabricated Linear Formula:
const effectiveClearance = Math.round(Math.max(45, Math.min(120, distToRoute * 1.4)));
if (distToRoute < 50) {
  minClearance = Math.min(minClearance, 54);
} else {
  minClearance = Math.min(minClearance, effectiveClearance);
}

// 4. Quantized Step Outputs Rather Than Calculated Distribution:
if (minClearance <= 60) {
  risk = 68; highHazards = 3; totalHazards = 7;
} else if (minClearance < 90) {
  risk = 41; highHazards = 1; totalHazards = 4;
} else {
  risk = 27; highHazards = 0; totalHazards = 2;
}

// 5. Overriding Route Lengths with Hardcoded Demo Numbers:
const isDefaultRoute = route.length === 8 && route[0].x === 60;
const routeLengthM = isDefaultRoute
  ? activeAlternativeId === "balanced" ? 10.4 : activeAlternativeId === "max-safety" ? 10.0 : 11.8
  : Number((totalLengthCm / 100).toFixed(1));
```

### Architectural Implications
1. **Zero Multi-Object Spatial Awareness**: Moving any of the other 17 objects has zero effect on the metrics.
2. **Fragile Coupling**: Any user who deletes `chair-c04` permanently locks the risk score into the "safe" state (`risk = 27`), even if they obstruct the entrance with 10 tables.
3. **Fictitious Risk Scales**: The risk numbers `68`, `41`, and `27` are not calibrated against any clinical risk stratification tool (such as the Morse Fall Scale, STRATIFY, or CDC STEADI).

---

## 4. Required Rule-Engine Specification (For Stage 4)

To replace these hardcoded fixtures with defensible analytical rigor, the system requires a deterministic rule registry adhering to documented building accessibility standards:

### Standard References to Formalise
1. **Clearance Envelope Standards**:
   - *Hong Kong Barrier Free Design Handbook 2008 (Section 12)*: Minimum clear width of accessible corridor = 1050 mm; absolute minimum unobstructed transit pinch point = 900 mm for walking frame, 800 mm for single doorway threshold.
   - *ADA Standards 2010 (Section 403)*: 36 inches (915 mm) continuous clear path, minimum 32 inches (815 mm) at discrete doorway points.
2. **Turning Space Standards**:
   - *Hong Kong BFD 2008*: Minimum 1500 mm × 1500 mm clear turning area for 180° / 360° wheelchair turns.
3. **Lighting & Photometric Standards**:
   - *CIBSE Code for Lighting / SLL Lighting Guide 2 (Hospitals and Health Care Buildings)*: Minimum 200 Lux on horizontal floor plane in corridors and circulation areas; 300 Lux in consultation and activity zones.
4. **Grab Rail & Continuous Support**:
   - Maximum unsupported gait distance between stable resting touchpoints: 1.5 m for frail older adults (OT clinical guideline).
5. **Threshold & Level Change**:
   - Maximum vertical trip threshold without bevel: 6 mm. Maximum beveled threshold: 13 mm (1:2 slope).

### Target Risk Index Formula Structure
Risk should be computed as a weighted multi-factor penalty function normalized to `0..100`:

$$\text{Risk} = \min\left(100, \sum w_i \cdot \text{Penalty}_i\right)$$

Where factors include:
- $P_{\text{clearance}}$: Proportional deficit below required profile envelope ($\ge 90\text{ cm}$).
- $P_{\text{corners}}$: Proximity of unrounded edges ($r < 5\text{ mm}$) within $60\text{ cm}$ of walking corridor.
- $P_{\text{trip}}$: Unsecured floor coverings, rugs, thresholds $> 6\text{ mm}$ along active route.
- $P_{\text{support}}$: Uninterrupted wall segments $> 1.5\text{ m}$ lacking stable support handrails.
- $P_{\text{lux}}$: Deficit below required profile illuminance at floor level ($< 200\text{ Lux}$).
- Factor weights ($w_i$) are scaled by user profile vulnerability (e.g., fall history, low-vision, walking aid dependency).
