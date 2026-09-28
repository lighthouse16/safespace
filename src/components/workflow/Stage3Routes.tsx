"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
} from "lucide-react";

export function Stage3Routes() {
  const {
    routeWaypoints,
    selectedWaypointId,
    selectWaypoint,
    removeRouteWaypoint,
    recalculateRoute,
    isWalkerAnimating,
    setIsWalkerAnimating,
    runAnalysisTransition,
    setStage,
    getLiveMetrics,
  } = useSafeSpaceStore();

  const metrics = getLiveMetrics();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Route Waypoints & Metrics Management */}
        <aside className="w-72 bg-white border-r border-[#e2e8e4] flex flex-col justify-between p-3.5 z-10 shrink-0 select-none overflow-y-auto">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1e7168]">
                Stage 3 · Critical Routes
              </p>
              <h2 className="text-base font-bold text-[#192329] tracking-tight mt-0.5">
                Walking Route
              </h2>
            </div>

            {/* Key Metrics Strip */}
            <div className="grid grid-cols-2 gap-2 bg-[#f8faf8] p-2.5 rounded-lg border border-[#e2e8e4]">
              <div>
                <span className="text-[9px] uppercase font-semibold text-slate-400 block">
                  Route Length
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {metrics.routeLengthM} m
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase font-semibold text-slate-400 block">
                  Min Clearance
                </span>
                <span
                  className={`text-sm font-bold ${
                    metrics.minClearanceCm < 90 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {metrics.minClearanceCm} cm
                </span>
              </div>
            </div>

            {/* Inline Warning for Clearance Deficit */}
            {metrics.minClearanceCm < 90 && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">
                  Narrows to <strong>{metrics.minClearanceCm} cm</strong> at Chair C-04 (min 90 cm required).
                </span>
              </div>
            )}

            {/* Animation Controls */}
            <div className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white">
              <span className="text-xs font-medium text-slate-700">Simulate Gait</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsWalkerAnimating(!isWalkerAnimating)}
                  className={`p-1 rounded transition cursor-pointer ${
                    isWalkerAnimating
                      ? "bg-[#e8f3f1] text-[#1e7168]"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  title={isWalkerAnimating ? "Pause" : "Play"}
                >
                  {isWalkerAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={recalculateRoute}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                  title="Reset Route"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Waypoints List */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                Waypoints ({routeWaypoints.length})
              </span>

              <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                {routeWaypoints.map((pt, i) => {
                  const isSelected = selectedWaypointId === pt.id;
                  const isPinch = pt.id === "pt-4";

                  return (
                    <div
                      key={pt.id}
                      onClick={() => selectWaypoint(pt.id)}
                      className={`flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer transition ${
                        isSelected
                          ? "border-[#1e7168] bg-[#f0f7f5]"
                          : isPinch
                          ? "border-red-200 bg-red-50/70 text-red-900"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                            isPinch ? "bg-red-600" : "bg-[#1d63b8]"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium text-xs truncate max-w-[150px]">{pt.name}</span>
                      </div>

                      {routeWaypoints.length > 2 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRouteWaypoint(pt.id);
                          }}
                          className="p-0.5 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5">
            <button
              onClick={runAnalysisTransition}
              className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <span>Run Safety Analysis</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setStage("profile")}
              className="w-full py-1.5 px-2 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Back to Profile</span>
            </button>
          </div>
        </aside>

        {/* Central Canvas */}
        <main className="flex-1 h-full p-2.5 overflow-hidden flex flex-col">
          <Floorplan2D className="flex-1" />
        </main>
      </div>
    </div>
  );
}
