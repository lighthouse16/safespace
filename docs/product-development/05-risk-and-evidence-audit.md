# Analytical Integrity, Safety Claims & Evidence Audit

## 1. Executive Summary: Evidence Posture & Clear Separation

In elder care, clinical environments, and residential planning, safety assessments must maintain absolute evidentiary transparency. Recommending inadequate doorway clearances, inaccurate turning circles, or unverified lighting thresholds directly affects physical safety and clinical trust.

### Essential Architectural Corrections
1. **Clinical Screening vs. Spatial Hazard Analysis**:
   - The CDC STEADI (Stopping Elderly Accidents, Deaths, & Injuries) framework is a **clinical screening, assessment, and intervention protocol** administered by healthcare providers to evaluate patient gait, balance, medication, and fall history.
   - **CDC STEADI does NOT supply a validated spatial floorplan risk formula or geometric penalty weighting.**
   - STEADI principles can legitimately inform user mobility profile intake (e.g. screening questions on fall history, assistive device use, and balance asymmetry), but they cannot be cited as validation for a spatial algorithm.
2. **Neutral Terminology & Primary Output**:
   - The primary output of the safety engine must be **transparent individual rule violations, exact physical measurements, evidentiary provenance, and severity levels**.
   - Any composite metric is designated as a reserved, disabled concept: **Environmental Hazard Score (EHS)**. It represents an architectural heuristic reflecting environmental compliance and hazard severity, **not** an individual person's likelihood of falling.
   - A composite score is **optional, experimental, and completely disabled**. It must not be calculated, displayed, or used in analysis, optimization, ranking, reports, or UI until weights and category thresholds have been reviewed, calibrated, and approved by relevant occupational therapy and architectural professionals.
   - The score must never be described as being validated by BFA, CIBSE, or CDC STEADI.
3. **Primary-Source Standards Hierarchy & Applicability Scope**:
   - For Hong Kong environments, the primary statutory design document is the **Hong Kong Buildings Department *Design Manual: Barrier Free Access 2008 (2025 Edition)*** (First issue: December 2008; Current revision: June 2025; Official URL: [BFA 2008 (2025 Edition)](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BFA2008_e.pdf)).
   - **Scope of Application & Statutory Limits**: Statutory BFA requirements depend strictly on building type, designated accessible routes, alteration/addition status, exemptions, and extent-of-application provisions under the Buildings Ordinance (Cap. 123) and Building (Planning) Regulations. Statutory requirements for commercial, institutional, or healthcare premises do not automatically apply to private domestic apartments.
   - US ADA 2010 standards and UK Building Regulations Part M are comparative international benchmarks only and must not be cited as default Hong Kong requirements.

---

## 2. Standards Traceability Matrix (Primary Sources vs. Product Assumptions)

| Rule ID | Metric / Threshold | Jurisdiction | Primary Source Document | Edition / Year | Section, Clause, or Paragraph | Official Primary-Source URL | Applicability | Classification |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **STD-01a** | Clear width of accessible route: not less than **1050 mm** | Hong Kong | BD Design Manual: Barrier Free Access 2008 (2025 Edition) | 2008 (Rev. Jun 2025) | Chapter 4, Division 4 — Access Route, Paragraph 12(1) | [BFA 2008 PDF](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BFA2008_e.pdf) | Accessible routes within applicable building scope | **Obligatory Design Requirement** |
| **STD-01b** | Clear width of internal corridors, lobbies, and paths: not less than **1050 mm** | Hong Kong | BD Design Manual: Barrier Free Access 2008 (2025 Edition) | 2008 (Rev. Jun 2025) | Chapter 4, Division 9 — Corridors, Lobbies, Paths, Paragraph 31(a) | [BFA 2008 PDF](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BFA2008_e.pdf) | Internal corridors, lobbies, paths within applicable building scope | **Obligatory Design Requirement** |
| **STD-02** | Clear width of doorway opening: not less than **800 mm** | Hong Kong | BD Design Manual: Barrier Free Access 2008 (2025 Edition) | 2008 (Rev. Jun 2025) | Chapter 4, Division 10 — Doors, Paragraph 38 | [BFA 2008 PDF](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BFA2008_e.pdf) | Doors on accessible routes within applicable building scope | **Obligatory Design Requirement** |
| **STD-03a** | Space not less than **1500 mm × 1500 mm** provided within 3500 mm of every dead end | Hong Kong | BD Design Manual: Barrier Free Access 2008 (2025 Edition) | 2008 (Rev. Jun 2025) | Chapter 4, Division 9 — Corridors, Lobbies, Paths, Paragraph 31(b) | [BFA 2008 PDF](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BFA2008_e.pdf) | Internal corridors, lobbies, and paths with dead ends | **Obligatory Design Requirement** (dead-end specific) |
| **STD-03b** | Universal wheelchair turning space across arbitrary rooms/junctions | N/A | None (Commonly cited international 1500 mm circle heuristic) | N/A | N/A | None | General room interiors | **TBD — requires verification of applicable primary provision** |
| **STD-04** | Top of handrail between **850 mm and 950 mm** above finished floor level | Hong Kong | BD Design Manual: Barrier Free Access 2008 (2025 Edition) | 2008 (Rev. Jun 2025) | Chapter 4, Division 8 — Handrails, Paragraph 28(2) | [BFA 2008 PDF](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BFA2008_e.pdf) | Handrails associated with ramps and steps under Division 8 (not universally mandated for every flat corridor) | **Obligatory Design Requirement (Ramps/Steps)** |
| **STD-05** | Healthcare circulation corridor maintained illuminance: **200 Lux** | UK / Intl | CIBSE / SLL Lighting Guide 02: Lighting for healthcare premises | 2019 (Peer reviewed) | Circulation areas (unverified clause in licensed text) | [CIBSE LG02 Catalogue](https://www.cibse.org/knowledge-library/knowledge-items/detail?id=a0q0O00000G0l1KQAR) | Hospitals, outpatient clinics, healthcare circulation | **Source document identified; exact threshold and clause require verification from full licensed document before implementation** |
| **STD-06** | General consulting room maintained illuminance: **500 Lux** (task) / **300 Lux** (ambient) | UK / Intl | CIBSE / SLL Lighting Guide 02: Lighting for healthcare premises | 2019 (Peer reviewed) | Consulting rooms (unverified clause in licensed text) | [CIBSE LG02 Catalogue](https://www.cibse.org/knowledge-library/knowledge-items/detail?id=a0q0O00000G0l1KQAR) | Consultation and examination rooms | **Source document identified; exact threshold and clause require verification from full licensed document before implementation** |
| **STD-07** | Clinical mobility screening protocol (TUG, 30s chair stand, 4-stage balance) | USA / Intl | CDC STEADI: Algorithm for Fall Risk Screening | 2019 | Provider Clinical Algorithm | [CDC STEADI](https://www.cdc.gov/steadi) | Clinical patient intake and risk stratification | **Clinical guidance** |
| **STD-08** | Preferred rollator walker corridor clearance: **90 cm** | N/A | None (Derived from 65 cm walker width + 25 cm sway buffer) | N/A | N/A | None | Domestic & clinic walking paths | **TBD — requires OT/building-code validation** |
| **STD-09** | Maximum unsupported walking distance between handrails/resting points: **1.5 m** | N/A | None (Common clinical OT heuristic for frail elderly gait) | N/A | N/A | None | Corridor and residential transit routes | **TBD — requires OT validation** |
| **STD-10** | Universal corridor illuminance: **200 Lux** across all domestic residences | N/A | None (Domestic night lighting requires 50–100 Lux to avoid circadian disruption) | N/A | N/A | None | Private apartments and residences | **TBD — requires OT/lighting validation** |
| **STD-11** | Sharp furniture corner safety buffer: **60 cm proximity** to transit route | N/A | None (Product safety heuristic) | N/A | N/A | None | All environments | **TBD — requires OT validation** |
| **STD-12** | Rigid furniture edge corner radius threshold: **5 mm** | N/A | None (Impact mitigation heuristic) | N/A | N/A | None | All environments | **TBD — requires OT validation** |
| **STD-13** | Environmental Hazard Score composite formula & factor weights ($w_i$) | N/A | None (Engineering prototype formulation) | N/A | N/A | None | All environments | **TBD — product hypothesis requiring clinical validation** |
| **STD-14** | Risk category classification thresholds (e.g. Low $<35$, High $\ge 60$) | N/A | None (Arbitrary UI grouping) | N/A | N/A | None | All environments | **TBD — product assumption** |
| **STD-15** | Implementation cost estimates (HK$180, HK$850, HK$2400) and improvement % | N/A | None (Unbacked prototype sample values) | N/A | N/A | None | Queen Care Clinic demo plan | **TBD — product assumption** |

---

## 3. Audit of Currently Displayed Metrics & Hardcoded Claims

| Displayed Metric / Claim | Currently Displayed Value | Code Symbol & Location | True Nature of Current Implementation | Evidentiary Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Environmental Risk Index** | `68 / 100 (High Risk)` | `spatial-model.ts:935` | Hardcoded step clamped based exclusively on `chair-c04` proximity. | **Unsupported product assumption**. Must prioritize individual rule violations; composite score is experimental. |
| **Narrowest Clearance** | `54 cm` | `spatial-model.ts:576, 905` | Hardcoded literal `54` if `chair-c04` is within 50 cm of point (235, 260). | **Unsupported hardcoding**. Must be replaced with Minkowski dilation corridor calculation. |
| **Sharp Corner Clearance** | `28 cm` to table | `spatial-model.ts:593` | Static string in `INITIAL_HAZARDS[1]`. | **Unsupported static fixture**. |
| **Corridor Illuminance** | `110 Lux` / `85 Lux` | `spatial-model.ts:609`, `risk-analysis.tsx:62` | Static text in fixture descriptions; values conflict between files. | **Unsupported static fixture**. |
| **Unsupported Walking Span** | `2.1 m span` | `spatial-model.ts:623`, `risk-analysis.tsx:78` | Static text in hazard evidence string. | **Unsupported static fixture**. |
| **Trip Threshold** | `12 mm height edge` | `spatial-model.ts:653` | Static text in hazard description. | **Unsupported static fixture**. |
| **Tight S-Turn Curvature** | `42 cm radius` | `spatial-model.ts:667` | Static text in hazard description. | **Unsupported static fixture**. |
| **Alternative Risk Scores** | `41`, `27`, `19` | `spatial-model.ts:757, 785, 832` | Hardcoded constants in `LAYOUT_ALTERNATIVES`. | **Unsupported product assumption**. |
| **Retrofit Costs** | `HK$ 180`, `HK$ 850`, `HK$ 2,400` | `spatial-model.ts:759, 787, 834` | Fixed integers with no bill-of-materials takeoff. | **Unsupported product assumption**. |
| **Professional Reviewer** | "Dr. Adrian Lau, HKROT" | `mock-data.ts:147`, `ReportModal.tsx:112` | Hardcoded static string presenting a fictitious clinical sign-off. | **Non-compliant mock**. Must be replaced by real user authentication and digital sign-off. |

---

## 4. Proposed Environmental Hazard Scoring Model (Product Hypothesis — Reserved and Disabled)

Unless and until the team explicitly chooses to pursue a validated composite metric and completes the professional, intended-use, and evidence review required for that claim, the software must avoid claiming that its score predicts a resident's clinical likelihood of falling. Instead, Stage 4's primary output must be transparent individual rule violations, measurements, provenance, and severity.

A composite Environmental Hazard Score (EHS) is a reserved, disabled experimental concept. Do not calculate, implement, or display a composite score until weights and category thresholds have been reviewed and approved by relevant occupational therapy and architectural professionals. EHS cannot be used in analysis, optimization, ranking, reports, or UI. Do not describe the score as being validated by BFA, CIBSE, or CDC STEADI.

### Status of Composite Formula

No composite formula, weights, or category thresholds are approved or specified for implementation.

### Governance Rule
During Stages 1 through 4, all UI screens must prioritize:
1. Exact measured dimensions (e.g. "Measured clear width: 72 cm · Standard: 105 cm · Deficit: 33 cm").
2. The specific standard reference (e.g. "HK BFA 2008 Chapter 4 Division 4 Para 12(1)").
3. Individual hazard counts by severity level.
4. Any composite EHS is a reserved, disabled experimental concept, and must remain uncalculated and unvalidated until professional review.
