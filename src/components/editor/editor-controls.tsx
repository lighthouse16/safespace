"use client";
export type EditorControlsProps = { view: "2d" | "3d"; onViewChange: (view: "2d" | "3d") => void; showHeatmap: boolean; showRoute: boolean; onHeatmapChange: (value: boolean) => void; onRouteChange: (value: boolean) => void };
const button = (active: boolean) => ({ border: "1px solid " + (active ? "#237d78" : "#cbd3d3"), background: active ? "#e2f0ed" : "#ffffff", color: active ? "#176c68" : "#4c5d62", borderRadius: 7, padding: "7px 11px", font: "600 12px/1 system-ui, sans-serif", cursor: "pointer" } as const);
export function EditorControls(props: EditorControlsProps) {
  return <div aria-label="Editor view controls" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
    <div style={{ display: "flex", padding: 3, gap: 2, border: "1px solid #d9dede", borderRadius: 9, background: "#fff" }}>
      {(["2d", "3d"] as const).map((view) => <button key={view} type="button" aria-pressed={props.view === view} onClick={() => props.onViewChange(view)} style={button(props.view === view)}>{view.toUpperCase()} plan</button>)}
    </div>
    <button type="button" aria-pressed={props.showHeatmap} onClick={() => props.onHeatmapChange(!props.showHeatmap)} style={button(props.showHeatmap)}>Risk heatmap</button>
    <button type="button" aria-pressed={props.showRoute} onClick={() => props.onRouteChange(!props.showRoute)} style={button(props.showRoute)}>Critical route</button>
  </div>;
}
