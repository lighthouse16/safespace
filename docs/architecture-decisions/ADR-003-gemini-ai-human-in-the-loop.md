# ADR-003: Gemini AI Integration & Human-in-the-Loop Review

## Status
Accepted

## Context
AI provides powerful multimodal perception and synthesis capabilities for floorplans. However, AI models are non-deterministic and can hallucinate objects, misread dimensions, or fabricate medical claims. For an application assessing physical safety and fall prevention, automated uncontrolled mutation of safety plans is unacceptable.

## Decision
1. **Official SDK & Pinned Model**:
   - Integrated using `@google/genai` official SDK.
   - Pinned model: `gemini-2.5-flash`.
   - Low temperatures (0.2 - 0.3) for factual extraction.

2. **Strict Structured JSON Schema**:
   - All AI interactions enforce strict typed JSON schema responses (`Type.OBJECT`, `Type.ARRAY`). No markdown formatting or freeform text returned from core extraction.

3. **Workflow A: Floorplan Interpretation**:
   - Detects furniture and obstacles in normalized coordinates (0..1000).
   - Server validates bounding boxes, converts coordinates using calibration pixels-per-cm, and filters physically impossible noise (e.g. dimensions < 15cm or > 600cm).
   - Full audit trail stored in `public.ai_analyses`.

4. **Human-in-the-Loop Review**:
   - AI outputs are never applied directly to the floorplan.
   - Rendered in `AIInterpretationReviewModal`: The user reviews every single detected item with category, confidence, and dimensions, checking or unchecking items before clicking "Add Selected Elements".

5. **Workflow B: Clinical Findings Explanation**:
   - Strictly explanatory: AI explains the deterministic findings computed by the spatial engine.
   - Prompt instructions forbid altering or inventing spatial dimensions or clearances.
   - Includes standard medical disclaimer that SafeSpace is an architectural layout assessment tool.
