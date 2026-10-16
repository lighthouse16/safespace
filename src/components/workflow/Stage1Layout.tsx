"use client";

import React, { useState, useMemo } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  MousePointer,
  Undo2,
  Redo2,
  Maximize2,
  ChevronDown,
  RotateCw,
  Trash2,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronRight,
  Search,
  Sparkles,
  Ruler,
  Grip,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react";
import type { FurnitureCategory } from "@/lib/spatial-model";
import {
  AIInterpretationReviewModal,
  type InterpretedElementCandidate,
} from "@/components/ai/AIInterpretationReviewModal";
import { requestFloorplanInterpretation } from "@/lib/services/gemini-gateway-client";
import { GenerateLayoutPanel } from "./GenerateLayoutPanel";

type CatalogItem = { group: string; category: FurnitureCategory; name: string; dim: string };
const ELEMENT_CATALOG: CatalogItem[] = [
  { group: "Seating", category: "chair", name: "Standard Chair", dim: "55 × 55 cm" },
  { group: "Seating", category: "bench", name: "Waiting Bench", dim: "140 × 45 cm" },
  { group: "Work & Tables", category: "desk", name: "Reception Desk", dim: "120 × 70 cm" },
  { group: "Work & Tables", category: "table", name: "Clinic Table", dim: "100 × 60 cm" },
  { group: "Storage & Medical", category: "cabinet", name: "Storage Cabinet", dim: "90 × 45 cm" },
  { group: "Storage & Medical", category: "medical-fixture", name: "Medical Fixture", dim: "60 × 60 cm" },
  { group: "Safety & Support", category: "handrail", name: "Grab Handrail", dim: "150 × 8 cm" },
  { group: "Safety & Support", category: "mat", name: "Anti-slip Mat", dim: "80 × 50 cm" },
  { group: "Safety & Support", category: "light", name: "Safety Luminaire", dim: "30 × 30 cm" },
  { group: "Decor", category: "plant", name: "Indoor Plant", dim: "40 × 40 cm" },
];

export function Stage1Layout() {
  const {
    furniture,
    selectedFurnitureId,
    selectedHazardId,
    hazards,
    renameFurniture,
    renameHazard,
    deleteHazard,
    selectedTool,
    setSelectedTool,
    confirmFurniture,
    confirmAllRemaining,
    deleteFurniture,
    rotateFurniture,
    addFurniture,
    undo,
    redo,
    history,
    future,
    setStage,
    placementError,
    clearPlacementError,
    showGrid,
    setShowGrid,
    showDimensions,
    setShowDimensions,
    snapToGrid,
    setSnapToGrid,
    zoom,
    setZoom,
    hasFloorplanImage,
    floorplanImageBlobUrl,
    calibrationProvenance,
    canonicalBoundary,
    addCustomFurnitureBatch,
  } = useSafeSpaceStore();

  const [activeRightTab, setActiveRightTab] = useState<"fixtures" | "properties">("fixtures");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const startRename = (key: string, currentName: string) => {
    setEditingTarget(key);
    setEditingLabel(currentName);
  };
  const saveRename = (key: string, id: string, isHazard: boolean) => {
    if (editingLabel.trim()) {
      if (isHazard) renameHazard(id, editingLabel);
      else renameFurniture(id, editingLabel);
    }
    setEditingTarget(null);
  };
  const addCatalogItem = (item: CatalogItem) => {
    const before = useSafeSpaceStore.getState().furniture.length;
    addFurniture(item.category);
    const after = useSafeSpaceStore.getState();
    if (after.furniture.length > before && after.selectedFurnitureId) {
      renameFurniture(after.selectedFurnitureId, item.name);
      setActiveRightTab("properties");
      setShowAddMenu(false);
    }
  };
  const [mobileTab, setMobileTab] = useState<"canvas" | "drawer">("canvas");
  const [isInterpretingAI, setIsInterpretingAI] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<InterpretedElementCandidate[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleTriggerAIInterpretation = async () => {
    if (!floorplanImageBlobUrl) return;
    setAiError(null);

    // Validate calibration scale before sending to AI
    if (!calibrationProvenance?.pixelsPerCm || calibrationProvenance.pixelsPerCm <= 0) {
      setAiError("Calibration scale required. Calibrate reference dimension before AI detection.");
      return;
    }

    setIsInterpretingAI(true);
    try {
      const blob = await fetch(floorplanImageBlobUrl).then((r) => r.blob());
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(",");
          resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Get natural image dimensions if possible
      let imageWidth = 800;
      let imageHeight = 600;
      try {
        const img = new Image();
        img.src = floorplanImageBlobUrl;
        await new Promise((resolve) => {
          if (img.complete) resolve(true);
          else {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
          }
        });
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          imageWidth = img.naturalWidth;
          imageHeight = img.naturalHeight;
        }
      } catch {}

      const data = await requestFloorplanInterpretation({
        userConsent: true,
        imageMimeType: blob.type.startsWith("image/") ? blob.type : "image/png",
        imageBase64: base64,
        pixelsPerCm: calibrationProvenance.pixelsPerCm,
        imageWidth,
        imageHeight,
        canonicalBoundary: canonicalBoundary && canonicalBoundary.length >= 3 ? canonicalBoundary : undefined,
      });

      setAiCandidates(data.elements || []);
      setAiModalOpen(true);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to interpret floorplan");
    } finally {
      setIsInterpretingAI(false);
    }
  };

  const handleAcceptAICandidates = (accepted: InterpretedElementCandidate[]) => {
    if (!accepted.length) return;
    const items = accepted.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      roomId: "user-space",
      x: c.x,
      y: c.y,
      width: c.width,
      depth: c.depth,
      height: 80,
      rotation: c.rotation || 0,
      isFixed: false,
      isConfirmed: true,
      isStableSupport: c.category === "handrail" || c.category === "desk",
    }));
    addCustomFurnitureBatch(items);
  };

  const selectedItem = furniture.find((f) => f.id === selectedFurnitureId);
  const selectedHazard = hazards.find((h) => h.id === selectedHazardId);
  const catalogResults = ELEMENT_CATALOG.filter((item) =>
    (item.name + " " + item.group).toLowerCase().includes(catalogSearch.trim().toLowerCase())
  );
  const unconfirmedCount = furniture.filter((f) => !f.isConfirmed).length;

  // Categorized fixture counts
  const fixtureCounts = useMemo(() => {
    let beds = 0;
    let sofas = 0;
    let tables = 0;
    let storage = 0;
    let appliances = 0;
    let sanitary = 0;

    for (const item of furniture) {
      const cat = item.category?.toLowerCase() || "";
      const name = item.name?.toLowerCase() || "";

      if (cat === "bed" || name.includes("bed")) {
        beds += 1;
      } else if (cat === "chair" || cat === "bench" || name.includes("sofa") || name.includes("chair") || name.includes("seating")) {
        sofas += 1;
      } else if (cat === "table" || cat === "desk" || name.includes("table") || name.includes("desk")) {
        tables += 1;
      } else if (cat === "cabinet" || name.includes("storage") || name.includes("wardrobe") || name.includes("cabinet")) {
        storage += 1;
      } else if (name.includes("bath") || name.includes("toilet") || name.includes("sink") || name.includes("sanitary")) {
        sanitary += 1;
      } else if (name.includes("appliance") || name.includes("fridge") || name.includes("dispenser")) {
        appliances += 1;
      }
    }

    return { beds, sofas, tables, storage, appliances, sanitary };
  }, [furniture]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#F7F8F8]">
      {/* Mobile Tab Switcher */}
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
          2D Layout
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("drawer")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "drawer"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Room Fixtures {unconfirmedCount > 0 && `(${unconfirmedCount})`}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Canvas Area */}
        <main
          className={`flex-1 h-full p-4 lg:p-6 overflow-hidden flex flex-col relative ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Top Canvas Toolbar matching 06-workspace-layout.png */}
          <div className="w-full bg-white border border-[#E2E6E8] rounded-xl px-4 py-2.5 flex items-center justify-between shadow-2xs mb-4 z-20">
            {/* Left Tools: 2D plan, Grid, Snap, Dim */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#0B514B] bg-[#F0F5F4] text-xs font-semibold text-[#0B514B] cursor-pointer"
              >
                {/* 2D Plan icon */}
                <svg className="w-4 h-4 text-[#0B514B]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M3 3h14v14H3zM3 9h14M9 3v14" />
                </svg>
                <span>2D plan</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                aria-pressed={showGrid}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  showGrid
                    ? "border-[#0B514B] bg-[#F0F5F4] text-[#0B514B] font-semibold"
                    : "border-[#E2E6E8] bg-white text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 5.5h12M2 10.5h12M5.5 2v12M10.5 2v12" />
                </svg>
                <span>Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                aria-pressed={snapToGrid}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  snapToGrid
                    ? "border-[#0B514B] bg-[#F0F5F4] text-[#0B514B] font-semibold"
                    : "border-[#E2E6E8] bg-white text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 3v5a4 4 0 0 0 8 0V3M4 5h3M9 5h3" />
                </svg>
                <span>Snap</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDimensions(!showDimensions)}
                aria-pressed={showDimensions}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  showDimensions
                    ? "border-[#0B514B] bg-[#F0F5F4] text-[#0B514B] font-semibold"
                    : "border-[#E2E6E8] bg-white text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 8h12M2 5v6M14 5v6M5 7l-2 1 2 1M11 7l2 1-2 1" />
                </svg>
                <span>Dim</span>
              </button>

              {hasFloorplanImage ? (
                <button
                  type="button"
                  onClick={handleTriggerAIInterpretation}
                  disabled={isInterpretingAI}
                  title="Detect furniture and fixtures from floorplan using Gemini AI"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0B514B] bg-[#F0F5F4] text-xs font-semibold text-[#0B514B] hover:bg-teal-100 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0B514B]" />
                  <span>{isInterpretingAI ? "Analyzing..." : "AI Detect"}</span>
                </button>
              ) : null}
            </div>

            {/* Right Tools: Undo, Redo, Zoom, Search, Expand */}
            <div className="flex items-center gap-3 text-[#647078]">
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                aria-label="Undo"
                className="p-1 hover:text-[#17252B] disabled:opacity-30 transition cursor-pointer"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0}
                aria-label="Redo"
                className="p-1 hover:text-[#17252B] disabled:opacity-30 transition cursor-pointer"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-[#E2E6E8]" />

              <div className="flex items-center gap-1 text-xs font-medium text-[#17252B] cursor-pointer">
                <span>{Math.round(zoom * 100)}%</span>
                <ChevronDown className="w-3 h-3 text-[#647078]" />
              </div>

              <button
                type="button"
                onClick={() => setZoom(Math.min(zoom + 0.15, 2.5))}
                aria-label="Zoom in"
                className="p-1 hover:text-[#17252B] transition cursor-pointer"
                title="Zoom In"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Fit view"
                className="p-1 hover:text-[#17252B] transition cursor-pointer"
                title="Reset zoom"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {placementError && (
            <div
              role="alert"
              className="mb-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between shrink-0 shadow-2xs z-20"
            >
              <span>{placementError}</span>
              <button
                type="button"
                onClick={clearPlacementError}
                className="text-amber-700 hover:text-amber-900 font-bold ml-2 text-xs cursor-pointer"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {aiError && (
            <div
              role="alert"
              className="mb-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between shrink-0 shadow-2xs z-20"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="text-rose-700 hover:text-rose-900 font-bold ml-2 text-xs cursor-pointer"
                aria-label="Dismiss AI error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Canvas container with Left Tool Rail */}
          <div className="flex-1 relative rounded-xl border border-[#E2E6E8] bg-white overflow-hidden shadow-2xs">
            {/* Left Vertical Tool Rail matching 06-workspace-layout.png */}
            <aside
              aria-label="Drawing tools rail"
              className="absolute left-3 top-3 z-20 bg-white border border-[#E2E6E8] rounded-xl py-2 px-1.5 flex flex-col items-center gap-2 shadow-sm select-none"
            >
              {/* Select */}
              <button
                type="button"
                onClick={() => setSelectedTool("select")}
                aria-label="Select tool"
                className={`flex flex-col items-center justify-center w-11 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedTool === "select"
                    ? "bg-[#E8F3F1] text-[#0B514B]"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <MousePointer className="w-4 h-4 fill-current" />
                <span className="text-[10px] font-medium mt-1">Select</span>
              </button>

              {/* Partition wall: draws actual route obstacles */}
              <button
                type="button"
                onClick={() => setSelectedTool("wall")}
                aria-label="Wall tool"
                aria-pressed={selectedTool === "wall"}
                className={"flex flex-col items-center justify-center w-11 py-1.5 rounded-lg transition cursor-pointer " +
                  (selectedTool === "wall" ? "bg-[#E8F3F1] text-[#0B514B]" : "text-[#647078] hover:bg-[#F7F8F8]")}
              >
                <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 4h14v10H2zM2 9h14M7 4v5M12 4v5M4 9v5M9 9v5M14 9v5" />
                </svg>
                <span className="text-[10px] font-medium mt-1">Wall</span>
              </button>

              {/* Manual safety observation pin */}
              <button type="button" onClick={() => setSelectedTool("hazard")}
                aria-label="Hazard pin tool" aria-pressed={selectedTool === "hazard"}
                className={"flex flex-col items-center justify-center w-11 py-1.5 rounded-lg transition cursor-pointer " +
                  (selectedTool === "hazard" ? "bg-[#E8F3F1] text-[#0B514B]" : "text-[#647078] hover:bg-[#F7F8F8]")}>
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] font-medium mt-1">Note</span>
              </button>
              {/* Tape measure: ephemeral calibrated measurement */}
              <button type="button" onClick={() => setSelectedTool("measure")}
                aria-label="Measure tool" aria-pressed={selectedTool === "measure"}
                className={"flex flex-col items-center justify-center w-11 py-1.5 rounded-lg transition cursor-pointer " +
                  (selectedTool === "measure" ? "bg-[#E8F3F1] text-[#0B514B]" : "text-[#647078] hover:bg-[#F7F8F8]")}>
                <Ruler className="w-4 h-4" />
                <span className="text-[10px] font-medium mt-1">Measure</span>
              </button>

              {/* Furniture */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAddMenu((v) => !v)}
                  aria-label="Add Furniture"
                  className="flex flex-col items-center justify-center w-11 py-1.5 rounded-lg text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 6h10v6H4zM2 10v4M16 10v4M2 10h2M14 10h2" />
                  </svg>
                  <span className="text-[10px] font-medium mt-1">Furniture</span>
                </button>

                {showAddMenu && (
                  <div className="absolute left-14 top-0 bg-white border border-[#E2E6E8] shadow-xl rounded-xl w-64 z-30 text-xs overflow-hidden">
                    <div className="p-2 border-b border-[#E2E6E8] flex justify-between items-center bg-[#FAFBF9]">
                      <span className="text-xs font-semibold text-[#17252B]">Furniture catalog</span>
                      <button type="button" onClick={() => setShowAddMenu(false)} aria-label="Close catalog"><X className="w-4 h-4" /></button>
                    </div>
                    <label className="block px-2 pt-2 pb-1">
                      <span className="sr-only">Search catalog</span>
                      <input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)}
                        placeholder="Search items…" className="w-full rounded-lg border border-[#E2E6E8] p-2 text-xs outline-[#0B514B]" />
                    </label>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {catalogResults.map((item) => (
                        <button type="button" key={item.name} onClick={() => addCatalogItem(item)}
                          className="w-full px-2 py-2 rounded-lg text-left hover:bg-[#E8F3F1] flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block font-medium text-[#17252B]">{item.name}</span>
                            <span className="block text-[10px] text-[#647078]">{item.group}</span>
                          </span>
                          <span className="text-[9px] text-[#647078] font-mono shrink-0">{item.dim}</span>
                        </button>
                      ))}
                      {catalogResults.length === 0 && <p className="p-3 text-[#647078]">No matching items.</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Pan replaces previously inactive Text / More placeholders */}
              <button type="button" onClick={() => setSelectedTool("pan")}
                aria-label="Pan tool" aria-pressed={selectedTool === "pan"}
                className={"flex flex-col items-center justify-center w-11 py-1.5 rounded-lg transition cursor-pointer " +
                  (selectedTool === "pan" ? "bg-[#E8F3F1] text-[#0B514B]" : "text-[#647078] hover:bg-[#F7F8F8]")}>
                <Grip className="w-4 h-4" />
                <span className="text-[10px] font-medium mt-1">Pan</span>
              </button>
            </aside>

            {/* Canvas Component with internal controls hidden */}
            <Floorplan2D hideControls={true} className="w-full h-full border-0 rounded-none bg-[#FAFBF9]" />
          </div>
        </main>

        {/* Right Drawer matching 06-workspace-layout.png */}
        <aside
          aria-label="Room fixtures and properties"
          className={`w-full lg:w-80 bg-white border-l border-[#E2E6E8] flex flex-col justify-between z-10 shrink-0 select-none h-full overflow-hidden ${
            mobileTab === "drawer" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Drawer Tabs: Room fixtures vs Properties */}
            <div className="flex border-b border-[#E2E6E8] px-5 pt-3">
              <button
                type="button"
                onClick={() => setActiveRightTab("fixtures")}
                className={`pb-3 text-sm font-bold transition cursor-pointer relative ${
                  activeRightTab === "fixtures"
                    ? "text-[#17252B] border-b-2 border-[#0B514B]"
                    : "text-[#647078] hover:text-[#17252B]"
                }`}
              >
                Room fixtures
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab("properties")}
                className={`ml-6 pb-3 text-sm font-medium transition cursor-pointer relative ${
                  activeRightTab === "properties"
                    ? "text-[#17252B] border-b-2 border-[#0B514B] font-bold"
                    : "text-[#647078] hover:text-[#17252B]"
                }`}
              >
                Properties
              </button>
            </div>

            {/* Tab 1 Content: Room fixtures */}
            {activeRightTab === "fixtures" && (
              <div className="p-5">
                <GenerateLayoutPanel />
                <h2 className="text-sm font-bold text-[#17252B] mb-3.5">
                  Fixture summary
                </h2>

                {/* Fixture categories list with line icons and counts */}
                <div className="space-y-3.5 text-xs text-[#17252B]">
                  {/* Beds */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M2 13V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M2 10h14M2 13h14M4 13v2M14 13v2" />
                      </svg>
                      <span>Beds</span>
                    </div>
                    <span className="font-semibold">{fixtureCounts.beds}</span>
                  </div>

                  {/* Sofas / seating */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5H3zM2 10v4M16 10v4M2 12h14" />
                      </svg>
                      <span>Sofas / seating</span>
                    </div>
                    <span className="font-semibold">{fixtureCounts.sofas}</span>
                  </div>

                  {/* Tables */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M2 6h14v2H2zM4 8v7M14 8v7" />
                      </svg>
                      <span>Tables</span>
                    </div>
                    <span className="font-semibold">{fixtureCounts.tables}</span>
                  </div>

                  {/* Storage units */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 3h12v12H3zM3 7h12M3 11h12" />
                      </svg>
                      <span>Storage units</span>
                    </div>
                    <span className="font-semibold">{fixtureCounts.storage}</span>
                  </div>

                  {/* Appliances */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4 2h10v14H4zM4 6h10M7 4h2M7 10h1" />
                      </svg>
                      <span>Appliances</span>
                    </div>
                    <span className="font-semibold">{fixtureCounts.appliances}</span>
                  </div>

                  {/* Sanitary fixtures */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#647078]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M5 4h8v5a4 4 0 0 1-8 0zM7 13v2M11 13v2" />
                      </svg>
                      <span>Sanitary fixtures</span>
                    </div>
                    <span className="font-semibold">{fixtureCounts.sanitary}</span>
                  </div>
                </div>

                <div className="h-px bg-[#E2E6E8] my-6" />

                {/* Empty State vs Selected Item */}
                {selectedHazard ? (
                  <div className="space-y-3.5 bg-[#FAFBF9] p-3.5 rounded-xl border border-[#E2E6E8]">
                    <div className="flex items-center gap-2 text-amber-800 text-xs font-bold"><AlertTriangle className="w-4 h-4" /> Safety observation</div>
                    {editingTarget === "hazard-" + selectedHazard.id ? (
                      <form onSubmit={(event) => { event.preventDefault(); saveRename(editingTarget, selectedHazard.id, true); }}>
                        <input aria-label="Rename hazard" autoFocus value={editingLabel} maxLength={160}
                          onChange={(event) => setEditingLabel(event.target.value)}
                          onBlur={() => saveRename(editingTarget, selectedHazard.id, true)}
                          className="w-full rounded border border-[#0B514B] px-2 py-1 text-xs" />
                      </form>
                    ) : (
                      <button type="button" title="Rename hazard"
                        onClick={() => startRename("hazard-" + selectedHazard.id, selectedHazard.title)}
                        className="flex items-center gap-1 text-left text-xs font-semibold hover:text-[#0B514B]">
                        {selectedHazard.title}<Pencil className="w-3 h-3 shrink-0" />
                      </button>
                    )}
                    <p className="text-[11px] text-[#647078]">{selectedHazard.plainDescription}</p>
                    <p className="text-[10px] text-[#647078]">Position: {Math.round(selectedHazard.position.x)}, {Math.round(selectedHazard.position.y)} cm</p>
                    <p className="text-[10px] text-amber-800">{selectedHazard.measuredEvidence}</p>
                    {selectedHazard.code === "MANUAL" && (
                      <button type="button" onClick={() => deleteHazard(selectedHazard.id)}
                        className="inline-flex gap-1 items-center text-xs text-red-700 hover:underline"><Trash2 className="w-3 h-3" /> Remove note</button>
                    )}
                    <p className="text-[10px] text-[#647078]">User-authored notes are local to this browser until cloud support is implemented.</p>
                  </div>
                ) : !selectedItem ? (
                  <div className="flex flex-col items-center justify-center text-center py-6">
                    {/* Isometric 3D Cube Icon matching 06-workspace-layout.png */}
                    <svg className="w-10 h-10 text-[#647078] mb-3 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      <path d="M12 12v10" />
                      <path d="M2 7v10" />
                      <path d="M22 7v10" />
                    </svg>
                    <h3 className="text-sm font-bold text-[#17252B]">No item selected</h3>
                    <p className="text-xs text-[#647078] mt-1 max-w-[210px] leading-relaxed">
                      Select a room, wall or fixture to view and edit its details.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5 bg-[#FAFBF9] p-3.5 rounded-xl border border-[#E2E6E8]">
                    <div className="flex items-start justify-between">
                      <div>
                        {editingTarget === "fixture-" + selectedItem.id ? (
                          <form onSubmit={(event) => { event.preventDefault(); saveRename(editingTarget, selectedItem.id, false); }}>
                            <input autoFocus aria-label="Rename furniture" value={editingLabel}
                              onChange={(event) => setEditingLabel(event.target.value)}
                              onBlur={() => saveRename(editingTarget, selectedItem.id, false)}
                              maxLength={120} className="w-full min-w-0 rounded border border-[#0B514B] px-1 text-xs" />
                          </form>
                        ) : (
                          <button type="button" onClick={() => startRename("fixture-" + selectedItem.id, selectedItem.name)}
                            title="Rename furniture" className="flex items-center gap-1 text-left font-bold text-xs text-[#17252B] hover:text-[#0B514B]">
                            {selectedItem.name}<Pencil className="w-3 h-3 shrink-0" />
                          </button>
                        )}
                        <p className="text-[10px] text-[#647078] font-mono">
                          {selectedItem.code || "CUSTOM"}
                        </p>
                      </div>
                      <span className="px-1.5 py-0.5 bg-white border border-[#E2E6E8] text-[#17252B] rounded text-[10px] font-mono capitalize">
                        {selectedItem.category}
                      </span>
                    </div>

                    <div className="flex gap-1 text-[10px]">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                          selectedItem.isFixed
                            ? "bg-slate-100 text-slate-600"
                            : "bg-[#E8F3F1] text-[#0B514B]"
                        }`}
                      >
                        {selectedItem.isFixed ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                        {selectedItem.isFixed ? "Fixed" : "Movable"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                          selectedItem.isStableSupport
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {selectedItem.isStableSupport ? "Support Point" : "Non-support"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-white p-2 rounded-lg border border-[#E2E6E8] font-mono">
                      <div>
                        <span className="text-[#647078] block text-[9px]">POS</span>
                        <span className="font-semibold text-[#17252B]">
                          {Math.round(selectedItem.x)}, {Math.round(selectedItem.y)} cm
                        </span>
                      </div>
                      <div>
                        <span className="text-[#647078] block text-[9px]">ROT</span>
                        <span className="font-semibold text-[#17252B]">{selectedItem.rotation || 0}°</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#647078] block text-[9px]">SIZE</span>
                        <span className="font-semibold text-[#17252B]">
                          {selectedItem.width} × {selectedItem.depth} cm
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 space-y-1.5">
                      {!selectedItem.isConfirmed && (
                        <button
                          type="button"
                          onClick={() => confirmFurniture(selectedItem.id)}
                          className="w-full py-1.5 bg-[#0B514B] hover:bg-[#073D38] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Object</span>
                        </button>
                      )}

                      {!selectedItem.isFixed && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => rotateFurniture(selectedItem.id)}
                            className="flex-1 py-1.5 bg-white border border-[#E2E6E8] hover:bg-[#F7F8F8] text-[#17252B] rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Rotate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteFurniture(selectedItem.id)}
                            className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2 Content: Properties */}
            {activeRightTab === "properties" && (
              <div className="p-5">
                {selectedHazard ? (
                  <div className="space-y-2 text-xs">
                    <h3 className="font-bold text-[#17252B]">Safety observation</h3>
                    <p className="text-[#17252B]">{selectedHazard.title}</p>
                    <p className="text-[#647078]">{selectedHazard.measuredEvidence}</p>
                    <p className="text-[#647078]">{selectedHazard.recommendation}</p>
                  </div>
                ) : selectedItem ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-[#17252B]">Selected Item Details</h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[#647078] block">Name</span>
                        <span className="font-semibold text-[#17252B]">{selectedItem.name}</span>
                      </div>
                      <div>
                        <span className="text-[#647078] block">Category</span>
                        <span className="font-semibold text-[#17252B] capitalize">{selectedItem.category}</span>
                      </div>
                      <div>
                        <span className="text-[#647078] block">Dimensions</span>
                        <span className="font-mono text-[#17252B]">{selectedItem.width} cm × {selectedItem.depth} cm</span>
                      </div>
                      <div>
                        <span className="text-[#647078] block">Coordinates</span>
                        <span className="font-mono text-[#17252B]">X: {Math.round(selectedItem.x)}, Y: {Math.round(selectedItem.y)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-xs text-[#647078]">
                    No fixture selected. Click an object on the plan to view its properties.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Right Primary Action matching 06-workspace-layout.png */}
          <div className="p-4 sm:p-5 border-t border-[#E2E6E8] bg-white space-y-2.5 shrink-0">
            {unconfirmedCount > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                <span>{unconfirmedCount} unconfirmed items</span>
                <button
                  type="button"
                  onClick={confirmAllRemaining}
                  className="font-bold underline cursor-pointer text-[#0B514B]"
                >
                  Confirm all
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStage("profile")}
              className="w-full py-3 px-4 bg-[#0B514B] hover:bg-[#073D38] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <span>Continue to mobility profile</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
      {aiError && (
        <div className="fixed bottom-4 left-4 z-50 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 shadow-lg flex items-center justify-between gap-4">
          <span>{aiError}</span>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="font-bold text-rose-600 hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      <AIInterpretationReviewModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        candidates={aiCandidates}
        onAccept={handleAcceptAICandidates}
      />
    </div>
  );
}
