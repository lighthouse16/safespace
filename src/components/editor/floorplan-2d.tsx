"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Group, Rect, Line, Circle, Text, Arrow } from "react-konva";
import Konva from "konva";
import {
  type Point,
  EditorViewProps,
  editorPalette,
  clampFurniture
} from "./editor-model";

const SNAP_SIZE = 25;
const MAX_ZOOM = 3;
const MIN_ZOOM = 0.3;

const getSnapPos = (p: number) => Math.round(p / SNAP_SIZE) * SNAP_SIZE;

const Grid = ({ width, height }: { width: number; height: number }) => {
  const lines = [];
  for (let i = 0; i <= width; i += SNAP_SIZE) {
    const isMajor = i % 100 === 0;
    lines.push(
      <Line
        key={`v${i}`}
        points={[i, 0, i, height]}
        stroke={editorPalette.line}
        strokeWidth={isMajor ? 1.5 : 0.5}
        dash={isMajor ? [] : [2, 4]}
      />
    );
  }
  for (let j = 0; j <= height; j += SNAP_SIZE) {
    const isMajor = j % 100 === 0;
    lines.push(
      <Line
        key={`h${j}`}
        points={[0, j, width, j]}
        stroke={editorPalette.line}
        strokeWidth={isMajor ? 1.5 : 0.5}
        dash={isMajor ? [] : [2, 4]}
      />
    );
  }
  return <Group>{lines}</Group>;
};

const FurnitureShape = ({ kind, w, d, c }: { kind: string; w: number; d: number; c: string }) => {
  if (kind === "chair") {
    return (
      <Group>
        <Rect width={w} height={d} fill={c} cornerRadius={4} />
        <Rect width={w} height={d * 0.3} fill={editorPalette.ink} opacity={0.2} cornerRadius={4} />
      </Group>
    );
  }
  if (kind === "desk") {
    return (
      <Group>
        <Rect width={w} height={d} fill={c} />
        <Line points={[4, 4, w - 4, 4, w - 4, d - 4, 4, d - 4, 4, 4]} stroke={editorPalette.ink} strokeWidth={1} opacity={0.2} />
        <Line points={[w * 0.2, d * 0.8, w * 0.8, d * 0.8]} stroke={editorPalette.ink} strokeWidth={1} opacity={0.3} />
      </Group>
    );
  }
  if (kind === "cabinet") {
    return (
      <Group>
        <Rect width={w} height={d} fill={c} />
        <Line points={[0, 0, w, d]} stroke={editorPalette.floor} strokeWidth={1} opacity={0.5} />
        <Line points={[0, d, w, 0]} stroke={editorPalette.floor} strokeWidth={1} opacity={0.5} />
      </Group>
    );
  }
  if (kind === "plant") {
    const r = Math.min(w, d) / 2;
    return (
      <Group x={w / 2} y={d / 2}>
        <Circle radius={r} fill="#7cb342" />
        <Line points={[-r, 0, r, 0]} stroke="#558b2f" strokeWidth={2} />
        <Line points={[0, -r, 0, r]} stroke="#558b2f" strokeWidth={2} />
        <Line points={[-r * 0.7, -r * 0.7, r * 0.7, r * 0.7]} stroke="#558b2f" strokeWidth={1} />
        <Line points={[-r * 0.7, r * 0.7, r * 0.7, -r * 0.7]} stroke="#558b2f" strokeWidth={1} />
      </Group>
    );
  }
  if (kind === "bench") {
    return (
      <Group>
        <Rect width={w} height={d} fill={c} cornerRadius={2} />
        <Rect width={w * 0.1} height={d} fill={editorPalette.ink} opacity={0.2} cornerRadius={2} />
        <Rect x={w * 0.9} width={w * 0.1} height={d} fill={editorPalette.ink} opacity={0.2} cornerRadius={2} />
      </Group>
    );
  }
  if (kind === "shelf") {
    return (
      <Group>
        <Rect width={w} height={d} fill="#8a7e6e" />
        {[0.25, 0.5, 0.75].map(f => (
          <Line key={f} points={[2, d * f, w - 2, d * f]} stroke={editorPalette.ink} strokeWidth={1} opacity={0.25} />
        ))}
      </Group>
    );
  }
  if (kind === "tv") {
    return (
      <Group>
        <Rect width={w} height={d} fill="#2c3e50" cornerRadius={2} />
        <Rect x={3} y={2} width={w - 6} height={d - 4} fill="#445566" cornerRadius={1} />
      </Group>
    );
  }
  return <Rect width={w} height={d} fill={c} />;
};

export function Floorplan2D({
  plan,
  selectedId,
  onSelect,
  onFurnitureMove,
  showHeatmap,
  showRoute,
  className = ""
}: EditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [dragSpaceStart, setDragSpaceStart] = useState<Point | null>(null);
  const [stagePosStart, setStagePosStart] = useState<Point | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setSize({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (e.type === "keydown") setIsSpaceDown(true);
        if (e.type === "keyup") setIsSpaceDown(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    
    let newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
    
    setScale(newScale);
    setPos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
  }, []);

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSpaceDown || e.evt.button === 1) {
      setDragSpaceStart({ x: e.evt.clientX, y: e.evt.clientY });
      setStagePosStart(pos);
      return;
    }
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      onSelect?.(null);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (dragSpaceStart && stagePosStart) {
      setPos({
        x: stagePosStart.x + (e.evt.clientX - dragSpaceStart.x),
        y: stagePosStart.y + (e.evt.clientY - dragSpaceStart.y)
      });
    }
  };

  const handleStageMouseUp = () => {
    setDragSpaceStart(null);
    setStagePosStart(null);
  };

  if (!plan) return <div className={className}>No plan</div>;

  const isPanning = !!dragSpaceStart;
  const stageCursor = isSpaceDown ? (isPanning ? "grabbing" : "grab") : "default";

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-[#e0e5e7] ${className}`} style={{ cursor: stageCursor }}>
      <Stage
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        ref={stageRef}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
        draggable={false}
      >
        <Layer>
          <Grid width={plan.width} height={plan.depth} />
          
          {plan.rooms.map(r => (
            <Group key={r.id} x={r.x} y={r.y}>
              <Rect width={r.width} height={r.depth} fill={editorPalette.room} stroke={editorPalette.ink} strokeWidth={4} />
              <Text x={8} y={8} text={r.label.toUpperCase()} fontSize={14} fill={editorPalette.muted} fontFamily="sans-serif" fontStyle="bold" />
            </Group>
          ))}
          
          {plan.furniture.map(f => {
            const isSelected = selectedId === f.id;
            const isMovable = f.movable !== false;
            const fc = f.kind === "cabinet" ? "#5a666e" : f.kind === "chair" ? "#8c9ba3" : "#abb7bd";
            
            return (
              <Group
                key={f.id}
                x={f.x}
                y={f.y}
                rotation={f.rotation || 0}
                draggable={isMovable && !isSpaceDown}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelect?.(f.id);
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  onSelect?.(f.id);
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  if (!plan || !onFurnitureMove) return;
                  const newP = clampFurniture(f, { x: getSnapPos(e.target.x()), y: getSnapPos(e.target.y()) }, plan);
                  e.target.position(newP);
                  onFurnitureMove(f.id, newP);
                }}
                onMouseEnter={(e) => {
                  if (isMovable && !isSpaceDown) {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = "grab";
                  }
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = stageCursor;
                }}
              >
                <FurnitureShape kind={f.kind} w={f.width} d={f.depth} c={fc} />
                
                {scale > 1.2 && (
                  <Text y={f.depth + 4} text={f.label} fontSize={10 / scale} fill={editorPalette.ink} align="center" width={f.width} />
                )}
                
                {isSelected && (
                  <Rect
                    x={-3} y={-3}
                    width={f.width + 6} height={f.depth + 6}
                    stroke={editorPalette.teal} strokeWidth={3}
                    shadowColor={editorPalette.teal} shadowBlur={10} shadowOpacity={0.5}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {showRoute && plan.route && plan.route.length > 0 && (
            <Group listening={false}>
              <Line
                points={plan.route.flatMap(p => [p.x, p.y])}
                stroke="white"
                strokeWidth={8}
                lineJoin="round"
                lineCap="round"
              />
              <Line
                points={plan.route.flatMap(p => [p.x, p.y])}
                stroke={editorPalette.route}
                strokeWidth={4}
                dash={[10, 10]}
                lineJoin="round"
                lineCap="round"
              />
              <Circle x={plan.route[0].x} y={plan.route[0].y} radius={8} fill={editorPalette.route} />
              <Text x={plan.route[0].x + 12} y={plan.route[0].y - 8} text="ENTRY" fill={editorPalette.ink} fontSize={12} fontStyle="bold" />
              {plan.route.length > 1 && (
                <Arrow
                  points={[
                    plan.route[plan.route.length - 2].x, plan.route[plan.route.length - 2].y,
                    plan.route[plan.route.length - 1].x, plan.route[plan.route.length - 1].y
                  ]}
                  pointerLength={10}
                  pointerWidth={10}
                  fill={editorPalette.route}
                  stroke={editorPalette.route}
                  strokeWidth={4}
                />
              )}
            </Group>
          )}

          {showHeatmap && (
            <Group listening={false}>
              <Circle x={420} y={340} radius={120} fillRadialGradientStartPoint={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={120} fillRadialGradientColorStops={[0, "rgba(201,87,77,0.6)", 1, "rgba(201,87,77,0)"]} />
              <Circle x={260} y={190} radius={140} fillRadialGradientStartPoint={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={140} fillRadialGradientColorStops={[0, "rgba(217,145,50,0.5)", 1, "rgba(217,145,50,0)"]} />
              <Circle x={440} y={450} radius={80} fillRadialGradientStartPoint={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={80} fillRadialGradientColorStops={[0, "rgba(217,145,50,0.35)", 1, "rgba(217,145,50,0)"]} />
            </Group>
          )}
        </Layer>
      </Stage>
      <div className="absolute bottom-4 left-4 bg-white/90 px-2 py-1 rounded text-xs font-mono border border-gray-200 pointer-events-none">
        Scale: {Math.round(scale * 100)}%
      </div>
    </div>
  );
}

export default Floorplan2D;
