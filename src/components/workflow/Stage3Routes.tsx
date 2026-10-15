"use client";

import React, { useState } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  ChevronRight,
  ChevronLeft,
  Trash2,
  Plus,
  Pencil,
  Info,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
} from "lucide-react";

export function Stage3Routes() {
  const {
    routeWaypoints,
    selectedWaypointId,
    selectWaypoint,
    removeRouteWaypoint,
    addRouteWaypoint,
    routeResult,
    activeProfile,
    runAnalysisTransition,
    setStage,
    zoom,
    setZoom,
    setReportModalOpen,
  } = useSafeSpaceStore();

  const [mobileTab, setMobileTab] = useState<"map" | "setup">("map");

  const isSuccess = routeResult?.status === "success";
  const requiredRadiusCm = activeProfile.minClearanceCm / 2;
  const isMarginDeficit = isSuccess && routeResult.minimumClearanceCm < requiredRadiusCm;

  const displayLengthM = isSuccess
    ? `${(routeResult.pathLengthCm / 100).toFixed(1)} m`
    : "Not measured";

  const displayClearanceM = isSuccess
    ? `${(routeResult.minimumClearanceCm / 100).toFixed(2)} m`
    : "Not measured";

  const routeStatus = routeWaypoints.length < 2 || !routeResult
    ? "Not assessed"
    : isSuccess
      ? isMarginDeficit ? "Clearance below profile" : "Passable in 2D"
      : "No passable route";
  const routeStatusNote = routeWaypoints.length < 2 || !routeResult
    ? "Add at least two checkpoints"
    : isSuccess
      ? isMarginDeficit ? "Review route clearance" : "Not a compliance certification"
      : "Adjust route or furniture";
  const routePassable = isSuccess && !isMarginDeficit;

  const otherNeedsText = [
    activeProfile.fallHistory ? "Fall risk" : null,
    activeProfile.requiresSupport ? "Support points" : null,
    activeProfile.lowLightSensitivity === "High" ? "Low-light" : null,
  ]
    .filter(Boolean)
    .join(", ") || "Standard";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#F7F8F8]">
      {/* Mobile view switcher */}
      <div className="flex lg:hidden border-b border-[#E2E6E8] bg-white px-3 py-1.5 justify-center gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMobileTab("map")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "map"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Route Map
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("setup")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "setup"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Route Setup ({routeWaypoints.length})
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden p-4 lg:p-6 gap-6">
        {/* Left Side: Route configuration matching 08-workspace-routes.png */}
        <aside
          aria-label="Route configuration and checkpoints"
          className={`w-full lg:w-[420px] bg-white rounded-2xl border border-[#E2E6E8] flex-col justify-between p-5 lg:p-6 z-10 shrink-0 select-none h-full overflow-hidden shadow-xs ${
            mobileTab === "setup" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
            <div>
              <h2 className="text-lg font-bold text-[#17252B] tracking-tight">
                Route configuration
              </h2>
              <p className="text-xs text-[#647078] mt-1 leading-relaxed">
                Map walking routes, check accessibility and identify potential risks.
              </p>
            </div>

            {/* Profile summary card matching 08-workspace-routes.png */}
            <div className="p-3.5 rounded-xl border border-[#E2E6E8] bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E6E8]">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-[#E8F3F1] flex items-center justify-center text-[#0B514B]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="4" r="2" />
                      <path d="M12 7v5l4 3M10 13a5 5 0 1 0 5 5" />
                      <path d="M16 19h3" />
                    </svg>
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[#17252B]">
                    {activeProfile.id === "wheelchair" ? "Wheelchair user" : activeProfile.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setStage("profile")}
                  className="flex items-center gap-1 text-xs font-semibold text-[#0B514B] hover:underline cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>

              {/* Profile Details List */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#647078]">Mobility aid</span>
                  <span className="font-medium text-[#17252B]">
                    {activeProfile.id === "wheelchair" ? "Manual wheelchair" : activeProfile.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#647078]">Clearance width</span>
                  <span className="font-medium text-[#17252B]">{(activeProfile.minClearanceCm * 10).toLocaleString()} mm</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#647078]">Turning space</span>
                  <span className="font-medium text-[#17252B]">{(activeProfile.turningSpaceCm * 10).toLocaleString()} mm</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#647078]">Other needs</span>
                  <span className="font-medium text-[#17252B] capitalize">{otherNeedsText}</span>
                </div>
              </div>
            </div>

            {/* Route details section matching 08-workspace-routes.png */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[#17252B]">
                Route details
              </h3>

              <div className="space-y-2">
                {/* Route length */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E6E8] bg-white">
                  <div className="flex items-center gap-3">
                    <div className="text-[#0B514B]">
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M2 5h12M11 2l3 3-3 3M14 11H2M5 8l-3 3 3 3" />
                      </svg>
                    </div>
                    <span className="text-xs text-[#17252B]">Route length</span>
                  </div>
                  <span className="text-sm font-bold text-[#17252B]">{displayLengthM}</span>
                </div>

                {/* Tightest corridor clearance */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E6E8] bg-white">
                  <div className="flex items-center gap-3">
                    <div className="text-[#0B514B]">
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 2v12M13 2v12M3 8h10M6 6l-2 2 2 2M10 6l2 2-2 2" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#17252B]">Tightest corridor clearance</span>
                      <Info className="w-3.5 h-3.5 text-[#647078]" />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#17252B]">{displayClearanceM}</span>
                </div>

                {/* Route status */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E6E8] bg-white">
                  <div className="flex items-center gap-3">
                    <div className={routePassable ? "text-emerald-600" : "text-[#647078]"}>
                      {routePassable ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-xs text-[#17252B]">Route status</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${routePassable ? "text-[#17252B]" : "text-[#647078]"}`}>
                      {routeStatus}
                    </span>
                    <span className="text-[10px] text-[#647078] block">
                      {routeStatusNote}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* + Add Checkpoint button matching 08-workspace-routes.png */}
            <button
              type="button"
              onClick={() => addRouteWaypoint()}
              className="w-full py-2 px-3 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#17252B] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#0B514B]" />
              <span>Add checkpoint</span>
            </button>

            {/* Checkpoints list */}
            {routeWaypoints.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {routeWaypoints.map((pt, i) => {
                  const isSelected = selectedWaypointId === pt.id;
                  const isStart = i === 0;
                  const isEnd = i === routeWaypoints.length - 1;

                  return (
                    <div
                      key={pt.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectWaypoint(pt.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                        isSelected
                          ? "border-[#0B514B] bg-[#F0F5F4]"
                          : "border-[#E2E6E8] bg-white hover:bg-[#F7F8F8]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                            isStart
                              ? "bg-emerald-600"
                              : isEnd
                              ? "bg-[#0B514B]"
                              : "bg-[#0B514B]"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium text-xs text-[#17252B]">
                          {isStart ? "Start" : isEnd ? "Destination" : pt.name || `Point ${i + 1}`}
                        </span>
                      </div>

                      {routeWaypoints.length > 2 && !isStart && !isEnd && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRouteWaypoint(pt.id);
                          }}
                          aria-label={`Remove checkpoint ${pt.name || i + 1}`}
                          className="p-1 text-[#647078] hover:text-red-600 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Footer matching 08-workspace-routes.png */}
          <div className="pt-4 border-t border-[#E2E6E8] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setStage("profile")}
              className="py-2.5 px-3.5 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#17252B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to profile</span>
            </button>

            <button
              type="button"
              onClick={runAnalysisTransition}
              className="py-2.5 px-4 rounded-lg bg-[#0B514B] hover:bg-[#073D38] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <span>Review clearance findings</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Central Canvas Area matching 08-workspace-routes.png */}
        <main
          className={`flex-1 h-full bg-white rounded-2xl border border-[#E2E6E8] p-4 lg:p-5 shadow-xs overflow-hidden flex flex-col relative ${
            mobileTab === "map" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Canvas Top Toolbar matching 08-workspace-routes.png */}
          <div className="w-full flex items-center justify-between mb-4 z-20">

            {/* Right Toolbar Controls */}
            <div className="flex items-center gap-2 sm:gap-3 text-[#647078]">
              <button
                type="button"
                onClick={() => setZoom(Math.min(zoom + 0.15, 2.5))}
                aria-label="Zoom in"
                className="p-1.5 rounded-lg border border-[#E2E6E8] bg-white hover:text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setZoom(Math.max(zoom - 0.15, 0.4))}
                aria-label="Zoom out"
                className="p-1.5 rounded-lg border border-[#E2E6E8] bg-white hover:text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Fit view"
                className="p-1.5 rounded-lg border border-[#E2E6E8] bg-white hover:text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E6E8] bg-white text-xs font-medium text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#647078]" />
                <span>Open report</span>
              </button>
            </div>
          </div>

          {/* Floorplan Canvas Container */}
          <div className="flex-1 relative rounded-xl border border-[#E2E6E8] bg-white overflow-hidden shadow-2xs">
            <Floorplan2D hideControls={true} className="w-full h-full border-0 rounded-none bg-[#FAFBF9]" />
          </div>
        </main>
      </div>
    </div>
  );
}
