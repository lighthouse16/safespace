# SafeSpace — Guest Local-First Mode and Acceptance Evidence

**Default experience:** No account, sign-in, or Supabase connection is required. A visitor can create an assessment, calibrate a manual or uploaded floorplan, draft walls and hazard notes, configure mobility/routes, review evaluator findings, try local layout optimization and reopen the saved assessment in the same browser.

## Runtime contract

- `NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS` defaults to unset/false. In this mode, account UI and session checks are suppressed, the assessment list uses browser persistence, and editor mutations never submit protected cloud API requests. Local saves are labelled **Saved locally**, not Cloud synced. Storage is browser-specific; clearing site data or using another device does not transfer the assessment.
- To explicitly restore the legacy account-backed cloud experience in a different deployment, set `NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS=true` **before building** and provide Supabase configuration. Protected server routes and ownership/RLS security stay enforced; disabling sign-in in the UI never grants anonymous permission to cloud data.
- Analysis offers a deterministic **Local evidence summary** derived from evaluator findings. This is not Gemini output, not clinical advice and not proof of safety. Cloud-backed Gemini explanation remains account-gated when cloud mode is explicitly enabled.
- External M3DLayout/Colab inference requires a reachable, compatible inference endpoint. Live inference was not proven by guest E2E. The existing offline/local room composition and store behavior remain testable.
- Uploaded images are stored separately in browser IndexedDB; the JSON assessment snapshot is saved in localStorage. Backup/export across devices and fully anonymous hosted cloud persistence have **not** been implemented. Do not claim otherwise.

## Verification (2026-10-16, Lighthouselap)

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero warnings.
- `npm test`: 289 pass, 0 fail, 1 skipped (live Gemini API key absent).
- `npm run build`: PASS.
- `npm run test:browser:guest`: Chrome Stable E2E PASS; covers guest dashboard with no auth/API calls, assessment details, manual source, two-point calibration, drafting and closing boundary, review, saving, CAD hazard placement, analysis local evidence summary, returning to the assessments list, reopening the saved assessment, persisted hazard, separate genuine PNG upload and transition into calibration, and no runtime JS exceptions.
- UI bug corrected: initial drafting tab said Set scale while active canvas tool was Select; initial active tool now Calibrate. The script asserts a calibration line actually appears after two pointer clicks.

**Still requires separate authorization and environments:** live Gemini key test, external M3DLayout/Colab test, production deployment, multi-browser/device cloud persistence. No deployment approval is implied by local or GitHub CI passes.

To repeat in CI or locally: install Chrome Stable, run `npm ci`, `npm run build`, then `npm run test:browser:guest`. The smoke script runs and terminates its own temporary Next.js server, and writes a screenshot to `test-results/guest-e2e-failure.png` only on failure.
