# Foundation Gate 0 — canonical frontend and future integration

Baseline `origin/main`: `0a61d08f5e5d9acab98bb0152e3339ff0b563348`. UI V2 preservation: `6edbbe22cada056bed0e06b33daa26fba608e963`, `950639108ce71d45890f12ccb61c2873bb5428e9`; merge `35615d3589695b838e32078113794bffc9d5c29e` (merge-base equals baseline). No server features in Gate 0.

## Canonical routes

| Path | Owner |
|---|---|
| `/` | Public landing (`src/app/page.tsx`) |
| `/assessments` | Local assessments (`src/app/assessments/page.tsx`) |
| `/assessments/new` | Intake: details, source, calibration/draw, review |
| `/workspace` | Layout, Profile, Routes, Analysis, Improve; report modal |

Unknown/retired paths must show 404. Canonical spatial engine: `src/lib/spatial/**`, `src/lib/spatial-model.ts`. Editor: `src/store/safespace-store.ts`, `src/components/spatial/Floorplan2D.tsx`. Browser persistence: `src/lib/storage/**`; typed seam: `src/lib/services/assessment-repository.ts`. Public UI owns marketing only; intake/workflow UI consumes domain and store; pure domain never imports React. Keep `src/components/workflow/ReportModal.tsx` and valid spatial/storage tests.

## Removed-file manifest

Each path below was checked against active route/import/test graph. Removed route files only rendered retirement-era mock screens; editor/analysis/options/review/report modules and mock store/data were orphaned or used exclusively by those routes. Legacy-only tests imported deleted mock implementations, not canonical engine; canonical spatial/storage/workflow tests retained. Do not reintroduce these modules as alternate frontend.
- `src/app/assessments/queen-care-clinic/analysis/page.tsx`
- `src/app/assessments/queen-care-clinic/model/page.tsx`
- `src/app/assessments/queen-care-clinic/options/compare/page.tsx`
- `src/app/assessments/queen-care-clinic/options/page.tsx`
- `src/app/assessments/queen-care-clinic/report/page.tsx`
- `src/app/reports/queen-care-clinic/page.tsx`
- `src/app/reviews/page.tsx`
- `src/app/reviews/queen-care-clinic/page.tsx`
- `src/components/analysis/hazard-detail.tsx`
- `src/components/analysis/index.ts`
- `src/components/analysis/risk-analysis.tsx`
- `src/components/editor/editor-controls.tsx`
- `src/components/editor/editor-model.ts`
- `src/components/editor/editor-shell.tsx`
- `src/components/editor/floorplan-2d.tsx`
- `src/components/editor/floorplan-3d.tsx`
- `src/components/editor/floorplan-drag.ts`
- `src/components/editor/index.ts`
- `src/components/options/index.ts`
- `src/components/options/options-compare.tsx`
- `src/components/report/assessment-report.tsx`
- `src/components/report/index.ts`
- `src/components/report/report-data.ts`
- `src/components/review/decision-modal.tsx`
- `src/components/review/index.ts`
- `src/components/review/review-workspace.tsx`
- `src/components/shell/workspace-shell.tsx`
- `src/lib/mock-data.ts`
- `src/lib/types.ts`
- `src/store/assessment-store.ts`
- `tests/domain.test.ts`
- `tests/floorplan-drag.test.ts`
- `tests/risk-analysis.test.ts`
## Future ownership and typed contract inventory

| Capability | Gate 0 owner | Gate 1 requirement |
|---|---|---|
| Assessment CRUD | Single local browser assessment; `AssessmentRepository` | User-scoped create/list/get/update/delete, revisions, authorized overwrite/delete, migration without silent loss |
| Floorplan upload/storage | Browser validation, IndexedDB media | Authorized media storage, MIME/size verification, immutable reference, cleanup/recovery; PDF needs rasterization before tracing; DWG unsupported |
| Scale calibration | Intake endpoints, real length, provenance | Validated image coordinate system, units, source evidence |
| Boundary/fixtures | `src/lib/spatial/**`, editor | Versioned geometry data, containment/self-intersection validation, authoritative user edits |
| Mobility profile | Canonical store | Versioned user profile and sourced thresholds |
| Routes | Canonical routing engine | Ordered checkpoints, result/failure status, measured lengths only after calculation |
| Spatial findings | Canonical evaluator | Versioned findings and evidence; unassessed distinct from zero findings; no certification |
| Layout alternatives | Canonical optimizer | Real candidates, measured baseline/candidate metrics and scene fingerprint |
| Apply/Revert | Canonical store and browser persistence | Atomic, revision-aware write and rollback; reject stale candidates |
| Report | `src/components/workflow/ReportModal.tsx` | Versioned assessment snapshot with measured values and incomplete-state disclosures |
| User-owned data/permissions | Not implemented | Identity, per-user authorization, retention and deletion policy |
| Gemini-assisted explanation | Not implemented | Server-only opt-in adapter, bounded structured output, privacy review; never override geometry or certify safety |

`next.config.ts` intentionally keeps `output: "export"` for local and GitHub Pages. Gate 1 needs explicit server-enabled deployment choice before authenticated API or server Gemini. Never embed API credentials in client bundle. Browser-local storage is device-specific, not cloud collaboration.

## Gate 1 dependencies

1. Identity and ownership model, privacy/retention policy, threat model.
2. Durable data/media and migration plan with revision conflicts, recoverable deletion.
3. Versioned spatial contracts with units/provenance and auditable failures.
4. Server deployment decision, secrets, observability and CI gates.
5. Gemini consent and evaluation; explanations require human review.
