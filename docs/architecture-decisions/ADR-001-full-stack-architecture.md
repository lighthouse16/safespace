# ADR-001: SafeSpace Full-Stack Architecture & Data Persistence

## Status
Accepted

## Context
SafeSpace evolved from a local-first prototype where assessments were stored purely in browser `localStorage` and `IndexedDB`. To support multi-device workflows, clinical collaboration, secure data retention, and HIPAA/privacy compliance, SafeSpace requires a robust full-stack architecture with user authentication, private cloud media storage, and relational schema persistence.

## Decision
1. **Next.js 16 App Router on Node.js Runtime**:
   - Backend APIs are implemented as standard App Router Route Handlers under `/api/v1/*`.
   - `next.config.ts` conditionally sets `output: "export"` only when `EXPORT_GH_PAGES` is set, allowing dynamic Node.js server runtime for production while maintaining static export capabilities for GitHub Pages CI if required.

2. **Database & Row Level Security (RLS)**:
   - PostgreSQL via Supabase.
   - Normalized relational tables: `profiles`, `assessments`, `floorplan_assets`, `calibrations`, `scenes`, `mobility_configs`, `routes`, `evaluations`, `optimizations`, `ai_analyses`.
   - Strict Row Level Security (RLS) on every table: Users can only select, insert, update, or delete assessments and related child records that they own (`auth.uid() = user_id`).
   - Foreign key cascades (`ON DELETE CASCADE`) ensure atomic and total cleanup when an assessment is deleted.

3. **Storage & Media Privacy**:
   - Private Supabase Storage bucket (`floorplans`).
   - Objects are scoped to `floorplans/{userId}/{assessmentId}/*`.
   - Read access is mediated via time-limited signed URLs (1 hour expiry) generated server-side.

4. **Hybrid Durability & Migration Seam**:
   - Preserves instant offline/local responsiveness using the existing `browserAssessmentRepository`.
   - When an authenticated user creates or updates an assessment, changes are persisted locally and transparently synced to Supabase via `serverAssessmentService`.
