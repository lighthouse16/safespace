# SafeSpace

UI-only MVP for spatial fall-risk assessment in homes, clinics, and public facilities. SafeSpace helps facility managers, occupational therapists, NGO teams, and caregivers verify floor plans, model mobility routes, compare safer layouts, complete professional review, and prepare implementation reports.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Generate a layout from Colab

The M3DLayout checkpoint stays on Google Colab. This branch only rewrites the room sentence and calls that notebook. Open the site from a Codespace if you do not want `npm install` on your own computer.

1. On Colab, run the cells that clone `M3DLayout-code`, install packages, remove the `tkinter` import, write the `fast_transformers` shim, write `api_server.py`, install or stub CLIP, start uvicorn on port 8000, and open ngrok.
2. Copy the printed `API: https://….ngrok-free.app` line. That is the Colab API URL. Do not append `/generate`.
3. In this app, open an assessment and stay on Layout. The form is at the top of **Room fixtures**.
4. Paste the URL and describe every room in one sentence, for example `a living room with a sofa and a television, a kitchen with a table and 6 chairs, a toilet with a sink`. The prompt agent sends one training-style description per room. Each room is drawn as its own rectangle with walls, and that room's furniture is placed inside it. You do not trace the floorplan image.
5. Press **Add room frames** after you review the list. Undo restores the previous furniture and frame.

Leave the Colab runtime running. After a disconnect, start uvicorn and ngrok again and paste the new URL. The browser stores it in `localStorage` under `safespace-m3d-api-url`.

The rewriter lives in `src/lib/m3dlayout/prompt-agent.ts`. It maps everyday furniture words onto the model's 102 class labels, keeps relations such as "facing" and "in front of", and sends an already paper-style paragraph through unchanged. `src/lib/m3dlayout/scene-adapter.ts` reads translations as meters with Y up, uses X and Z as the floor, converts them to centimeter top-left corners, and centers the group in the current room. Colab does not pull this branch. It still clones `Graphic-Kiliani/M3DLayout-code`.

## Demo path

1. Open Queen Care Clinic assessment.
2. Verify the extracted waiting-area plan.
3. Inspect the walker route in 2D or 3D.
4. Review hazards and compare layout options.
5. Select Balanced, complete professional review, and print the report.

## Scope

Frontend prototype only. Automated spatial extraction, safety analysis, collaboration, persistence, and PDF generation use deterministic sample data. Results support professional decisions and do not replace an onsite assessment.
