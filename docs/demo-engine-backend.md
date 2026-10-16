# SafeSpace — Deterministic Engine & Guest Backend Demo Gate

## Purpose

A user can run SafeSpace **without an account**. The first-class geometry/route/optimizer calculations remain deterministic and work offline in the browser. A separately hosted Next.js gateway can independently calculate identical results using two stateless APIs:

- `POST /api/spatial/evaluate`: physical clearance, route feasibility, evaluator findings, actual path length and uncertainty.
- `POST /api/spatial/optimize`: bounded constrained placement candidates, fresh route/finding recomputation, scene fingerprint and non-regression checks.

Both endpoints are deliberately anonymous but **never write to Supabase**. They accept only calibrated canonical coordinates in **centimeters**. They do not ask Gemini to fabricate geometry or scores.

### Payload example

```json
{
  "units": "cm",
  "boundary": [{"x":0,"y":0},{"x":600,"y":0},{"x":600,"y":400},{"x":0,"y":400}],
  "furniture": [],
  "walls": [{"id":"divider","start":{"x":300,"y":0},"end":{"x":300,"y":400},"thickness":12,"isExterior":false}],
  "routeWaypoints": [{"id":"start","name":"Start","x":100,"y":200,"isMandatory":true},{"id":"end","name":"End","x":500,"y":200,"isMandatory":true}],
  "profile": {"id":"walker","name":"Walker","description":"Example","minClearanceCm":90,"turningSpaceCm":150,"fallHistory":false,"requiresSupport":true,"lowLightSensitivity":"Moderate"}
}
```

Send this JSON to `/api/spatial/evaluate`. For optimization, send `{"scene": <above>, "maxCandidates": 2, "maxEvaluations": 10}`. In this example a full-height divider should prevent an adequate route; without the divider, a viable path is expected.

### Safety/integrity boundaries

- Spatial engine models **2D geometry**, furniture footprints, partition walls, routed clearance envelopes and constrained rearrangements. It does **not** measure the physical world, infer actual lux readings, validate turning kinematics, or estimate certified clinical fall probability.
- The path's `minimumClearanceCm` is the **centerline distance to the nearest obstacle/boundary**, not the full physical corridor width. The required width comes from the selected mobility profile (modeled as radius = half the width).
- Strict shape validation and scene-size caps: boundary within a 15m x 15m span, at most 60 furniture items, 40 walls, 12 waypoints; optimization at most 3 candidates and 40 evaluations; JSON request <=128 KB. Invalid units/geometry, forbidden origin and oversized bodies fail without computation.
- No authenticated assessment records or service-role credentials are used by the new stateless routes.
- If an image interpretation is sent to Gemini, detected furniture must still be **human reviewed** before entering canonical geometry.
- Explanation API recomputes geometry on server when a calibrated scene is provided; external client claims are labeled unverified otherwise and must never be sent as independently measured facts.
- Legacy DB `evaluations.score` was an arbitrary score derived from deficit counts. Migration `003_unscored_spatial_evaluations.sql` makes it nullable; no fake 0–100 score is saved. Turning compliance is `not-assessed`, not `verified`. **Migration 003 must be applied BEFORE enabling authenticated persisted evaluation; it has only been applied locally.**

## Free-tier Gemini

The text model is `gemini-3.1-flash-lite`. Gemini is optional: deterministic calculations do not require an API key or GPU. Image generation returns an honest quota error if the free-tier account has no available image quota. Never substitute fake output or automatically upgrade to paid models.

`GEMINI_DAILY_BUDGET` counts **weighted request units** (text=1, image=5); it is **not** a USD spending cap. Default is 25; set 0 to immediately turn off external Gemini calls. Rate limiting currently uses an atomic file lock **on a single machine**; that does not protect independent Vercel/serverless instances. Do not connect a billed internet-facing deployment without an external distributed quota store and additional abuse controls. With no gateway URL configured the static GitHub Pages client remains fully usable for local deterministic work, but AI calls cannot succeed.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:api:guest
npm run test:browser:guest
npm run build:pages
node scripts/smoke-pages-browser.mjs
```

The HTTP smoke actually starts Next.js and posts scene data to both stateless APIs, checking a feasible route, an impassable full-height divider, optimized candidates and invalid-unit rejection. Chrome guest browser smoke tests the local-first UI. GitHub Pages serves only static output and CANNOT execute `/api/*`. An authenticated hosting setup (Vercel CLI login/project link) is required to deploy the gateway and set a server-only `GEMINI_API_KEY`.

For the hackathon demo, **local-first engine is the reliable baseline**. The separately hosted gateway and Colab M3DLayout diffusion inference are optional external services; neither is needed to claim 2D route computation is real.
