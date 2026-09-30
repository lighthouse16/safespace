"use client";

import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
}: BoundaryDraftCanvasProps) {
  const [activeTool, setActiveTool] = useState<"calibrate" | "boundary">(
    calibration.isCalibrated ? "boundary" : "calibrate"
  );
  const [pointerPos, setPointerPos] = useState<Point2D | null>(null);
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
  };

  const handleCanvasClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingVertexIdx !== null) return;
    const rawPt = getSvgCoordinates(e);
    const pt = snapPoint(rawPt);

    if (activeTool === "calibrate") {
      if (!calibration.p1) {
        onUpdateCalibration({ ...calibration, p1: pt, p2: null });
      } else if (!calibration.p2) {
        onUpdateCalibration({ ...calibration, p2: pt });
      } else {
        // If already had 2 points, start fresh calibration with this point
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

  const handleVertexPointerDown = (index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!boundary.isClosed) return;
    setDraggingVertexIdx(index);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }
  };

  const handleVertexPointerUp = (e: React.PointerEvent) => {
    if (draggingVertexIdx !== null) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
      setDraggingVertexIdx(null);
    }
  };

  const handleUndoVertex = () => {
    if (boundary.vertices.length === 0 || boundary.isClosed) return;
    onUpdateBoundary({
      ...boundary,
      vertices: undoBoundaryVertex(boundary.vertices),
    });
  };

  const handleCloseBoundary = () => {
    onUpdateBoundary(closeBoundary(boundary));
  };

  const handleResetBoundary = () => {
    setShowResetConfirm(false);
    onUpdateBoundary({
      ...boundary,
      vertices: [],
      isClosed: false,
      selectedVertexIndex: null,
    });
  };

  // Convert points to SVG points string
  const polygonPoints = boundary.vertices.map((v) => `${v.x},${v.y}`).join(" ");

  const lastVertex =
    boundary.vertices.length > 0
      ? boundary.vertices[boundary.vertices.length - 1]
      : null;

  const isNearFirstVertex =
    !boundary.isClosed &&
    boundary.vertices.length >= 3 &&
    pointerPos &&
    Math.hypot(pointerPos.x - boundary.vertices[0].x, pointerPos.y - boundary.vertices[0].y) <=
      20;

  const boundaryStatus =
    boundary.vertices.length === 0
      ? "Not started"
      : boundary.isClosed
      ? "Closed"
      : "In progress";

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tool mode switch */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => setActiveTool("calibrate")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTool === "calibrate"
                  ? "bg-white text-[#1e7168] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              1. Set Scale {calibration.isCalibrated && "✓"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("boundary")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTool === "boundary"
                  ? "bg-white text-[#1e7168] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2. Draw Boundary {boundary.isClosed && "✓"}
            </button>
          </div>

          {/* Grid snap toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateBoundary({ ...boundary, gridSnap: !boundary.gridSnap })
            }
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              boundary.gridSnap
                ? "border-[#1e7168] bg-[#e8f3f1] text-[#1e7168]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Grid Snap (20px): {boundary.gridSnap ? "ON" : "OFF"}
          </button>
        </div>

        {/* Boundary Actions */}
        <div className="flex items-center gap-2">
          {activeTool === "boundary" && !boundary.isClosed && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleUndoVertex}
                disabled={boundary.vertices.length === 0}
              >
                Undo Point
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={handleCloseBoundary}
                disabled={boundary.vertices.length < 3}
              >
                Close Boundary ({boundary.vertices.length}/3+)
              </Button>
            </>
          )}

          {boundary.vertices.length > 0 && (
            <div>
              {showResetConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#dc2626] font-medium">Reset all?</span>
                  <Button
                    type="button"
                    variant="danger"
                    size="xs"
                    onClick={handleResetBoundary}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-slate-500 hover:text-[#dc2626]"
                >
                  Reset Boundary
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Area: Sidebar & Canvas */}
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Left Side Controller / Inspector */}
        <div className="space-y-4">
          <CalibrationTool
            calibration={calibration}
            onApplyCalibration={(newCal) => {
              onUpdateCalibration(newCal);
              setActiveTool("boundary");
            }}
            onResetCalibration={() =>
              onUpdateCalibration({
                p1: null,
                p2: null,
                realLength: null,
                unit: "cm",
                pixelsPerCm: null,
                isCalibrated: false,
              })
            }
          />

          {/* Status & Instructions Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs text-xs space-y-2.5">
            <h4 className="font-semibold uppercase tracking-wider text-slate-500 text-[11px]">
              Drafting Guide
            </h4>

            {activeTool === "calibrate" ? (
              <p className="text-slate-600 leading-relaxed">
                Click two points along a known distance (e.g. wall or door) on the preview or manual grid. Then specify the real dimension to calculate physical scale.
              </p>
            ) : (
              <p className="text-slate-600 leading-relaxed">
                {boundary.vertices.length === 0
                  ? "Click anywhere on the canvas to place the first boundary vertex."
                  : !boundary.isClosed
                  ? `Placed ${boundary.vertices.length} vertices. Continue clicking perimeter corners. Need at least 3 to close.`
                  : "Boundary closed. Drag any corner handle on the canvas to fine-tune the room outline."}
              </p>
            )}

            <div className="border-t border-slate-100 pt-2.5 space-y-1.5 text-[11px] text-[#475569]">
              <div className="flex justify-between">
                <span>Vertices:</span>
                <span className="font-mono font-medium">{boundary.vertices.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Boundary status:</span>
                <span className="font-medium text-[#192329]">{boundaryStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Physical scale:</span>
                <span className="font-mono">
                  {calibration.isCalibrated && calibration.pixelsPerCm
                    ? `${calibration.pixelsPerCm.toFixed(2)} px/cm`
                    : "Not calibrated"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Canvas Area */}
        <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-900 shadow-inner">
          {/* Instructions Overlay Header */}
          <div className="absolute top-2 left-2 z-10 rounded bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-xs border border-slate-200 shadow-2xs">
            {activeTool === "calibrate"
              ? "Scale tool active · Click 2 points"
              : boundary.isClosed
              ? "Boundary complete · Drag vertices to edit"
              : "Boundary tool active · Click to trace points"}
          </div>

          {/* Canvas SVG */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="w-full h-auto max-h-[620px] select-none touch-none cursor-crosshair block"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handleCanvasClick}
          >
            <defs>
              {/* Coordinate Grid Pattern */}
              <pattern
                id="grid-pattern"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="0.8"
                />
              </pattern>
              <pattern
                id="grid-major"
                width={GRID_SIZE * 5}
                height={GRID_SIZE * 5}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.18)"
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>

            {/* Background Canvas: Either Image or Blank Grid */}
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#131d24" />

            {/* Image Floorplan if uploaded */}
            {source === "upload" && uploadedFile && uploadedFile.previewAvailable ? (
              <image
                href={uploadedFile.objectUrl}
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                preserveAspectRatio="xMidYMid meet"
                opacity="0.85"
              />
            ) : null}

            {/* Coordinate Grid overlay */}
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid-pattern)" />
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid-major)" />

            {/* Scale Calibration Reference Line */}
            {calibration.p1 && (
              <g>
                <circle
                  cx={calibration.p1.x}
                  cy={calibration.p1.y}
                  r={6}
                  fill="#1e7168"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                {calibration.p2 ? (
                  <>
                    <line
                      x1={calibration.p1.x}
                      y1={calibration.p1.y}
                      x2={calibration.p2.x}
                      y2={calibration.p2.y}
                      stroke="#1e7168"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                    />
                    <circle
                      cx={calibration.p2.x}
                      cy={calibration.p2.y}
                      r={6}
                      fill="#1e7168"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </>
                ) : (
                  pointerPos &&
                  activeTool === "calibrate" && (
                    <line
                      x1={calibration.p1.x}
                      y1={calibration.p1.y}
                      x2={pointerPos.x}
                      y2={pointerPos.y}
                      stroke="#1e7168"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  )
                )}
              </g>
            )}

            {/* Boundary Polygon Drafting Layer */}
            {boundary.vertices.length > 0 && (
              <g>
                {/* Traced polygon */}
                {boundary.isClosed ? (
                  <polygon
                    points={polygonPoints}
                    fill="rgba(30, 113, 104, 0.25)"
                    stroke="#1e7168"
                    strokeWidth={2.5}
                  />
                ) : (
                  <polyline
                    points={polygonPoints}
                    fill="none"
                    stroke="#1e7168"
                    strokeWidth={2.5}
                  />
                )}

                {/* Dynamic live cursor connection line during drafting */}
                {activeTool === "boundary" &&
                  !boundary.isClosed &&
                  lastVertex &&
                  pointerPos && (
                    <line
                      x1={lastVertex.x}
                      y1={lastVertex.y}
                      x2={pointerPos.x}
                      y2={pointerPos.y}
                      stroke="#1e7168"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  )}

                {/* Vertex handles */}
                {boundary.vertices.map((v, i) => {
                  const isFirst = i === 0;
                  return (
                    <g
                      key={i}
                      data-testid={`vertex-handle-${i}`}
                      className={boundary.isClosed ? "cursor-move" : "cursor-pointer"}
                      onPointerDown={(e) => handleVertexPointerDown(i, e)}
                      onPointerUp={handleVertexPointerUp}
                      onPointerCancel={handleVertexPointerUp}
                    >
                      {/* Transparent touch hit-target (44x44 target, r=22) */}
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r={22}
                        fill="transparent"
                      />
                      {/* Visual Vertex Handle */}
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r={isFirst && !boundary.isClosed ? 7 : 5}
                        fill={isFirst && isNearFirstVertex ? "#16a34a" : "#ffffff"}
                        stroke="#1e7168"
                        strokeWidth={2.5}
                        className="pointer-events-none"
                      />
                      <text
                        x={v.x + 9}
                        y={v.y - 7}
                        fill="#ffffff"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                        className="pointer-events-none drop-shadow-sm select-none"
                      >
                        v{i + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Hover near first vertex hint */}
                {isNearFirstVertex && (
                  <g className="pointer-events-none">
                    <circle
                      cx={boundary.vertices[0].x}
                      cy={boundary.vertices[0].y}
                      r={14}
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                    />
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
