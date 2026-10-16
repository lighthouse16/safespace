# Unified SafeSpace Main — Engineering Handoff

## Scope and source lineage

This integration joins the previously separate SafeSpace histories into one code line:

- Original UI V2 foundation / Gate 0 (PR #21, `5f71e4c`)
- Full-stack implementation and teammate's newer M3DLayout fixes (PR #22, through `bb5ec1e`)
- Unpushed security hardening `b7ac86c` (replayed in integration as `ed5fca7`)
- Frontend V2 CAD/inspector recovery (PR #23, `672b891`, replayed as `c9f2d3d`)
- Existing `main` history through `fa080e2` (merged as `ce839c2`)

Repeated M3DLayout implementations conflicted. The newer full-stack implementation was kept while `main` history was joined; no force push or reset was used.

## End-to-end persistence contract

Migration `supabase/migrations/002_scene_annotations.sql` adds the `scenes.hazards` JSONB column and replaces `save_assessment_bundle` with additional `p_walls` and `p_hazards` parameters. Walls were already a scene column but were not being written by the RPC. Validation, API save, DB row mapping, and the browser store are now connected.

**Apply the new migration before deploying the corresponding application server.** It has been applied to the local Supabase container only, not to any production database. Existing assessments receive an empty hazards array; the function enforces non-null `auth.uid()` and exact ownership before saving.

The service must fail closed if migration 002 is missing: it must not report a cloud-synced state on unsuccessful RPC calls.

## Verification performed locally

- `npm run typecheck`: PASS
- `npm run lint`: PASS, zero warnings
- `npm run build`: PASS
- `npm test`: **288 PASS, 0 FAIL, 1 SKIPPED**. The skipped test uses a live Gemini key that was not supplied.
- Authenticated HTTP lifecycle exercise includes: signup, signin, storage, atomic save, spatial evaluate/optimize, apply/revert, new session, authored walls/hazards cloud round-trip, deletion.
- SQL security/concurrency test suites ran against local Supabase; see the test command output for the full assertions.
- Real pointer/drag visual browser automation of the recovered 2D CAD tools remains **UNTESTED**; code/unit tests and production build are not substitutes.

## Deployment separation

The former `.github/workflows/deploy.yml` attempted to publish `./out` on every push to `main`. This cannot host the Next.js server routes, Supabase Auth, or Gemini API. The workflow is changed to a **non-deploying build check** on pushes and PRs.

Existing GitHub Pages deployment content is left untouched. A separate authenticated server-capable hosting plan, production database migration and secrets configuration are prerequisites for any production release.

## Remaining release gates

- Live Gemini external-key smoke test not exercised.
- Automated browser interaction coverage for Stage 1 CAD tools has not been executed.
- Production Supabase migration/environment/backup/runbook not executed.
- Evaluate and harden cloud write ordering and out-of-order request effects under rapid consecutive edits.
- Review GitHub Actions result after merge; local tests do not prove remote CI.

**Code consolidation is distinct from deployment approval.** Do not claim a production GO based on this commit alone.
