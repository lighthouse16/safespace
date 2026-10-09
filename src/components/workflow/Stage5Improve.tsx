"use client";

import React, { useState } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import { Floorplan3D } from "@/components/spatial/Floorplan3D";
import { LAYOUT_ALTERNATIVES } from "@/lib/spatial-model";
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FileText,
  Columns,
  SplitSquareVertical,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Box,
} from "lucide-react";

export function Stage5Improve() {
  const {
    assessmentType,
    assessmentMetadata,
    loadDemoAssessment,
    viewMode,
    setViewMode,
    selectedAlternativeId,
    selectAlternative,
    compareMode,
    setCompareMode,
    compareSliderPosition,
    setCompareSliderPosition,
    proposedFurniture,
    moveProposedFurniture,
    furniture: originalFurniture,
    approvalStatus,
    approvePlan,
    setReportModalOpen,
    setStage,
    getLiveMetrics,
  } = useSafeSpaceStore();

  const metrics = getLiveMetrics();
  const currentAlt = LAYOUT_ALTERNATIVES[selectedAlternativeId];

  const [subTab, setSubTab] = useState<"compare" | "review">("compare");
  const [showChangedOnly, setShowChangedOnly] = useState<boolean>(false);
  const [otChecklist, setOtChecklist] = useState<Record<string, boolean>>({
    turnaround: true,
    handrail: true,
    threshold: false,
    gaitTrial: false,
  });

  const toggleChecklist = (key: string) => {
    setOtChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (assessmentType === "user") {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
        {/* Top Stage 5 Toolbar */}
        <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#1e7168]">
              Stage 5 · Layout Optimization
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500">
              {assessmentMetadata?.facilityName || "Custom Assessment"}
            </span>
          </div>
          <button
            onClick={() => setReportModalOpen(true)}
            className="px-2.5 py-1 rounded bg-[#1e7168] text-white text-xs font-semibold hover:bg-[#175b54] transition cursor-pointer flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Summary Report</span>
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-[#1e7168]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Layout Improvement Pending for Custom Spaces
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Automated furniture rearrangement and fixture recommendations are currently calibrated to the Queen Care Clinic demonstration scenario. Custom space alternative layout authoring is scheduled for Gate 3.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-left text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Active Space:</span>
                <span className="font-semibold">{assessmentMetadata?.spaceName || "Custom Space"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Clearance Margin:</span>
                <span className="font-semibold text-emerald-700">{metrics.minClearanceCm} cm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Critical Route Length:</span>
                <span className="font-semibold">{metrics.routeLengthM} m</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setStage("routes")}
                className="w-full py-2 px-3 bg-[#1e7168] text-white rounded-lg text-xs font-semibold hover:bg-[#185e56] transition cursor-pointer"
              >
                Back to Route Clearance (Stage 3)
              </button>
              <button
                onClick={loadDemoAssessment}
                className="w-full py-2 px-3 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Switch to Demo Clinic Scenario
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Top Stage 5 Toolbar */}
      <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
        {/* Sub-tab selection */}
        <div className="flex items-center gap-1 bg-[#f1f5f3] p-0.5 rounded-lg border border-[#e2e8e4] text-xs">
          <button
            onClick={() => setSubTab("compare")}
            className={`px-2.5 py-0.5 rounded font-semibold transition cursor-pointer ${
              subTab === "compare"
                ? "bg-white text-[#1e7168] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Before & After
          </button>
          <button
            onClick={() => setSubTab("review")}
            className={`px-2.5 py-0.5 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
              subTab === "review"
                ? "bg-white text-[#1e7168] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileCheck className="w-3 h-3" />
            <span>Review & Approval</span>
          </button>
        </div>

        {/* View Controls & Comparison Mode */}
        <div className="flex items-center gap-2">
          {/* Changed objects only toggle */}
          {subTab === "compare" && (
            <button
              onClick={() => setShowChangedOnly(!showChangedOnly)}
              className={`px-2 py-0.5 rounded text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
                showChangedOnly
                  ? "bg-[#e8f3f1] border-[#1e7168] text-[#1e7168]"
                  : "bg-white border-[#e2e8e4] text-slate-600 hover:bg-slate-50"
              }`}
              title="Filter to changed objects only (dim unchanged items)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e7168]" />
              <span>Show changed only</span>
            </button>
          )}

          {/* 2D / 3D Toggle */}
          <div className="flex items-center gap-0.5 bg-[#f1f5f3] p-0.5 rounded-lg border border-[#e2e8e4] text-xs">
            <button
              onClick={() => setViewMode("2d")}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === "2d" ? "bg-white text-[#1e7168] shadow-xs" : "text-slate-600"
              }`}
            >
              2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                viewMode === "3d" ? "bg-white text-[#1e7168] shadow-xs" : "text-slate-600"
              }`}
            >
              <Box className="w-3 h-3" />
              <span>3D</span>
            </button>
          </div>

          {/* Comparison Mode Toggle */}
          {subTab === "compare" && (
            <div className="hidden sm:flex items-center gap-0.5 bg-[#f1f5f3] p-0.5 rounded-lg border border-[#e2e8e4] text-xs">
              <button
                onClick={() => setCompareMode("side-by-side")}
                className={`p-1 rounded transition cursor-pointer ${
                  compareMode === "side-by-side" ? "bg-white text-[#1e7168] shadow-xs" : "text-slate-600"
                }`}
                title="Side by Side"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCompareMode("slider")}
                className={`p-1 rounded transition cursor-pointer ${
                  compareMode === "slider" ? "bg-white text-[#1e7168] shadow-xs" : "text-slate-600"
                }`}
                title="Split Slider"
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Primary Workspace */}
        <main className="flex-1 h-full p-2.5 overflow-hidden flex flex-col">
          {subTab === "compare" ? (
            compareMode === "side-by-side" ? (
              /* Side-by-Side View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 h-full">
                {/* Before Condition */}
                <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Before</span>
                      <span className="text-[10px] text-slate-500">(Original Layout)</span>
                    </div>
                    <span className="font-mono text-[11px] text-red-600 font-bold">
                      Original · 54 cm min
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {viewMode === "2d" ? (
                      <Floorplan2D
                        customFurniture={originalFurniture}
                        readOnly
                        isBeforeCondition={true}
                      />
                    ) : (
                      <Floorplan3D
                        customFurniture={originalFurniture}
                        isBeforeCondition={true}
                      />
                    )}
                  </div>
                </div>

                {/* After Condition */}
                <div className="flex flex-col h-full bg-white rounded-lg border-2 border-[#1e7168] overflow-hidden">
                  <div className="px-2.5 py-1 bg-[#f0f7f5] border-b border-[#b8d9d4] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#1e7168]">
                        After · {currentAlt.title}
                      </span>
                      {showChangedOnly && (
                        <span className="text-[10px] bg-[#1e7168] text-white px-1 rounded font-medium">
                          Changes Isolated
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-emerald-700 font-bold">
                      Clearance {metrics.minClearanceCm} cm
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    {viewMode === "2d" ? (
                      <Floorplan2D
                        customFurniture={proposedFurniture}
                        onCustomMove={moveProposedFurniture}
                        overrideStage="improve"
                        showDiffGhost={true}
                        showChangedOnly={showChangedOnly}
                      />
                    ) : (
                      <Floorplan3D customFurniture={proposedFurniture} />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Draggable Split Slider View */
              <div className="relative h-full w-full rounded-lg border border-slate-300 overflow-hidden bg-white select-none">
                <div className="absolute inset-0">
                  {viewMode === "2d" ? (
                    <Floorplan2D
                      customFurniture={proposedFurniture}
                      onCustomMove={moveProposedFurniture}
                      overrideStage="improve"
                      showDiffGhost={true}
                      showChangedOnly={showChangedOnly}
                    />
                  ) : (
                    <Floorplan3D customFurniture={proposedFurniture} />
                  )}
                </div>

                <div
                  className="absolute inset-0 overflow-hidden border-r-2 border-white shadow-xl"
                  style={{ width: `${compareSliderPosition}%` }}
                >
                  <div className="w-[100vw] h-full pointer-events-none">
                    {viewMode === "2d" ? (
                      <Floorplan2D
                        customFurniture={originalFurniture}
                        readOnly
                        isBeforeCondition={true}
                      />
                    ) : (
                      <Floorplan3D
                        customFurniture={originalFurniture}
                        isBeforeCondition={true}
                      />
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={compareSliderPosition}
                  onChange={(e) => setCompareSliderPosition(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                />

                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center justify-center"
                  style={{ left: `calc(${compareSliderPosition}% - 12px)` }}
                >
                  <div className="w-6 h-6 rounded-full bg-white shadow border border-slate-300 flex items-center justify-center text-slate-700 text-[10px] font-bold">
                    ⇄
                  </div>
                </div>

                <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded bg-black/60 text-white text-[11px] backdrop-blur-xs font-medium">
                  Original (Baseline · 54 cm min)
                </div>
                <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded bg-[#1e7168]/90 text-white text-[11px] backdrop-blur-xs font-medium">
                  Proposed ({currentAlt.title} · {metrics.minClearanceCm} cm min)
                </div>
              </div>
            )
          ) : (
            /* Review & Professional Approval */
            <div className="h-full bg-white rounded-lg border border-[#e2e8e4] p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Approval Header Card */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  approvalStatus === "approved"
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#1e7168]" />
                    <h3 className="font-bold text-sm text-slate-900">
                      {approvalStatus === "approved"
                        ? "Plan Approved for Implementation"
                        : "Ready for Professional Sign-off"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Balanced Layout achieves 96 cm clearance throughout critical route (Threshold ≥ 90 cm).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1 transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>

                  {approvalStatus !== "approved" ? (
                    <button
                      onClick={approvePlan}
                      className="px-3.5 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Plan</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approved
                    </span>
                  )}
                </div>
              </div>

              {/* Layout Preview & Metrics Matrix Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* Visual Thumbnail */}
                <div className="lg:col-span-5 border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex flex-col">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>Proposed Layout Layout Preview</span>
                    <span className="font-mono text-[11px] text-[#1e7168]">Balanced (HK$850)</span>
                  </div>
                  <div className="h-44 w-full bg-white rounded border border-slate-200 overflow-hidden relative">
                    <Floorplan2D
                      customFurniture={proposedFurniture}
                      readOnly
                      overrideStage="improve"
                      showDiffGhost={true}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Green: moved items (C-04) · Red dashed: former pinch location · Solid line: 2.4 m wall handrail
                  </span>
                </div>

                {/* Metrics Comparison Matrix */}
                <div className="lg:col-span-7 border border-slate-200 rounded-lg p-3 bg-white flex flex-col justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Before vs. After Metrics Comparison
                  </h4>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-medium">
                        <th className="pb-1.5">Parameter</th>
                        <th className="pb-1.5">Before</th>
                        <th className="pb-1.5">After</th>
                        <th className="pb-1.5">Standard</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      <tr>
                        <td className="py-1.5 font-sans font-medium text-slate-800">Safety Scoring (EHS)</td>
                        <td className="py-1.5 text-slate-500 font-sans">Pending OT</td>
                        <td className="py-1.5 text-slate-500 font-sans">Pending OT</td>
                        <td className="py-1.5 text-slate-500 font-sans">Disabled (no validation)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-sans font-medium text-slate-800">Minimum Clearance</td>
                        <td className="py-1.5 text-red-600 font-bold">54 cm</td>
                        <td className="py-1.5 text-emerald-700 font-bold">{metrics.minClearanceCm} cm</td>
                        <td className="py-1.5 text-slate-500 font-sans">≥ 90 cm (Rollator)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-sans font-medium text-slate-800">Critical Bottlenecks</td>
                        <td className="py-1.5 text-red-600 font-bold">2 points</td>
                        <td className="py-1.5 text-emerald-700 font-bold">0 points</td>
                        <td className="py-1.5 text-slate-500 font-sans">0 bottlenecks</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-sans font-medium text-slate-800">Tripping Hazards</td>
                        <td className="py-1.5 text-amber-600 font-bold">1 (Loose mat)</td>
                        <td className="py-1.5 text-emerald-700 font-bold">0 (Removed)</td>
                        <td className="py-1.5 text-slate-500 font-sans">Zero loose rugs</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remaining Warnings & Residual Considerations */}
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 text-xs">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Residual Considerations & Post-Installation Cautions</span>
                </div>
                <div className="mt-1.5 space-y-1 text-amber-900 text-[11px]">
                  <p>• <strong>Doorway threshold rise (8 mm):</strong> Recommend installing a 1:12 beveled rubber transition reducer strip to prevent caster snagging.</p>
                  <p>• <strong>Lighting verification:</strong> Verify 3000K illumination delivers minimum 150 lux at floor level before evening consultations.</p>
                </div>
              </div>

              {/* OT On-Site Verification Protocol */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Occupational Therapist On-Site Verification Checklist
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: "turnaround", label: "Verify 150 cm turning circle in consultation room for rollator & wheelchair" },
                    { key: "handrail", label: "Confirm wall studs and load capacity (1.3 kN downward) for 2.4 m handrail" },
                    { key: "threshold", label: "Verify transition bevel flushness (< 6 mm vertical rise without bevel)" },
                    { key: "gaitTrial", label: "Supervise client functional ambulation trial across revised route" },
                  ].map((chk) => (
                    <label
                      key={chk.key}
                      onClick={() => toggleChecklist(chk.key)}
                      className="p-2.5 rounded border border-slate-200 bg-slate-50/50 flex items-start gap-2 cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      <input
                        type="checkbox"
                        checked={!!otChecklist[chk.key]}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-[#1e7168] focus:ring-[#1e7168]"
                      />
                      <span className={`text-slate-800 text-[11px] leading-relaxed ${otChecklist[chk.key] ? "line-through text-slate-400" : ""}`}>
                        {chk.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Side: Options & Metrics */}
        <aside className="w-80 bg-white border-l border-[#e2e8e4] flex flex-col justify-between p-3.5 z-10 shrink-0 select-none overflow-y-auto">
          <div className="space-y-3.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1e7168]">
                Stage 5 · Layout Optimization
              </p>
              <h2 className="text-sm font-bold text-[#192329] mt-0.5">
                Safer Layout Alternatives
              </h2>
            </div>

            {/* Constraint inline warning */}
            {metrics.constraintWarning && (
              <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-medium text-[11px]">{metrics.constraintWarning}</span>
              </div>
            )}

            {/* Alternatives Selector Table */}
            <div className="space-y-1.5">
              {(["min-cost", "balanced", "max-safety"] as const).map((altId) => {
                const alt = LAYOUT_ALTERNATIVES[altId];
                const isSelected = selectedAlternativeId === altId;

                return (
                  <button
                    key={altId}
                    onClick={() => selectAlternative(altId)}
                    className={`w-full p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      isSelected
                        ? "border-[#1e7168] bg-[#f0f7f5] ring-1 ring-[#1e7168]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs text-slate-900">
                          {alt.title}
                        </span>
                        {alt.isRecommended && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-[#1e7168] text-white">
                            Rec
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        HK${alt.costHkd}
                      </span>
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-emerald-700 font-bold capitalize">{alt.id.replace("-", " ")}</span>
                      <span>Clear: {alt.minClearanceCm} cm</span>
                      <span className="text-slate-400">{alt.furnitureMovesCount} moves</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Delta Summary */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs font-mono">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
                Improvement Summary
              </span>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Evaluation:</span>
                <span className="font-bold text-emerald-700 font-sans">
                  Deterministic Geometry
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Clearance:</span>
                <span className="font-bold">
                  <span className="text-red-600">54 cm</span> →{" "}
                  <span className="text-emerald-700">{metrics.minClearanceCm} cm</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Route:</span>
                <span className="font-bold">11.8 m → {metrics.routeLengthM} m</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-sans">
                <span className="text-slate-500">Cost:</span>
                <span className="font-mono font-bold text-slate-900">
                  HK${currentAlt.costHkd}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
            {subTab === "compare" ? (
              <button
                onClick={() => setSubTab("review")}
                className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <span>Proceed to Review</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setReportModalOpen(true)}
                className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Preview Report</span>
              </button>
            )}

            <button
              onClick={() => setStage("analysis")}
              className="w-full py-1.5 px-2 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Back to Analysis</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
