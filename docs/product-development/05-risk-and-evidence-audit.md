# Analytical Integrity, Safety Claims & Evidence Audit

## 1. Executive Summary: Evidence Posture & Clear Separation

In elder care, clinical environments, and residential planning, safety assessments must maintain absolute evidentiary transparency. Recommending inadequate doorway clearances, inaccurate turning circles, or unverified lighting thresholds directly affects physical safety and clinical trust.

### Essential Architectural Corrections
1. **Clinical Screening vs. Spatial Hazard Analysis**:
   - The CDC STEADI (Stopping Elderly Accidents, Deaths, & Injuries) framework is a **clinical screening, assessment, and intervention protocol** administered by healthcare providers to evaluate patient gait, balance, medication, and fall history.
   - **CDC STEADI does NOT supply a validated spatial floorplan risk formula or geometric penalty weighting.**
   - STEADI principles can legitimately inform user mobility profile intake (e.g. screening questions on fall history, assistive device use, and balance asymmetry), but they cannot be cited as empirical validation for a spatial algorithm.
2. **Neutral Terminology: Environmental Hazard Score**:
   - The proposed composite metric is designated as an **Environmental Hazard Score (EHS)**, not an "individual fall probability" or clinical diagnosis.
   - It represents an architectural heuristic reflecting environmental compliance and hazard severity, **not** an individual person's likelihood of falling.
   - During early stages (Stages 1–4), the system must prioritize **transparent individual rule violations and hazard severity counts** over any single composite 0–100 index.
3. **Primary-Source Standards Hierarchy**:
   - For Hong Kong environments, the primary statutory design document is the **Hong Kong Buildings Department *Design Manual: Barrier Free Access 2008* (BFA 2008)**.
   - US ADA 2010 standards and UK Building Regulations Part M are comparative international benchmarks only and must not be cited as default Hong Kong requirements.

---

## 2. Standards Traceability Matrix (Primary Sources vs. Product Assumptions)

| Rule ID | Metric / Threshold | Jurisdiction | Primary Source Document | Edition / Year | Section, Clause, or Page | Official Primary-Source URL | Applicability | Classification |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **STD-01** | Minimum clear width of accessible corridor / path: **1050 mm** | Hong Kong | BD Design Manual: Barrier Free Access | 2008 | Division 2, Section 12, Clause 12.1 | [https://www.bd.gov.hk](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/bfa2008_e.pdf) | Clinics, care facilities, commercial & public buildings | **Statutory requirement** |
| **STD-02** | Minimum clear width of doorway opening: **800 mm** | Hong Kong | BD Design Manual: Barrier Free Access | 2008 | Division 3, Section 17, Clause 17.1 | [https://www.bd.gov.hk](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/bfa2008_e.pdf) | Clinics, care facilities, accessible domestic units | **Statutory requirement** |
| **STD-03** | Minimum wheelchair turning space: **1500 mm × 1500 mm** | Hong Kong | BD Design Manual: Barrier Free Access | 2008 | Division 2, Section 12, Clause 12.2 | [https://www.bd.gov.hk](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/bfa2008_e.pdf) | Clinics, care facilities, commercial & public buildings | **Statutory requirement** |
| **STD-04** | Continuous handrail height: **850 mm – 950 mm** above finished floor level | Hong Kong | BD Design Manual: Barrier Free Access | 2008 | Division 3, Section 18, Clause 18.1 | [https://www.bd.gov.hk](https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/bfa2008_e.pdf) | Corridors and ramps in public and care buildings | **Statutory requirement** |
| **STD-05** | Healthcare circulation corridor maintained illuminance: **200 Lux** | UK / Intl | CIBSE / SLL Lighting Guide 2: Hospitals and Health Care Buildings | 2019 | Section 5.3 (Circulation areas), Table 2 | [https://www.cibse.org](https://www.cibse.org) | Hospitals, outpatient clinics, healthcare circulation | **Official design guidance** |
| **STD-06** | General consulting room maintained illuminance: **500 Lux** (task) / **300 Lux** (ambient) | UK / Intl | CIBSE / SLL Code for Lighting | 2022 | Section 7.4 (Health care premises) | [https://www.cibse.org](https://www.cibse.org) | Consultation and examination rooms | **Official design guidance** |
| **STD-07** | Clinical mobility screening protocol (TUG, 30s chair stand, 4-stage balance) | USA / Intl | CDC STEADI: Algorithm for Fall Risk Screening | 2019 | Provider Clinical Algorithm | [https://www.cdc.gov/steadi](https://www.cdc.gov/steadi) | Clinical patient intake and risk stratification | **Clinical guidance** |
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
| **Environmental Risk Index** | `68 / 100 (High Risk)` | `spatial-model.ts:935` | Hardcoded step clamped based exclusively on `chair-c04` proximity. | **Unsupported product assumption**. Must be renamed to Environmental Hazard Score and calibrated with OTs. |
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

## 4. Proposed Environmental Hazard Scoring Model (Product Hypothesis)

Until empirical multi-center clinical validation is conducted, the software must avoid claiming that its score predicts a resident's clinical likelihood of falling. Instead, the system outputs an **Environmental Hazard Score (EHS)** representing the density and severity of physical guideline deviations.

### Product Hypothesis Formula (Subject to OT Panel Review)

$$\text{EHS} = \min\left(100, \sum_{k \in \text{Hazards}} S(k) \times W(\text{profile}, k)\right)$$

Where:
- $S(k)$ is the base severity penalty of hazard $k$:
  - Critical (unpassable route, door blocked, step $> 13\text{ mm}$): $30\text{ points}$.
  - High (clearance below profile minimum, unrounded corner in sweep zone): $15\text{ points}$.
  - Medium (illuminance deficit, unsupported span $> \text{threshold}$): $8\text{ points}$.
  - Low (minor operational clutter, non-optimal turning arc): $3\text{ points}$.
- $W(\text{profile}, k)$ is a profile vulnerability multiplier ($1.0\dots1.5$) reflecting specific user limitations (e.g. a low-light deficit is weighted higher for a user with limited vision).

### Governance Rule
During Stages 1 through 4, all UI screens must present:
1. Exact measured dimensions (e.g. "Measured clear width: 72 cm · Standard: 105 cm · Deficit: 33 cm").
2. The specific standard reference (e.g. "HK BFA 2008 Clause 12.1").
3. Individual hazard counts by severity level.
4. Composite EHS marked as an advisory product heuristic.
