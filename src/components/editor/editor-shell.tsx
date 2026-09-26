"use client";
import { useState, useEffect } from "react";
import { EditorControls } from "./editor-controls";
import { Floorplan2D } from "./floorplan-2d";
import { Floorplan3D } from "./floorplan-3d";
import { clinicPlan, type EditorPlan, type Point, type EditorFurniture } from "./editor-model";
export type { EditorFurniture };

export type EditorShellProps = {
  initialPlan?: EditorPlan;
  initialView?: "2d" | "3d";
  className?: string;
  onSelectedChange?: (furniture: EditorFurniture | null) => void;
};

export function EditorShell({
  initialPlan = clinicPlan,
  initialView = "2d",
  className,
  onSelectedChange
}: EditorShellProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [view, setView] = useState(initialView);
  const [selectedId, setSelectedId] = useState<string | null>("route-chair");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [coords, setCoords] = useState<Point>({ x: 0, y: 0 });

  const move = (id: string, position: Point) => {
    setPlan(current => ({
      ...current,
      furniture: current.furniture.map(item => item.id === id ? { ...item, ...position } : item)
    }));
  };

  const selected = plan.furniture.find(item => item.id === selectedId) ?? null;

  useEffect(() => {
    onSelectedChange?.(selected);
  }, [selected, onSelectedChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) alert("Toasted: item removed (demo)");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  const shared = { plan, selectedId, onSelect: setSelectedId, onFurnitureMove: move, showHeatmap, showRoute };

  return (
    <section 
      className={className} 
      aria-label="Clinic floorplan editor" 
      style={{ display: "grid", gridTemplateRows: "auto minmax(430px,1fr) auto", height: "100%", minHeight: 540, border: "1px solid #cfd7d5", borderRadius: 12, overflow: "hidden", background: "#f7f9f7", boxShadow: "0 12px 32px rgba(31,49,51,.10)" }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setCoords({ x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) });
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "11px 14px", borderBottom: "1px solid #d9dfdd", background: "#fdfefd", flexWrap: "wrap" }}>
        <div>
          <div style={{ font: "700 13px system-ui", color: "#26373b" }}>Queen Care Clinic <span style={{ fontWeight: 500, color: "#7a888c" }}>/ Waiting area</span></div>
          <div style={{ font: "500 11px system-ui", color: "#829094", marginTop: 3 }}>Scale 1:50 · Synced spatial model</div>
        </div>
        <EditorControls view={view} onViewChange={setView} showHeatmap={showHeatmap} showRoute={showRoute} onHeatmapChange={setShowHeatmap} onRouteChange={setShowRoute} />
      </header>
      
      {view === "2d" ? <Floorplan2D {...shared} /> : <Floorplan3D {...shared} />}
      
      <footer aria-live="polite" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 14px", borderTop: "1px solid #d9dfdd", background: "#fff", font: "500 11px system-ui", color: "#64757a" }}>
        <span>{selected ? `Selected: ${selected.label}` : "Select furniture to inspect"}</span>
        <span style={{ display: "flex", gap: 16 }}>
          <span>{view === "2d" ? "Zoom: 100%" : "Camera: orbit"}</span>
          <span>X: {coords.x} Y: {coords.y}</span>
        </span>
      </footer>
    </section>
  );
}
export default EditorShell;
