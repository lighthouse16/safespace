"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSafeSpaceStore, computeStoreRoute } from "@/store/safespace-store";
import { evaluateSpatialScene } from "@/lib/spatial";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  ChevronLeft,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import type { LayoutCandidate } from "@/lib/spatial";
import { AIConceptPreviewModal } from "./AIConceptPreviewModal";

function formatMovePlainLanguage(move: {
  furnitureName: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  distanceCm: number;
  rotationDelta?: number;
}): string {
  const dx = Math.round(move.toPosition.x - move.fromPosition.x);
  const dy = Math.round(move.toPosition.y - move.fromPosition.y);
  const parts: string[] = [];
  if (Math.abs(dx) >= 5) {
    parts.push(dx > 0 ? `${Math.abs(dx)} cm right` : `${Math.abs(dx)} cm left`);
  }
  if (Math.abs(dy) >= 5) {
    parts.push(dy > 0 ? `${Math.abs(dy)} cm down` : `${Math.abs(dy)} cm up`);
  }
  const moveStr = parts.length > 0 ? parts.join(", ") : `${move.distanceCm} cm`;
  const rotStr = move.rotationDelta ? ` and rotate ${move.rotationDelta}°` : "";
  return `Move ${move.furnitureName} ${moveStr}${rotStr}.`;
}

export function Stage5Improve() {
  const {
    assessmentType,
    assessmentMetadata,
    furniture,
    baselineFurnitureSnapshot,
    routeResult,
    rooms,
    walls,
    doors,
    activeProfile,
    routeWaypoints,
    canonicalBoundary,
    runOptimization,
    applyLayoutCandidate,
    revertLayoutCandidate,
    activeOptimizationResult,
    selectedCandidateId,
    selectCandidate,
    setStage,
  } = useSafeSpaceStore();

  // Mobile/tablet defaults to single-pane Proposed view; desktop defaults to side-by-side
  const [viewMode, setViewMode] = useState<"side-by-side" | "before" | "proposed">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      return "proposed";
    }
    return "side-by-side";
  });

  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [conceptModalOpen, setConceptModalOpen] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up feedback timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  // Responsive viewMode adjustment when window resizes across 1024px threshold
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (window.innerWidth < 1024 && viewMode === "side-by-side") {
        setViewMode("proposed");
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

  // Two modes: Proposal mode vs Applied-layout review mode
  const isAppliedReviewMode = baselineFurnitureSnapshot !== null;

  // Run optimization ONLY in Proposal mode when not yet performed
  useEffect(() => {
    if (!isAppliedReviewMode && !activeOptimizationResult) {
      runOptimization();
    }
  }, [isAppliedReviewMode, activeOptimizationResult, runOptimization]);

  // Current canonical spatial findings: derived reactively from complete scene snapshot
  const currentFindings = useMemo(() => {
    return evaluateSpatialScene({
      assessmentType,
      assessmentMetadata,
      canonicalBoundary,
      rooms,
      furniture,
      profile: activeProfile,
      routeWaypoints,
      routeResult,
      doors,
      walls,
    });
  }, [
    assessmentType,
    assessmentMetadata,
    canonicalBoundary,
    rooms,
    furniture,
    activeProfile,
    routeWaypoints,
    routeResult,
    doors,
    walls,
  ]);

  // In Proposal Mode: candidates from active optimizer result
  const optResult = !isAppliedReviewMode ? activeOptimizationResult : null;
  const candidates = useMemo(() => optResult?.candidates || [], [optResult]);

  // Active candidate in Proposal Mode: selectedCandidateId or first candidate
  const activeCandidate: LayoutCandidate | null = useMemo(() => {
    if (isAppliedReviewMode || !candidates || candidates.length === 0) return null;
    return candidates.find((c) => c.id === selectedCandidateId) || candidates[0];
  }, [isAppliedReviewMode, candidates, selectedCandidateId]);

  // Active candidate index for 1-based Option numbering
  const activeCandidateIndex = useMemo(() => {
    if (!activeCandidate) return 0;
    const idx = candidates.findIndex((c) => c.id === activeCandidate.id);
    return idx >= 0 ? idx : 0;
  }, [candidates, activeCandidate]);

  // Before condition:
  // - In Applied Review Mode: historical pre-apply snapshot
  // - In Proposal Mode: current accepted layout
  const beforeFurniture = useMemo(() => {
    return isAppliedReviewMode && baselineFurnitureSnapshot ? baselineFurnitureSnapshot : furniture;
  }, [isAppliedReviewMode, baselineFurnitureSnapshot, furniture]);

  const beforeRoute = useMemo(() => {
    if (isAppliedReviewMode && baselineFurnitureSnapshot) {
      return computeStoreRoute(
        baselineFurnitureSnapshot,
        rooms,
        activeProfile,
        routeWaypoints,
        walls,
        doors,
        canonicalBoundary
      );
    }
    return routeResult;
  }, [
    isAppliedReviewMode,
    baselineFurnitureSnapshot,
    routeResult,
    rooms,
    activeProfile,
    routeWaypoints,
    walls,
    doors,
    canonicalBoundary,
  ]);

  const beforeEval = useMemo(() => {
    if (isAppliedReviewMode && baselineFurnitureSnapshot) {
      return evaluateSpatialScene({
        assessmentType,
        assessmentMetadata,
        canonicalBoundary,
        rooms,
        furniture: baselineFurnitureSnapshot,
        profile: activeProfile,
        routeWaypoints,
        routeResult: beforeRoute,
        doors,
        walls,
      });
    }
    return currentFindings;
  }, [
    isAppliedReviewMode,
    baselineFurnitureSnapshot,
    currentFindings,
    assessmentType,
    assessmentMetadata,
    canonicalBoundary,
    rooms,
    activeProfile,
    routeWaypoints,
    beforeRoute,
    doors,
    walls,
  ]);

  const handleApply = (candId: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    const res = applyLayoutCandidate(candId);
    if (res.success) {
      setActionFeedback({ type: "success", message: "Layout applied and persisted to workspace (Draft)." });
      feedbackTimeoutRef.current = setTimeout(() => setActionFeedback(null), 3500);
    } else {
      setActionFeedback({ type: "error", message: res.error || "Failed to apply layout." });
      feedbackTimeoutRef.current = setTimeout(() => setActionFeedback(null), 4500);
    }
  };

  const handleRevert = () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    const res = revertLayoutCandidate();
    if (res.success) {
      setActionFeedback({ type: "success", message: "Reverted back to original baseline layout." });
      feedbackTimeoutRef.current = setTimeout(() => setActionFeedback(null), 3500);
    } else {
      setActionFeedback({ type: "error", message: res.error || "Failed to revert layout." });
      feedbackTimeoutRef.current = setTimeout(() => setActionFeedback(null), 4500);
    }
  };

  const afterEval = isAppliedReviewMode ? currentFindings : activeCandidate?.evaluation;

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#F7F8F8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        {/* Accessible heading for test harnesses and screen readers matching Proposal / Applied mode */}
        <h2 className="sr-only">
          {isAppliedReviewMode ? "Applied Layout Review" : "Layout Improvement Options"}
        </h2>

        {/* View Mode & Responsive Toggles: visible on mobile, sr-only on desktop matching 10-workspace-improve.png */}
        <div className="flex lg:sr-only items-center justify-between">
          <div className="sr-only">
            {!isAppliedReviewMode && (
              <span>Alternatives ({candidates.length}):</span>
            )}
            <span>{isAppliedReviewMode ? "Applied (Draft)" : "Candidate (Unverified)"}</span>
          </div>

          <div className="flex items-center bg-white rounded-lg p-0.5 border border-[#E2E6E8] shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                viewMode === "side-by-side"
                  ? "bg-[#0B514B] text-white"
                  : "text-[#647078] hover:text-[#17252B]"
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setViewMode("before")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                viewMode === "before"
                  ? "bg-[#0B514B] text-white"
                  : "text-[#647078] hover:text-[#17252B]"
              }`}
            >
              Before
            </button>
            <button
              type="button"
              onClick={() => setViewMode("proposed")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                viewMode === "proposed"
                  ? "bg-[#0B514B] text-white"
                  : "text-[#647078] hover:text-[#17252B]"
              }`}
            >
              Proposed
            </button>
          </div>
        </div>

        {/* Option Selector Cards (row of 3) matching 10-workspace-improve.png */}
        {!isAppliedReviewMode && (
          candidates.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-500 italic">
              {optResult?.status === "already_optimal"
                ? "No clearance deficits detected along configured walking route (0 deficits). No modifications needed."
                : optResult?.status === "infeasible"
                ? "No alternatives found within bounded search scope. You can adjust the layout manually."
                : "Optimization unavailable."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {candidates.slice(0, 3).map((cand, idx) => {
                const isSelected = activeCandidate?.id === cand.id;

                return (
                  <button
                    type="button"
                    key={cand.id}
                    onClick={() => selectCandidate(cand.id)}
                    aria-pressed={isSelected}
                    className={`p-4 rounded-xl text-left transition cursor-pointer flex items-center justify-between border bg-white ${
                      isSelected
                        ? "border-2 border-[#0B514B] shadow-2xs"
                        : "border-[#E2E6E8] hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio indicator */}
                      <div
                        className={`size-4 rounded-full flex items-center justify-center border transition ${
                          isSelected
                            ? "border-[#0B514B]"
                            : "border-[#CBD5E1] bg-white"
                        }`}
                      >
                        {isSelected && (
                          <span className="size-2 rounded-full bg-[#0B514B]" />
                        )}
                      </div>

                      <div>
                        <span className="text-sm font-bold text-[#17252B] block leading-snug">
                          Option {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-[#647078]">
                          {cand.metrics.actionableDeficitsCount} deficit{cand.metrics.actionableDeficitsCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-[#647078] block">
                        {cand.moveCount} move{cand.moveCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Applied Review Banner if applied */}
        {isAppliedReviewMode && (
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold text-emerald-950">
                Applied Layout Review: Comparing original pre-optimization baseline with current accepted draft.
              </span>
            </div>
          </div>
        )}

        {/* Feedback message banner */}
        {actionFeedback && (
          <div
            role="status"
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-red-50 text-red-900 border border-red-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{actionFeedback.message}</span>
          </div>
        )}

        {/* Side-by-side or Single Comparison View matching 10-workspace-improve.png */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch relative">
          {/* Arrow indicator between Before and Proposed on desktop */}
          {viewMode === "side-by-side" && (
            <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white border border-[#E2E6E8] shadow-sm items-center justify-center text-[#647078] pointer-events-none">
              <ArrowRight className="w-4 h-4" />
            </div>
          )}

          {/* Left / Before Card */}
          {(viewMode === "side-by-side" || viewMode === "before") && (
            <div
              data-testid="floorplan-pane-before"
              className="bg-white rounded-2xl border border-[#E2E6E8] p-5 flex flex-col justify-between shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#17252B]">
                    {isAppliedReviewMode ? "Before: Original Baseline" : "Before"}
                  </h3>
                  <p className="text-xs text-[#647078] mt-0.5">
                    Current layout evaluated against the configured movement route.
                  </p>
                </div>
                <div className="sr-only">
                  {beforeEval.summary.actionableDeficitsCount} deficit{beforeEval.summary.actionableDeficitsCount === 1 ? "" : "s"}
                </div>
              </div>

              {/* Floorplan canvas */}
              <div className="h-[360px] rounded-xl border border-[#E2E6E8] overflow-hidden bg-[#FAFBF9]">
                <Floorplan2D
                  readOnly={true}
                  isBeforeCondition={true}
                  customFurniture={beforeFurniture}
                  customRouteResult={beforeRoute}
                  customEvaluation={beforeEval}
                  hideControls={true}
                  className="w-full h-full border-0 rounded-none bg-[#FAFBF9]"
                />
              </div>

              {/* Key Issues Strip matching 10-workspace-improve.png */}
              <div className="rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] p-4 space-y-2.5">
                <span className="text-xs font-semibold text-[#647078] block">
                  Before evaluation
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-lg font-bold text-[#17252B] leading-none block">
                        {beforeEval.summary.actionableDeficitsCount}
                      </span>
                      <span className="text-[11px] text-[#647078] leading-tight block">Actionable deficits</span>
                    </div>
                  </div>
                  <div className="text-xs text-[#647078]">
                    <span className="font-semibold block text-[#17252B]">Route status</span>
                    {beforeEval.summary.routeFeasibility.replaceAll("-", " ")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right / Proposed Card */}
          {(viewMode === "side-by-side" || viewMode === "proposed") && (
            <div
              data-testid="floorplan-pane-proposed"
              className="bg-white rounded-2xl border border-[#E2E6E8] p-5 flex flex-col justify-between shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#17252B]">
                    {isAppliedReviewMode
                      ? "Proposed: Accepted Layout"
                      : activeCandidate
                      ? `Option ${activeCandidateIndex + 1}: Proposed`
                      : "Proposed"}
                  </h3>
                  <p className="text-xs text-[#647078] mt-0.5">
                    {isAppliedReviewMode
                      ? "Current accepted draft compared with original baseline."
                      : activeCandidate
                      ? "Candidate layout; review measured findings before applying."
                      : "No measured layout alternative available."}
                  </p>
                </div>
                <div className="sr-only">
                  {isAppliedReviewMode
                    ? `${currentFindings.summary.actionableDeficitsCount} deficit${currentFindings.summary.actionableDeficitsCount === 1 ? "" : "s"}`
                    : activeCandidate
                    ? `${activeCandidate.metrics.actionableDeficitsCount} deficit${activeCandidate.metrics.actionableDeficitsCount === 1 ? "" : "s"}`
                    : "No alternative evaluated"}
                </div>
              </div>

              {/* Floorplan canvas */}
              <div className="h-[360px] rounded-xl border border-[#E2E6E8] overflow-hidden bg-[#FAFBF9]">
                {isAppliedReviewMode ? (
                  <Floorplan2D
                    readOnly={true}
                    customFurniture={furniture}
                    customRouteResult={routeResult}
                    customEvaluation={currentFindings}
                    hideControls={true}
                    className="w-full h-full border-0 rounded-none bg-[#FAFBF9]"
                  />
                ) : activeCandidate ? (
                  <Floorplan2D
                    readOnly={true}
                    customFurniture={activeCandidate.furniture}
                    customRouteResult={activeCandidate.routeResult}
                    customEvaluation={activeCandidate.evaluation}
                    hideControls={true}
                    className="w-full h-full border-0 rounded-none bg-[#FAFBF9]"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400 p-4 text-center">
                    No layout alternative selected or available.
                  </div>
                )}
              </div>

              {/* Changes & Improvement Summary matching 10-workspace-improve.png */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                {/* Left: Changes in this option */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#17252B] block">
                    Changes in this option
                  </span>
                  <div className="space-y-2">
                    {activeCandidate && activeCandidate.moves.length > 0 ? (
                      activeCandidate.moves.slice(0, 2).map((m, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-[#17252B]">
                          <span className="size-5 rounded-full bg-[#0B514B] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{formatMovePlainLanguage(m)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#647078]">
                        {isAppliedReviewMode ? "Accepted layout; move instructions available when selecting an alternative." : "No furniture moves in this option."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Improvement Summary Mint Card */}
                <div className="rounded-xl bg-[#EBF7F5] border border-[#CDEAE3] p-3.5 space-y-1.5 flex flex-col justify-center">
                  <span className="text-[11px] font-semibold text-[#0B514B] block">
                    {afterEval ? "Measured layout summary" : "No alternative measured"}
                  </span>
                  {afterEval && (
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div>
                        <span className="text-lg font-bold text-[#0B514B] leading-none block">
                          {afterEval.summary.actionableDeficitsCount}
                        </span>
                        <span className="text-[10px] text-[#647078] leading-tight block mt-0.5">
                          Actionable deficits
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#0B514B] block">
                          {afterEval.summary.routeFeasibility.replaceAll("-", " ")}
                        </span>
                        <span className="text-[10px] text-[#647078] leading-tight block mt-0.5">
                          Route status
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer matching 10-workspace-improve.png */}
        <div className="pt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStage("analysis")}
              className="py-2.5 px-4 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#17252B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to analysis</span>
              <span className="sr-only"> (Back to Findings)</span>
            </button>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs text-emerald-800 font-medium">
              <span>
                Deficits: <strong>{beforeEval.summary.actionableDeficitsCount} → {isAppliedReviewMode ? currentFindings.summary.actionableDeficitsCount : activeCandidate ? activeCandidate.metrics.actionableDeficitsCount : beforeEval.summary.actionableDeficitsCount}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConceptModalOpen(true)}
              title="Preview AI 3D conceptual visual render"
              className="py-2.5 px-3.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#0B514B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0B514B]" />
              <span>AI Concept Preview</span>
            </button>

            {!isAppliedReviewMode && (
              <button
                type="button"
                onClick={() => runOptimization()}
                className="py-2.5 px-4 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#17252B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Re-optimize</span>
              </button>
            )}

            {isAppliedReviewMode ? (
              <button
                type="button"
                onClick={handleRevert}
                className="py-2.5 px-5 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#17252B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-4 h-4 text-[#647078]" />
                <span>Revert to Original</span>
              </button>
            ) : activeCandidate ? (
              <button
                type="button"
                onClick={() => handleApply(activeCandidate.id)}
                className="py-2.5 px-5 rounded-lg bg-[#0B514B] hover:bg-[#073D38] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <span>Apply this layout</span>
                <span className="sr-only">Apply This Layout</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* AI Concept Preview Modal */}
        <AIConceptPreviewModal
          isOpen={conceptModalOpen}
          onClose={() => setConceptModalOpen(false)}
          layoutTitle={isAppliedReviewMode ? "Applied Layout" : activeCandidate ? `Option ${activeCandidateIndex + 1}` : "Proposed Space"}
          furniture={isAppliedReviewMode ? furniture : activeCandidate ? activeCandidate.furniture : furniture}
          rooms={rooms}
          isAlternative={!isAppliedReviewMode}
        />
      </div>
    </div>
  );
}
