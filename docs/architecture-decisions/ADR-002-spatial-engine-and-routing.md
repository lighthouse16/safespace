# ADR-002: Server-Authoritative Spatial Engine, Routing & Parity

## Status
Accepted

## Context
Accessibility decisions require exact geometric computations: clearance margins, corridor widths, turning circles, and obstacle collision detection. Running spatial logic solely on the client risks client-side tampering, drift between devices, and inability to run background optimizations.

## Decision
1. **Shared Deterministic Core**:
   - `src/lib/spatial/**` is purely functional and deterministic without any browser or DOM globals.
   - The same mathematical engine runs in both the client store (for instant 60fps canvas interaction) and in server Route Handlers (`/api/v1/assessments/:id/spatial/*`).

2. **Server-Authoritative Evaluation & Optimization**:
   - `POST /api/v1/assessments/:id/spatial/evaluate`: Runs `evaluateSpatialScene`, validates boundary polygons against self-intersection, computes clearances, and records findings to the `evaluations` table.
   - `POST /api/v1/assessments/:id/spatial/optimize`: Generates constrained layout candidates reducing accessibility deficits.
   - `POST /api/v1/assessments/:id/spatial/apply` & `POST /api/v1/assessments/:id/spatial/revert`: Transactionally applies or rolls back candidate furniture layouts, validating scene fingerprint signatures to reject stale proposals if user geometry changed in the interim.

3. **Numerical Parity Invariant**:
   - Rigorously verified via `tests/spatial-parity.test.ts`: Client and server evaluations produce identical numerical outputs, clearances, and findings counts.
