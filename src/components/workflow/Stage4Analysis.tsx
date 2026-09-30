"use client";

import React, { useState } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import { Floorplan3D } from "@/components/spatial/Floorplan3D";
import {
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Box,
} from "lucide-react";

export function Stage4Analysis() {
  const {
    viewMode,
    setViewMode,
    layerToggles,
    toggleLayer,
    hazards,
    selectedHazardId,
    selectHazard,
    setStage,
    getLiveMetrics,
    setCameraPreset,
  } = useSafeSpaceStore();

  const metrics = getLiveMetrics();
  const [filterSeverity, setFilterSeverity] = useState<"all" | "high" | "medium">("all");

  const filteredHazards = hazards.filter((h) =>
    filterSeverity === "all" ? true : h.severity === filterSeverity
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Top View Toolbar */}
      <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
        {/* 2D / 3D Switcher */}
        <div className="flex items-center gap-1 bg-[#f1f5f3] p-0.5 rounded-lg border border-[#e2e8e4]">
          <button
            onClick={() => setViewMode("2d")}
            className={`px-2.5 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
              viewMode === "2d"
                ? "bg-white text-[#1e7168] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2D Plan
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`px-2.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
              viewMode === "3d"
                ? "bg-white text-[#1e7168] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Box className="w-3 h-3" />
            <span>3D Iso</span>
          </button>
        </div>

        {/* 2D Layer Toggles */}
        {viewMode === "2d" && (
          <div className="hidden sm:flex items-center gap-1 text-xs">
            {(
              [
                { id: "route", label: "Route" },
                { id: "clearance", label: "Clearance" },
                { id: "heatmap", label: "Heatmap" },
                { id: "hazards", label: "Hazards" },
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
        )}

        {/* 3D View Presets */}
        {viewMode === "3d" && (
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setCameraPreset("isometric")}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] transition cursor-pointer"
            >
              Iso
            </button>
            <button
              onClick={() => setCameraPreset("top")}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] transition cursor-pointer"
            >
              Top
            </button>
            <button
              onClick={() => setCameraPreset("reset")}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] transition cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Primary Spatial Canvas */}
        <main className="flex-1 h-full p-2.5 overflow-hidden flex flex-col">
          {viewMode === "2d" ? (
            <Floorplan2D className="flex-1" />
          ) : (
            <Floorplan3D className="flex-1" />
          )}
        </main>

        {/* Right Hazard List Panel */}
        <aside className="w-96 sm:w-[420px] bg-white border-l border-[#e2e8e4] flex flex-col justify-between p-4 z-10 shrink-0 select-none overflow-y-auto">
          <div className="space-y-3.5">
            {/* Top Score Banner */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50/70">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-red-800">
                    Environmental Risk Index
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold text-red-950 font-mono">
                      {metrics.riskIndex}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-red-600 text-white">
                      {metrics.riskLevel}
                    </span>
                  </div>
                </div>
                <ShieldAlert className="w-7 h-7 text-red-600 stroke-[1.5]" />
              </div>

              {/* 3 Metrics */}
              <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-red-200/60 text-center font-mono text-[11px]">
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[9px] text-slate-400 block">CLEARANCE</span>
                  <span className="font-bold text-red-700">{metrics.minClearanceCm} cm</span>
                </div>
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[9px] text-slate-400 block">TOTAL HAZARDS</span>
                  <span className="font-bold text-slate-800">{metrics.activeHazardsCount}</span>
                </div>
                <div className="bg-white/80 p-1 rounded">
                  <span className="text-[9px] text-slate-400 block">CRITICAL</span>
                  <span className="font-bold text-red-700">{metrics.highPriorityHazardsCount}</span>
                </div>
              </div>
            </div>

            {/* Configured Demo Threshold Notice */}
            <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-snug">
              <span className="font-semibold text-slate-800">Configured Demo Threshold:</span> Clearance ≥ 90 cm · Demonstration Risk: 68. Baseline for occupational therapy review.
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Identified Hazards ({hazards.length})
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                {(["all", "high", "medium"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2 py-0.5 rounded capitalize transition cursor-pointer ${
                      filterSeverity === sev
                        ? "bg-[#1e7168] text-white font-medium"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Hazard Inspector Detail Card (if selected) */}
            {selectedHazardId && (() => {
              const sel = hazards.find((h) => h.id === selectedHazardId);
              if (!sel) return null;
              const isHigh = sel.severity === "high";

              return (
                <div className="p-3 rounded-lg border-2 border-[#1e7168] bg-[#f0f7f5] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e7168]">
                      Selected Hazard Detail
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                        isHigh ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {sel.severity} priority
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs leading-snug">
                    {sel.title}
                  </h4>
                  <p className="text-slate-700 text-[11px] leading-relaxed">
                    {sel.plainDescription}
                  </p>
                  <div className="p-2 rounded bg-white/80 border border-[#b8d9d4] space-y-1 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-500">Measured Evidence: </span>
                      <span className="font-mono font-medium text-red-700">{sel.measuredEvidence}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Recommendation: </span>
                      <span className="text-emerald-800 font-medium">{sel.recommendation}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Prioritised Hazard List (No title truncations!) */}
            <div className="space-y-2 max-h-[calc(100vh-27rem)] overflow-y-auto pr-0.5">
              {filteredHazards.map((h, i) => {
                const isSelected = selectedHazardId === h.id;
                const isHigh = h.severity === "high";

                return (
                  <div
                    key={h.id}
                    onClick={() => selectHazard(h.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? "border-[#1e7168] bg-[#f0f7f5] ring-1 ring-[#1e7168]"
                        : isHigh
                        ? "border-red-200 bg-white hover:bg-red-50/20"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span
                          className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
                            isHigh ? "bg-red-600" : "bg-amber-600"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <h4 className="font-semibold text-slate-900 leading-snug">
                          {h.title}
                        </h4>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wide shrink-0 ${
                          isHigh
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {h.severity}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px] mt-1.5 leading-relaxed">
                      {h.plainDescription}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                      <span className="font-mono text-slate-700 text-[10px]">{h.measuredEvidence}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectHazard(h.id);
                        }}
                        className="text-[#1e7168] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer text-[11px]"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <p className="text-[10px] text-slate-400 leading-tight">
              Demonstration environmental index for professional OT review. Not clinical diagnosis.
            </p>
          </div>

          {/* Action Footer */}
          <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
            <button
              onClick={() => setStage("improve")}
              className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <span>Generate Safer Layouts</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setStage("routes")}
              className="w-full py-1.5 px-2 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Back to Routes</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
