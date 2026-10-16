# SafeSpace

UI-only MVP for spatial fall-risk assessment in homes, clinics, and public facilities. SafeSpace helps facility managers, occupational therapists, NGO teams, and caregivers verify floor plans, model mobility routes, compare safer layouts, complete professional review, and prepare implementation reports.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Generate an AI layout — backend-connected (experimental)

SafeSpace's Layout panel calls a **same-origin Next.js API** at
`/api/v1/m3d/generate`; the browser does **not** need or store a Colab URL.

### Connect the temporary Colab runtime

1. Run the team's original notebook, including `api_server.py`, uvicorn and ngrok. Keep the notebook executing for the demo.
2. Copy the current HTTPS ngrok base URL (without `/generate`) to
   `M3D_INFERENCE_URL` in `.env.local` locally, or to a **server-side**
   environment variable in the Vercel deployment.
3. Optional: set `M3D_INFERENCE_TOKEN` only if the FastAPI service implements bearer-token validation. **Never commit secrets** or use `NEXT_PUBLIC_` for inference configuration.
4. Start or restart the Next.js server (`npm run dev`). Open the Layout panel. The **Model backend** indicator probes the FastAPI OpenAPI schema. Click **Recheck** after changing runtimes.
5. Describe rooms, generate, inspect the proposed room/object counts and select **Add room frames**. An impossible/non-collision-free placement is rejected with an error; the existing plan remains intact.

The app constructs room prompts in `src/lib/m3dlayout/prompt-agent.ts`, converts model-generated boxes using `src/lib/m3dlayout/scene-adapter.ts`, and validates furniture against other objects, room polygons, walls and doors before application. The user must still inspect the layout; this is not a certified fall-risk safety check.

Colab managed runtimes **are not 24/7 inference servers**: free runtimes can disconnect or terminate, and using them primarily to serve a web app is restricted by Google's published policy. When the Colab tunnel changes, update `M3D_INFERENCE_URL` and restart/redeploy. The intended permanent replacement is a separately deployed, authenticated inference service (for example, on-demand GPU hosting); the Next.js client API does not need to change.

**Deployment warning:** GitHub Pages is a static export and cannot serve these Next.js API routes. The server gateway requires a Next.js server deployment (such as Vercel or self-hosted Node). A serverless platform may impose a function execution limit shorter than GPU cold-start plus inference time; for production jobs lasting minutes, use a background job/polling architecture.

See [live integration checklist](docs/colab-live-validation.md). API tests with a mocked upstream do **not** constitute an actual Colab model smoke test.

## Demo path

1. Open Queen Care Clinic assessment.
2. Verify the extracted waiting-area plan.
3. Inspect the walker route in 2D or 3D.
4. Review hazards and compare layout options.
5. Select Balanced, complete professional review, and print the report.

## Scope

Frontend prototype only. Automated spatial extraction, safety analysis, collaboration, persistence, and PDF generation use deterministic sample data. Results support professional decisions and do not replace an onsite assessment.
