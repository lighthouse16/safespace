# SafeSpace Technical & Clinical Risk Register

## 1. Top Five Highest-Priority Technical Risks

| Rank | Risk ID | Description & Immediate Trigger | Technical Impact | Clinical & Product Severity | Mitigation Strategy | Assigned Stage |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **TECH-01** | **Unvalidated AI Hallucination in Floorplan Dimensions & Hazards**<br>Trigger: Relying on generative LLMs/multimodal models to extract dimensions, calculate clearances, or invent hazards without deterministic geometric validation. | System displays physically impossible or distorted floorplan dimensions; clearances are inaccurate. | **Catastrophic**: An older adult or OT relies on a false clearance, resulting in walker entrapment or falls. | Strict architectural isolation: Stage 2 intake is 100% manual and deterministic. Stage 7 AI vision is limited to optional draft geometry with **mandatory human confirmation**. All measurements, clearances, collisions, and individual rule findings are computed by deterministic math. | Stage 2 & Stage 7 |
| **2** | **TECH-02** | **Total Browser Refresh Data Loss & False Persistence Claims**<br>Trigger: System advertises "All changes saved" while state exists exclusively in volatile Zustand in-memory state. | Accidental page reload, browser crash, or session timeout instantly erases all customized layouts and OT reviews. | **High**: Clinicians and facility managers lose hours of spatial analysis, eroding product trust immediately. | Implement offline-first IndexedDB persistence with debounced auto-save in Stage 1 before building further UI features. | Stage 1 |
| **3** | **TECH-03** | **Three.js WebGL Rendering Crashes & Context Exhaustion**<br>Trigger: Crash reproduced on deployed app; exact root cause remains unresolved (candidate hypotheses: WebGL context loss on mobile/constrained GPUs, unhandled errors, memory exhaustion, remote Drei `<Text>` font loading). Absence of error boundary allows 3D failures to crash global workspace shell. | Total white-screen crash (`error.tsx`, "Workspace could not load") when switching between 2D and 3D or comparing layouts on GPU-constrained devices. | **High**: Complete user flow disruption; renders 3D digital twin unusable in clinical presentations. | Stage 1: Add defensive error boundary around `<Canvas>` with graceful 2D fallback to protect core user flow. Stage 6: Complete root cause isolation, eliminate remote font fetching, implement single-canvas viewport splitting for Stage 5, and full 3D twin hardening. | Stage 1 & Stage 6 |
| **4** | **TECH-04** | **Hardcoded Single-Object Metric Evaluation (`chair-c04` Locking)**<br>Trigger: `calculateLiveMetrics` queries hardcoded ID `chair-c04` and coordinates `(235, 260)`. | Arbitrary floorplans cannot be evaluated. Moving other obstacles does not alter metrics; deleting `chair-c04` permanently locks risk score into safe state. | **Critical**: The product cannot function beyond the single demo fixture, blocking commercial adoption. | Build a general polygon-line clearance engine based on Minkowski corridor dilation and A* pathfinding. | Stage 3 & Stage 4 |
| **5** | **TECH-05** | **Architectural & State Duplication between Stepper SPA and Multi-Page Routes**<br>Trigger: Coexistence of two divergent stores (`safespace-store.ts` vs `assessment-store.ts`), two 2D renderers, two 3D renderers, and two hazard models (7 vs 4 hazards). | Divergent bug fixes, code drift, test inconsistencies, and developer confusion. | **Medium-High**: Escalating maintenance cost and regression surface across stages. | Fully retire the legacy multi-page prototype in Stage 1; consolidate around the canonical domain model and unified store. | Stage 1 |

---

## 2. Comprehensive Multi-Axis Risk Matrix

### Clinical & Safety Risks

| Risk ID | Risk Title | Probability | Impact | Risk Level | Description | Mitigating Action |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **CLIN-01** | **False Sense of Environmental Safety** | High | Critical | **CRITICAL** | A resident or caregiver sees a low hardcoded risk score in the current prototype (e.g. 19/100) or an unvalidated composite score and assumes an environment is 100% safe, failing to address non-spatial hazards or confusing spatial hazard identification with clinical patient fall screening (CDC STEADI). | Keep composite EHS disabled; prioritize transparent individual rule findings, measured values, and exact deficits rather than composite scores; separate environmental hazard identification from clinical patient screening; display prominent disclaimers on every screen and report: "SafeSpace provides spatial decision support; it does not guarantee fall prevention or replace professional clinical evaluation." |
| **CLIN-02** | **Fictitious Clinical Credentialing Liability** | Medium | High | **HIGH** | Displaying pre-filled sign-offs ("Dr. Adrian Lau, HKROT") in downloadable reports could constitute fraudulent misrepresentation. | Remove hardcoded professional names; replace with authenticated OT signature and license input fields. |
| **CLIN-03** | **Inappropriate Assistive Device Clearances** | Medium | Critical | **HIGH** | Applying one generic mobility-envelope value to users with different assistive devices, body dimensions, gait patterns, or turning needs can create false clearance results. | Capture device/user-specific dimensions or use thresholds from a verified rule registry; require professional confirmation where appropriate. |
| **CLIN-04** | **Unvalidated Arbitrary Spatial Thresholds** | High | High | **HIGH** | Hardcoding unvalidated thresholds (90 cm walker clearance, 1.5 m support span, 200 lux residential, 60 cm corner proximity, 5 mm thresholds, cost weights) without statutory backing or OT validation creates false hazard flags or false reassurance. | Explicitly classify unvalidated values as "TBD — requires OT/building-code validation"; anchor enforceable rules in primary statutory codes (HK BFA 2008); require full licensed document verification for CIBSE LG02 guidance before implementation; require validation gate before pilot. |

### Technical & Architectural Risks

| Risk ID | Risk Title | Probability | Impact | Risk Level | Description | Mitigating Action |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **TECH-06** | **Heuristic Solver Stagnation** | High | Medium | **MEDIUM** | In Stage 5, the constraint solver fails to find a valid furniture arrangement in a small, cluttered room without violating door swings. | Provide fallback to manual assisted tweaking mode with real-time collision guidelines. |
| **TECH-07** | **Headless Test Delays via DOM Canvas** | High | Low | **LOW** | Konva / HTML5 Canvas imports slow down `npm test` by 5+ seconds in Node.js headless environments. | Isolate headless test suites from visual canvas wrappers; mock canvas primitives in test environment. |
| **TECH-08** | **WebGL Context Loss on Low-End Tablets** | Medium | High | **HIGH** | Occupational therapists conducting field visits on low-end iPads or Android tablets experience GPU context loss. | Enable low-power WebGL mode and provide 1-click toggle to disable 3D in favor of crisp 2D vector plans. |

### Regulatory, Legal & Privacy Risks

| Risk ID | Risk Title | Probability | Impact | Risk Level | Description | Mitigating Action |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **LEGAL-01** | **Patient Residence Identifiable Data Leak** | Medium | High | **HIGH** | Floorplans of private homes containing resident names, floor numbers, and daily routines uploaded to third-party AI APIs. | Strip PII before sending floorplans to cloud models; provide local-only processing mode for sensitive health facilities. |
| **LEGAL-02** | **Building Code Non-Compliance Liability** | Low | High | **MEDIUM** | Layout recommendations violating local fire egress codes (e.g., placing furniture within primary fire escape routes). | Model accessible routes and fire-egress routes as separate protected route types. Apply only verified, jurisdiction- and building-type-specific rules from the applicable BFA and fire-safety codes. Until the fire-egress provision is verified, do not display a numeric egress-width threshold. |
| **LEGAL-03** | **Premature Medical Device Classification & Unverified Clinical Claims** | Medium | High | **HIGH** | Presenting SafeSpace as a regulated medical diagnostic or clinical intervention tool without formal SaMD assessment. | Position product strictly as environmental decision support; condition any medical claims on formal intended-use determination, IRB approval, and regulatory compliance. |

---

## 3. Risk Monitoring & Stage Gate Governance

- **Stage Gate Checkpoints**: At the conclusion of each stage (Stage 1 through Stage 9), the Risk Register must be reviewed.
- **Closure Criteria**: A risk cannot be marked "Mitigated" until corresponding unit tests, integration tests, or architectural boundaries have been implemented and verified.
- **Stage 0 Status**: All listed risks are currently **ACTIVE** and documented as baselines for subsequent implementation stages.

