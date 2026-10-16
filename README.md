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

- **Deterministic Local Evaluator:** The on-device geometry evaluator provides measurable findings and a deterministic, evidence-only summary without requiring an account or model API key (`Deterministic Local Engine`). This is not Gemini output and does not diagnose medical risk.
- **Production Gemini AI Gateway (Server-Side Isolated):**
  - **Models & Defaults:** `gemini-3.1-flash-lite` for multimodal floorplan detection (`/api/gemini/interpretation`) and evidence-grounded findings explanation (`/api/gemini/explanation`). `gemini-3.1-flash-lite-image` for cost-controlled 1K interior conceptual previews (`/api/gemini/visualize`), with an optional toggle for `gemini-3.1-flash-image`.
  - **Account-Free Guest Workflow:** Guest users can access Gemini features anonymously through server-side gateway routes without creating Supabase accounts or logging in.
  - **Zero Key Exposure:** `GEMINI_API_KEY` is loaded strictly on the server from `.env.local` (never committed or exposed to client-side bundles or network payloads).
  - **Cost Controls & Rate Limiting:** Sliding-window IP rate limiting (15/min interpretation, 25/min explanation, 4/min visualization) and global daily request budget controls prevent unbounded API spend. Free-tier quota exhaustion (`RESOURCE_EXHAUSTED` / `QUOTA_EXCEEDED`) is parsed into actionable feedback without disrupting CAD or local analysis.
  - **Truthful Labeling:** Visualizations and explanations are explicitly badged (`Gemini AI` vs `Deterministic Local Engine`), with conceptual renders prominently labeled as non-metric representations.
- **M3DLayout & Procedural Planner:**
  - **External M3DLayout:** When a Colab endpoint URL is configured, predictions are converted directly into spatial room furniture (`sceneToFurniture`) with interactive Discard/Apply verification.
  - **Offline Procedural Planner:** When no Colab endpoint is configured, the system honestly labels and runs the deterministic procedural layout generator (`arrangeRoomFurniture`) with boundary collision avoidance.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser:guest
npm run build:pages
```

The browser test requires Chrome Stable and uses Playwright Core. It launches its own temporary Next.js server and validates the unauthenticated intake/calibration/drafting/save/CAD/analysis/reopen flow plus PNG upload. It must not call authenticated API routes.

Live Gemini integration tests (`tests/gemini-live-smoke.test.ts`) require `GEMINI_API_KEY` in `.env.local`. When unconfigured, live tests skip gracefully.

## Deployment

- **Full-Stack Server Mode:** Recommended for complete functionality including server-side Gemini gateway routes and optional Supabase account sync.
- **GitHub Pages Static Export (`npm run build:pages`):** Generates a static SPA in `out/` with server API routes excluded. Static clients can connect to any hosted SafeSpace gateway by setting `NEXT_PUBLIC_GEMINI_GATEWAY_URL`. CORS is preconfigured for `https://lighthouse16.github.io` and local origins.

For any future server deployment, configure the target host, data-handling policy, environment variables, database migration and rollback, observability, and external API budgets separately. See [Unified Main Handoff](docs/unified-main-handoff.md).
