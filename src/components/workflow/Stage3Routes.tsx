"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import { MOBILITY_PROFILES } from "@/lib/spatial-model";
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Plus,
  ShieldCheck,
} from "lucide-react";

export function Stage3Routes() {
  const {
    assessmentType,
    assessmentMetadata,
    routeWaypoints,
    selectedWaypointId,
    selectWaypoint,
    removeRouteWaypoint,
    addRouteWaypoint,
    recalculateRoute,
    routeResult,
    activeProfile,
    setProfile,
    isWalkerAnimating,
    setIsWalkerAnimating,
    runAnalysisTransition,
    setStage,
  } = useSafeSpaceStore();

  const [mobileTab, setMobileTab] = React.useState<"map" | "setup">("map");

  const isSuccess = routeResult?.status === "success";
  const requiredRadiusCm = activeProfile.minClearanceCm / 2;

  const displayLengthM = isSuccess
    ? (routeResult.pathLengthCm / 100).toFixed(2)
    : "—";
  const displayMarginCm = isSuccess
    ? Math.round(routeResult.minimumClearanceCm)
    : "—";
  const isMarginDeficit = isSuccess && routeResult.minimumClearanceCm < requiredRadiusCm;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Mobile view switcher */}
      <div className="flex lg:hidden border-b border-slate-200 bg-white px-3 py-1.5 justify-center gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMobileTab("map")}
          className={`px-3 py-1 rounded-md transition ${
            mobileTab === "map"
              ? "bg-[#1e7168] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Route Map
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("setup")}
          className={`px-3 py-1 rounded-md transition ${
            mobileTab === "setup"
              ? "bg-[#1e7168] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Route Setup ({routeWaypoints.length})
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Route Waypoints & Metrics Management */}
        <aside
          aria-label="Route configuration and checkpoints"
          className={`w-full lg:w-80 bg-white border-r border-[#e2e8e4] flex-col justify-between p-3.5 z-10 shrink-0 select-none overflow-y-auto ${
            mobileTab === "setup" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="space-y-3.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1e7168]">
                Critical Routes
              </p>
              <h2 className="text-base font-bold text-[#192329] tracking-tight mt-0.5">
                Walking Route & Clearance
              </h2>
            </div>

            {/* Mobility Profile Selector */}
            <div className="p-2.5 rounded-lg border border-[#e2e8e4] bg-[#f8faf8] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Active Profile
                </span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                  assessmentType === "user"
                    ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                    : "text-slate-600 bg-slate-100 border-slate-200"
                }`}>
                  {assessmentType === "user"
                    ? `${assessmentMetadata?.spaceName || "User Assessment"} · Calibrated`
                    : "Example clinic scenario"}
                </span>
              </div>
              <select
                aria-label="Select mobility profile for route clearance"
                value={activeProfile.id}
                onChange={(e) => setProfile(e.target.value)}
                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1e7168]"
              >
                {MOBILITY_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.minClearanceCm} cm corridor width)
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                <span>Required corridor width: {activeProfile.minClearanceCm} cm</span>
                <span>Margin: ≥{requiredRadiusCm} cm</span>
              </div>
            </div>

            {/* Key Metrics Strip */}
            <div className="grid grid-cols-2 gap-2 bg-[#f8faf8] p-2.5 rounded-lg border border-[#e2e8e4]">
              <div>
                <span className="text-[9px] uppercase font-semibold text-slate-400 block">
                  Route Length
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {displayLengthM}{isSuccess ? " m" : ""}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {isSuccess
                    ? `${routeResult.path.length} waypoints`
                    : routeWaypoints.length < 2
                    ? "Need ≥2 checkpoints"
                    : "No traversable path"}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase font-semibold text-slate-400 block">
                  Tightest Corridor Clearance
                </span>
                <span
                  className={`text-sm font-bold ${
                    !isSuccess
                      ? "text-slate-400"
                      : isMarginDeficit
                      ? "text-red-600"
                      : "text-emerald-700"
                  }`}
                >
                  {displayMarginCm}{isSuccess ? " cm" : ""}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Required: ≥{requiredRadiusCm} cm
                </span>
              </div>
            </div>

            {/* Dynamic Status Banner */}
            {routeWaypoints.length < 2 ? (
              <div
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-1.5"
                role="status"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                <div className="leading-snug space-y-1">
                  <span className="font-semibold text-slate-800 block">Route Not Configured</span>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Add at least 2 checkpoints (start and destination) to compute walking clearance.
                  </p>
                </div>
              </div>
            ) : routeResult?.status === "clearance-insufficient" ? (
              <div
                className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-1.5"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div className="leading-snug space-y-1">
                  <span className="font-semibold text-red-800 block">Clearance Insufficient</span>
                  <p className="text-[11px] text-red-700 leading-tight">{routeResult.reason}</p>
                  <p className="text-[10px] text-red-600 font-mono">
                    Required corridor width: {activeProfile.minClearanceCm} cm (margin ≥ {requiredRadiusCm} cm)
                  </p>
                </div>
              </div>
            ) : routeResult?.status === "unreachable" ? (
              <div
                className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-1.5"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-snug space-y-1">
                  <span className="font-semibold text-amber-800 block">Route Unreachable</span>
                  <p className="text-[11px] text-amber-700 leading-tight">{routeResult.reason}</p>
                </div>
              </div>
            ) : routeResult?.status && routeResult.status !== "success" ? (
              <div
                className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-1.5"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-snug space-y-1">
                  <span className="font-semibold text-amber-800 block">Route Calculation Failed</span>
                  <p className="text-[11px] text-amber-700 leading-tight">{routeResult.reason}</p>
                </div>
              </div>
            ) : isMarginDeficit ? (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">
                  Narrowest path margin ({displayMarginCm} cm) is below required margin (≥ {requiredRadiusCm} cm; corridor width {activeProfile.minClearanceCm} cm).
                </span>
              </div>
            ) : (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="leading-snug font-medium">
                  Narrowest path margin ({displayMarginCm} cm) meets required margin (≥ {requiredRadiusCm} cm, {activeProfile.minClearanceCm} cm width).
                </span>
              </div>
            )}

            {/* Animation Controls */}
            <div className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white">
              <span className="text-xs font-medium text-slate-700">Preview Route Animation</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => isSuccess && setIsWalkerAnimating(!isWalkerAnimating)}
                  disabled={!isSuccess}
                  aria-label={isWalkerAnimating ? "Pause route preview animation" : "Play route preview animation"}
                  className={`min-h-[28px] min-w-[28px] flex items-center justify-center p-1 rounded transition ${
                    !isSuccess
                      ? "text-slate-300 cursor-not-allowed"
                      : isWalkerAnimating
                      ? "bg-[#e8f3f1] text-[#1e7168] cursor-pointer"
                      : "text-slate-600 hover:bg-slate-100 cursor-pointer"
                  }`}
                  title={
                    !isSuccess
                      ? "Simulation unavailable for non-traversable route"
                      : isWalkerAnimating
                      ? "Pause"
                      : "Play"
                  }
                >
                  {isWalkerAnimating && isSuccess ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={recalculateRoute}
                  aria-label="Reset route calculation"
                  className="min-h-[28px] min-w-[28px] flex items-center justify-center p-1 text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                  title="Reset Route"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Waypoints List & Checkpoint Manager */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                  Checkpoints ({routeWaypoints.length})
                </span>
                <button
                  type="button"
                  onClick={() => addRouteWaypoint()}
                  className="text-[11px] font-semibold text-[#1e7168] hover:text-[#185e56] flex items-center gap-0.5 cursor-pointer py-1 px-1.5"
                  title="Add Checkpoint"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Checkpoint</span>
                </button>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                {routeWaypoints.map((pt, i) => {
                  const isSelected = selectedWaypointId === pt.id;
                  const isStart = i === 0;
                  const isEnd = i === routeWaypoints.length - 1;

                  return (
                    <div
                      key={pt.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => selectWaypoint(pt.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectWaypoint(pt.id);
                        }
                      }}
                      className={`flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1e7168] ${
                        isSelected
                          ? "border-[#1e7168] bg-[#f0f7f5]"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                            isStart
                              ? "bg-emerald-600"
                              : isEnd
                              ? "bg-[#1e7168]"
                              : "bg-[#1d63b8]"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="truncate max-w-[170px]">
                          <span className="font-medium text-xs truncate block">{pt.name}</span>
                          <span className="text-[9px] font-mono text-slate-400">
                            ({Math.round(pt.x)}, {Math.round(pt.y)})
                          </span>
                        </div>
                      </div>

                      {routeWaypoints.length > 2 && !isStart && !isEnd && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRouteWaypoint(pt.id);
                          }}
                          aria-label={`Remove checkpoint ${pt.name || i + 1}`}
                          className="min-h-[28px] min-w-[28px] flex items-center justify-center p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                          title="Remove Checkpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
              type="button"
              onClick={runAnalysisTransition}
              className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <span>Review Clearance Findings</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setStage("profile")}
              className="w-full py-1.5 px-2 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Back to Profile</span>
            </button>
          </div>
        </aside>

        {/* Central Canvas */}
        <main
          className={`flex-1 h-full p-2.5 overflow-hidden flex-col ${
            mobileTab === "map" ? "flex" : "hidden lg:flex"
          }`}
        >
          <Floorplan2D className="flex-1" />
        </main>
      </div>
    </div>
  );
}
