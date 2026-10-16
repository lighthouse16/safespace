# Frontend V2 CAD Recovery — Integration Notes

> **Historical note:** This document records the original isolated PR #23 and its limitations. In the unified code line, migration `supabase/migrations/002_scene_annotations.sql` plus API/store changes now persist authored walls/hazards to Supabase, with a tested authenticated cloud round-trip. For current verification and deployment gates, see `docs/unified-main-handoff.md`. The original statement below that cloud storage is unsupported no longer describes the unified branch.

**Base:** `origin/feat/full-stack-v1` at `9e5483c` (teammate's latest at branch creation).

**Source:** local `backup/frontend-stage-3-local-wip`, commits `f4b1e5d`, `eb36e7f`, `1d033a0`, `73bc8fc`, `633854c`.
**Implementation branch:** `feat/frontend-v2-cad-recovery` in isolated worktree, without rebasing or modifying local security commit `b7ac86c`.

## Recovered behavior

- 2D CAD toolbar: actionable partition wall, tape-measure, user-authored hazard pin, pan, select, and furniture catalog. Removed inert Door/Window/Text stubs rather than promising unsupported actions.
- Furniture catalog contains ten items grouped by Seating, Work & Tables, Storage & Medical, Safety & Support and Decor, with search, placement via canonical store, and per-item naming.
- Inspector: click-to-rename on furniture and manually authored hazards, with validation and selection. User observations are explicitly marked unverified, never represented as clinical evidence.
- SVG coordinates: retain native `getScreenCTM().inverse()`; fix letterboxing and avoid subtracting pan twice in fallback. Shift constrains walls/measurements to a horizontal or vertical axis; grid snap supported.
- Partition walls create canonical `SpatialWall` obstacles, recompute route, invalidate old optimization, and participate in structural undo.
- Stage 3 route sidebar: horizontal drag / arrow-key resizing (300–560px) on desktop, local width preference, no nested checkpoint scrollbar.
- Demo copy remains truthful. The old `f4b1e5d` removal of Demo Fixture/Session Only tags and relabeling fabricated risk scores as factual is intentionally **not** reapplied.

## Data and scope boundaries

- Locally authored `walls` and `hazards` are serialized into the existing versioned local browser snapshot with basic shape validation and backward compatibility; user assessment hydration recomputes routing from restored walls.
- The server assessment RPC/API **does not yet persist walls or user-authored hazards**. Frontend explicitly sets `remoteSyncStatus=failed` with an informative reason when these fields exist; local saves are not misrepresented as remotely synced.
- Tape measurements are transient annotations, as in the original branch. They are not exported as formal safety measurements or synced to the server.
- A follow-up backend contract/migration is needed before production use of user-authored walls/hazards across devices.
- This feature branch intentionally does **not** incorporate the separate unpushed backend security commit `b7ac86c`. Merge both only after review and conflict resolution.

## Tests

- `tests/frontend-v2-cad-recovery.test.ts`: manual hazard semantics/editing, furniture rename, partition wall/undo, local snapshot save/load and malformed geometry rejection.
- Verified independently on Lighthouselap after integrating UI V2 CAD: `npm run typecheck` PASS; `npm run lint` PASS with zero warnings; `npm run build` PASS (Next.js 16.3.6, 12 generated static pages); `npx tsx --test tests/frontend-v2-cad-recovery.test.ts` 4 PASS, 0 FAIL; `git diff --check` PASS.
- Full `npm test` has 3 inherited backend/infrastructure failures and one controlled Gemini skip: authenticated API lifecycle apply returned HTTP 400 rather than 200, RPC candidate-apply geometry check returned false, and concurrency candidate-apply check returned false. These were **not corrected** or misrepresented as passes; the separate security/back-end remediation must resolve them before release.
- Real browser interaction E2E for the recovered CAD rail is **not yet verified**. This Draft PR is not production release approval.

**Release rule:** Keep PR #21 immutable; do not merge this work directly to `main` or `feat/full-stack-v1` without backend contract and regression sign-off.
