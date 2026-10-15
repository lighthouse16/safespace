# SafeSpace

UI-only MVP for spatial fall-risk assessment in homes, clinics, and public facilities. SafeSpace helps facility managers, occupational therapists, NGO teams, and caregivers verify floor plans, model mobility routes, compare safer layouts, complete professional review, and prepare implementation reports.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The layout model is not installed here. Furniture generation runs on the Google Colab notebook you already use, and this app only sends it a rewritten text prompt.

## Generate a layout from Colab

The website and the model run in two places.

| Piece | Where it runs | What it holds |
|---|---|---|
| SafeSpace UI and prompt agent | This repo, in a Codespace or locally | No checkpoint and no PyTorch |
| M3DLayout autoregressive model | Google Colab | `M3DLayout-code`, `weights/autoregressive_59000.pth`, FastAPI on port 8000 |

Colab clones `https://github.com/Graphic-Kiliani/M3DLayout-code`. It does not pull this SafeSpace repository, so a different frontend remote does not require a notebook change.

### Colab cells

Run these cells, in this order, from the notebook that already works:

1. Mount Drive, clone `M3DLayout-code`, copy `autoregressive_59000.pth` into `weights/`.
2. Install the Python packages.
3. Remove the `tkinter` import from `scene_synthesis/networks/diffusion/denoise_net.py`.
4. Write the local `fast_transformers` shim. Skip the CUDA build of `pytorch-fast-transformers` when that build fails.
5. Write `api_server.py`.
6. Install CLIP, or keep the CLIP stub. This checkpoint encodes text with `bert-base-cased`, which the package install already provides.
7. Start `uvicorn api_server:app --host 0.0.0.0 --port 8000` from `/content/M3DLayout-code`. Wait until `GET /health` returns `{"ok": true}`.
8. Open the ngrok tunnel and copy the `https://….ngrok-free.app` URL.

The checkpoint-inspection cells are optional. Leave the runtime running. After a disconnect, start uvicorn and ngrok again and paste the new URL. If the runtime was deleted, start again at the clone cell.

### Website

From this repository, in a Codespace or on a machine that already has Node:

```bash
npm install
npm run dev
```

Open the forwarded `http://localhost:3000`, start an assessment, stay on **Layout**, paste the ngrok URL into **Colab API URL**, and press **Generate layout**. The browser stores that URL in `localStorage` under `safespace-m3d-api-url`. `NEXT_PUBLIC_M3D_API_URL` is the fallback when nothing has been saved.

Confirm the placed objects before continuing. Undo restores the previous furniture.

## M3DLayout integration

```text
room sentence
  -> translateUserQuery()          src/lib/m3dlayout/prompt-agent.ts
  -> POST { prompt, seed }         src/lib/m3dlayout/client.ts
  -> Colab /generate               autoregressive checkpoint
  -> sceneToFurniture()            src/lib/m3dlayout/scene-adapter.ts
  -> replaceFurnitureLayout()      src/store/safespace-store.ts
  -> Layout canvas                 src/components/workflow/GenerateLayoutPanel.tsx
```

`config/m3dlayout_autoregressive.yaml` sets `text_condition: true` and `text_embed_dim: 512`. The network loads `bert-base-cased`, mean-pools the token states, and projects 768 dimensions to 512. Generation then calls `M3DLayoutArGenerator.generate_scene_from_text(prompt, seed)`.

### API

The notebook's FastAPI route is the contract. This repo does not ship `api_server.py`.

```http
GET /health
{"ok": true}

POST /generate
Content-Type: application/json
ngrok-skip-browser-warning: true

{"prompt": "The room is a living room. There is a sofa and a television. ...", "seed": 0}
```

Response fields used by the adapter:

| Field | Meaning |
|---|---|
| `class_names` | One dataset class per box. `start` and `end` are dropped. |
| `translations` | Meters, `[x, y, z]`. Y is up. The floor plane is X and Z. |
| `sizes` | Meters, `[width, height, depth]` along X, Y, and Z. |
| `angles` | Yaw in radians, either a number or `[yaw]`. |

The request times out after 180 seconds. CORS on the notebook already allows the browser to call the tunnel directly, which a static Next export needs because there is no Next.js server proxy.

### Prompt agent

`translateUserQuery()` runs in the browser. It does not call a second model.

Short text is outside the training distribution. `a living room with a sofa and a tv` becomes:

```text
The room is a living room. There is a sofa and a television. The furniture is placed for optimal use. Only include the objects described above. Do not include small decorative items.
```

The rewrite follows `examples/desc_*.txt` and `SENTENCE_REWRITE_TEMPLATES` in `scene_synthesis/datasets/m3dlayout_dataset.py`:

- The room sentence names one of `living room`, `bedroom`, `dining room`, `kitchen`, `bathroom`, or `office`. Waiting, reception, lounge, and clinic map to a living room. Consultation and study map to an office.
- Furniture phrases map through `src/lib/m3dlayout/vocabulary.ts` onto the autoregressive class list (`sofa`, `coffee_table`, `tv`, `tv_stand`, and the rest of the 102 content classes). Longer phrases win, so `coffee table` stays `coffee_table` and `television stand` stays `tv_stand`.
- `facing`, `in front of`, `behind`, `next to`, `opposite`, `between`, and `against` become up to two placement sentences. Otherwise the prompt says the furniture is placed for optimal use.
- The closing constraint is the training object-scope line. `minimal` or `simple` adds the minimal-layout line. `detailed` adds the detailed-scene line.
- A paragraph of at least 12 words that already begins like the paper prompts (`The room is...`, `This living room...`, `In the living room...`) is sent unchanged.
- A named room with no recognized furniture uses that room's default set. A bedroom default is `bed`, `nightstand`, and `wardrobe`.

### Coordinates and furniture

SafeSpace stores a top-left corner in centimeters. The adapter converts each box as follows:

1. Floor position is `(translation.x, translation.z)` in centimeters. Height is `size.y`.
2. The group is centered on the user boundary when one exists, otherwise on the first room.
3. Scale is `min(1, roomWidth / layoutWidth, roomDepth / layoutDepth)`, so a layout is shrunk into the room and never enlarged.
4. Yaw becomes degrees in `[0, 359]`.
5. Each item is unconfirmed, movable, and tagged `Generated by M3DLayout`.

Class names collapse onto the existing furniture categories: sofas and beds become `bench`, tables become `table`, desks stay `desk`, storage and TV stands become `cabinet`, lamps become `light`, rugs become `mat`, plants stay `plant`, and bathroom fixtures become `medical-fixture`. The visible name still says Sofa, Television, or Bed.

### Files

| File | Role |
|---|---|
| `src/lib/m3dlayout/prompt-agent.ts` | Rewrites the user sentence. |
| `src/lib/m3dlayout/vocabulary.ts` | Class labels and everyday aliases. |
| `src/lib/m3dlayout/client.ts` | `POST /generate` and the saved API URL. |
| `src/lib/m3dlayout/scene-adapter.ts` | Boxes to `SpatialFurniture`. |
| `src/components/workflow/GenerateLayoutPanel.tsx` | Layout-step form. |
| `src/components/workflow/Stage1Layout.tsx` | Mounts the form. |
| `src/store/safespace-store.ts` | `replaceFurnitureLayout()`. |
| `tests/m3dlayout-prompt-agent.test.ts` | Rewrite, class mapping, and coordinate tests. |

```bash
npm test
```

### Collaborator repository

Push this frontend branch to the SafeSpace repository you collaborate on and open a pull request. The Colab notebook stays pointed at `Graphic-Kiliani/M3DLayout-code` and the Drive checkpoint. Do not copy the weights or the shim into this repository.

## Demo path

1. Open Queen Care Clinic assessment.
2. Verify the extracted waiting-area plan.
3. Inspect the walker route in 2D or 3D.
4. Review hazards and compare layout options.
5. Select Balanced, complete professional review, and print the report.

## Scope

Frontend prototype only. Automated spatial extraction, safety analysis, collaboration, persistence, and PDF generation use deterministic sample data. Results support professional decisions and do not replace an onsite assessment.
