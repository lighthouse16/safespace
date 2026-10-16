# Colab M3DLayout integration — isolated test branch

Source branch: `feat/full-stack-v1` at `44f7c2f6c84f771a37c1e6c2428a308dbab5b4b1`.
No commits have been pushed to the teammate's branch.

## What was wrong
Previously `GenerateLayoutPanel` POSTed each prompt to the Colab `/generate` API, but discarded `translations`, `sizes` and `angles`. Positions were created by a separate hard-coded arranger. Its iterative clamping cannot guarantee collision-free layouts.

## New behavior
- Use the actual API scene via `sceneToFurniture` and validate geometry via `placeModelFurniture`.
- Retain model coordinates and rotation as preference, move only if needed to find a valid placement.
- Reject the whole result instead of partially inserting furniture when any model object cannot be placed.
- Continue to require a user click before replacing the workspace plan.
- This is a geometry check, **not** proof of accessibility, circulation clearance, or safety compliance.

## End-to-end live verification needed
Desktop Commander later connected to Lighthouselap. We created a **separate Git worktree** at `D:\\projects\\Hack\\safespace-colab-worktree`. Verified: npm dependencies installed, TypeScript typecheck passed, production build passed **including** the new Next.js M3D gateway, ESLint 0 errors with two unrelated test-file warnings, and **22/22 targeted M3DLayout and backend gateway tests passed** after the proxy addition. The earlier full-suite run produced **270 pass, 3 fail, 1 skip**: 25-second test server startup timeout in authenticated API lifecycle, and two PostgreSQL/RPC tests failing assertions. No currently running Google Colab/ngrok URL or server-side `M3D_INFERENCE_URL` configuration was available, so **live inference and browser E2E are still unverified**. The mock API-contract tests use a stubbed `fetch`, not the real Colab inference service.

1. Bring up the actual Colab notebook and confirm its FastAPI `/generate` route; verify the response fields `class_names`, `translations`, `sizes`, `angles` and units.
2. Validate tunnel HTTPS, FastAPI OpenAPI probe, ngrok warning bypass, GPU cold-start latency, backend timeout, and at least one error path. CORS between the browser and Colab is no longer needed because Next.js calls Colab server-to-server; **do not expose ngrok auth tokens**.
3. From a local checkout: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
4. Set server-only `M3D_INFERENCE_URL` in `.env.local` or the server deployment environment, restart/redeploy Next.js, then from the Layout panel enter `a living room with a sofa, a coffee table, and a television`, seed 0, and choose Generate.
5. Verify browser Network POST to `/api/v1/m3d/generate` actually returns a model response, objects appear only in the pending review until `Add room frames` is clicked, and two different model outputs produce different arrangements.
6. Test crowded rooms, malformed model data, tunnel disconnected mid-request, retries and Undo after acceptance.
7. Inspect whether generated objects are inside the *polygonal* room boundaries, not just rectangular frames, and whether doors/walls are obstructed. Further work may be needed before production use.

## Remaining architectural consideration
`placeModelFurniture` now receives actual room polygons and approximate wall/door obstacle footprints. Door swing arcs, access clearance envelopes, and model-to-user furniture inventory alignment are not yet comprehensively verified; do not claim clinical or regulatory suitability. The model predicts scene classes, not necessarily precisely the user's requested inventory. Confirm generated class counts and physical scale against raw Colab output before claiming full semantic correctness.
