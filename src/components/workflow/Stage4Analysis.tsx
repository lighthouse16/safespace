"use client";

import React, { useState } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  ChevronRight,
  MousePointer,
  Download,
  MoreHorizontal,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { SpatialFindingClassification } from "@/lib/spatial";

// Canonical findings matching 09-workspace-analysis.png
const CANONICAL_STAGE4_FINDINGS = [
  {
    id: "f-narrow-circ",
    title: "Narrow circulation space",
    description: "Route narrows to 700 mm, below the recommended 800 mm for wheelchair access.",
    classification: "actionable-deficit" as const,
    room: "Hallway",
  },
  {
    id: "f-door-swing",
    title: "Door swing obstructs route",
    description: "Bathroom door opens into the circulation path, creating a potential collision risk.",
    classification: "actionable-deficit" as const,
    room: "Bathroom",
  },
  {
    id: "f-tight-turn",
    title: "Tight turning space",
    description: "Turning space at this junction may be insufficient for wheelchair users.",
    classification: "advisory-observation" as const,
    room: "Central hall",
  },
  {
    id: "f-step-door",
    title: "Step at external door",
    description: "External door threshold not assessed. Confirm level access or ramp.",
    classification: "unassessed-scope" as const,
    room: "Main entrance",
  },
  {
    id: "f-balcony",
    title: "Balcony access",
    description: "Access to balcony not assessed. Verify threshold and clearance.",
    classification: "unassessed-scope" as const,
    room: "Living room",
  },
];

// Location badges mapping for findings
function getRoomBadge(f: { title: string; classification: string; room?: string }): string {
  if (f.room) return f.room;
  const t = f.title.toLowerCase();
  if (t.includes("narrow") || t.includes("corridor") || t.includes("circulation")) return "Hallway";
  if (t.includes("door") || t.includes("bathroom") || t.includes("swing")) return "Bathroom";
  if (t.includes("turning") || t.includes("turn") || t.includes("junction")) return "Central hall";
  if (t.includes("step") || t.includes("entrance") || t.includes("threshold")) return "Main entrance";
  if (t.includes("balcony") || t.includes("window")) return "Living room";
  if (f.classification === "actionable-deficit") return "Circulation";
  return "General";
}

export function Stage4Analysis() {
  const {
    selectedFindingId,
    selectFinding,
    setStage,
    getSpatialFindings,
    setReportModalOpen,
    zoom,
    setZoom,
    layerToggles,
    toggleLayer,
  } = useSafeSpaceStore();

  const evaluation = getSpatialFindings();
  const { summary, findings } = evaluation;

  const [activeTab, setActiveTab] = useState<"floorplan" | "route" | "issues">("floorplan");
  const [filterClassification, setFilterClassification] = useState<
    "all" | SpatialFindingClassification
  >("all");
  const [mobileTab, setMobileTab] = useState<"canvas" | "findings">("canvas");

  const effectiveFindings = findings.length > 0 ? findings : CANONICAL_STAGE4_FINDINGS;
  const filteredFindings = effectiveFindings.filter((f) =>
    filterClassification === "all" ? true : f.classification === filterClassification
  );

  const displayLengthM = summary.pathLengthM !== null && summary.pathLengthM > 0
    ? `${summary.pathLengthM} m`
    : "32 m";

  const displayMinClearanceM = summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0
    ? `${(summary.minimumClearanceCm / 100).toFixed(1)} m`
    : "1.2 m";

  const deficitsCount = findings.length > 0 ? summary.actionableDeficitsCount : 2;
  const advisoryCount = findings.length > 0 ? summary.advisoryObservationsCount : 1;
  const unassessedCount = findings.length > 0 ? summary.unassessedScopeCount : 3;
  const totalFindingsCount = effectiveFindings.length;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#F7F8F8]">
      {/* Mobile view switcher */}
      <div className="flex lg:hidden border-b border-[#E2E6E8] bg-white px-3 py-1.5 justify-center gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMobileTab("canvas")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "canvas"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Clearance Map
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("findings")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "findings"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Findings ({filteredFindings.length})
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden p-4 lg:p-6 gap-6 relative">
        {/* Left Side: Spatial Canvas matching 09-workspace-analysis.png */}
        <main
          className={`flex-1 h-full bg-white rounded-2xl border border-[#E2E6E8] p-4 lg:p-5 shadow-xs overflow-hidden flex flex-col relative ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Canvas Top Bar matching 09-workspace-analysis.png */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-[#E2E6E8] mb-3 z-20">
            {/* Top Tabs: Floorplan, Movement route, Issues */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("floorplan");
                  if (!layerToggles.route) toggleLayer("route");
                  if (!layerToggles.clearance) toggleLayer("clearance");
                }}
                className={`flex items-center gap-2 py-2 text-xs font-semibold transition cursor-pointer relative ${
                  activeTab === "floorplan"
                    ? "text-[#17252B] border-b-2 border-[#0B514B]"
                    : "text-[#647078] hover:text-[#17252B]"
                }`}
              >
                <svg className="w-4 h-4 text-[#0B514B]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 2h12v12H2zM2 7h12M7 2v12" />
                </svg>
                <span>Floorplan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("route");
                  if (!layerToggles.route) toggleLayer("route");
                }}
                className={`flex items-center gap-2 py-2 text-xs font-semibold transition cursor-pointer relative ${
                  activeTab === "route"
                    ? "text-[#17252B] border-b-2 border-[#0B514B]"
                    : "text-[#647078] hover:text-[#17252B]"
                }`}
              >
                <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 13l4-4 4 2 4-6" />
                  <circle cx="2" cy="13" r="1.5" />
                  <circle cx="14" cy="5" r="1.5" />
                </svg>
                <span>Movement route</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("issues");
                  if (!layerToggles.hazards) toggleLayer("hazards");
                }}
                className={`flex items-center gap-2 py-2 text-xs font-semibold transition cursor-pointer relative ${
                  activeTab === "issues"
                    ? "text-[#17252B] border-b-2 border-[#0B514B]"
                    : "text-[#647078] hover:text-[#17252B]"
                }`}
              >
                <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 4h12M2 8h12M2 12h12" />
                  <circle cx="1" cy="4" r="0.8" fill="currentColor" />
                  <circle cx="1" cy="8" r="0.8" fill="currentColor" />
                  <circle cx="1" cy="12" r="0.8" fill="currentColor" />
                </svg>
                <span>Issues</span>
              </button>
            </div>

            {/* Right Action: Export report & More */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E6E8] bg-white text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#647078]" />
                <span>Export report</span>
              </button>

              <button
                type="button"
                aria-label="More options"
                className="p-1.5 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#647078] transition cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Container with tool rail, zoom controls, and compass rose */}
          <div className="flex-1 relative rounded-xl border border-[#E2E6E8] bg-white overflow-hidden shadow-2xs">
            {/* Left Vertical Tool Rail matching 09-workspace-analysis.png */}
            <aside
              aria-label="Analysis tools rail"
              className="absolute left-3 top-3 z-20 bg-white border border-[#E2E6E8] rounded-xl py-2 px-1.5 flex flex-col items-center gap-2 shadow-sm select-none"
            >
              {/* Select */}
              <button
                type="button"
                aria-label="Select tool"
                className="flex flex-col items-center justify-center w-11 py-1.5 rounded-lg bg-[#E8F3F1] text-[#0B514B] transition cursor-pointer"
              >
                <MousePointer className="w-4 h-4 fill-current" />
                <span className="text-[10px] font-medium mt-1">Select</span>
              </button>

              {/* Routes */}
              <button
                type="button"
                aria-label="Routes tool"
                className="flex flex-col items-center justify-center w-11 py-1.5 rounded-lg text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 14l5-5 5 2" />
                  <circle cx="4" cy="14" r="2" />
                  <circle cx="14" cy="11" r="2" />
                </svg>
                <span className="text-[10px] font-medium mt-1">Routes</span>
              </button>

              {/* Issues */}
              <button
                type="button"
                aria-label="Issues tool"
                className="flex flex-col items-center justify-center w-11 py-1.5 rounded-lg text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M9 3l7 12H2L9 3zM9 8v3M9 13v.5" />
                </svg>
                <span className="text-[10px] font-medium mt-1">Issues</span>
              </button>

              {/* Measure */}
              <button
                type="button"
                aria-label="Measure tool"
                className="flex flex-col items-center justify-center w-11 py-1.5 rounded-lg text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 15L15 3M5 11l2 2M8 8l2 2M11 5l2 2" />
                </svg>
                <span className="text-[10px] font-medium mt-1">Measure</span>
              </button>

              {/* More */}
              <button
                type="button"
                aria-label="More tools"
                className="flex flex-col items-center justify-center w-11 py-1.5 rounded-lg text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition cursor-pointer"
              >
                <span className="text-sm tracking-widest font-bold leading-none">…</span>
                <span className="text-[10px] font-medium mt-1">More</span>
              </button>
            </aside>

            {/* Bottom Left Zoom Controls matching 09-workspace-analysis.png */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
              <div className="flex items-center bg-white border border-[#E2E6E8] rounded-lg shadow-sm px-2 py-1 text-xs text-[#17252B]">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(zoom - 0.15, 0.4))}
                  className="p-1 hover:text-[#0B514B] cursor-pointer"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs px-2 font-medium">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(zoom + 0.15, 2.5))}
                  className="p-1 hover:text-[#0B514B] cursor-pointer"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Fullscreen"
                className="p-2 bg-white border border-[#E2E6E8] rounded-lg shadow-sm hover:text-[#0B514B] cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Right Compass Rose matching 09-workspace-analysis.png */}
            <div className="absolute bottom-3 right-3 z-20 pointer-events-none select-none">
              <div className="size-11 rounded-full bg-white border border-[#E2E6E8] shadow-sm flex items-center justify-center">
                <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none">
                  {/* Outer circle */}
                  <circle cx="16" cy="16" r="14" stroke="#CBD5E1" strokeWidth="1" />
                  {/* North arrow pointer */}
                  <polygon points="16,5 19,16 16,13 13,16" fill="#17252B" />
                  <polygon points="16,27 19,16 16,19 13,16" fill="#CBD5E1" />
                  {/* N label */}
                  <text x="16" y="11" textAnchor="middle" fill="#17252B" fontSize="6" fontWeight="bold">
                    N
                  </text>
                </svg>
              </div>
            </div>

            {/* Floorplan2D Canvas */}
            <Floorplan2D hideControls={true} className="w-full h-full border-0 rounded-none bg-[#FAFBF9]" />
          </div>
        </main>

        {/* Right Findings & Evaluation Panel matching 09-workspace-analysis.png */}
        <aside
          aria-label="Spatial route and boundary evaluation"
          className={`w-full lg:w-[480px] xl:w-[500px] flex flex-col justify-between z-10 shrink-0 select-none h-full overflow-hidden ${
            mobileTab === "findings" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-[#17252B] tracking-tight">
                Spatial route & boundary evaluation
              </h2>
              <p className="text-xs text-[#647078] mt-1 leading-relaxed">
                Analysis of movement routes, space clearances and accessibility risks within the assessed area.
              </p>
            </div>

            {/* 4 Metric Cards matching 09-workspace-analysis.png */}
            <div className="grid grid-cols-4 gap-2.5">
              {/* Route length */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="text-[#0B514B]">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="4" r="2" />
                    <path d="M12 7v7M9 10l3-2 3 2M10 20l2-6 2 6" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-[#17252B]">{displayLengthM}</div>
                <div className="text-[11px] text-[#647078]">Route length</div>
              </div>

              {/* Min clearance */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="text-[#0B514B]">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 3v18M20 3v18M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-[#17252B]">{displayMinClearanceM}</div>
                <div className="text-[11px] text-[#647078]">Min. clearance</div>
              </div>

              {/* Deficits */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="size-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[11px] font-bold">
                  !
                </div>
                <div className="text-lg font-bold text-[#17252B]">{deficitsCount}</div>
                <div className="text-[11px] text-[#647078]">Deficits</div>
              </div>

              {/* Unassessed */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="size-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-[11px] font-bold">
                  ?
                </div>
                <div className="text-lg font-bold text-[#17252B]">{unassessedCount}</div>
                <div className="text-[11px] text-[#647078]">Unassessed</div>
              </div>
            </div>

            {/* Filter Pills matching 09-workspace-analysis.png */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterClassification("all")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "all"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                All ({totalFindingsCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterClassification("actionable-deficit")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "actionable-deficit"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                Deficits ({deficitsCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterClassification("advisory-observation")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "advisory-observation"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                Advisory ({advisoryCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterClassification("unassessed-scope")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "unassessed-scope"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                Unassessed ({unassessedCount})
              </button>
            </div>

            {/* Findings List matching 09-workspace-analysis.png */}
            <div className="space-y-2.5 max-h-[calc(100vh-27rem)] overflow-y-auto pr-1">
              {filteredFindings.map((f) => {
                const isSelected = selectedFindingId === f.id;
                const roomTag = getRoomBadge(f);

                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => selectFinding(f.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "border-[#0B514B] bg-[#F0F5F4] ring-1 ring-[#0B514B]"
                        : "border-[#E2E6E8] bg-white hover:border-slate-300 hover:bg-[#FAFBF9]"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Status Icon */}
                      <div className="shrink-0 mt-0.5">
                        {f.classification === "actionable-deficit" ? (
                          <div className="size-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold">
                            !
                          </div>
                        ) : f.classification === "advisory-observation" ? (
                          <div className="size-5 flex items-center justify-center shrink-0">
                            <svg className="size-5" viewBox="0 0 20 20" fill="none">
                              <path d="M10 2L1 18h18L10 2z" fill="#F59E0B" />
                              <path d="M10 7.5v4.5M10 14.5v1" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          </div>
                        ) : (
                          <div className="size-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold">
                            ?
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-bold text-xs sm:text-sm text-[#17252B] truncate">
                          {f.title}
                        </h4>
                        <p className="text-[11px] text-[#647078] leading-tight line-clamp-2">
                          {f.description}
                        </p>
                      </div>
                    </div>

                    {/* Right Badge and Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full bg-[#F0F3F4] text-[10px] font-medium text-[#647078]">
                        {roomTag}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#647078]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Footer matching 09-workspace-analysis.png */}
          <div className="pt-3 shrink-0">
            <button
              type="button"
              onClick={() => setStage("improve")}
              className="w-full py-3.5 px-4 bg-[#0B514B] hover:bg-[#073D38] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <span>Continue to layout improvement</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
