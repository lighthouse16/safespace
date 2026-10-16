"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  MousePointer,
  Ruler,
  Share2,
  Hand,
  Search,
  CheckSquare,
  Square,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Building2,
  Layers,
} from "lucide-react";
import {
  type BoundaryState,
  type CalibrationState,
  type Point2D,
  type SourceType,
  type UploadedFileInfo,
} from "./intake-view-types";
import { CalibrationTool } from "./CalibrationTool";
import {
  canCloseBoundary,
  addBoundaryVertex,
  undoBoundaryVertex,
  closeBoundary,
  moveBoundaryVertex,
} from "./boundary-operations";

export type BoundaryDraftCanvasProps = {
  source: SourceType;
  uploadedFile: UploadedFileInfo | null;
  calibration: CalibrationState;
  boundary: BoundaryState;
  onUpdateCalibration: (cal: CalibrationState) => void;
  onUpdateBoundary: (b: BoundaryState) => void;
  assessmentName?: string;
  facilityName?: string;
  spaceName?: string;
  onBack?: () => void;
  onContinue?: () => void;
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 20;

export function BoundaryDraftCanvas({
  source,
  uploadedFile,
  calibration,
  boundary,
  onUpdateCalibration,
  onUpdateBoundary,
  assessmentName,
  facilityName,
  spaceName,
  onBack,
  onContinue,
}: BoundaryDraftCanvasProps) {
  // Resuming the drafting step after calibration must open the boundary
  // tool. Otherwise a user returning from Review sees scale mode and can
  // mistake a calibrated image for a completed, traced room.
  const [activeTool, setActiveTool] = useState<"calibrate" | "boundary" | "select" | "pan" | "zoom">(
    () => !calibration.isCalibrated ? "calibrate" : boundary.isClosed ? "select" : "boundary"
  );
  const [activeSubTab, setActiveSubTab] = useState<"scale" | "boundary" | "review">(
    () => !calibration.isCalibrated ? "scale" : boundary.isClosed ? "review" : "boundary"
  );
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [pointerPos, setPointerPos] = useState<Point2D | null>(null);
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [panOffset, setPanOffset] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point2D>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);

  // Convert browser event coordinates to SVG viewBox (0..800, 0..600)
  const getSvgCoordinates = useCallback((e: React.PointerEvent<SVGSVGElement>): Point2D => {
    if (!svgRef.current) return { x: e.clientX, y: e.clientY };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const screenCTM = svg.getScreenCTM();
    if (screenCTM) {
      const inverted = screenCTM.inverse();
      const transformed = pt.matrixTransform(inverted);
      const rawX = Math.max(0, Math.min(CANVAS_WIDTH, transformed.x));
      const rawY = Math.max(0, Math.min(CANVAS_HEIGHT, transformed.y));
      return { x: rawX, y: rawY };
    }
    return { x: 0, y: 0 };
  }, []);

  const snapPoint = useCallback(
    (pt: Point2D): Point2D => {
      if (!boundary.gridSnap) return pt;
      return {
        x: Math.round(pt.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(pt.y / GRID_SIZE) * GRID_SIZE,
      };
    },
    [boundary.gridSnap]
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const rawPt = getSvgCoordinates(e);
    const pt = snapPoint(rawPt);
    setPointerPos(pt);

    if (draggingVertexIdx !== null && boundary.isClosed) {
      const nextVertices = moveBoundaryVertex(boundary.vertices, draggingVertexIdx, pt);
      onUpdateBoundary({
        ...boundary,
        vertices: nextVertices,
      });
    }
  };

  const handlePointerLeave = () => {
    setPointerPos(null);
    if (draggingVertexIdx !== null) {
      setDraggingVertexIdx(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  const handleCanvasClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingVertexIdx !== null || isPanning) return;
    const rawPt = getSvgCoordinates(e);
    const pt = snapPoint(rawPt);

    if (activeTool === "calibrate") {
      if (!calibration.p1) {
        onUpdateCalibration({ ...calibration, p1: pt, p2: null });
      } else if (!calibration.p2) {
        onUpdateCalibration({ ...calibration, p2: pt });
      } else {
        // Start fresh calibration with this point
        onUpdateCalibration({
          ...calibration,
          p1: pt,
          p2: null,
          isCalibrated: false,
          realLength: null,
          pixelsPerCm: null,
        });
      }
      return;
    }

    if (activeTool === "boundary") {
      if (boundary.isClosed) return;

      // Check if clicking near first vertex to close
      if (canCloseBoundary(boundary.vertices)) {
        const v0 = boundary.vertices[0];
        const dist = Math.hypot(pt.x - v0.x, pt.y - v0.y);
        if (dist <= 22) {
          onUpdateBoundary(closeBoundary(boundary));
          return;
        }
      }

      onUpdateBoundary({
        ...boundary,
        vertices: addBoundaryVertex(boundary.vertices, pt),
      });
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {}
      return;
    }
    if (activeTool === "zoom") {
      setZoomLevel((z) => Math.min(200, z + 20));
      return;
    }
    handleCanvasClick(e);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleVertexPointerDown = (index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!boundary.isClosed) return;
    setDraggingVertexIdx(index);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  const handleVertexPointerUp = (e: React.PointerEvent) => {
    setDraggingVertexIdx(null);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleUndoVertex = () => {
    onUpdateBoundary({
      ...boundary,
      vertices: undoBoundaryVertex(boundary.vertices),
      isClosed: false,
    });
  };

  const handleCloseBoundary = () => {
    if (canCloseBoundary(boundary.vertices)) {
      onUpdateBoundary(closeBoundary(boundary));
    }
  };

  const handleResetBoundary = () => {
    onUpdateBoundary({
      ...boundary,
      vertices: [],
      isClosed: false,
      selectedVertexIndex: null,
    });
  };

  // SVG polygon path
  const polygonPointsStr = boundary.vertices.map((v) => `${v.x},${v.y}`).join(" ");

  const canClose = canCloseBoundary(boundary.vertices) && !boundary.isClosed;
  const isHoveringFirstVertex =
    canClose &&
    boundary.vertices.length > 0 &&
    pointerPos &&
    Math.hypot(pointerPos.x - boundary.vertices[0].x, pointerPos.y - boundary.vertices[0].y) <= 22;

  // Dynamic ViewBox from zoomLevel & panOffset
  const zoomFactor = zoomLevel / 100;
  const viewBoxWidth = CANVAS_WIDTH / zoomFactor;
  const viewBoxHeight = CANVAS_HEIGHT / zoomFactor;
  const viewBoxX = (CANVAS_WIDTH - viewBoxWidth) / 2 - panOffset.x / zoomFactor;
  const viewBoxY = (CANVAS_HEIGHT - viewBoxHeight) / 2 - panOffset.y / zoomFactor;
  const currentViewBox = `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`;

  const canvasCursor = isPanning
    ? "cursor-grabbing"
    : activeTool === "pan"
    ? "cursor-grab"
    : activeTool === "zoom"
    ? "cursor-zoom-in"
    : activeTool === "boundary" || activeTool === "calibrate"
    ? "cursor-crosshair"
    : "cursor-default";

  // Approximate area in m² for a closed, calibrated boundary.
  const approximateAreaM2 = boundary.isClosed && boundary.vertices.length >= 3 && calibration.isCalibrated && calibration.pixelsPerCm && calibration.pixelsPerCm > 0
    ? (() => {
        let areaPx = 0;
        for (let i = 0; i < boundary.vertices.length; i++) {
          const j = (i + 1) % boundary.vertices.length;
          areaPx += boundary.vertices[i].x * boundary.vertices[j].y;
          areaPx -= boundary.vertices[j].x * boundary.vertices[i].y;
        }
        areaPx = Math.abs(areaPx) / 2;
        const areaCm2 = areaPx / (calibration.pixelsPerCm * calibration.pixelsPerCm);
        return (areaCm2 / 10000).toFixed(1);
      })()
    : "—";

  return (
    <div className="space-y-4">
      {/* 3-Column Metadata Strip matching 04-calibration-and-boundary.png */}
      <div className="rounded-2xl border border-[#E2E6E8] bg-white shadow-xs grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-[#E2E6E8]">
        <div className="flex items-center gap-3 p-4">
          <FileText size={20} strokeWidth={1.8} className="text-[#17252B] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-[#647078]">Assessment</p>
            <p className="font-semibold text-sm text-[#17252B] truncate">{assessmentName || "Not provided"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4">
          <Building2 size={20} strokeWidth={1.8} className="text-[#17252B] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-[#647078]">Facility</p>
            <p className="font-semibold text-sm text-[#17252B] truncate">{facilityName || "Not provided"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4">
          <Layers size={20} strokeWidth={1.8} className="text-[#17252B] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-[#647078]">Space or area</p>
            <p className="font-semibold text-sm text-[#17252B] truncate">{spaceName || "Not provided"}</p>
          </div>
        </div>
      </div>

      {/* Main Drafting Grid: Left Controls + Right Canvas */}
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Left Side Controller */}
        <div className="rounded-2xl border border-[#E2E6E8] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#17252B]">
              Calibration & drafting
            </h2>
            <p className="mt-1 text-xs text-[#647078]">
              Set the scale and draw the boundary for the space.
            </p>

            {/* Sub-tabs matching 04-calibration-and-boundary.png */}
            <div className="mt-5 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab("scale");
                  setActiveTool("calibrate");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  activeSubTab === "scale"
                    ? "bg-[#E6F0EE] text-[#0B514B] border-l-4 border-[#0B514B]"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Ruler size={16} />
                <span>Set scale</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSubTab("boundary");
                  setActiveTool("boundary");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  activeSubTab === "boundary"
                    ? "bg-[#E6F0EE] text-[#0B514B] border-l-4 border-[#0B514B]"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Share2 size={16} />
                <span>Draw boundary</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSubTab("review");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  activeSubTab === "review"
                    ? "bg-[#E6F0EE] text-[#0B514B] border-l-4 border-[#0B514B]"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Search size={16} />
                <span>Review & refine</span>
              </button>
            </div>

            {/* Sub-tab Content */}
            <div className="mt-6 border-t border-[#E2E6E8] pt-5">
              {activeSubTab === "scale" && (
                <div className="space-y-4">
                  <CalibrationTool
                    calibration={calibration}
                    onApplyCalibration={(newCal) => {
                      onUpdateCalibration(newCal);
                      setActiveTool("boundary");
                      setActiveSubTab("boundary");
                    }}
                    onResetCalibration={() =>
                      onUpdateCalibration({
                        p1: null,
                        p2: null,
                        realLength: null,
                        unit: "m",
                        pixelsPerCm: null,
                        isCalibrated: false,
                      })
                    }
                  />
                </div>
              )}

              {activeSubTab === "boundary" && (
                <div className="space-y-4 text-xs">
                  <div>
                    <h3 className="text-sm font-bold text-[#17252B]">Draw boundary</h3>
                    <p className="mt-1 text-xs text-[#647078] leading-relaxed">
                      {!boundary.isClosed
                        ? "Click corners along the room perimeter. Place at least 3 points, then click the start point or close button to complete."
                        : "Boundary outline completed. Drag any corner handle to adjust alignment."}
                    </p>
                  </div>

                  {!boundary.isClosed ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between text-xs text-[#647078] bg-[#F8FAFA] p-2.5 rounded-lg border border-[#E2E6E8]">
                        <span>Points placed:</span>
                        <span className="font-mono font-bold text-[#17252B]">{boundary.vertices.length} vertices</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleUndoVertex}
                          disabled={boundary.vertices.length === 0}
                          className="rounded-lg border border-[#E2E6E8] bg-white px-3 py-1.5 font-medium hover:bg-[#F7F8F8] disabled:opacity-40 cursor-pointer"
                        >
                          Undo Point
                        </button>
                        <button
                          type="button"
                          onClick={handleCloseBoundary}
                          disabled={boundary.vertices.length < 3}
                          className="rounded-lg bg-[#0B514B] px-3 py-1.5 font-semibold text-white hover:bg-[#073D38] disabled:opacity-40 cursor-pointer"
                        >
                          Close Boundary
                        </button>
                        {boundary.vertices.length > 0 && (
                          <button
                            type="button"
                            onClick={handleResetBoundary}
                            className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-600 hover:bg-red-50 cursor-pointer ml-auto"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 space-y-1">
                        <p className="font-semibold text-xs flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span>Boundary polygon closed</span>
                        </p>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          Drag any corner circle directly on the canvas to adjust and align the perimeter.
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleResetBoundary}
                          className="rounded-lg border border-[#E2E6E8] bg-white px-3 py-1.5 font-medium text-[#647078] hover:bg-[#F7F8F8] cursor-pointer"
                        >
                          Redraw boundary
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubTab("review");
                            setActiveTool("select");
                          }}
                          className="rounded-lg bg-[#0B514B] px-3.5 py-1.5 font-semibold text-white hover:bg-[#073D38] cursor-pointer"
                        >
                          Review & refine &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === "review" && (
                <div className="space-y-4 text-xs text-[#647078]">
                  <div>
                    <h3 className="text-sm font-bold text-[#17252B]">Review & refine</h3>
                    <p className="mt-1 text-xs text-[#647078] leading-relaxed">
                      Confirm scale calibration and perimeter boundary before continuing.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E6E8] p-3 space-y-2 bg-[#F8FAFA]">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#17252B]">Scale status:</span>
                      <span className={`font-bold ${calibration.isCalibrated ? "text-emerald-600" : "text-amber-600"}`}>
                        {calibration.isCalibrated ? "Calibrated ✓" : "Incomplete"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#17252B]">Boundary status:</span>
                      <span className={`font-bold ${boundary.isClosed ? "text-emerald-600" : "text-amber-600"}`}>
                        {boundary.isClosed ? `${boundary.vertices.length} vertices ✓` : "Incomplete"}
                      </span>
                    </div>
                    {approximateAreaM2 !== "—" && (
                      <div className="flex justify-between items-center pt-1 border-t border-[#E2E6E8]">
                        <span className="font-medium text-[#17252B]">Calculated area:</span>
                        <span className="font-mono font-bold text-[#0B514B]">{approximateAreaM2} m²</span>
                      </div>
                    )}
                  </div>

                  {onContinue && (
                    <button
                      type="button"
                      onClick={onContinue}
                      disabled={!boundary.isClosed || !calibration.isCalibrated}
                      className="w-full rounded-lg bg-[#0B514B] px-4 py-2.5 font-semibold text-white hover:bg-[#073D38] disabled:opacity-50 transition cursor-pointer"
                    >
                      Continue to review step &rarr;
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Metrics Summary */}
          <div className="border-t border-[#E2E6E8] pt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[#647078]">Boundary progress</p>
              <p className="mt-0.5 font-bold text-[#17252B]">
                {boundary.vertices.length} vertices
              </p>
            </div>
            <div>
              <p className="text-[#647078]">Area (auto-calc)</p>
              <p className="mt-0.5 font-bold text-[#17252B]">
                {approximateAreaM2 !== "—" ? `${approximateAreaM2} m²` : "Not measured"}
              </p>
            </div>
          </div>
        </div>

        {/* Right Canvas Area */}
        <div className="flex flex-col rounded-2xl border border-[#E2E6E8] bg-white overflow-hidden shadow-xs">
          {/* Top Floating Canvas Toolbar matching 04-calibration-and-boundary.png */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#E2E6E8] bg-white px-4 py-2 text-xs">
            {/* Tool Mode Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTool("select")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                  activeTool === "select"
                    ? "bg-[#E6F0EE] text-[#0B514B] font-semibold"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <MousePointer size={14} />
                <span>Select</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool("calibrate");
                  setActiveSubTab("scale");
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                  activeTool === "calibrate"
                    ? "bg-[#E6F0EE] text-[#0B514B] font-semibold"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Ruler size={14} />
                <span>Calibrate</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool("boundary");
                  setActiveSubTab("boundary");
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                  activeTool === "boundary"
                    ? "bg-[#E6F0EE] text-[#0B514B] font-semibold"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Share2 size={14} />
                <span>Draw boundary</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("pan")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                  activeTool === "pan"
                    ? "bg-[#E6F0EE] text-[#0B514B] font-semibold"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Hand size={14} />
                <span>Pan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("zoom")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                  activeTool === "zoom"
                    ? "bg-[#E6F0EE] text-[#0B514B] font-semibold"
                    : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
                }`}
              >
                <Search size={14} />
                <span>Zoom</span>
              </button>
            </div>

            {/* Grid & Zoom Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className="flex items-center gap-1.5 text-[#647078] hover:text-[#17252B] cursor-pointer"
              >
                {showGrid ? (
                  <CheckSquare size={16} className="text-[#0B514B]" />
                ) : (
                  <Square size={16} />
                )}
                <span>Show grid</span>
              </button>

              <div className="h-4 w-px bg-[#E2E6E8]" />

              <div className="flex items-center rounded-lg border border-[#E2E6E8] bg-white">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  className="px-2 py-1 text-[#647078] hover:text-[#17252B] cursor-pointer"
                  aria-label="Zoom out"
                >
                  <Minus size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(100);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  title="Click to reset zoom and pan"
                  className="px-2 font-mono text-[11px] font-semibold text-[#17252B] hover:text-[#0B514B] cursor-pointer"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                  className="px-2 py-1 text-[#647078] hover:text-[#17252B] cursor-pointer"
                  aria-label="Zoom in"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* SVG Canvas Surface */}
          <div className="relative flex-1 overflow-hidden bg-[#F7F8F8] p-4 flex items-center justify-center min-h-[460px]">
            <svg
              ref={svgRef}
              viewBox={currentViewBox}
              className={`w-full h-auto max-h-[580px] select-none touch-none ${canvasCursor} rounded-lg bg-white shadow-xs border border-[#E2E6E8]`}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onPointerDown={handleCanvasPointerDown}
              onPointerUp={handleCanvasPointerUp}
            >
              <defs>
                {/* Architectural Coordinate Grid */}
                <pattern
                  id="architectural-grid"
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                    fill="none"
                    stroke="#E5EAE8"
                    strokeWidth="0.8"
                  />
                </pattern>
                <pattern
                  id="architectural-major-grid"
                  width={GRID_SIZE * 5}
                  height={GRID_SIZE * 5}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`}
                    fill="none"
                    stroke="#D5DEDC"
                    strokeWidth="1.2"
                  />
                </pattern>
              </defs>

              {/* Background */}
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#FFFFFF" />

              {/* Image Floorplan */}
              {source === "upload" && uploadedFile?.previewAvailable && (
                <image
                  href={uploadedFile.objectUrl}
                  x="0"
                  y="0"
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  preserveAspectRatio="xMidYMid meet"
                  opacity="0.95"
                />
              )}

              {/* Grid Overlay */}
              {showGrid && (
                <>
                  <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#architectural-grid)" />
                  <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#architectural-major-grid)" />
                </>
              )}

              {/* Calibration Line matching 04-calibration-and-boundary.png */}
              {calibration.p1 ? (
                <g>
                  <circle
                    cx={calibration.p1.x}
                    cy={calibration.p1.y}
                    r={5}
                    fill="#0B514B"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                  {calibration.p2 ? (
                    <g>
                      <line
                        x1={calibration.p1.x}
                        y1={calibration.p1.y}
                        x2={calibration.p2.x}
                        y2={calibration.p2.y}
                        stroke="#0B514B"
                        strokeWidth={2.5}
                        strokeDasharray="6 3"
                      />
                      <circle
                        cx={calibration.p2.x}
                        cy={calibration.p2.y}
                        r={5}
                        fill="#0B514B"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                      {calibration.realLength != null && calibration.realLength > 0 && (
                        <>
                          {/* Midpoint measurement label */}
                          <rect
                            x={(calibration.p1.x + calibration.p2.x) / 2 - 28}
                            y={(calibration.p1.y + calibration.p2.y) / 2 - 18}
                            width={56}
                            height={18}
                            rx={4}
                            fill="#0B514B"
                          />
                          <text
                            x={(calibration.p1.x + calibration.p2.x) / 2}
                            y={(calibration.p1.y + calibration.p2.y) / 2 - 5}
                            fill="#FFFFFF"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {`${calibration.realLength} ${calibration.unit}`}
                          </text>
                        </>
                      )}
                    </g>
                  ) : (
                    pointerPos &&
                    activeTool === "calibrate" && (
                      <line
                        x1={calibration.p1.x}
                        y1={calibration.p1.y}
                        x2={pointerPos.x}
                        y2={pointerPos.y}
                        stroke="#0B514B"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                    )
                  )}
                </g>
              ) : null}

              {/* Traced Boundary Polygon */}
              {boundary.vertices.length > 0 ? (
                <g>
                  {boundary.isClosed ? (
                    <polygon
                      points={polygonPointsStr}
                      fill="rgba(11, 81, 75, 0.12)"
                      stroke="#0B514B"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                    />
                  ) : (
                    <>
                      <polyline
                        points={polygonPointsStr}
                        fill="none"
                        stroke="#0B514B"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                      />
                      {pointerPos && activeTool === "boundary" && (
                        <line
                          x1={boundary.vertices[boundary.vertices.length - 1].x}
                          y1={boundary.vertices[boundary.vertices.length - 1].y}
                          x2={pointerPos.x}
                          y2={pointerPos.y}
                          stroke="#0B514B"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                      )}
                    </>
                  )}

                  {/* Corner Vertex Handles */}
                  {boundary.vertices.map((v, i) => (
                    <g key={`vertex-${i}`}>
                      {i === 0 && isHoveringFirstVertex && (
                        <circle
                          cx={v.x}
                          cy={v.y}
                          r={14}
                          fill="rgba(11, 81, 75, 0.2)"
                          stroke="#0B514B"
                          strokeWidth={1.5}
                        />
                      )}
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r={draggingVertexIdx === i ? 7 : i === 0 && isHoveringFirstVertex ? 7 : 5}
                        fill={draggingVertexIdx === i || (i === 0 && isHoveringFirstVertex) ? "#0B514B" : "#FFFFFF"}
                        stroke="#0B514B"
                        strokeWidth={2}
                        className={boundary.isClosed ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                        onPointerDown={(e) => handleVertexPointerDown(i, e)}
                        onPointerUp={handleVertexPointerUp}
                      />
                      {i === 0 && isHoveringFirstVertex && (
                        <g transform={`translate(${v.x + 10}, ${v.y - 12})`}>
                          <rect x={0} y={-12} width={76} height={18} rx={4} fill="#0B514B" />
                          <text x={38} y={1} fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                            Click to close
                          </text>
                        </g>
                      )}
                    </g>
                  ))}
                </g>
              ) : null}
            </svg>
          </div>
        </div>
      </div>

      {/* Footer Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E6E8] bg-white px-4 py-2.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Back to source</span>
          </button>
        ) : <div />}

        {onContinue ? (
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B514B] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#073D38] transition-colors cursor-pointer"
          >
            <span>Continue to review</span>
            <ChevronRight size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
