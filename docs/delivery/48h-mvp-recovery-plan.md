# SafeSpace — 48-hour MVP delivery and backend takeover

Status: **PROPOSED DELIVERY PLAN; do not treat as completed implementation.**

Owner: product technical lead / reviewer. Implementer: Antigravity coding agent, supervised through gated PR reviews. Original research collaborators retain ownership of model experiments unless reassigned explicitly.

Baseline: `main` at `a860f03103521f0d7e0c5caf807642a3f22c5e2a`, approved frontend Stage 3 Draft PR #5 at `544aca0d82adcb8f7a5935521cee67f1e2f3b6d8` (check live GitHub status before any merge). The official product scope and architecture remain `docs/product-development/{00-product-scope,03-domain-model-audit,06-target-architecture,07-stage-implementation-plan,08-risk-register}.md`.

## Delivery interpretation

**48-hour objective: an honest, reliable, demonstrable single-user MVP**, not a clinically validated or production-ready healthcare platform. The complete user story should function with one properly calibrated/manual floorplan and the explicit Queen Care Clinic Demo Fixture:

1. Create/import an assessment, calibrate, draft/confirm geometry.
2. Open that exact user-confirmed scene in the canonical workspace (currently missing bridge).
3. Select mobility profile and author functional route(s), with deterministic route feasibility and clearance.
4. Display evidence-backed individual spatial findings and uncertainties, not an invented numeric fall-risk index.
5. Try deterministic, geometrically valid layout improvements; clearly say when no solution exists.
6. Compare before/after in usable 2D, and show consistent 3D only where proven stable.
7. Review findings and print/export a report whose measurements match current canonical state.
8. Never lose the only assessment on simple page reload (local persistence or explicit clearly documented fallback).

**Out of scope for the 48-hour gate unless independently finished and verified:** medical diagnosis, individual fall probability, legal compliance certification, clinical validation, tenant accounts, production auth/billing, enterprise collaboration, hosted GPU, fully automated floorplan recognition, real-world fall-outcome effectiveness, unsupported sensor efficacy claims.

## Authoritative separation

- Single canonical 2D centimetre scene. 3D = same geometry rendered in metres.
- Route feasibility, dimensions, clearance, intersections and candidate filtering = deterministic engine, no AI.
- Statutory/clinical rule: activate only with exact primary-source reference, jurisdiction, applicability, verified numeric threshold and clear provenance. Otherwise show measured geometry + **Needs professional review / requirement unavailable**, not a statutory pass/fail claim.
- Composite riskIndex/EHS 0–100, hardcoded Queen Care score/price/clearance and fictional reported gains must be removed from live analysis, compare and report surfaces.
- Generated drafts cannot replace a calibrated, user-confirmed scene. No automatic hallucinated room dimensions.
- No secret/token/working ngrok URL/model weights in Git. No live Colab dependency in default workflow.
- Every task: branch from latest main, focused Draft PR, tests, typecheck/lint/build, reviewer pass before merge. No frontend-vs-backend unilateral rewrites.

## Notebook / backend research audit (2026-10-08)

Artifact inspected: user-provided `hackathon.ipynb` (19 cells), **not committed** because it contains runtime outputs including a public ngrok URL and environment-specific instructions. Publish only a sanitized, outputs-stripped version in a separately reviewed research PR if genuinely necessary.

Observed notebook workflow:
- Clones upstream `Graphic-Kiliani/M3DLayout-code`, pulls a 553 MB checkpoint from an individual's Google Drive; local Colab Tesla T4, Python 3.13, PyTorch 2.11/CUDA 13; unpinned upstream HEAD/dependencies.
- `pytorch-fast-transformers` build failed; creates hand-written replacement of masking, attention, encoder, and builder classes under upstream's `fast_transformers` package name.
- Encoder submodule reports 66 matching checkpoint tensors; this verifies key/shape matching, **not** end-to-end numerical equivalence of the altered attention implementation.
- FastAPI `POST /generate` returns text, object classes, translations, half sizes and rotations; notebook captured HTTP 200 and 14 generated objects for a living-room request.
- Output includes unwanted categories (e.g. extra wall art, desk/monitor/cabinet for a sofa/coffee-table/TV request). It is text-to-3D layout synthesis, not measurement-grounded floorplan reconstruction, safety analysis or prompt-fidelity proof.
- Colab/ngrok process is manually started, CORS allows all origins, API has no auth/rate limit, input controls/structured output checks are insufficient; checkpoint is not pinned/hash-verified. Notebook code references a secret stored in Colab's secret manager; **never copy credentials**.
- Upstream published work addresses **text-conditioned 3D indoor scene layout**, not validated geometry extraction from real clinic floorplans. Licensing of code/weights and inherited dependencies must be checked before redistribution. See https://github.com/Graphic-Kiliani/M3DLayout-code and CVPR 2026 publication.

**Disposition**: preserve as independent research/spike, gated behind an optional feature flag and never feed unverified geometry into canonical safety computations. Do not spend the main 48-hour critical path retraining/debugging it. A suitable provider-based, optional AI drafting service can be integrated after honest core E2E flow.

## Priority-ordered execution gates

### Gate 0 — Integrate the approved baseline (first)
- Verify PR #5 HEAD and base against current origin; merge only if unchanged and approved; sync main; clean worktree and full quality gates.
- Record precise resulting SHA, screenshots and test count.
- If PR changed, stop and request re-review.

### Gate 1 — Real intake → canonical workspace (critical)
- Bridge the Stage 2 calibrated boundary and intake metadata to canonical scene; explicit px-to-cm transform, reversible checks, accurate units and no silent demo fallback.
- User draws/validates polygon, opening and 1–2 pieces of furniture or uses an honest blank/manual scene.
- Distinguish assessment-scoped user scene from the explicit Queen Care Demo Fixture; route/profile always read the current scene; use unsupported-input states rather than fabricated completions.
- Add local persistence across reload for confirmed drafts if achievable cleanly (no tokens/PII cloud).
- E2E test: new assessment → calibrate → confirm → workspace → refresh → same geometry → route change when obstacle moves.

### Gate 2 — Evidence-bound individual findings
- Implement a deterministic finding registry/evaluator using current core spatial measurements.
- Deliver first genuine findings: blocked/unreachable route, measured width/clearance margin, obstacle encroachment, door-swing intersection when valid opening geometry is confirmed.
- A finding contains measured value/unit, provenance, optional sourced requirement, status/unknown, severity only if grounded, and review status.
- Remove/replace hardcoded riskIndex, hazard counts, recommendations, fake lux and unsupported prices on Stage 4/5/report. Do not activate unverified BFA/CIBSE thresholds or infer lux from imagery.

### Gate 3 — Verified layout improvements and review/export
- Candidate furniture translations/rotations constrained to confirmed room polygons, fixed walls/doors, no new collisions and all applicable verified requirements. Deterministic and reproducible.
- Present 1–3 **actually distinct and validated** alternatives if feasible; never promise three if fewer exist. No invented HKD costs.
- Before/after compares the same canonical scene and dynamically recomputed findings/routes. Manual reviewer acceptance/rejection.
- Printable/downloadable report can be browser-native HTML/Print-to-PDF; all evidence traced to scene snapshot and rule. Never imply formal OT sign-off where none exists.

### Gate 4 — 3D and end-to-end release
- 3D consumes exactly same canonical entities, stays in sync after moves, safe fallback to 2D and no unsupported path/metric overlays.
- Regression flows across desktop/tablet/mobile + invalid/upload failures, no demo contamination.
- Verify repository CI or local gates, static deployment, privacy wording, no secrets, smoke test.
- Freeze features; list deferred clinical/enterprise capabilities honestly.

### Parallel research track (NOT A GATE BLOCKER)
- Capture M3DLayout version/checkpoint provenance and license, safe reproducible benchmark, outputs with 5–10 fixed prompts and seeds, exact requested-vs-generated object coverage, count of unexpected objects, latency, memory and failure cases.
- Compare original-attention implementation numerically when feasible. If not, mark `UNVERIFIED`.
- Prefer robust provider abstraction for later optional image-to-draft work; do not auto-deploy ngrok endpoint.

## Review discipline

Every gate must attach: HEAD SHA, changed-file list, precise UI repro steps, truthful demo-vs-user-input states, core input/output examples, tests (including negative cases), screenshots at 1440x900 / 768x1024 / 390x844 where applicable, lint/typecheck/build, and an explicit STOP. Approval must come from reviewer, not the implementer's own summary. No unreviewed merge. If a feature cannot be done reliably in time, degrade gracefully and mark it deferred rather than fabricating results.
