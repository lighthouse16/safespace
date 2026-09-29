# SafeSpace Technical & Clinical Risk Register

## 1. Top Five Highest-Priority Technical Risks

| Rank | Risk ID | Description & Immediate Trigger | Technical Impact | Clinical & Product Severity | Mitigation Strategy | Assigned Stage |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **TECH-01** | **Unvalidated AI Hallucination in Floorplan Dimensions & Hazards**<br>Trigger: Relying on generative LLMs/multimodal models to extract dimensions, calculate clearances, or invent hazards without deterministic geometric validation. | System displays physically impossible or distorted floorplan dimensions; clearances are inaccurate. | **Catastrophic**: An older adult or OT relies on a false clearance, resulting in walker entrapment or falls. | Strict architectural isolation: AI vision is limited to initial raster drafting with **mandatory human confirmation**. All measurements, clearances, collisions, and risk scores are computed by deterministic math. | Stage 1 & Stage 4 |
| **2** | **TECH-02** | **Total Browser Refresh Data Loss & False Persistence Claims**<br>Trigger: System advertises "All changes saved" while state exists exclusively in volatile Zustand in-memory state. | Accidental page reload, browser crash, or session timeout instantly erases all customized layouts and OT reviews. | **High**: Clinicians and facility managers lose hours of spatial analysis, eroding product trust immediately. | Implement offline-first IndexedDB persistence with debounced auto-save in Stage 1 before building further UI features. | Stage 1 |
| **3** | **TECH-03** | **Three.js WebGL Rendering Crashes & Context Exhaustion**<br>Trigger: Absence of React error boundaries around `<Canvas>`, removed APIs in Three.js r186, external font loading failures in Drei `<Text>`, and dual canvas instantiation in Stage 5. | Total white-screen crash (`error.tsx`) when switching between 2D and 3D or comparing layouts on mobile/GPU-constrained devices. | **High**: Complete user flow disruption; renders 3D digital twin unusable in clinical presentations. | Wrap `<Canvas>` in `Spatial3DErrorBoundary` with automatic 2D fallback, remove remote font fetching, and use single-canvas viewport splitting for Stage 5. | Stage 6 |
| **4** | **TECH-04** | **Hardcoded Single-Object Metric Evaluation (`chair-c04` Locking)**<br>Trigger: `calculateLiveMetrics` queries hardcoded ID `chair-c04` and coordinates `(235, 260)`. | Arbitrary floorplans cannot be evaluated. Moving other obstacles does not alter metrics; deleting `chair-c04` permanently locks risk score into safe state. | **Critical**: The product cannot function beyond the single demo fixture, blocking commercial adoption. | Build a general polygon-line clearance engine based on Minkowski corridor dilation and A* pathfinding. | Stage 3 & Stage 4 |
| **5** | **TECH-05** | **Architectural & State Duplication between Stepper SPA and Multi-Page Routes**<br>Trigger: Coexistence of two divergent stores (`safespace-store.ts` vs `assessment-store.ts`), two 2D renderers, two 3D renderers, and two hazard models (7 vs 4 hazards). | Divergent bug fixes, code drift, test inconsistencies, and developer confusion. | **Medium-High**: Escalating maintenance cost and regression surface across stages. | Fully retire the legacy multi-page prototype in Stage 1; consolidate around the canonical domain model and unified store. | Stage 1 |

---

## 2. Comprehensive Multi-Axis Risk Matrix

### Clinical & Safety Risks

| Risk ID | Risk Title | Probability | Impact | Risk Level | Description | Mitigating Action |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **CLIN-01** | **False Sense of Environmental Safety** | High | Critical | **CRITICAL** | A resident or caregiver sees a low risk score (e.g. 19/100) and assumes an environment is 100% safe, failing to address unmonitored hazards (e.g. wet tiles, pet hazards). | Explicit disclaimers on every screen and report: "SafeSpace provides spatial decision support; it does not guarantee fall prevention or replace professional clinical evaluation." |
| **CLIN-02** | **Fictitious Clinical Credentialing Liability** | Medium | High | **HIGH** | Displaying pre-filled sign-offs ("Dr. Adrian Lau, HKROT") in downloadable reports could constitute fraudulent misrepresentation. | Remove hardcoded professional names; replace with authenticated OT signature and license input fields. |
| **CLIN-03** | **Inappropriate Assistive Device Clearances** | Medium | Critical | **HIGH** | Applying standard walking-stick clearances (75 cm) to a bariatric rollator user (90+ cm), leading to route impaction. | Require explicit selection of mobility profile and display warning if selected profile envelope exceeds corridor width. |

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
| **LEGAL-02** | **Building Code Non-Compliance Liability** | Low | High | **MEDIUM** | Layout recommendations violating local fire egress codes (e.g., placing furniture within primary fire escape routes). | Integrate minimum egress corridor rules ($1.05\text{ m}$ in public buildings) and mark egress paths as non-blockable zones. |

---

## 3. Risk Monitoring & Stage Gate Governance

- **Stage Gate Checkpoints**: At the conclusion of each stage (Stage 1 through Stage 9), the Risk Register must be reviewed.
- **Closure Criteria**: A risk cannot be marked "Mitigated" until corresponding unit tests, integration tests, or architectural boundaries have been implemented and verified.
- **Stage 0 Status**: All listed risks are currently **ACTIVE** and documented as baselines for subsequent implementation stages.
