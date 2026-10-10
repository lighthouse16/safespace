"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  MousePointer,
  Hand,
  PlusSquare,
  AlertTriangle,
  Ruler,
  Undo2,
  Redo2,
  CheckCircle2,
  Trash2,
  RotateCw,
  Lock,
  Unlock,
  ChevronRight,
  Building,
  Plus,
} from "lucide-react";

export function Stage1Layout() {
  const {
    furniture,
    selectedFurnitureId,
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
    importMode,
    setImportMode,
  } = useSafeSpaceStore();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<"canvas" | "inspector">("canvas");

  const selectedItem = furniture.find((f) => f.id === selectedFurnitureId);
  const unconfirmedCount = furniture.filter((f) => !f.isConfirmed).length;
  const totalCount = furniture.length;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Mobile view switcher for small screens */}
      <div className="flex lg:hidden border-b border-slate-200 bg-white px-3 py-1.5 justify-center gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMobileTab("canvas")}
          className={`px-3 py-1 rounded-md transition ${
            mobileTab === "canvas"
              ? "bg-[#1e7168] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Room Layout
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("inspector")}
          className={`px-3 py-1 rounded-md transition ${
            mobileTab === "inspector"
              ? "bg-[#1e7168] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Item Properties {unconfirmedCount > 0 && `(${unconfirmedCount})`}
        </button>
      </div>

      {/* If in initial mode, show choices modal */}
      {importMode === "initial" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-plan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div className="max-w-lg w-full bg-white rounded-xl shadow-xl border border-[#e2e8e4] p-5 space-y-4">
            <div>
              <h2 id="import-plan-title" className="text-lg font-bold text-[#192329] tracking-tight">
                Choose Layout Option
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Start with a pre-configured scenario or measure your own facility room.
              </p>
            </div>

            <div className="grid gap-2.5">
              {/* Option 1: Demo Clinic */}
              <button
                type="button"
                onClick={() => setImportMode("ready")}
                className="flex items-center gap-3.5 p-3.5 rounded-lg border-2 border-[#1e7168] bg-[#f0f7f5] hover:bg-[#e6f2ee] transition text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-md bg-[#1e7168] text-white flex items-center justify-center shrink-0">
                  <Building className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#192329]">
                      Explore Example Clinic
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#1e7168] text-white">
                      Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Queen Care Clinic sample room · Waiting Area & Corridor (18 items)
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#1e7168] shrink-0" />
              </button>

              {/* Option 2: Custom Room Assessment */}
              <Link
                href="/assessments/new"
                className="flex items-center gap-3.5 p-3.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-slate-50 transition text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-teal-50 group-hover:text-teal-800">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#192329]">
                      + Set Up Custom Room
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                      New
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Calibrate scale, trace room outline, and evaluate actual facility dimensions
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Layout Review Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <aside
          aria-label="Layout tools"
          className={`w-12 bg-white border-r border-[#e2e8e4] flex flex-col items-center py-2.5 gap-1 z-10 shrink-0 select-none ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          <button
            onClick={() => setSelectedTool("select")}
            className={`p-2 rounded-md transition cursor-pointer ${
              selectedTool === "select"
                ? "bg-[#e8f3f1] text-[#1e7168]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Select & Move (V)"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedTool("pan")}
            className={`p-2 rounded-md transition cursor-pointer ${
              selectedTool === "pan"
                ? "bg-[#e8f3f1] text-[#1e7168]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Pan View (H)"
          >
            <Hand className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
              title="Add Furniture"
            >
              <PlusSquare className="w-4 h-4" />
            </button>
            {showAddMenu && (
              <div className="absolute left-10 top-0 bg-white border border-slate-200 shadow-md rounded-md py-1 w-32 z-30 text-xs">
                <button
                  onClick={() => {
                    addFurniture("chair");
                    setShowAddMenu(false);
                  }}
                  className="w-full px-2.5 py-1 text-left hover:bg-slate-50 cursor-pointer"
                >
                  + Chair
                </button>
                <button
                  onClick={() => {
                    addFurniture("table");
                    setShowAddMenu(false);
                  }}
                  className="w-full px-2.5 py-1 text-left hover:bg-slate-50 cursor-pointer"
                >
                  + Table
                </button>
                <button
                  onClick={() => {
                    addFurniture("bench");
                    setShowAddMenu(false);
                  }}
                  className="w-full px-2.5 py-1 text-left hover:bg-slate-50 cursor-pointer"
                >
                  + Bench
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setSelectedTool("hazard")}
            className={`p-2 rounded-md transition cursor-pointer ${
              selectedTool === "hazard"
                ? "bg-amber-100 text-amber-800"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Add Hazard Note"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedTool("measure")}
            className={`p-2 rounded-md transition cursor-pointer ${
              selectedTool === "measure"
                ? "bg-[#e8f3f1] text-[#1e7168]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Measure Distance"
          >
            <Ruler className="w-4 h-4" />
          </button>

          <div className="w-4 h-px bg-slate-200 my-1.5" />

          <button
            onClick={undo}
            disabled={history.length === 0}
            className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-md transition cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={redo}
            disabled={future.length === 0}
            className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-md transition cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </aside>

        {/* Central 2D Canvas */}
        <main
          className={`flex-1 h-full p-2.5 overflow-hidden flex-col ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          <Floorplan2D className="flex-1" />
        </main>

        {/* Right Inspector Panel */}
        <aside
          aria-label="Item properties"
          className={`w-full lg:w-72 bg-white border-l border-[#e2e8e4] flex-col justify-between p-3.5 z-10 shrink-0 select-none overflow-y-auto ${
            mobileTab === "inspector" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="space-y-3.5">
            {/* Detection Summary */}
            <div className="border-b border-slate-100 pb-2.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Detection Summary
              </span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">
                {totalCount} objects ·{" "}
                <span className={unconfirmedCount > 0 ? "text-amber-600 font-bold" : "text-teal-700"}>
                  {unconfirmedCount} need confirmation
                </span>
              </p>

              {unconfirmedCount > 0 && (
                <button
                  type="button"
                  onClick={confirmAllRemaining}
                  className="mt-2 w-full py-1 px-2.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Confirm All Remaining
                </button>
              )}
            </div>

            {/* Selected Object Details */}
            {selectedItem ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{selectedItem.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {selectedItem.code || "CUSTOM"}
                    </p>
                  </div>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-mono capitalize">
                    {selectedItem.category}
                  </span>
                </div>

                {/* Status Badges */}
                <div className="flex gap-1 text-[10px]">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                      selectedItem.isFixed
                        ? "bg-slate-100 text-slate-600"
                        : "bg-teal-50 text-teal-800 border border-teal-200"
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

                {/* Spatial Dimensions Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px]">POS</span>
                    <span className="font-semibold text-slate-700">
                      {Math.round(selectedItem.x)}, {Math.round(selectedItem.y)} cm
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ROT</span>
                    <span className="font-semibold text-slate-700">{selectedItem.rotation || 0}°</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">SIZE</span>
                    <span className="font-semibold text-slate-700">
                      {selectedItem.width} × {selectedItem.depth} cm
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">CONFIDENCE</span>
                    <span className="font-semibold text-slate-700">
                      {Math.round((selectedItem.detectionConfidence || 0.9) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-1 space-y-1.5">
                  {!selectedItem.isConfirmed && (
                    <button
                      type="button"
                      onClick={() => confirmFurniture(selectedItem.id)}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm Object
                    </button>
                  )}

                  {!selectedItem.isFixed && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => rotateFurniture(selectedItem.id)}
                        className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        Rotate
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteFurniture(selectedItem.id)}
                        className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs">
                Select an item on the floor plan to inspect.
              </div>
            )}
          </div>

          {/* Bottom Primary Button / Uncertainty Gate */}
          <div className="border-t border-slate-200 pt-2.5 space-y-2">
            {unconfirmedCount > 0 ? (
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{unconfirmedCount} unconfirmed detected items</span>
                </div>
                <p className="text-[10px] text-amber-900 leading-tight">
                  Review detected items or confirm all to proceed.
                </p>
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={confirmAllRemaining}
                    className="w-full py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm All ({unconfirmedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage("profile")}
                    className="w-full py-1 px-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded text-[11px] font-medium transition cursor-pointer"
                  >
                    Proceed to Mobility Profile
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStage("profile")}
                className="w-full py-2 px-3 bg-[#1e7168] hover:bg-[#185e56] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>Continue to Mobility Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
