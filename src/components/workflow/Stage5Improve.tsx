"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSafeSpaceStore, computeStoreRoute } from "@/store/safespace-store";
import { evaluateSpatialScene } from "@/lib/spatial";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  FileText,
  ChevronLeft,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import type { LayoutCandidate } from "@/lib/spatial";

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
  return `Move ${move.furnitureName} ${moveStr}${rotStr}`;
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
    showGrid,
    setShowGrid,
    setReportModalOpen,
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Top Stage 5 Toolbar */}
      <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1e7168]">
            {isAppliedReviewMode ? "Applied Layout Review" : "Layout Improvement Options"}
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500">
            {isAppliedReviewMode
              ? "Reviewing Applied Alternative"
              : assessmentMetadata?.facilityName || "Custom Space"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`px-2 py-0.5 text-[11px] font-medium rounded border transition cursor-pointer ${
              showGrid
                ? "bg-[#e8f3f1] text-[#1e7168] border-[#1e7168]/30 font-semibold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Grid
          </button>

          {/* View Mode Toggle: Responsive with mobile fallback */}
          <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={`hidden lg:inline-flex px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                viewMode === "side-by-side"
                  ? "bg-white text-slate-800 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setViewMode("before")}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                viewMode === "before"
                  ? "bg-white text-slate-800 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Before
            </button>
            <button
              type="button"
              onClick={() => setViewMode("proposed")}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                viewMode === "proposed"
                  ? "bg-white text-slate-800 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isAppliedReviewMode ? "After" : "Proposed"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="px-2.5 py-1 rounded bg-[#1e7168] text-white text-xs font-semibold hover:bg-[#175b54] transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary Report</span>
          </button>
        </div>
      </div>

      {/* Subheader: Decision & Alternative Selection Ribbon */}
      <div className="bg-white border-b border-slate-200 px-3.5 py-2 shrink-0 overflow-hidden">
        {isAppliedReviewMode ? (
          /* Applied-Layout Review Mode Banner */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Applied Layout Review</span>
              </span>
              <span className="text-xs text-slate-600 truncate">
                Original layout is saved. You can compare changes or revert at any time.
              </span>
            </div>
          </div>
        ) : (
          /* Proposal Mode Ribbon */
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Alternatives ({candidates.length}):
              </span>

              {candidates.length === 0 ? (
                <span className="text-xs text-slate-500 italic">
                  {optResult?.status === "already_optimal"
                    ? "No clearance deficits detected along configured walking route (0 deficits). No modifications needed."
                    : optResult?.status === "infeasible"
                    ? "No alternatives found within bounded search scope. You can adjust the layout manually."
                    : "Optimization unavailable."}
                </span>
              ) : (
                candidates.map((cand, idx) => {
                  const isSelected = activeCandidate?.id === cand.id;
                  const optionLabel = `Option ${idx + 1}`;
                  return (
                    <button
                      key={cand.id}
                      onClick={() => selectCandidate(cand.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs text-left transition cursor-pointer shrink-0 ${
                        isSelected
                          ? "bg-emerald-50/80 border-[#1e7168] text-slate-900 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{optionLabel}</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            ({cand.moveCount} move{cand.moveCount === 1 ? "" : "s"})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="text-emerald-700 font-medium">
                            {cand.metrics.actionableDeficitsDelta < 0
                              ? `${Math.abs(cand.metrics.actionableDeficitsDelta)} deficits resolved`
                              : "Deficits maintained"}
                          </span>
                          {cand.metrics.clearanceGainCm !== null && cand.metrics.clearanceGainCm > 0 ? (
                            <>
                              <span>·</span>
                              <span className="text-emerald-700 font-medium">
                                +{cand.metrics.clearanceGainCm} cm clearance
                              </span>
                            </>
                          ) : beforeEval.summary.minimumClearanceCm === null ? (
                            <>
                              <span>·</span>
                              <span className="text-slate-500">
                                Baseline clearance: not measured
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Proposal Mode Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => runOptimization()}
                title="Re-run geometric solver"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs transition cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Re-optimize</span>
              </button>
            </div>
          </div>
        )}

        {/* Feedback message banner */}
        {actionFeedback && (
          <div
            role="status"
            className={`mt-1.5 px-2.5 py-1 rounded text-xs flex items-center gap-1.5 animate-fadeIn ${
              actionFeedback.type === "success"
                ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                : "bg-rose-100 text-rose-900 border border-rose-200"
            }`}
          >
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Main Floorplan Canvas: Single pane on mobile/tablet (<1024px), Side-by-Side on desktop (>=1024px) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden p-2 gap-2">
        {/* Left / Baseline Condition */}
        {(viewMode === "side-by-side" || viewMode === "before") && (
          <div
            data-testid="floorplan-pane-before"
            className={`flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs w-full ${
              viewMode === "side-by-side" ? "flex-1 min-w-0" : "flex-1"
            }`}
          >
            <div className="h-8 bg-slate-50 border-b border-slate-200 px-3 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-xs font-bold text-slate-700">
                  {isAppliedReviewMode ? "Before: Original Baseline" : "Before: Current Layout"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span
                  className={`font-semibold ${
                    beforeEval.summary.actionableDeficitsCount > 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {beforeEval.summary.actionableDeficitsCount} deficit{beforeEval.summary.actionableDeficitsCount === 1 ? "" : "s"}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">
                  Clr: {beforeEval.summary.minimumClearanceCm !== null ? `${beforeEval.summary.minimumClearanceCm} cm` : "not measured"}
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <Floorplan2D
                readOnly={true}
                isBeforeCondition={true}
                customFurniture={beforeFurniture}
                customRouteResult={beforeRoute}
                customEvaluation={beforeEval}
                hideControls={true}
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Right / Proposed Condition */}
        {(viewMode === "side-by-side" || viewMode === "proposed") && (
          <div
            data-testid="floorplan-pane-proposed"
            className={`flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs w-full ${
              viewMode === "side-by-side" ? "flex-1 min-w-0" : "flex-1"
            }`}
          >
            <div className="h-8 bg-emerald-50/60 border-b border-emerald-100 px-3 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  {isAppliedReviewMode
                    ? "After: Accepted Layout (Draft)"
                    : activeCandidate
                    ? `Option ${activeCandidateIndex + 1}: Proposed`
                    : "Proposed Alternative"}
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                  {isAppliedReviewMode ? "Applied (Draft)" : "Candidate (Unverified)"}
                </span>
              </div>

              {isAppliedReviewMode ? (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span
                    className={`font-semibold ${
                      currentFindings.summary.actionableDeficitsCount === 0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {currentFindings.summary.actionableDeficitsCount} deficit{currentFindings.summary.actionableDeficitsCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700">
                    Clr: {currentFindings.summary.minimumClearanceCm !== null ? `${currentFindings.summary.minimumClearanceCm} cm` : "not measured"}
                  </span>
                </div>
              ) : activeCandidate ? (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span
                    className={`font-semibold ${
                      activeCandidate.metrics.actionableDeficitsCount === 0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {activeCandidate.metrics.actionableDeficitsCount} deficit{activeCandidate.metrics.actionableDeficitsCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700">
                    Clr: {activeCandidate.metrics.minimumClearanceCm !== null ? `${activeCandidate.metrics.minimumClearanceCm} cm` : "not measured"}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">No alternative active</span>
              )}
            </div>

            <div className="flex-1 min-h-0 relative">
              {isAppliedReviewMode ? (
                <Floorplan2D
                  readOnly={true}
                  customFurniture={furniture}
                  customRouteResult={routeResult}
                  customEvaluation={currentFindings}
                  hideControls={true}
                  className="w-full h-full"
                />
              ) : activeCandidate ? (
                <Floorplan2D
                  readOnly={true}
                  customFurniture={activeCandidate.furniture}
                  customRouteResult={activeCandidate.routeResult}
                  customEvaluation={activeCandidate.evaluation}
                  hideControls={true}
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 p-4 text-center">
                  No layout alternative selected or available.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary & Actions Drawer */}
      <div className="bg-white border-t border-slate-200 px-4 py-2.5 shrink-0 select-none max-h-44 overflow-y-auto overflow-x-hidden">
        {isAppliedReviewMode ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Applied Layout Review (Draft)
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600">
                  Comparing original pre-optimization baseline against current accepted layout draft.
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                To explore different proposal alternatives, revert to the original baseline first.
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 text-xs text-emerald-800 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Deficits:{" "}
                  <strong>
                    {beforeEval.summary.actionableDeficitsCount} → {currentFindings.summary.actionableDeficitsCount}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleRevert}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Revert to Original</span>
              </button>
              <button
                type="button"
                onClick={() => setStage("analysis")}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Back to Findings</span>
              </button>
            </div>
          </div>
        ) : activeCandidate ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Option {activeCandidateIndex + 1} Summary
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600">
                  {activeCandidate.moves.length > 0
                    ? activeCandidate.moves.map((m) => formatMovePlainLanguage(m)).join("; ")
                    : "No fixture adjustments required."}
                </span>
              </div>

              {/* Collapsible secondary coordinate details */}
              {activeCandidate.moves.length > 0 && (
                <details className="mt-1 text-[11px] text-slate-500 cursor-pointer">
                  <summary className="hover:text-slate-700 select-none">
                    Show precise coordinate details
                  </summary>
                  <div className="mt-1 flex flex-wrap gap-2 pt-0.5">
                    {activeCandidate.moves.map((m, i) => (
                      <span
                        key={i}
                        className="font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700"
                      >
                        {m.furnitureName}: ({m.fromPosition.x}, {m.fromPosition.y}) → ({m.toPosition.x}, {m.toPosition.y}) [{m.distanceCm} cm]
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 text-xs text-emerald-800 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Deficits:{" "}
                  <strong>
                    {beforeEval.summary.actionableDeficitsCount} → {activeCandidate.metrics.actionableDeficitsCount}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleApply(activeCandidate.id)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1e7168] text-white text-xs font-semibold hover:bg-[#175b54] transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply This Layout</span>
              </button>
              <button
                type="button"
                onClick={() => setStage("analysis")}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Back to Findings</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1 text-xs text-slate-500">
              {optResult?.status === "already_optimal"
                ? "Walking route has adequate clearance (0 actionable deficits). No fixture modifications needed."
                : optResult?.status === "infeasible"
                ? "No alternatives found within bounded search scope. Manual adjustments may be required."
                : "No alternative proposal active."}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStage("analysis")}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Back to Findings</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
