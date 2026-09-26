"use client";
import { useState } from "react";
import { EditorControls } from "./editor-controls";
import { Floorplan2D } from "./floorplan-2d";
import { Floorplan3D } from "./floorplan-3d";
import { clinicPlan, type EditorPlan, type Point } from "./editor-model";

export type EditorShellProps = { initialPlan?: EditorPlan; initialView?: "2d" | "3d"; className?: string };
export function EditorShell({ initialPlan=clinicPlan, initialView="2d", className }:EditorShellProps){
  const [plan,setPlan]=useState(initialPlan),[view,setView]=useState(initialView),[selectedId,setSelectedId]=useState<string|null>("route-chair"),[showHeatmap,setShowHeatmap]=useState(true),[showRoute,setShowRoute]=useState(true);
  const move=(id:string,position:Point)=>setPlan(current=>({...current,furniture:current.furniture.map(item=>item.id===id?{...item,...position}:item)}));
  const selected=plan.furniture.find(item=>item.id===selectedId);
  const shared={plan,selectedId,onSelect:setSelectedId,onFurnitureMove:move,showHeatmap,showRoute};
  return <section className={className} aria-label="Clinic floorplan editor" style={{display:"grid",gridTemplateRows:"auto minmax(430px,1fr) auto",height:"100%",minHeight:540,border:"1px solid #cfd7d5",borderRadius:12,overflow:"hidden",background:"#f7f9f7",boxShadow:"0 12px 32px rgba(31,49,51,.10)"}}>
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"11px 14px",borderBottom:"1px solid #d9dfdd",background:"#fdfefd",flexWrap:"wrap"}}>
      <div><div style={{font:"700 13px system-ui",color:"#26373b"}}>Queen Care Clinic <span style={{fontWeight:500,color:"#7a888c"}}>/ Waiting area</span></div><div style={{font:"500 11px system-ui",color:"#829094",marginTop:3}}>Scale 1:50 · Synced spatial model</div></div>
      <EditorControls view={view} onViewChange={setView} showHeatmap={showHeatmap} showRoute={showRoute} onHeatmapChange={setShowHeatmap} onRouteChange={setShowRoute}/>
    </header>
    {view==="2d"?<Floorplan2D {...shared}/>:<Floorplan3D {...shared}/>} 
    <footer aria-live="polite" style={{display:"flex",justifyContent:"space-between",gap:12,padding:"9px 14px",borderTop:"1px solid #d9dfdd",background:"#fff",font:"500 11px system-ui",color:"#64757a"}}><span>{selected?`Selected: ${selected.label}`:"Select furniture to inspect"}</span><span>{view==="2d"?"Drag furniture · precise plan view":"Orbit · pan · select and drag furniture"}</span></footer>
  </section>;
}
export default EditorShell;
