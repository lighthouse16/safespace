# 2D & 3D Rendering Architecture Audit & 3D Failure Diagnosis

## 1. 2D Rendering Engine Audit

The repository contains two separate 2D canvas implementations:

### Implementation 1: Primary Spatial Canvas (`src/components/spatial/Floorplan2D.tsx`)
- **Technology**: Native React HTML5 DOM + SVG overlays + native Canvas.
- **Used by**: Primary 5-Stage Stepper Workspace (`Stage1Layout`, `Stage4Analysis`, `Stage5Improve`).
- **Features**:
  - Pan / Zoom / Grid background.
  - Interactive furniture dragging with rotation markers.
  - Dynamic walker path animation using SVG `strokeDashoffset` and interpolating coordinates.
  - Visual layers: Risk heatmap circles, route lines, clearance dimension lines, wall outlines.
- **Strengths**: Fast mount time, zero Node.js test runner conflicts, lightweight DOM integration.
- **Limitations**: Heatmap is drawn via fixed concentric SVG circles rather than a true distance-field rasterizer. Collision detection is rudimentary.

### Implementation 2: Konva Canvas (`src/components/editor/floorplan-2d.tsx`)
- **Technology**: `konva` 10.7.0 + `react-konva` 19.3.0.
- **Used by**: Multi-page routes (`/assessments/queen-care-clinic/model`, `/options`).
- **Features**:
  - Konva `Stage`, `Layer`, `Rect`, `Circle`, `Text`, `Arrow`.
  - Snapping via `snapAndClampPosition` (`floorplan-drag.ts`).
  - Zoom and pan controls.
- **Strengths**: Hardware-accelerated 2D canvas rendering with fine-grained layer caching.
- **Limitations**: Severe test environment friction—importing Konva in Node.js headless test environments delays test execution by ~5 seconds.

---

## 2. 3D Rendering Engine Audit

Similarly, 3D rendering is implemented in two decoupled components:

### Implementation 1: Primary Spatial 3D Visualizer (`src/components/spatial/Floorplan3D.tsx`)
- **Technology**: `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9, `three` 0.186.1.
- **Used by**: `Stage4Analysis` and `Stage5Improve`.
- **Scene Features**:
  - `OrbitControls` with damping and polar angle constraints (`maxPolarAngle={Math.PI / 2.05}`).
  - Low-height cutaway architectural walls (`wallHeight = 0.85m`).
  - Custom procedural 3D furniture meshes (`Chair3D`, `Desk3D`, `Bench3D`, `Plant3D`, `Mat3D`).
  - Animated camera focus presets (`isometric`, `top`, `reset`).
  - Billboard 3D hazard pins with `@react-three/drei` `<Text>` markers.
  - `ContactShadows` under floor.

### Implementation 2: Editor 3D Visualizer (`src/components/editor/floorplan-3d.tsx`)
- **Technology**: `@react-three/fiber`, `@react-three/drei` (`CameraControls`, `Environment`, `Grid`, `Line`).
- **Used by**: Multi-page route (`/assessments/queen-care-clinic/model`).
- **Scene Features**:
  - Drei `CameraControls` with smooth animated `setLookAt` transitions.
  - HDRI environment lighting (`<Environment preset="city" />`).
  - Raycasted 3D plane dragging with pointer capture.

---

## 3. 3D Failure Investigation & Diagnosis

### Incident Confirmation & Status
> [!IMPORTANT]
> **Crash Status Statement**: The failure on the deployed application—where navigating to Analysis and switching to 3D Iso sends the workspace into the global `"Workspace could not load"` error state (`src/app/error.tsx`)—is confirmed by team testing. However, across controlled local and remote test runs on Chrome 154 (Windows 11 with active WebGL2 acceleration), the crash did not re-occur deterministically. Therefore:
> **Crash reproduced; exact root cause remains unresolved.**

---

### Multi-Environment Test Matrix

The identical reproduction sequence was executed across three environments:
1. **Navigation Sequence**: Load initial view (`layout`) $\to$ Click "4 Analysis" $\to$ Click "3D Iso" toggle $\to$ Toggle camera presets ("Iso", "Top", "Reset") $\to$ Click hazard "Inspect" $\to$ Navigate to Stage 5 "Improve" $\to$ Toggle "3D" $\to$ Toggle "Side by Side" and "Split Slider".
2. **Browser & OS**: Chromium 154.0.0.0 (64-bit), Windows 11 Enterprise (NT 10.0; Win32 x64), GPU WebGL2 hardware enabled.

| Test Environment | Crash Reproduced? | First Uncaught Error | Console Warnings Observed | Failed Network Requests | Entered `error.tsx`? | `webglcontextlost` Observed? |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| **1. Deployed Build** (`https://lighthouse16.github.io/safespace/`) | **No** (in this Chromium run) | None (`errors: []`) | • `THREE.Clock: This module has been deprecated...`<br>• `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed...`<br>• `unsupported GPOS/GSUB table LookupType...` (troika-three-text) | `404` on `/favicon.ico` (non-fatal) | No | **0** (`contextLost: 0`) |
| **2. Local Production Build** (`http://localhost:8080/` from `out/`) | **No** (in this Chromium run) | None (`errors: []`) | • `THREE.Clock` deprecation warning<br>• `PCFSoftShadowMap` removed warning<br>• `unsupported GPOS/GSUB` debug logs | `404` on `/favicon.ico` (non-fatal) | No | **0** (`contextLost: 0`) |
| **3. Local Development Build** (`http://localhost:3000/` via `next dev`) | **No** (in this Chromium run) | None (`errors: []`) | • `THREE.Clock` deprecation warning<br>• `PCFSoftShadowMap` removed warning<br>• `unsupported GPOS/GSUB` debug logs<br>• `THREE.WebGLProgram` X4122 precision warning | None | No | **0** (`contextLost: 0`) |

---

## 4. Statement Classification & Forensic Analysis

To adhere to rigorous technical audit standards, every technical statement regarding the 3D pipeline is classified into one of six evidentiary tiers:

### Tier A: Confirmed Code Facts
1. `src/components/spatial/Floorplan3D.tsx` line 576 mounts `<Canvas shadows ...>` without specifying a shadow map type in its GL parameters.
2. `src/components/spatial/Floorplan3D.tsx` lines 439–447 renders `@react-three/drei` `<Text>` components inside hazard pins.
3. Neither `Stage4Analysis.tsx`, `Stage5Improve.tsx`, nor `Floorplan3D.tsx` is wrapped in a React Error Boundary. Zero `ErrorBoundary` components exist in `src/`.
4. `src/app/error.tsx` is the top-level Next.js global error boundary and renders the exact heading `"Workspace could not load"`.
5. In `Stage5Improve.tsx` lines 179 and 214, the "Side by Side" Before/After view mounts two simultaneous `<Floorplan3D>` components, creating two concurrent React Three Fiber canvas instances.

### Tier B: Reproduced Runtime Facts
1. During runtime initialization in Three.js 0.186.1, the engine emits `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
2. The engine emits `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.` Three.js automatically falls back to `PCFShadowMap` in this revision rather than throwing an uncaught exception.
3. `troika-three-text` (used by Drei `<Text>`) outputs multiple debug messages: `unsupported GPOS table LookupType 8 format 2` and `unsupported GSUB table LookupType 6 format 1/2`. It parses glyph layout with fallbacks without throwing an uncaught exception in standard desktop Chrome.
4. In the audited Chromium session, `window.__safespace_diagnostics` recorded exactly zero uncaught runtime errors and zero `webglcontextlost` events.

### Tier C: Root Cause Proven by Isolation
- **None at this stage.** No single isolated component edit (disabling `<Text>`, removing shadows, or removing `<ContactShadows>`) consistently turned the crash on and off in this environment. The exact root cause cannot be declared proven.

### Tier D: Hypotheses Requiring Validation (Ranked by Likelihood)

#### Hypothesis 1: WebGL Context Creation Failure on Constrained/Mobile GPUs (Likelihood: High)
- **Evidence**: On devices where WebGL2 hardware acceleration is disabled, restricted, or where available contexts are exhausted (e.g. mobile Safari, low-end Android tablets, or virtualized CI browsers), `canvas.getContext("webgl2")` returns `null`.
- **Mechanism**: R3F throws an uncaught error: `THREE.WebGLRenderer: A WebGL context could not be created.` Because no intermediate Error Boundary exists, this error bubbles directly to `src/app/error.tsx`, rendering `"Workspace could not load"`.
- **Next Diagnostic Experiment**: Emulate WebGL failure in Chrome DevTools (`chrome://flags/#disable-accelerated-2d-canvas` or inject a script overriding `HTMLCanvasElement.prototype.getContext` to return `null`) and verify whether the exact `"Workspace could not load"` screen appears.

#### Hypothesis 2: Asynchronous Font Decoding / Network Rejection in `troika-three-text` (Likelihood: Medium-High)
- **Evidence**: Drei's `<Text>` fetches remote woff font files via HTTP request. In network configurations blocking external CDNs or under offline conditions, or when opentype font parsing encounters corrupted byte arrays, unhandled promise rejections or worker exceptions can occur.
- **Mechanism**: If `troika-three-text` throws inside a React render or layout effect pass, React 19 aborts the component tree.
- **Next Diagnostic Experiment**: Block requests to `fonts.gstatic.com` and external CDN domains using Chrome DevTools network throttling/blocking rules, then navigate to Stage 4 3D Iso to test font load failure behavior.

#### Hypothesis 3: Shader Compilation Failure on Specific WebGL Drivers (Likelihood: Medium)
- **Evidence**: `THREE.WebGLProgram` outputs shader precision warnings (`warning X4122: sum of ... cannot be represented accurately in double precision`).
- **Mechanism**: On certain Intel integrated GPUs or older mobile graphics chipsets with strict GLSL compilers, shader precision warnings are treated as fatal shader linking errors, causing `gl.linkProgram()` to fail and Three.js to throw during material compilation.
- **Next Diagnostic Experiment**: Test deployed application across heterogeneous hardware (Intel UHD 620, Apple Silicon Safari, Android Chrome, and Firefox on Linux).

#### Hypothesis 4: Concurrent WebGL Context Limit Reached in Stage 5 (Likelihood: Medium)
- **Evidence**: Stage 5 mounts two `<Floorplan3D>` canvases simultaneously. Browsers enforce a maximum of 8 to 16 active WebGL contexts per domain.
- **Mechanism**: If a user switches back and forth between Stage 4 and Stage 5 multiple times without complete garbage collection of previous contexts, the browser forcibly evicts older contexts, triggering `webglcontextlost`.
- **Next Diagnostic Experiment**: Rapidly toggle Stage 4 and Stage 5 thirty times and monitor `window.__safespace_diagnostics.contextLost`.

### Tier E: General Future Reliability Risks
1. **React Error Boundary Limitations**:
   - A standard React Error Boundary (`componentDidCatch` / `getDerivedStateFromError`) **only catches errors occurring during React rendering, lifecycle methods, and constructors**.
   - It **CANNOT** catch:
     - Asynchronous callbacks (e.g. `setTimeout`, `requestAnimationFrame` render loops outside React's commit phase).
     - Errors inside Web Workers (e.g. font rasterization workers in Troika).
     - Native browser `webglcontextlost` events unless an explicit event listener forwards them into React state via `setState()`.
2. **Dual Canvas Memory Overhead**:
   - Retaining two concurrent Three.js canvases in Stage 5 doubles GPU memory, vertex buffer allocations, and render loop overhead.

### Tier F: Required Investigation in Stage 1
1. Construct a reproducible offline/no-GPU test bed.
2. Implement defensive telemetry logging to capture stack traces on client devices before the global error screen mounts.
3. Validate whether replacing Drei `<Text>` with HTML overlay badges or canvas textures eliminates font parser warnings entirely.

---

## 5. Architectural Corrective Strategy (Stage 1 Stabilization & Stage 6 Rebuild)

To address the unresolved 3D failure without prematurely undertaking a full 3D rewrite:

1. **Stage 1 Minimal Runtime Stabilization**:
   - Wrap `<Floorplan3D />` in a dedicated `Spatial3DErrorBoundary`.
   - Add explicit WebGL context availability check before mounting `<Canvas>`. If WebGL is unavailable, automatically render `Floorplan2D` with an informational notice ("3D hardware acceleration unavailable; viewing in 2D plan mode").
   - Listen explicitly to `webglcontextlost` on the canvas element, prevent default event behavior (`event.preventDefault()`), and gracefully degrade to 2D rather than allowing the application to enter `src/app/error.tsx`.
2. **Stage 6 Full Synchronized 3D Digital Twin**:
   - Replace Drei `<Text>` font fetching with local pre-baked textures or CSS 2D overlays.
   - Refactor Stage 5 comparison view to a single shared canvas utilizing WebGL viewport scissors.
   - Explicitly configure shadow maps and update `Clock` to `Timer` per Three.js r186 standards.
