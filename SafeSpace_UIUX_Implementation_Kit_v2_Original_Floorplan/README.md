# SafeSpace UI/UX Implementation Kit — REVISED: Original Approved Floorplan (v2)

**IMPORTANT:** This revision replaces the previous *different-layout* programmatic floorplan. The photo-like apartment content now derives directly from `original-approved-floorplan-visual-reference.png` — **the image the user approved**. Room positions remain: Living Room NW, Bedroom NE, Kitchen SW, Corridor mid/right, Entry S centre, Bathroom SE. Furnishings, walls and doors are kept from the original raster source.

## Upload-ready files

- **`safespace-demo-floorplan-calibrated.png`** — actual 1600×1200 PNG compatible with SafeSpace image upload.
- **`safespace-demo-floorplan-calibrated.svg`** — self-contained corresponding SVG (embedded original artwork plus vector-accurate ruler/dimensions).
- `original-approved-floorplan-visual-reference.png` — untouched original approved AI-rendered source retained for a direct visual comparison.
- `demo-calibration-guide.json` — machine-readable geometry and exact calibration coordinates.
- `design-references/01-landing.png` through `10-workspace-improve.png` — original screen design mockups; THESE contain inconsistent floorplan renditions, so DO NOT use their specific room geometry as source-of-truth.

## Technical correction

The originally generated source incorrectly printed `7,800 cm`, `6,200 cm` and a misleading "1:100" bar. The revised image removes those and accurately labels the intentionally assigned **nominal outer envelope 7.80×6.20 m**. All unsupported room interior numeric dimensions are removed. A small 0.939119× horizontal correction reconciles the original illustration's slightly non-isotropic drawn envelope; this does not change its topology or furniture placement.

The calibration segment is exactly 200 cm by CONSTRUCTION, with endpoints:

- 1600×1200 source-image pixels: (404, 1052) → (643.35484, 1052)
- 800×600 intake viewBox: (202, 526) → (321.67742, 526)
- Expected scale in intake coordinates: **0.59838710 viewBox pixels per cm** (tolerance ±0.001).

The asset is **synthetic**, NOT a ground-truth clinical floorplan or an as-built survey. No room fixture is automatically detected from the background bitmap. User must author semantic boundary, furniture and routes. Use real data-dependent analysis; don't hardcode route findings from screenshots.

## Antigravity instructions

1. Work on the planned new UI/UX branch off verified `main`; never overwrite the real production architecture.
2. Replace any prior kit/old demo PNG or SVG with these revised files; verify sha256 and geometry using JSON.
3. On the public website, show floorplan only as an optional product preview. A separate **Try sample floorplan** action during intake may feed this actual PNG through the same upload/validation/decode, calibration, IndexedDB and spatial workflow as user-uploaded files. No pre-population of a personal assessment.
4. Calibration UI must show the two exact endpoints above and accept 200 cm. Convert from source image to viewBox and world coordinates consistently.
5. Preserve original topology throughout the complete workflow. Do not regenerate different floorplans for different steps.
6. Never claim pixel artwork is a semantically modeled obstacle. Test actual geometric modeling, route authoring and persisted results independently.

This kit is a **corrected visual+functional reference**, not a working app by itself.
