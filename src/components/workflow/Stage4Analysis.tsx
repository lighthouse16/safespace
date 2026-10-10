"use client";

import React, { useState, useEffect } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  MapPin,
} from "lucide-react";
import type { SpatialFindingClassification } from "@/lib/spatial";

export function Stage4Analysis() {
  const {
    assessmentType,
    assessmentMetadata,
    activeProfile,
    viewMode,
    setViewMode,
    layerToggles,
    toggleLayer,
    selectedFindingId,
    selectFinding,
    setStage,
    getSpatialFindings,
  } = useSafeSpaceStore();

  useEffect(() => {
    if (viewMode === "3d") {
      setViewMode("2d");
    }
  }, [viewMode, setViewMode]);

  const evaluation = getSpatialFindings();
  const { summary, findings } = evaluation;
  const isUserAssessment = assessmentType === "user";

  const [mobileTab, setMobileTab] = useState<"both" | "plan" | "findings">("both");
  const [filterClassification, setFilterClassification] = useState<
    "all" | SpatialFindingClassification
  >("all");

  const filteredFindings = findings.filter((f) =>
    filterClassification === "all" ? true : f.classification === filterClassification
  );

  const selectedFinding = findings.find((f) => f.id === selectedFindingId);

  const isDeficit = summary.actionableDeficitsCount > 0;
  const isUnconfigured = summary.routeFeasibility === "unconfigured";
  const isInvalidGeometry = summary.routeFeasibility === "invalid-geometry";
  const isOutOfBounds = summary.routeFeasibility === "out-of-bounds";
  const isUnreachable = summary.routeFeasibility === "unreachable";
  const isPendingValidation = isUnconfigured || isInvalidGeometry || isOutOfBounds;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Top View Toolbar */}
      <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-2">
          {/* 2D Plan Active */}
          <div className="flex items-center gap-1 bg-[#f1f5f3] p-0.5 rounded-lg border border-[#e2e8e4]">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-white text-[#1e7168] shadow-xs">
              2D Clearance Plan
            </span>
          </div>

          {/* Mobile / Tablet View Switcher [Both | Plan | Findings] */}
          <div className="flex lg:hidden items-center gap-0.5 bg-[#f1f5f3] p-0.5 rounded-lg border border-[#e2e8e4]">
            {(
              [
                { id: "both", label: "Both" },
                { id: "plan", label: "Plan" },
                { id: "findings", label: "Findings" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  mobileTab === t.id
                    ? "bg-white text-[#1e7168] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2D Layer Toggles */}
        <div className="hidden sm:flex items-center gap-1 text-xs">
          {(
            [
              { id: "route", label: "Route" },
              { id: "clearance", label: "Clearance" },
              { id: "heatmap", label: "Heatmap" },
              { id: "hazards", label: "Findings" },
              { id: "dimensions", label: "Dim" },
            ] as const
          ).map((l) => (
            <button
              key={l.id}
              onClick={() => toggleLayer(l.id)}
              className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                layerToggles[l.id]
                  ? "bg-[#e8f3f1] text-[#1e7168] font-medium"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body: Responsive flex container */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Primary Spatial Canvas */}
        <main
          className={
            mobileTab === "findings"
              ? "hidden lg:flex flex-1 h-full p-2.5 overflow-hidden flex-col"
              : mobileTab === "both"
              ? "h-[320px] sm:h-[400px] lg:h-full lg:flex-1 shrink-0 lg:shrink p-2.5 overflow-hidden flex flex-col border-b lg:border-b-0 border-[#e2e8e4]"
              : "flex-1 h-full p-2.5 overflow-hidden flex flex-col"
          }
        >
          <Floorplan2D className="flex-1" />
        </main>

        {/* Right Evidence & Findings Panel */}
        <aside
          className={
            mobileTab === "plan"
              ? "hidden lg:flex w-full lg:w-[420px] bg-white lg:border-l border-[#e2e8e4] flex-col justify-between p-4 z-10 shrink-0 select-none overflow-y-auto"
              : "flex-1 lg:flex-initial w-full lg:w-[420px] bg-white lg:border-l border-[#e2e8e4] flex flex-col justify-between p-4 z-10 shrink-0 select-none overflow-y-auto"
          }
        >
          <div className="space-y-3.5">
            {/* Top Evidence Evaluation Banner */}
            <div
              className={`p-3 rounded-lg border ${
                isPendingValidation
                  ? "border-amber-200 bg-amber-50/70"
                  : isUnreachable || isDeficit
                  ? "border-red-200 bg-red-50/70"
                  : "border-emerald-200 bg-emerald-50/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isPendingValidation
                        ? "text-amber-800"
                        : isUnreachable || isDeficit
                        ? "text-red-800"
                        : "text-emerald-800"
                    }`}
                  >
                    Spatial Route & Boundary Evaluation
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span
                      className={`text-base font-bold leading-tight ${
                        isPendingValidation
                          ? "text-amber-950"
                          : isUnreachable || isDeficit
                          ? "text-red-950"
                          : "text-emerald-950"
                      }`}
                    >
                      {summary.overallStatusLabel}
                    </span>
                  </div>
                </div>
                {isPendingValidation ? (
                  <AlertCircle className="w-6 h-6 text-amber-600 stroke-[1.8] shrink-0" />
                ) : isUnreachable || isDeficit ? (
                  <ShieldAlert className="w-6 h-6 text-red-600 stroke-[1.8] shrink-0" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-emerald-600 stroke-[1.8] shrink-0" />
                )}
              </div>

              {/* 4 Objective Metrics */}
              <div className="grid grid-cols-4 gap-1 pt-2 mt-2 border-t border-slate-200/60 text-center font-mono text-[10px]">
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[8px] text-slate-400 block font-sans">CLEARANCE</span>
                  <span
                    className={`font-bold ${
                      summary.minimumClearanceCm !== null &&
                      summary.requiredClearanceRadiusCm !== null &&
                      summary.minimumClearanceCm >= summary.requiredClearanceRadiusCm
                        ? "text-emerald-700"
                        : summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0
                        ? "text-red-700"
                        : "text-slate-400"
                    }`}
                  >
                    {summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0 ? `${summary.minimumClearanceCm} cm` : "—"}
                  </span>
                </div>
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[8px] text-slate-400 block font-sans">ROUTE</span>
                  <span className="font-bold text-slate-800">
                    {summary.pathLengthM !== null && summary.pathLengthM > 0 ? `${summary.pathLengthM} m` : "—"}
                  </span>
                </div>
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[8px] text-slate-400 block font-sans">DEFICITS</span>
                  <span
                    className={`font-bold ${
                      summary.actionableDeficitsCount > 0
                        ? "text-red-700"
                        : summary.routeFeasibility === "adequate"
                        ? "text-emerald-700"
                        : "text-slate-500"
                    }`}
                  >
                    {summary.actionableDeficitsCount}
                  </span>
                </div>
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[8px] text-slate-400 block font-sans">UNASSESSED</span>
                  <span className="font-bold text-slate-600">
                    {summary.unassessedScopeCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Scope & Standards Disclaimer */}
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-snug">
              <span className="font-semibold text-slate-800">
                {isUserAssessment
                  ? `Custom Assessment (${assessmentMetadata?.spaceName || "User Space"}): `
                  : "Example Clinic Scenario: "}
              </span>
              Findings are derived from 2D room geometry and active route clearance ({summary.corridorWidthCm !== null && summary.corridorWidthCm > 0 ? `target: ≥ ${summary.corridorWidthCm} cm for ${activeProfile.name}` : `target width for ${activeProfile.name}`}). 3D structures, grab bar anchorage, and non-holonomic turns are not assessed in 2D evaluation. Not statutory or clinical certification.
            </div>

            {/* Classification Filter Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
              <span className="font-semibold text-slate-700">
                Evidence Findings ({findings.length})
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                {(
                  [
                    { id: "all", label: `All (${findings.length})` },
                    { id: "actionable-deficit", label: `Deficits (${summary.actionableDeficitsCount})` },
                    { id: "advisory-observation", label: `Advisory (${summary.advisoryObservationsCount})` },
                    { id: "unassessed-scope", label: `Unassessed (${summary.unassessedScopeCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterClassification(tab.id)}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      filterClassification === tab.id
                        ? "bg-[#1e7168] text-white font-medium"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Finding Detail Card (if selected) */}
            {selectedFinding && (
              <div className="p-3 rounded-lg border-2 border-[#1e7168] bg-[#f0f7f5] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e7168]">
                    Selected Finding Detail
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                        selectedFinding.classification === "actionable-deficit"
                          ? "bg-red-100 text-red-800"
                          : selectedFinding.classification === "advisory-observation"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {selectedFinding.classification.replace("-", " ")}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                        selectedFinding.severity === "critical" || selectedFinding.severity === "high"
                          ? "bg-red-100 text-red-800"
                          : selectedFinding.severity === "medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {selectedFinding.severity}
                    </span>
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 text-xs leading-snug">
                  {selectedFinding.title}
                </h4>

                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {selectedFinding.description}
                </p>

                <div className="p-2 rounded bg-white/90 border border-[#b8d9d4] space-y-1 text-[11px]">
                  {selectedFinding.evidence.measuredQuantity && (
                    <div>
                      <span className="font-semibold text-slate-500">Measured: </span>
                      <span className="font-mono font-medium text-red-700">
                        {selectedFinding.evidence.measuredQuantity}
                      </span>
                    </div>
                  )}
                  {selectedFinding.evidence.requiredQuantity && (
                    <div>
                      <span className="font-semibold text-slate-500">Requirement: </span>
                      <span className="font-mono font-medium text-slate-800">
                        {selectedFinding.evidence.requiredQuantity}
                      </span>
                    </div>
                  )}
                  {selectedFinding.evidence.margin && (
                    <div>
                      <span className="font-semibold text-slate-500">Margin: </span>
                      <span className="font-mono font-semibold text-slate-900">
                        {selectedFinding.evidence.margin}
                      </span>
                    </div>
                  )}
                  {selectedFinding.evidence.failureReason && (
                    <div>
                      <span className="font-semibold text-slate-500">Diagnostic: </span>
                      <span className="text-amber-800 font-medium">
                        {selectedFinding.evidence.failureReason}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-500">Source: </span>
                    <span className="font-mono text-slate-700">
                      {selectedFinding.evidence.source}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Recommendation: </span>
                    <span className="text-emerald-800 font-medium">
                      {selectedFinding.recommendation}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Findings List */}
            <div className="space-y-2 max-h-[calc(100vh-27rem)] overflow-y-auto pr-0.5">
              {filteredFindings.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-700 font-semibold">
                    {filterClassification === "actionable-deficit"
                      ? `All configured routes meet the clearance target (${activeProfile.minClearanceCm} cm). No bottlenecks detected.`
                      : "No findings in this category"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Adjust the category filter above to inspect other findings or unassessed scope.
                  </p>
                </div>
              ) : (
                filteredFindings.map((f, i) => {
                  const isSelected = selectedFindingId === f.id;
                  const isCriticalOrHigh = f.severity === "critical" || f.severity === "high";

                  return (
                    <button
                      type="button"
                      key={f.id}
                      aria-pressed={isSelected}
                      onClick={() => selectFinding(f.id)}
                      className={`w-full text-left p-3 rounded-lg border text-xs cursor-pointer transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1e7168] ${
                        isSelected
                          ? "border-[#1e7168] bg-[#f0f7f5] ring-1 ring-[#1e7168]"
                          : f.classification === "actionable-deficit"
                          ? "border-red-200 bg-white hover:bg-red-50/20"
                          : f.classification === "advisory-observation"
                          ? "border-blue-100 bg-white hover:bg-blue-50/20"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span
                            className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
                              f.classification === "actionable-deficit"
                                ? "bg-red-600"
                                : f.classification === "advisory-observation"
                                ? "bg-blue-600"
                                : "bg-slate-500"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <h3 className="font-semibold text-slate-900 leading-snug text-xs">
                            {f.title}
                          </h3>
                        </div>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wide shrink-0 ${
                            isCriticalOrHigh
                              ? "bg-red-100 text-red-800"
                              : f.classification === "advisory-observation"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {f.severity}
                        </span>
                      </div>

                      <p className="text-slate-600 text-[11px] mt-1.5 leading-relaxed">
                        {f.description}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-700">
                            {f.evidence.measuredQuantity || f.evidence.margin || f.evidence.source}
                          </span>
                        </div>
                        {f.location && (
                          <span className="text-[10px] text-[#1e7168] flex items-center gap-0.5 font-medium">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>View on plan</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Disclaimer */}
            <p className="text-[10px] text-slate-400 leading-tight">
              Deterministic 2D spatial clearance and footprint evaluation. Does not claim statutory building code certification or clinical diagnosis.
            </p>
          </div>

          {/* Action Footer */}
          <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
            <button
              type="button"
              onClick={() => setStage("improve")}
              className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <span>Explore Layout Improvements</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setStage("routes")}
              className="w-full py-1.5 px-2 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Back to Route Clearance (Stage 3)</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
