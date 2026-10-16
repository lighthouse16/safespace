# SafeSpace

SafeSpace is a spatial planning and accessibility review web application for residential and care environments. It supports calibrated floorplans, 2D layout editing, manually authored safety notes, mobility profiles, route evaluation, and proposed furniture rearrangements.

**This tool is not a clinical fall-risk assessment, certified safety audit, or substitute for onsite measurements and professional review.** Evaluator findings and geometry should be checked by a qualified person.

## Quick start — no account required

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select **Assessments**, and create a new assessment. Sign-in is **not required** in the default experience.

Use an existing PNG/JPEG/SVG floorplan or draw a space manually. Set the scale with two points and a known physical length, trace and close the boundary, review the intake, and open the workspace. The five workspace stages are **Layout**, **Profile**, **Routes**, **Analysis**, and **Improve**.

**Local-first persistence:** the versioned assessment is held in browser localStorage, while uploaded floorplan images are stored in browser IndexedDB. The editor shows **Saved locally** only after a confirmed local write. The data is **not automatically available on another device**, and browser data clearing can erase it. Do not claim that browser-local data is cloud backed.

For implementation details, browser acceptance coverage, and unresolved external dependencies, see [Guest Local-First Mode](docs/guest-local-first.md).

## Optional account-backed cloud integration

The original authenticated Next.js API, Supabase storage and PostgreSQL RLS implementation is retained, but disabled in the frontend by default. Do **not** remove ownership checks or make these endpoints public to bypass authentication.

To explicitly enable accounts for a separate deployment, set `NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS=true` **before building**, configure Supabase secrets privately, and apply migrations `001_initial_schema.sql` and `002_scene_annotations.sql` with a documented backup and rollback plan. Do not commit `.env*` files.

Local assessments, local evaluator output, CAD editing and local optimization do not depend on this cloud mode.

## External AI and room generation

- **Local Analysis:** the on-device geometry evaluator provides measurable findings and a deterministic, evidence-only summary without an account or model API key. This is not Gemini output and does not diagnose medical risk.
- **Gemini:** external interpretation/explanation is an optional consent-gated server workflow that requires its own correctly configured authenticated service. Live Gemini tests are skipped when credentials are not provided.
- **M3DLayout:** room composition and prompt preparation run locally, but actual model inference requires a compatible external API hosted separately (for example, Colab with a live endpoint). In the Layout panel, enter the compatible API base URL without appending `/generate`; the browser saves it only on this device. The checkpoint is **not** bundled with this repo.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser:guest
```

The browser test requires Chrome Stable and uses Playwright Core. It launches its own temporary Next.js server and validates the unauthenticated intake/calibration/drafting/save/CAD/analysis/reopen flow plus PNG upload. It must not call authenticated API routes.

Some database tests depend on a running local Supabase container; live external Gemini and M3DLayout require separate integration environments. A local test pass does not verify external infrastructure or production deployment.

## Deployment

This is a **Next.js full-stack server** project. GitHub Pages can host static files but **cannot run its authenticated API routes**. The GitHub Actions workflow checks typecheck, lint, focused unit tests, production build and guest browser smoke; it intentionally does not deploy to GitHub Pages.

For any future server deployment, configure the target host, data-handling policy, environment variables, database migration and rollback, observability, and external API budgets separately. See [Unified Main Handoff](docs/unified-main-handoff.md).
