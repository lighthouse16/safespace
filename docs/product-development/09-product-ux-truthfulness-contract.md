# SafeSpace — Product UX & Truthfulness Contract

**Status:** Proposed technical-lead product contract, for review. Source audit 2026-10-09. This is NOT an implementation-completion claim. Apply to all user-facing SafeSpace surfaces after Gate 3 correctness approval. No clinical/statutory certification is implied.

## 1. Who the product is for; one primary task

**Primary operator for this MVP:** clinic/property staff, occupational therapy / safety review professionals and facility managers. **Beneficiaries:** older people using the spaces. The operator's real task is:

**Create a floor plan → confirm its measured scale/geometry → choose the relevant mobility profile → define a walking route → understand observable 2D obstructions and unknowns → compare viable repositioning proposals → choose whether to apply → export/share a clearly scoped draft.**

The product is an environmental 2D spatial decision aid, not a fall-risk predictor, engineering compliance certificate, photometer, professionally signed OT report or generic AI interior decorator.

**Design priority:** task success and trust > clarity > consistency/accessibility > aesthetics. No invented measurements, decorative AI flourishes, pseudo-progress or feature claims.

## 2. Hard boundaries (stop-ship)

1. **One source of truth:** active canonical scene in centimetres. Candidate/preview snapshots MUST NOT overwrite canonical route or report, and all before/after numbers must be computed from matching scene snapshots. Null = unknown, never 0. Stage 4 / report remain canonical after preview.
2. **Single live workflow:** `/assessments` → `/assessments/new` or labelled sample → canonical `/` workspace → draft report. No separate old hardcoded `/assessments/queen-care-clinic/{model,analysis,options,report}` and `/reviews/queen-care-clinic` routes presented as live/current assessment. Audit and route existing deep links to a truthful entry, without breaking static-export deployment.
3. **No invented sources:** no static risk indices (68/27), lux (85/110/200 without measurements or independently verified applicable source), fabricated clearance (54→96), HKD costs, invented compliance/pass, fictitious licensed therapist names/signatures, automated 'AI-extracted' claims or unsupported "confidence". If needed for an intentionally separate story illustration, it must never look like measured results and never mix with actual report.
4. **No simulated processing:** the current `AnalysisTransition.tsx` displays a fixed 2.1-second progress narrative including photometric evaluation and Queen Care context even for a user's space, while actual evaluation is deterministic. Remove faux timeline/progress. Show immediate results, or real pending feedback tied to actual processing only.
5. **No unverified 3D:** the existing `Floorplan3D.tsx` still renders a fixed 8.4m×6.4m slab, legacy hazards, demo-specific furniture IDs, and waypoint chords. Until it renders the same canonical boundary/route/findings as 2D, keep it inaccessible as *spatial evidence*; do not display a grayed-out public button advertising an internal delivery phase.
6. **Honest saving:** local-only persistence matters when a user might lose work; state this **at the decision point** (confirmation/deletion/device transfer), in plain language. Never falsely say saved if storage fails; never silently discard edits or source uploads.
7. **Accuracy before appearance:** do not remove a necessary warning simply to make an interface look minimal. Place limitations in a concise "How this assessment works" / "What was not checked" disclosure and report footnote, while keeping user task controls prominent.

## 3. In-scope vs internal: UI copy rules

| Current source copy (examples) | User-facing replacement / treatment |
|---|---|
| `Session only`, `in-memory state`, `localStorage v1` | Remove ongoing badges. If editing an unsaved draft: only when leaving, **"Leave without saving? Your changes will be lost."** If confirming: **"Saved on this device. It won't appear automatically on other devices."** |
| `Gate 3`, `Stage 5`, `solver budget`, `evaluation budget`, `post-MVP` | Never reveal implementation phases. Say **"Improve layout"**, **"Find alternatives"**, or simply hide deferred controls. Debug counters in development diagnostics only. |
| `Demo Fixture`, `Unverified Inputs`, `DEMO-PRESET-WALKER` | Use **"Example clinic"** / **"Sample layout"** (sample label retained to avoid presenting examples as real); mobility inputs **"Suggested starting values — check for your situation"**, not fabricated code citation. |
| `3D Analysis Pending` / disabled controls | Hide entirely until genuinely supported. Do not show a roadmap item as a clickable/disabling UI affordance. |
| `Session review`, `canonical boundary`, `assessment metadata`, `px/cm` | **"Review your space"**, **"Room outline"**, **"Assessment details"**. Scale unit details only when editing calibration or inspecting measurements. |
| `Run Safety Analysis`, `certifies`, `Meets Standard`, `optimal/safest` | **"Check walking route"** / **"Review findings"** / **"No issues found in the checked 2D measurements"** ONLY when route evaluated; explicitly not a general safety/compliance determination. |
| `0 deficits` in an unconfigured assessment | **"Add a walking route to check clearance"**, NOT "safe"/green pass. |
| `Infeasible` after 60 sampled proposals | **"No suitable alternative found in this search. You can adjust the layout manually."** Do not imply mathematical impossibility. |
| Technical route error / numeric radius-vs-width | Plain English primary reason, action to fix, precise width/radius labels in optional details; never conflate distance to nearest obstruction with whole corridor width. |
| `AI confidence` without actual model-backed evidence | Remove the assertion. A sample is a sample, manually traced geometry is user-confirmed, not AI-detected. |
| `Simulate Gait` for a moving marker | **"Preview route"**, avoiding claims of a biomechanical gait simulation. |

All user-visible text is professional, calm, concise English (no exclamation marks, gratuitous emojis, 8–10px microtype, gradient glow, arbitrary numeric KPI rings or fake green safety badges). Use a small neutral palette, consistent spacing/type scale, distinct neutral/attention/error/success semantics. Avoid repetitive disclaimer banners.

## 4. Information architecture and interactions

- **Assessments**: prominent **New assessment**, one current saved assessment (MVP limitation), and a clearly labelled **Explore sample**. No meaningless session banner, raw vertices/px/cm or internal save schema on overview. No duplicate "View analysis demo" linking to mock legacy view.
- **New assessment**: 4 steps are fine if evidence shows users need them; user names room, selects source, calibrates by specifying a known length, traces room outline, and confirms. PNG/JPEG/SVG are visual draft references; PDF visual preview-only until proven otherwise. Don't offer unavailable CAD import as an actual feature. Confirmed outline persists; uploaded background may not persist; give this limitation at review if it matters for future editing.
- **Workspace**: one clear active space name and succinct task progress (Plan, Mobility, Route, Findings, Improve). Keep expert geometry controls inside appropriate panels. No nested duplicate steppers/menu bars. Use fewer visible controls on mobile; at least one obvious primary action.
- **Add furniture**: current `addFurniture` always spawns at (240,200) regardless of room boundary. Place only at a demonstrated valid in-room position or allow user to place deliberately, with clear errors. No unexplained out-of-room object.
- **Mobility**: presets are editable starting points not clinical mandates. Expose clearance width with a brief explanation; don't imply turning-space geometry was tested when pathfinder doesn't model nonholonomic turns. Hide fall history if it doesn't change any evaluated rule; never suggest individual fall prediction.
- **Route**: user chooses start and destination; show computed accessible/blocked/unknown. Optional movement preview should follow computed path, not pretend to simulate human gait.
- **Findings**: put measured issue and next action first, more detail + measurement provenance on expand. Unassessed categories are grouped **"Not checked"**, not repeated hazard badges. Zero observed findings is not a safety certificate.
- **Improve**: show verified candidate(s) only, exact affected furniture, compared route and finding changes, simple Apply/Cancel, durable undo where supported. Manual preview editing absent? Do not advertise it. Don't label proposals globally optimal/safest. Hide solver counters unless a diagnostic mode explicitly requested.
- **Report**: only canonical accepted scene by default. Clearly identify evaluation date and scope; route not configured = not assessed. Print-friendly, never fictitious professional name/signature/cost. Do not imply a reviewer signed off unless a named real reviewer explicitly did so through working flow.
- **Save & navigation**: destructive reset/replacement/delete confirmed in one concise dialog; successful saves unobtrusive; errors specific and recoverable. No faux loading stages.

## 5. Accessibility / responsive contract

Target WCAG 2.2 AA as product baseline, but don't claim conformance without verification. WCAG 2.2 SC 2.5.8 sets 24×24 CSS px minimum target OR documented spacing/equivalent exceptions; for primary touch actions aim at least 40×40 to be comfortable. Support visible focus, semantics/labels, keyboard route/geometry alternatives, error message adjacent to source and logical focus after modal, readable text (default body ~14–16px instead of existing 9–11px critical labels), no text clipped at 200% zoom and usable at 390×844 / 768×1024 / 1440×900.

References:
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.nngroup.com/articles/progressive-disclosure/
- https://www.nngroup.com/articles/error-message-guidelines/

## 6. Deep verification — mandatory agent evidence

**Never treat agent self-report as independent approval.** Output of a command and visual screenshots are claims until reviewer checks relevant artifacts against exact PR SHA.

A. **Truth-source inventory:** enumerate every public route (static export produces 13), accessible link, real user action, displayed number, confidence, legal standard, named review credential, 3D claim and mock object. For each, cite file:line, input/source, transformation, user claim, and verdict `REAL / SAMPLE LABELED / UNKNOWN / BLOCK`. User-visible `AI-extracted` cannot stand without real corresponding provider output.

B. **State-transition attack matrix:** demo ↔ user, new assessment draft↔confirmed, Save failure/quota/private mode, candidate select/apply/revert, reload, after-Apply edits, offline, route unset/invalid/blocked, invalid polygons, concave boundary, mobile navigation, print. For every transition assert accepted canonical scene, persisted version, non-mutation of preview, correct report and no stale mock. Test **actual UI**, not only store methods.

C. **Property-based / bounded brute-force tests:** for small rectangular and concave polygons enumerate shapes, obstacles, waypoints and 90° rotations; compare against independent geometry oracles where feasible. Metamorphic invariants: translating entire scene by a vector preserves route feasibility and clearance; rotating the complete scene 90° preserves scale; object order permutation doesn't change physical findings; candidate selection has no side effects; Apply→Revert roundtrips exact geometry; physically invalid inputs fail closed. Generate reproducible random cases with recorded seed, shrink failures, near-touching edges, self-intersection, floating-point values, unmeasured paths. A finite search is NOT proof of optimality or proof of arbitrary real-world safety.

D. **Performance evidence:** measure realistic scenes incl. dense 18-object sample and larger L-shape with fixed deterministic budget; record p50/p95 on target browser and interaction latency; no unsupported 'non-blocking' claim merely because evaluator loops are bounded. If UI freezes, schedule/yield work or reduce search appropriately.

E. **Practical usability runs:** record a video/repro steps for nontechnical operator: 1) new calibrated assessment and one walking route; 2) find what is blocked, why, what hasn't been checked; 3) compare candidate and apply/revert after reload. Include actual screenshot or screencast artifacts accessible to reviewer in PR (not only `C:\...` local absolute paths). At 390/768/1440, check horizontal scroll, occluded controls, focus/keyboard, pointer targets, error recovery, empty/unknown screens. Explain screenshots by exact commit SHA and state.

F. **Release gate:** exhaustive grep/AST or equivalent audit of all user-facing components; no `Session only`, `Gate [0-9]`, `localStorage v1`, `AI-extracted`, `riskIndex`, fake lux/HKD/OT signature exposed by reachable routes. Preserve meaningful limited-scope disclosures and sample labeling. Run diff check, typecheck, lint, test, build and deployed static smoke test.

## 7. Sequencing

1. **Finish PR #13 Gate 3 data correctness; do not approve while scene/report/revert mix-ups remain.**
2. **P0 public truthfulness hotfix**: remove/replace user navigation into old mock clinic analysis/options/report/review routes; fix simulated progress; no unsupported AI/licensed reviewer/site measurements. Ensure legacy deep links are truthful under GitHub Pages static export.
3. **Focused UX pass**: implement this contract with small, reversible changes, prioritize the primary path over surfaces that don't help task completion.
4. **3D only if canonical and robust**; otherwise keep hidden and ship trustworthy 2D.
5. Final browser E2E and release smoke test. Optional AI remains noncritical and can be skipped if not verifiable.

**Reviewer's question on every visible feature:** What job does this help the operator complete *now*? If none, remove/hide. If a safety/measurement claim exists, where is its actual evidence?
