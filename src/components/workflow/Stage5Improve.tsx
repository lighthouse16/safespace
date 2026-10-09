"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  FileText,
  ChevronLeft,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Move,
} from "lucide-react";
import type { LayoutCandidate } from "@/lib/spatial";

export function Stage5Improve() {
  const {
    assessmentType,
    assessmentMetadata,
    furniture,
    baselineFurnitureSnapshot,
    routeResult,
    runOptimization,
    applyLayoutCandidate,
    revertLayoutCandidate,
    activeOptimizationResult,
    selectedCandidateId,
    selectCandidate,
    approvalStatus,
    setReportModalOpen,
    setStage,
    getSpatialFindings,
  } = useSafeSpaceStore();

  const isUserAssessment = assessmentType === "user";
  const [viewMode, setViewMode] = useState<"side-by-side" | "before" | "proposed">("side-by-side");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Run optimization if not yet performed
  useEffect(() => {
    if (!activeOptimizationResult) {
      runOptimization();
    }
  }, [activeOptimizationResult, runOptimization]);

  const optResult = activeOptimizationResult || null;
  const candidates = useMemo(() => optResult?.candidates || [], [optResult]);

  // Active candidate: selectedCandidateId or first candidate
  const activeCandidate: LayoutCandidate | null = useMemo(() => {
    if (!candidates || candidates.length === 0) return null;
    return candidates.find((c) => c.id === selectedCandidateId) || candidates[0];
  }, [candidates, selectedCandidateId]);

  // Baseline furniture: if a candidate was applied, use baselineFurnitureSnapshot; otherwise current furniture
  const baselineFurniture = useMemo(() => {
    return baselineFurnitureSnapshot || (optResult ? optResult.baselineEvaluation ? furniture : furniture : furniture);
  }, [baselineFurnitureSnapshot, optResult, furniture]);

  const baselineEval = optResult?.baselineEvaluation || getSpatialFindings();
  const baselineRoute = optResult?.baselineRouteResult || routeResult;

  const handleApply = (candId: string) => {
    const res = applyLayoutCandidate(candId);
    if (res.success) {
      setActionFeedback("Layout applied and persisted successfully.");
      setTimeout(() => setActionFeedback(null), 3500);
    } else {
      setActionFeedback(res.error || "Failed to apply layout.");
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handleRevert = () => {
    revertLayoutCandidate();
    setActionFeedback("Reverted back to baseline layout.");
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const isCurrentCandidateApplied =
    Boolean(activeCandidate && selectedCandidateId === activeCandidate.id && approvalStatus === "approved");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Top Stage 5 Toolbar */}
      <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1e7168]">
            Stage 5 · Layout Alternatives & Optimization
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500">
            {isUserAssessment
              ? assessmentMetadata?.facilityName || "Custom Assessment"
              : "Queen Care Clinic Fixture"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                viewMode === "side-by-side"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode("before")}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                viewMode === "before"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Before Only
            </button>
            <button
              onClick={() => setViewMode("proposed")}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                viewMode === "proposed"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Proposed Only
            </button>
          </div>

          <button
            onClick={() => setReportModalOpen(true)}
            className="px-2.5 py-1 rounded bg-[#1e7168] text-white text-xs font-semibold hover:bg-[#175b54] transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary Report</span>
          </button>
        </div>
      </div>

      {/* Candidate Selector Ribbon */}
      <div className="bg-white border-b border-slate-200 px-3.5 py-2 shrink-0 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Alternatives ({candidates.length}):
            </span>

            {candidates.length === 0 ? (
              <span className="text-xs text-slate-500 italic">
                {optResult?.status === "already_optimal"
                  ? "Baseline satisfies requirements (0 deficits). No changes required."
                  : optResult?.status === "infeasible"
                  ? "No collision-free alternative found within room constraints."
                  : "Optimization unavailable."}
              </span>
            ) : (
              candidates.map((cand) => {
                const isSelected = activeCandidate?.id === cand.id;
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
                        <span className="font-semibold text-slate-900">{cand.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                            cand.strategy === "minimal_displacement"
                              ? "bg-blue-100 text-blue-800"
                              : cand.strategy === "deficit_elimination"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {cand.strategy.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>{cand.moveCount} fixture move{cand.moveCount === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-medium">
                          {cand.metrics.actionableDeficitsDelta < 0
                            ? `${Math.abs(cand.metrics.actionableDeficitsDelta)} deficit${
                                Math.abs(cand.metrics.actionableDeficitsDelta) === 1 ? "" : "s"
                              } resolved`
                            : "Deficits resolved"}
                        </span>
                        {cand.metrics.clearanceGainCm > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">
                              +{cand.metrics.clearanceGainCm} cm clearance
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Action buttons on ribbon */}
          <div className="flex items-center gap-2 shrink-0">
            {activeCandidate && (
              <>
                {isCurrentCandidateApplied ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Applied to Active Plan</span>
                    </span>
                    <button
                      onClick={handleRevert}
                      className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      <span>Revert Baseline</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleApply(activeCandidate.id)}
                    className="px-3 py-1 rounded bg-[#1e7168] text-white text-xs font-semibold hover:bg-[#175b54] transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply This Layout</span>
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => runOptimization()}
              title="Re-run geometric solver"
              className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs transition cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Re-optimize</span>
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div className="mt-1.5 px-2.5 py-1 rounded text-xs bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>{actionFeedback}</span>
          </div>
        )}
      </div>

      {/* Main Floorplan Comparison Canvas */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden p-2 gap-2">
        {/* Left: Baseline Condition */}
        {(viewMode === "side-by-side" || viewMode === "before") && (
          <div
            className={`flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs w-full ${
              viewMode === "side-by-side" ? "flex-1 min-w-0" : "flex-1"
            }`}
          >
            <div className="h-8 bg-slate-50 border-b border-slate-200 px-3 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-xs font-bold text-slate-700">Before: Baseline Condition</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span
                  className={`font-semibold ${
                    baselineEval.summary.actionableDeficitsCount > 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {baselineEval.summary.actionableDeficitsCount} deficit{baselineEval.summary.actionableDeficitsCount === 1 ? "" : "s"}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">
                  Clr: {baselineEval.summary.minimumClearanceCm ? `${baselineEval.summary.minimumClearanceCm} cm` : "—"}
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <Floorplan2D
                readOnly={true}
                isBeforeCondition={true}
                customFurniture={baselineFurniture}
                customRouteResult={baselineRoute}
                customEvaluation={baselineEval}
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Right: Proposed Layout Alternative */}
        {(viewMode === "side-by-side" || viewMode === "proposed") && (
          <div
            className={`flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs w-full ${
              viewMode === "side-by-side" ? "flex-1 min-w-0" : "flex-1"
            }`}
          >
            <div className="h-8 bg-emerald-50/60 border-b border-emerald-100 px-3 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  {activeCandidate ? `Proposed: ${activeCandidate.name}` : "Proposed Alternative"}
                </span>
                {activeCandidate && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                    Verified
                  </span>
                )}
              </div>
              {activeCandidate ? (
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
                    Clr: {activeCandidate.metrics.minimumClearanceCm ? `${activeCandidate.metrics.minimumClearanceCm} cm` : "—"}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">No alternative active</span>
              )}
            </div>
            <div className="flex-1 min-h-0 relative">
              {activeCandidate ? (
                <Floorplan2D
                  readOnly={true}
                  customFurniture={activeCandidate.furniture}
                  customRouteResult={activeCandidate.routeResult}
                  customEvaluation={activeCandidate.evaluation}
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

      {/* Bottom Details Drawer: Exact Moves & Transparent Metrics */}
      {activeCandidate && (
        <div className="bg-white border-t border-slate-200 px-4 py-2.5 shrink-0 select-none max-h-40 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Optimization Summary: {activeCandidate.name}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600">{activeCandidate.description}</span>
              </div>

              {/* Exact fixture moves list */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Fixture Adjustments:
                </span>
                {activeCandidate.moves.map((move, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-mono"
                  >
                    <Move className="w-3 h-3 text-[#1e7168]" />
                    <span className="font-semibold text-slate-900 font-sans">{move.furnitureName}:</span>
                    <span>
                      ({move.fromPosition.x}, {move.fromPosition.y})
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="text-[#1e7168] font-bold">
                      ({move.toPosition.x}, {move.toPosition.y})
                    </span>
                    <span className="text-slate-400 font-sans text-[11px]">
                      ({move.distanceCm} cm{move.rotationDelta ? `, ${move.rotationDelta}°` : ""})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transparent metric badges: NO fake HKD, NO fake fall risks */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-xs text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Deficits:{" "}
                  <strong>
                    {baselineEval.summary.actionableDeficitsCount} → {activeCandidate.metrics.actionableDeficitsCount}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700">
                <span>
                  Moves: <strong>{activeCandidate.moveCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700">
                <span>
                  Displacement: <strong>{activeCandidate.totalDisplacementCm} cm</strong>
                </span>
              </div>
              <button
                onClick={() => setStage("analysis")}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Back to Findings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
