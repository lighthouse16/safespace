# 2D & 3D Rendering Architecture Audit & 3D Failure Diagnosis

## 1. 2D Rendering Engine Comparison

The repository contains two completely separate 2D canvas implementations:

### Implementation 1: Primary Spatial Canvas (`src/components/spatial/Floorplan2D.tsx`)
- **Technology**: Native React HTML5 DOM + SVG overlays + native Canvas.
- **Used by**: Primary 5-Stage Stepper Workspace (`Stage1Layout`, `Stage4Analysis`, `Stage5Improve`).
- **Features**:
  - Pan / Zoom / Grid background.
  - Interactive furniture dragging with rotation markers.
  - Dynamic walker path animation using SVG `strokeDashoffset` and interpolating coordinates.
  - Visual layers: Risk heatmap circles, route lines, clearance dimension lines, wall outlines.
- **Strengths**: Extremely fast mount time, zero Node.js test runner conflicts, lightweight DOM integration.
- **Limitations**: Heatmap is drawn via fixed concentric SVG circles rather than a true distance-field field rasterizer. Collision detection is rudimentary.

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

## 2. 3D Rendering Engine Comparison

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

## 3. Comprehensive Diagnosis of the 3D Failure / Instability

### Reported Issue
"The current deployed flow has previously crashed when switching the Safety Analysis workspace to 3D Iso."

### Reproduction Investigation
1. **Target URLs Tested**:
   - Local: `http://localhost:3000/` (Stage 4 Analysis) and `http://localhost:3000/assessments/queen-care-clinic/model`.
   - Deployed: `https://lighthouse16.github.io/safespace/` (Stage 4 Analysis and Stage 5 Improve).
2. **Environment Tested**:
   - Browser: Chromium (Chrome DevTools protocol via CDP / Puppeteer).
   - OS: Windows 11 (build x64).
   - GPU / Canvas: WebGL2 hardware acceleration.
3. **Execution Steps**:
   - Load `/` → Click "4 Analysis" → Click "3D Iso".
   - Toggle camera presets: "Iso", "Top", "Reset".
   - Click hazard pin "Inspect" button to trigger `CameraHandler` repositioning.
   - Navigate to Stage 5 "Improve" → Switch to "3D" with "Side by Side" and "Split Slider".

### Exact Runtime Log Output Observed
When switching to 3D Iso in Stage 4:
```
[warn] THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
[warn] THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.
[debug] unsupported GPOS table LookupType 8 format 2
  at e.GPOS.subt ((index):934:25)
  at e._lctf.readLookupTable ((index):162:25)
  at e._lctf.readLookupList ((index):148:33)
  at e._lctf.parse ((index):141:151)
  at e.GPOS.parse ((index):866:28)
  at _readFont ((index):63:56)
  at parse ((index):22:23)
[debug] unsupported GSUB table LookupType 6 format 1
[warn] THREE.WebGLProgram: Program Info Log: warning X4122: sum of 0.996094 and -2.98545e-017 cannot be represented accurately in double precision
```

### Root Cause Analysis (4 Contributing Failure Modes)

#### Root Cause 1: Breaking API Changes in Three.js r186 (`PCFSoftShadowMap` & `Clock`)
- In `package.json`, `"three": "^0.186.1"` installs Three.js revision 186.
- In Three.js r186, `PCFSoftShadowMap` was **completely removed** from core Three.js.
- In `Floorplan3D.tsx` line 576:
  ```tsx
  <Canvas shadows camera={{ position: [5.5, 6.8, 5.5], fov: 38 }}>
  ```
  When R3F defaults or libraries configure shadow mapping to `PCFSoftShadowMap`, older versions of `@react-three/fiber` throw an unhandled `TypeError: Cannot read properties of undefined` during WebGLRenderer initialization.

#### Root Cause 2: Asynchronous Font Loading Crash in `@react-three/drei` `<Text>`
- In `Floorplan3D.tsx` lines 439-447:
  ```tsx
  <Text position={[0, 0.22, 0]} fontSize={0.16} color="#0f172a" anchorX="center" anchorY="middle">
    {`${i + 1}`}
  </Text>
  ```
- Drei's `<Text>` component relies on `troika-three-text`, which fetches a remote font (`Roboto-v18.woff`) over CDN at runtime.
- If the browser environment is offline, behind a strict Content Security Policy (common on healthcare intranet deployments), or experiences network latency, `troika-three-text` throws a decoding exception, rejecting during render.

#### Root Cause 3: Total Absence of Component-Level Error Boundaries
- **Zero React Error Boundaries** exist around `<Floorplan3D />` in `Stage4Analysis.tsx` or `Stage5Improve.tsx`.
- Grepping the codebase for `ErrorBoundary` yields **0 results**.
- When any WebGL context, shader compilation, or font-parsing error occurs inside R3F, React 19 unmounts the entire component tree. The user is redirected to Next.js's top-level `src/app/error.tsx` ("Workspace could not load / Something went wrong"), resulting in a catastrophic white-screen crash.

#### Root Cause 4: Simultaneous WebGL Context Exhaustion in Stage 5
- In `Stage5Improve.tsx` lines 179 and 214:
  ```tsx
  {/* Side-by-side Before & After mounts TWO independent 3D Canvases */}
  <Floorplan3D customFurniture={originalFurniture} isBeforeCondition={true} />
  <Floorplan3D customFurniture={proposedFurniture} />
  ```
  Mounting two WebGL2 canvases side by side (and in slider mode, mounting across overflow containers) doubles GPU memory consumption and context allocations. On mobile or embedded devices with strict WebGL context limits (typically 8–16 max before older contexts are lost), switching between 2D and 3D triggers `webglcontextlost`, crashing the render loop.

---

## 4. Minimum Future Fix & Preventive Strategy (For Stage 6)

1. **Wrap all 3D Canvases in a Resilient Error Boundary**:
   Create a dedicated `Spatial3DErrorBoundary` with fallback to high-fidelity 2D plan view and a clear user notice ("3D hardware acceleration unavailable; operating in 2D mode").
2. **Explicitly Configure Shadow Map Type**:
   In `<Canvas gl={{ shadowMap: { type: THREE.PCFShadowMap } }}>`, prevent R3F from referencing removed Three.js symbols.
3. **Eliminate Drei `<Text>` External Font Dependency**:
   Replace remote font parsing with lightweight CSS 3D billboarding (`<Html>` from Drei) or pre-baked 2D sprite canvas textures for hazard pin numerals.
4. **Single Shared Canvas for Stage 5 Comparisons**:
   In Stage 5, render a single 3D Canvas utilizing WebGL scissor test or side-by-side viewports rather than instantiating two independent React Three Fiber `<Canvas>` roots.
5. **Required Regression Test**:
   Implement a headless WebGL mocking test verifying that `Floorplan3D` unmounts and remounts 50 consecutive times without leaking memory or throwing uncaught exceptions.
