"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { type SpatialFurniture, type Point2D, type RouteWaypoint } from "@/lib/spatial-model";
import { computePolygonBoundsCm, type RouteResult, type SpatialEvaluationResult } from "@/lib/spatial";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

interface Floorplan2DProps {
  customFurniture?: SpatialFurniture[];
  customRouteResult?: RouteResult | null;
  customEvaluation?: SpatialEvaluationResult | null;
  onCustomMove?: (id: string, x: number, y: number) => void;
  readOnly?: boolean;
  overrideStage?: "layout" | "profile" | "routes" | "analysis" | "improve" | "before";
  isBeforeCondition?: boolean;
  showDiffGhost?: boolean;
  showChangedOnly?: boolean;
  hideControls?: boolean;
  className?: string;
}

export function Floorplan2D({
  customFurniture,
  customRouteResult,
  customEvaluation,
  onCustomMove,
  readOnly = false,
  overrideStage,
  isBeforeCondition = false,
  showChangedOnly = false,
  hideControls = false,
  className = "",
}: Floorplan2DProps) {
  const {
    activeStage,
    rooms,
    walls,
    doors,
    furniture: storeFurniture,
    routeWaypoints,
    selectedFurnitureId,
    selectedHazardId,
    selectedFindingId,
    selectFurniture,
    selectHazard,
    selectFinding,
    moveFurniture,
    rotateFurniture,
    deleteFurniture,
    showGrid,
    setShowGrid,
    showDimensions,
    setShowDimensions,
    snapToGrid,
    setSnapToGrid,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    selectedTool,
    layerToggles,
    isWalkerAnimating,
    selectedWaypointId,
    selectWaypoint,
    moveRouteWaypoint,
    routeResult: storeRouteResult,
    activeProfile,
    canonicalBoundary,
    calibrationProvenance,
    floorplanImageBlobUrl,
    getSpatialFindings,
  } = useSafeSpaceStore();

  const isBefore = isBeforeCondition || overrideStage === "before";
  const stage = isBefore ? "before" : (overrideStage || activeStage);
  const furniture = customFurniture || storeFurniture;
  const handleMove = onCustomMove || moveFurniture;
  const routeResult = customRouteResult !== undefined ? customRouteResult : storeRouteResult;

  const spatialEvaluation = customEvaluation !== undefined ? (customEvaluation || getSpatialFindings()) : getSpatialFindings();
  const spatialFindingsWithLocation = useMemo(
    () => spatialEvaluation.findings.filter((f) => Boolean(f.location)),
    [spatialEvaluation]
  );

  const userBounds = useMemo(() => {
    if (!canonicalBoundary || canonicalBoundary.length < 3) return null;
    return computePolygonBoundsCm(canonicalBoundary);
  }, [canonicalBoundary]);

  const { vbX, vbY, vbW, vbH, viewBoxStr } = useMemo(() => {
    if (userBounds) {
      const pad = Math.max(40, Math.round(Math.max(userBounds.widthCm, userBounds.heightCm) * 0.1));
      const x = Math.round(userBounds.minX - pad);
      const y = Math.round(userBounds.minY - pad);
      const w = Math.round(userBounds.widthCm + 2 * pad);
      const h = Math.round(userBounds.heightCm + 2 * pad);
      return { vbX: x, vbY: y, vbW: w, vbH: h, viewBoxStr: `${x} ${y} ${w} ${h}` };
    }
    return { vbX: 0, vbY: 0, vbW: 800, vbH: 600, viewBoxStr: "0 0 800 600" };
  }, [userBounds]);

  const isRouteSuccess =
    routeResult?.status === "success" && routeResult.path.length >= 2;
  const computedPath: readonly Point2D[] = useMemo(() => {
    return routeResult?.status === "success" && routeResult.path.length >= 2
      ? routeResult.path
      : [];
  }, [routeResult]);
  const requiredRadiusCm = activeProfile.minClearanceCm / 2;

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Dragging state
  const [draggingItem, setDraggingItem] = useState<{
    id: string;
    type: "furniture" | "waypoint";
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point2D>({ x: 0, y: 0 });
  const [hoveredWaypointId, setHoveredWaypointId] = useState<string | null>(null);

  // Walker animation along computed route only (Stage 3 & 4)
  const [walkerT, setWalkerT] = useState(0);

  useEffect(() => {
    if (!isWalkerAnimating || !isRouteSuccess || computedPath.length < 2) return;

    // Respect user's accessibility motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let animId: number;
    const start = performance.now();
    const duration = 6500; // 6.5s loop

    const step = (now: number) => {
      const elapsed = (now - start) % duration;
      setWalkerT(elapsed / duration);
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isWalkerAnimating, isRouteSuccess, computedPath]);

  // Compute walker coordinates along computedPath (only when route succeeds)
  const getWalkerPosition = useCallback(() => {
    if (!isRouteSuccess || computedPath.length < 2) {
      return { x: routeWaypoints[0]?.x ?? 95, y: routeWaypoints[0]?.y ?? 265, angle: 0 };
    }

    const segLengths: number[] = [];
    let totalLen = 0;
    for (let i = 0; i < computedPath.length - 1; i++) {
      const dx = computedPath[i + 1].x - computedPath[i].x;
      const dy = computedPath[i + 1].y - computedPath[i].y;
      const len = Math.hypot(dx, dy);
      segLengths.push(len);
      totalLen += len;
    }

    const targetDist = walkerT * totalLen;
    let accumulated = 0;

    for (let i = 0; i < segLengths.length; i++) {
      if (accumulated + segLengths[i] >= targetDist) {
        const segT = (targetDist - accumulated) / segLengths[i];
        const p1 = computedPath[i];
        const p2 = computedPath[i + 1];
        const x = p1.x + (p2.x - p1.x) * segT;
        const y = p1.y + (p2.y - p1.y) * segT;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
        return { x, y, angle };
      }
      accumulated += segLengths[i];
    }

    const last = computedPath[computedPath.length - 1];
    return { x: last.x, y: last.y, angle: 0 };
  }, [computedPath, isRouteSuccess, walkerT, routeWaypoints]);

  const walkerPos = getWalkerPosition();

  // Convert client mouse coordinates to SVG user coordinates
  const clientToSvgCoords = (clientX: number, clientY: number): Point2D => {
    if (!svgRef.current) return { x: 0, y: 0 };
    try {
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svgRef.current.getScreenCTM();
      if (ctm) {
        const transformed = pt.matrixTransform(ctm.inverse());
        return { x: transformed.x, y: transformed.y };
      }
    } catch {
      // Fallback to proportional calculation
    }

    const rect = svgRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    const scaleX = vbW / (rect.width * zoom);
    const scaleY = vbH / (rect.height * zoom);

    const x = vbX + (rawX - panOffset.x) * scaleX;
    const y = vbY + (rawY - panOffset.y) * scaleY;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedTool === "pan" || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!draggingItem || readOnly) return;

    const coords = clientToSvgCoords(e.clientX, e.clientY);
    let targetX = coords.x - draggingItem.offsetX;
    let targetY = coords.y - draggingItem.offsetY;

    if (snapToGrid) {
      targetX = Math.round(targetX / 10) * 10;
      targetY = Math.round(targetY / 10) * 10;
    }

    const minBoundX = userBounds ? Math.round(userBounds.minX + 5) : 50;
    const maxBoundX = userBounds ? Math.round(userBounds.maxX - 5) : 720;
    const minBoundY = userBounds ? Math.round(userBounds.minY + 5) : 50;
    const maxBoundY = userBounds ? Math.round(userBounds.maxY - 5) : 520;

    targetX = Math.max(minBoundX, Math.min(maxBoundX, targetX));
    targetY = Math.max(minBoundY, Math.min(maxBoundY, targetY));

    if (draggingItem.type === "furniture") {
      handleMove(draggingItem.id, targetX, targetY);
    } else if (draggingItem.type === "waypoint") {
      moveRouteWaypoint(draggingItem.id, targetX, targetY);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingItem(null);
  };

  const startDragFurniture = (e: React.MouseEvent, item: SpatialFurniture) => {
    if (readOnly || item.isFixed || selectedTool === "pan") return;
    e.stopPropagation();
    selectFurniture(item.id);

    const coords = clientToSvgCoords(e.clientX, e.clientY);
    setDraggingItem({
      id: item.id,
      type: "furniture",
      offsetX: coords.x - item.x,
      offsetY: coords.y - item.y,
    });
  };

  const startDragWaypoint = (e: React.MouseEvent, pt: RouteWaypoint) => {
    if (readOnly || stage !== "routes" || selectedTool === "pan") return;
    e.stopPropagation();
    selectWaypoint(pt.id);

    const coords = clientToSvgCoords(e.clientX, e.clientY);
    setDraggingItem({
      id: pt.id,
      type: "waypoint",
      offsetX: coords.x - pt.x,
      offsetY: coords.y - pt.y,
    });
  };

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))));
  const handleFitView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectFurniture(null);
        selectHazard(null);
        selectWaypoint(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedFurnitureId && !readOnly) {
        const item = furniture.find((f) => f.id === selectedFurnitureId);
        if (item && !item.isFixed) {
          deleteFurniture(selectedFurnitureId);
        }
      } else if (e.key.toLowerCase() === "r" && selectedFurnitureId && !readOnly) {
        rotateFurniture(selectedFurnitureId);
      } else if (selectedFurnitureId && !readOnly && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const item = furniture.find((f) => f.id === selectedFurnitureId);
        if (item && !item.isFixed) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 2;
          let dx = 0;
          let dy = 0;
          if (e.key === "ArrowUp") dy = -step;
          if (e.key === "ArrowDown") dy = step;
          if (e.key === "ArrowLeft") dx = -step;
          if (e.key === "ArrowRight") dx = step;
          handleMove(selectedFurnitureId, Math.round(item.x + dx), Math.round(item.y + dy));
        }
      } else if (selectedWaypointId && stage === "routes" && !readOnly && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const pt = routeWaypoints.find((w) => w.id === selectedWaypointId);
        if (pt) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 2;
          let dx = 0;
          let dy = 0;
          if (e.key === "ArrowUp") dy = -step;
          if (e.key === "ArrowDown") dy = step;
          if (e.key === "ArrowLeft") dx = -step;
          if (e.key === "ArrowRight") dx = step;
          moveRouteWaypoint(selectedWaypointId, Math.round(pt.x + dx), Math.round(pt.y + dy));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFurnitureId, furniture, readOnly, rotateFurniture, deleteFurniture, selectFurniture, selectHazard, selectWaypoint, selectedWaypointId, stage, routeWaypoints, moveRouteWaypoint, handleMove]);

  return (
    <div
      className={`relative flex flex-col h-full w-full select-none overflow-hidden bg-[#fafbf9] border border-[#e2e7e3] rounded-lg ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Floating Canvas Controls */}
      {!hideControls && (
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-[#e2e8e4] px-2 py-1 rounded text-xs text-[#2c3d3a]">
          <span className="font-semibold text-[#1e7168]">
            {isBefore ? "BEFORE PLAN" : "2D PLAN"}
          </span>
          <span className="text-[#a4b2ad]">|</span>
          <button
            type="button"
            aria-label="Toggle grid visibility"
            onClick={() => setShowGrid((v) => !v)}
            className={`min-h-[28px] px-2 py-0.5 rounded transition flex items-center text-xs ${
              showGrid ? "bg-[#e8f3f1] text-[#1e7168] font-medium" : "text-[#627571] hover:bg-slate-100"
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            aria-label="Toggle snap to grid"
            onClick={() => setSnapToGrid((v) => !v)}
            className={`min-h-[28px] px-2 py-0.5 rounded transition flex items-center text-xs ${
              snapToGrid ? "bg-[#e8f3f1] text-[#1e7168] font-medium" : "text-[#627571] hover:bg-slate-100"
            }`}
          >
            Snap
          </button>
          <button
            type="button"
            aria-label="Toggle dimension indicators"
            onClick={() => setShowDimensions((v) => !v)}
            className={`min-h-[28px] px-2 py-0.5 rounded transition flex items-center text-xs ${
              showDimensions ? "bg-[#e8f3f1] text-[#1e7168] font-medium" : "text-[#627571] hover:bg-slate-100"
            }`}
          >
            Dim
          </button>
        </div>
      )}

      {/* Floating Zoom / Fit Controls */}
      {!hideControls && (
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-[#e2e8e4] p-1 rounded">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="min-h-[28px] min-w-[28px] flex items-center justify-center p-1 text-[#4a5e59] hover:text-[#1e7168] hover:bg-slate-100 rounded transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-[#4a5e59] px-0.5">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="min-h-[28px] min-w-[28px] flex items-center justify-center p-1 text-[#4a5e59] hover:text-[#1e7168] hover:bg-slate-100 rounded transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitView}
            aria-label="Fit view to room"
            className="min-h-[28px] min-w-[28px] flex items-center justify-center p-1 text-[#4a5e59] hover:text-[#1e7168] hover:bg-slate-100 rounded transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scale bar indicator */}
      {!hideControls && (
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2 bg-white/90 border border-[#e2e8e4] px-2 py-0.5 rounded text-[9px] text-[#556964] font-mono">
          <div className="flex flex-col items-center">
            <div className="flex items-center">
              <span className="w-px h-1 bg-[#556964]"></span>
              <div className="w-[40px] h-0.5 bg-[#556964]"></div>
              <span className="w-px h-1 bg-[#556964]"></span>
            </div>
            <span>1.0 m</span>
          </div>
          <span>Scale 1:50</span>
        </div>
      )}

      {/* SVG Canvas Area */}
      <svg
        ref={svgRef}
        viewBox={viewBoxStr}
        className={`w-full h-full cursor-${selectedTool === "pan" ? "grab" : "default"}`}
        onMouseDown={handleMouseDown}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: isPanning || draggingItem ? "none" : "transform 0.15s ease-out",
        }}
      >
        <defs>
          <pattern id="grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8ece9" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#grid-minor)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d5ded9" strokeWidth="1" />
          </pattern>

          <radialGradient id="heat-high" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#dc2626" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat-med" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.38" />
            <stop offset="70%" stopColor="#d97706" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
          </radialGradient>

          <marker id="route-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1d63b8" />
          </marker>
          <marker id="route-arrow-pinch" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
          </marker>
          <marker id="move-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0f766e" />
          </marker>
        </defs>

        {/* 1. Grid */}
        {showGrid && <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#grid-major)" />}

        {/* 1b. Floorplan Background Image (User-imported floorplan raster/SVG) */}
        {floorplanImageBlobUrl && calibrationProvenance && calibrationProvenance.pixelsPerCm > 0 && (
          <image
            href={floorplanImageBlobUrl}
            x={0}
            y={0}
            width={800 / calibrationProvenance.pixelsPerCm}
            height={600 / calibrationProvenance.pixelsPerCm}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.8}
            className="pointer-events-none select-none"
          />
        )}

        {/* 2. Room Zones / Canonical Boundary */}
        <g id="rooms-layer">
          {canonicalBoundary && canonicalBoundary.length >= 3 ? (
            <g id="user-canonical-boundary">
              <polygon
                points={canonicalBoundary.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={floorplanImageBlobUrl ? "none" : "#f4f8f6"}
                stroke="#0f766e"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <text
                x={(userBounds?.minX ?? 0) + 16}
                y={(userBounds?.minY ?? 0) + 24}
                fill="#0f766e"
                fontSize="12"
                fontWeight="700"
                letterSpacing="1"
                fontFamily="var(--font-inter), Inter, sans-serif"
                className="select-none pointer-events-none"
              >
                USER BOUNDARY ({Math.round(userBounds?.widthCm ?? 0)} × {Math.round(userBounds?.heightCm ?? 0)} CM)
              </text>
            </g>
          ) : (
            rooms.map((room) => (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.depth}
                  fill={room.color}
                  stroke="#d2dbd6"
                  strokeWidth="1"
                />
                <text
                  x={room.x + 12}
                  y={room.y + 20}
                  fill="#70837e"
                  fontSize="10"
                  fontWeight="600"
                  letterSpacing="1"
                  fontFamily="var(--font-inter), Inter, sans-serif"
                  className="select-none pointer-events-none"
                >
                  {room.name.toUpperCase()}
                </text>
              </g>
            ))
          )}
        </g>

        {/* 3. Heatmap Layer */}
        {(stage === "analysis" || stage === "improve" || stage === "before") && layerToggles.heatmap && (
          <g id="heatmap-layer" className="pointer-events-none transition-opacity duration-300">
            {spatialFindingsWithLocation.map((f) => {
              const isHigh = f.severity === "critical" || f.severity === "high";
              const r = isHigh ? 55 : 35;
              const fillGrad = isHigh ? "url(#heat-high)" : "url(#heat-med)";
              return (
                <circle
                  key={`heat-${f.id}`}
                  cx={f.location!.x}
                  cy={f.location!.y}
                  r={r}
                  fill={fillGrad}
                />
              );
            })}
          </g>
        )}

        {/* 4. Route Clearance Envelope Buffer (Rendered only on successful computed route) */}
        {(stage === "routes" || stage === "analysis" || stage === "improve" || stage === "before") &&
          layerToggles.clearance &&
          isRouteSuccess && (
            <g id="clearance-envelope-layer" className="pointer-events-none">
              <path
                d={computedPath.reduce(
                  (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
                  ""
                )}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={activeProfile.minClearanceCm}
                strokeOpacity="0.18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Highlight narrowest bottleneck if present */}
              {routeResult.bottlenecks.length > 0 &&
                routeResult.minimumClearanceCm < requiredRadiusCm && (
                  <g
                    transform={`translate(${routeResult.bottlenecks[0].position.x}, ${routeResult.bottlenecks[0].position.y})`}
                  >
                    <circle
                      r="22"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                      className="animate-pulse"
                    />
                    <rect
                      x="-26"
                      y="-28"
                      width="52"
                      height="16"
                      rx="3"
                      fill="#dc2626"
                      opacity="0.9"
                    />
                    <text
                      textAnchor="middle"
                      y="-17"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {Math.round(routeResult.bottlenecks[0].clearanceCm)} cm
                    </text>
                  </g>
                )}
            </g>
          )}

        {/* 5. Walking Route Line */}
        {(stage === "routes" || stage === "analysis" || stage === "improve" || stage === "before") &&
          layerToggles.route && (
            <g id="route-layer">
              {/* Computed route path if success */}
              {isRouteSuccess &&
                computedPath.map((pt, i) => {
                  if (i === computedPath.length - 1) return null;
                  const next = computedPath[i + 1];
                  const isConstrained =
                    routeResult.minimumClearanceCm < requiredRadiusCm;

                  return (
                    <line
                      key={`seg-${i}-${next.x}-${next.y}`}
                      x1={pt.x}
                      y1={pt.y}
                      x2={next.x}
                      y2={next.y}
                      stroke={isConstrained ? "#dc2626" : "#1d63b8"}
                      strokeWidth={isConstrained ? "3" : "2"}
                      strokeDasharray={isConstrained ? "5,3" : undefined}
                      markerEnd={isConstrained ? "url(#route-arrow-pinch)" : "url(#route-arrow)"}
                    />
                  );
                })}

              {/* If route calculation failed, render neutral dashed line connecting authored checkpoints */}
              {!isRouteSuccess &&
                routeWaypoints.map((pt, i) => {
                  if (i === routeWaypoints.length - 1) return null;
                  const next = routeWaypoints[i + 1];

                  return (
                    <line
                      key={`req-seg-${pt.id}-${next.id}`}
                      x1={pt.x}
                      y1={pt.y}
                      x2={next.x}
                      y2={next.y}
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                    />
                  );
                })}

              {/* Waypoint Nodes: DEFAULT USE NUMBER ONLY, HOVER/SELECT SHOWS NAME (Fixes route screen clutter!) */}
              {routeWaypoints.map((pt, i) => {
                const isSelected = selectedWaypointId === pt.id;
                const isHovered = hoveredWaypointId === pt.id;
                const isPinch = (isBefore || stage !== "improve") && pt.id === "pt-4" && !canonicalBoundary;

                return (
                  <g
                    key={`wp-${pt.id}`}
                    tabIndex={stage === "routes" && !readOnly ? 0 : undefined}
                    role={stage === "routes" ? "button" : undefined}
                    aria-label={`Route checkpoint ${i + 1}: ${pt.name}${isSelected ? ", selected" : ""}`}
                    aria-pressed={stage === "routes" ? isSelected : undefined}
                    onFocus={() => selectWaypoint(pt.id)}
                    className={stage === "routes" ? "cursor-move outline-none" : "cursor-pointer"}
                    onMouseDown={(e) => startDragWaypoint(e, pt)}
                    onMouseEnter={() => setHoveredWaypointId(pt.id)}
                    onMouseLeave={() => setHoveredWaypointId(null)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected || isHovered ? 8 : 6}
                      fill={isPinch ? "#dc2626" : isSelected ? "#0284c7" : "#1d63b8"}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 3}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="var(--font-inter), Inter, sans-serif"
                      className="pointer-events-none select-none"
                    >
                      {i + 1}
                    </text>

                    {/* Show label tooltip ONLY on hover or select per user requirement! */}
                    {(isSelected || isHovered) && (
                      <g transform={`translate(${pt.x + 10}, ${pt.y - 12})`} className="pointer-events-none">
                        <rect
                          x="0"
                          y="0"
                          width={pt.name.length * 6 + 12}
                          height="18"
                          rx="3"
                          fill="#1e293b"
                          opacity="0.9"
                        />
                        <text
                          x="6"
                          y="12"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="500"
                          fontFamily="var(--font-inter), Inter, sans-serif"
                        >
                          {pt.name}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Walker Footprint Animation: Rendered ONLY on computed route success */}
              {isWalkerAnimating && isRouteSuccess && (
                <g
                  transform={`translate(${walkerPos.x}, ${walkerPos.y}) rotate(${walkerPos.angle})`}
                  className="pointer-events-none transition-transform duration-75"
                >
                  <circle
                    r="20"
                    fill="none"
                    stroke={
                      routeResult.bottlenecks.length > 0 &&
                      routeResult.minimumClearanceCm < requiredRadiusCm &&
                      Math.hypot(
                        walkerPos.x - routeResult.bottlenecks[0].position.x,
                        walkerPos.y - routeResult.bottlenecks[0].position.y
                      ) < 45
                        ? "#dc2626"
                        : "#0284c7"
                    }
                    strokeWidth="1.5"
                    strokeDasharray="2,3"
                    opacity="0.8"
                  />
                  <rect x="-7" y="-10" width="14" height="20" rx="2.5" fill="#1e293b" opacity="0.85" />
                  <circle cx="5" cy="-7" r="2" fill="#f8fafc" />
                  <circle cx="5" cy="7" r="2" fill="#f8fafc" />
                  <circle cx="-5" cy="-7" r="2" fill="#f8fafc" />
                  <circle cx="-5" cy="7" r="2" fill="#f8fafc" />
                  <line x1="-2" y1="-7" x2="-2" y2="7" stroke="#f1f5f9" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              )}
            </g>
          )}

        {/* 6. Structural Walls */}
        <g id="walls-layer">
          {walls.map((w) => (
            <line
              key={w.id}
              x1={w.start.x}
              y1={w.start.y}
              x2={w.end.x}
              y2={w.end.y}
              stroke="#2c3a37"
              strokeWidth={w.thickness}
              strokeLinecap="square"
            />
          ))}
        </g>

        {/* 7. Doors & Door-swing Arcs */}
        <g id="doors-layer">
          {doors.map((door) => {
            const hasSwing = door.swingDeg > 0;
            return (
              <g key={door.id}>
                <line
                  x1={door.hinge.x}
                  y1={door.hinge.y}
                  x2={door.hinge.x}
                  y2={door.hinge.y + door.width}
                  stroke="#475569"
                  strokeWidth="2.5"
                />
                {hasSwing && (
                  <path
                    d={`M ${door.hinge.x + door.width} ${door.hinge.y} A ${door.width} ${door.width} 0 0 1 ${door.hinge.x} ${door.hinge.y + door.width}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                )}
                {showDimensions && (
                  <text
                    x={door.position.x + 6}
                    y={door.position.y - 4}
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {door.width} cm
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* 10. Furniture Objects */}
        <g id="furniture-layer">
          {furniture.map((item) => {
            const isSelected = selectedFurnitureId === item.id;
            const isUnconfirmed = !item.isConfirmed;
            const isChanged = item.id === "chair-c04" || item.id === "chair-c05" || item.id === "mat-entrance";
            const opacity = showChangedOnly && !isChanged ? 0.25 : 1;

            return (
              <g
                key={item.id}
                tabIndex={readOnly ? undefined : 0}
                role="button"
                aria-label={`${item.name} (${item.code || item.id}), ${item.width} by ${item.depth} centimeters${isSelected ? ", selected" : ""}`}
                aria-pressed={isSelected}
                onFocus={() => selectFurniture(item.id)}
                transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation || 0}, ${item.width / 2}, ${item.depth / 2})`}
                className={`transition-all duration-100 outline-none focus:outline-none ${
                  item.isFixed ? "cursor-not-allowed" : "cursor-move"
                }`}
                opacity={opacity}
                onMouseDown={(e) => startDragFurniture(e, item)}
              >
                <rect
                  width={item.width}
                  height={item.depth}
                  rx={item.category === "chair" || item.category === "bench" ? 4 : 2}
                  fill={
                    item.category === "desk"
                      ? "#d6c7b2"
                      : item.category === "chair"
                      ? !isBefore && item.id === "chair-c04"
                        ? "#bbf7d0" // Moved chair C-04 is green in improved plan!
                        : isBefore && item.id === "chair-c04"
                        ? "#fecaca" // Pinch chair C-04 is red in before plan!
                        : "#c1cfc9"
                      : item.category === "plant"
                      ? "#a3cfbb"
                      : item.category === "mat"
                      ? "#e2b89b"
                      : item.category === "table"
                      ? "#e4d5c3"
                      : "#b8c5c0"
                  }
                  stroke={
                    isSelected
                      ? "#1e7168"
                      : isUnconfirmed
                      ? "#d97706"
                      : !isBefore && item.id === "chair-c04"
                      ? "#16a34a"
                      : isBefore && item.id === "chair-c04"
                      ? "#dc2626"
                      : "#82958f"
                  }
                  strokeWidth={isSelected ? 2.5 : isUnconfirmed ? 2 : 1}
                  strokeDasharray={isUnconfirmed && !isSelected ? "4,3" : undefined}
                />

                <text
                  x={item.width / 2}
                  y={item.depth / 2 + 3}
                  textAnchor="middle"
                  fill="#2c3a37"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="var(--font-inter), Inter, sans-serif"
                  className="pointer-events-none select-none"
                >
                  {item.code || item.name.slice(0, 5)}
                </text>

                {item.isFixed && (
                  <circle cx={item.width - 5} cy="5" r="2.5" fill="#64748b" opacity="0.7" />
                )}

                {isUnconfirmed && (
                  <g transform={`translate(${item.width - 7}, -5)`}>
                    <circle r="4.5" fill="#d97706" />
                    <text
                      textAnchor="middle"
                      dy="3"
                      fill="#ffffff"
                      fontSize="7"
                      fontWeight="bold"
                    >
                      ?
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 11. Numbered Spatial Finding Markers (Stage 4 Analysis and Stage 5 Improve/Before) */}
        {(stage === "analysis" || stage === "improve" || stage === "before") && layerToggles.hazards && (
          <g id="hazard-markers-layer">
            {spatialFindingsWithLocation.map((f, idx) => {
              const isSelected = selectedFindingId === f.id || selectedHazardId === f.id;
              const num = idx + 1;
              const isHigh = f.severity === "critical" || f.severity === "high";
              const markerColor =
                f.classification === "actionable-deficit"
                  ? "#dc2626"
                  : f.classification === "advisory-observation"
                  ? "#2563eb"
                  : "#d97706";

              return (
                <g
                  key={f.id}
                  transform={`translate(${f.location!.x}, ${f.location!.y})`}
                  className="cursor-pointer transition-transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectFinding(f.id);
                  }}
                >
                  {isHigh && (
                    <circle r="14" fill="#dc2626" opacity="0.2" className="animate-ping" />
                  )}
                  <circle
                    r={isSelected ? 11 : 8.5}
                    fill={markerColor}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? "2.5" : "1.5"}
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="var(--font-inter), Inter, sans-serif"
                  >
                    {num}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* 12. Dynamic Clearance Bottleneck Annotations (computed strictly from route bottlenecks) */}
        {showDimensions && layerToggles.dimensions && routeResult?.status === "success" && routeResult.bottlenecks && (
          <g id="dimensions-layer" className="pointer-events-none">
            {routeResult.bottlenecks.map((b, idx) => {
              const reqRadius = (activeProfile?.minClearanceCm || 90) / 2;
              const isDeficit = b.clearanceCm < reqRadius;
              const clrColor = isDeficit ? "#dc2626" : "#16a34a";
              return (
                <g key={`btnk-dim-${idx}`} transform={`translate(${b.position.x}, ${b.position.y})`}>
                  <rect
                    x="-28"
                    y="-18"
                    width="56"
                    height="16"
                    rx="3"
                    fill="#ffffff"
                    stroke={clrColor}
                    strokeWidth="1"
                    opacity="0.9"
                  />
                  <text
                    x="0"
                    y="-6"
                    textAnchor="middle"
                    fill={clrColor}
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {Math.round(b.clearanceCm)} cm
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
