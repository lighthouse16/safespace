"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { EditorControls } from "./editor-controls";
import { Floorplan2D } from "./floorplan-2d";
import { Floorplan3D } from "./floorplan-3d";
import { Spatial3DErrorBoundary } from "@/components/spatial/Spatial3DErrorBoundary";
import { currentPlan, proposedPlan, type EditorPlan, type Point, type EditorFurniture } from "./editor-model";
export type { EditorFurniture };

export type EditorShellProps = {
  initialPlan?: EditorPlan;
  initialView?: "2d" | "3d";
  className?: string;
  onSelectedChange?: (furniture: EditorFurniture | null) => void;
  /** Enable Before/After toggle (for options page) */
  showBeforeAfter?: boolean;
  /** External mode control */
  mode?: "current" | "proposed";
  onModeChange?: (mode: "current" | "proposed") => void;
  facilityName?: string;
  spaceName?: string;
};

export function EditorShell({
  initialPlan = currentPlan,
  initialView = "2d",
  className,
  onSelectedChange,
  showBeforeAfter = false,
  mode: externalMode,
  onModeChange,
  facilityName = "Queen Care Clinic",
  spaceName = "Waiting Area & Consultation Corridor",
}: EditorShellProps) {
  const [internalMode, setInternalMode] = useState<"current" | "proposed">("current");
  const mode = externalMode ?? internalMode;
  const setMode = useCallback((m: "current" | "proposed") => {
    setInternalMode(m);
    onModeChange?.(m);
  }, [onModeChange]);

  // Track user drag edits per mode
  const [edits, setEdits] = useState<Record<string, Record<string, Point>>>({ current: {}, proposed: {} });

  const basePlan = mode === "proposed" ? proposedPlan : initialPlan;
  const modeEdits = useMemo(() => edits[mode] ?? {}, [edits, mode]);
  const hasEdits = Object.keys(modeEdits).length > 0;
  const plan = useMemo(() => {
    if (!hasEdits) return basePlan;
    return {
      ...basePlan,
      furniture: basePlan.furniture.map(f => {
        const e = modeEdits[f.id];
        return e ? { ...f, x: e.x, y: e.y } : f;
      }),
    };
  }, [basePlan, modeEdits, hasEdits]);

  const [view, setView] = useState(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRoute, setShowRoute] = useState(true);

  const move = useCallback((id: string, position: Point) => {
    setEdits(prev => ({
      ...prev,
      [mode]: { ...prev[mode], [id]: position },
    }));
  }, [mode]);

  const selected = plan.furniture.find(item => item.id === selectedId) ?? null;
  const prevSelectedRef = useRef(selected);

  useEffect(() => {
    if (prevSelectedRef.current !== selected) {
      prevSelectedRef.current = selected;
      onSelectedChange?.(selected);
    }
  }, [selected, onSelectedChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const shared = { plan, selectedId, onSelect: setSelectedId, onFurnitureMove: move, showHeatmap, showRoute };

  return (
    <section
      className={className}
      aria-label="Floorplan editor"
      style={{
        display: "grid", gridTemplateRows: "auto minmax(430px,1fr) auto",
        height: "100%", minHeight: 540, border: "1px solid #cfd7d5",
        borderRadius: 12, overflow: "hidden", background: "#f7f9f7",
        boxShadow: "0 12px 32px rgba(31,49,51,.10)",
      }}
    >
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "10px 14px", borderBottom: "1px solid #d9dfdd",
        background: "#fdfefd", flexWrap: "wrap",
      }}>
        <div>
          <div style={{ font: "700 13px system-ui", color: "#26373b" }}>
            {facilityName}{" "}
            {spaceName && <span style={{ fontWeight: 500, color: "#7a888c" }}>/ {spaceName}</span>}
          </div>
          <div style={{ font: "500 11px system-ui", color: "#829094", marginTop: 2 }}>
            Scale 1:50 · {mode === "proposed" ? "Proposed layout" : "Current layout"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Before / After toggle */}
          {showBeforeAfter && (
            <div style={{
              display: "flex", padding: 3, gap: 2, border: "1px solid #d9dede",
              borderRadius: 9, background: "#fff",
            }}>
              {(["current", "proposed"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  style={{
                    border: `1px solid ${mode === m ? (m === "proposed" ? "#237d78" : "#94a3b0") : "#cbd3d3"}`,
                    background: mode === m ? (m === "proposed" ? "#e2f0ed" : "#f1f5f9") : "#fff",
                    color: mode === m ? (m === "proposed" ? "#176c68" : "#334155") : "#4c5d62",
                    borderRadius: 7, padding: "7px 14px",
                    font: "600 12px/1 system-ui", cursor: "pointer",
                  }}
                >
                  {m === "current" ? "⬤ Before" : "◉ After"}
                </button>
              ))}
            </div>
          )}
          <EditorControls
            view={view} onViewChange={setView}
            showHeatmap={showHeatmap} showRoute={showRoute}
            onHeatmapChange={setShowHeatmap} onRouteChange={setShowRoute}
          />
        </div>
      </header>

      {view === "2d" ? (
        <Floorplan2D {...shared} />
      ) : (
        <Spatial3DErrorBoundary onFallbackTo2D={() => setView("2d")}>
          <Floorplan3D {...shared} />
        </Spatial3DErrorBoundary>
      )}

      <footer
        aria-live="polite"
        style={{
          display: "flex", justifyContent: "space-between", gap: 12,
          padding: "9px 14px", borderTop: "1px solid #d9dfdd",
          background: "#fff", font: "500 11px system-ui", color: "#64757a",
        }}
      >
        <span>{selected ? `Selected: ${selected.label}` : "Click furniture to inspect"}</span>
        <span style={{ display: "flex", gap: 16 }}>
          <span>{view === "2d" ? "Scroll zoom · Space+drag pan" : "Orbit · scroll zoom"}</span>
          {showBeforeAfter && (
            <span style={{ color: mode === "proposed" ? "#176c68" : "#94a3b0", fontWeight: 600 }}>
              {mode === "proposed" ? "Risk 27 · Safe" : "Risk 68 · High risk"}
            </span>
          )}
        </span>
      </footer>
    </section>
  );
}
export default EditorShell;
