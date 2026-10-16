# SafeSpace — Deployment and Local Verification

> **Current baseline:** the account-free, local-first Next.js application on `main`. This document replaces the former, outdated GitHub Pages/static-export and production-ready checklists. A successful CI run is not a production release approval.

## 1. Default experience

Visitors use the 2D layout editor, manual drafting, mobility/routing evaluation, deterministic findings and local optimization **without creating an account**. Draft metadata, geometry and changes are saved in browser localStorage; floorplan images use IndexedDB. Browser storage is not a cloud backup. Clear-site-data, another browser or another device does not recover the same assessment.

The optional account-backed Supabase server routes remain access-controlled. Do **not** grant anonymous read/write to user-owned Supabase tables or accept caller-selected ownership to remove a login screen.

## 2. Local development and checks

```bash
npm ci
npm run dev
```

Then visit `http://localhost:3000`. The cloud account mode is disabled unless explicitly opted in.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser:guest
```

The guest browser smoke requires Google Chrome stable. It creates a disposable test assessment in an isolated browser context, tests manual calibration, boundary, CAD notes, analysis, reopen and PNG upload, and must not call authenticated APIs. Some Supabase-backed test suites require a separately running local Supabase database. Live Gemini and external M3DLayout inference need their own configured environments and have not been approved for production.

## 3. Server deployment

The app has Next.js route handlers and therefore requires a **server-capable host** with a supported Node.js runtime. **Do not deploy to GitHub Pages** or use the obsolete `EXPORT_GH_PAGES` option; it was removed because it is incompatible with full-stack routes. CI on GitHub Actions only tests and builds.

Before any production release, confirm the chosen hosting plan, environment variables, access controls, data retention, backups, HTTPS, monitoring, rate limiting and rollback strategy. Never commit `.env*` files. Keep service-role credentials server-side.

## 4. Optional Supabase account-backed deployment

This is *not* required for the default guest product. For an explicitly authorized account-backed deployment:

1. Configure `NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS=true` **at build time**, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and only the genuinely required private server credentials for the selected hosting environment.
2. Apply **both** `supabase/migrations/001_initial_schema.sql` and `supabase/migrations/002_scene_annotations.sql` to a backed-up target database in the correct order.
3. Revalidate `auth.uid()` ownership checks, PostgreSQL `SECURITY DEFINER` RPC grants, RLS isolation, concurrent/stale optimizer candidate rejection, Supabase Storage policies and authenticated API flows using real tokens.
4. Separately validate media round-trips, application restart durability and the handling of all failed API writes. Require explicit release authorization before migrating a production database.

## 5. External inference

- `GEMINI_API_KEY` is only needed for live Gemini server features when they are explicitly used. Consent, evidence grounding and server-side secret protection are mandatory; the guest spatial evidence summary is deterministic and does not call Gemini.
- M3DLayout inference depends on a separately running, compatible endpoint. Do not claim it works live without a successful round-trip test and relevant rate/availability limits.

## 6. Release evidence

Local and CI verification must be recorded separately; never replace an actual test with a previous result or mark skipped external tests as passing. See `docs/guest-local-first.md` and `docs/unified-main-handoff.md`. Historical architecture and Gate-0 documents describe earlier milestones and are preserved solely as project history.
