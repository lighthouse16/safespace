"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import Konva from "konva";
import { clampFurniture, clinicPlan, editorPalette as c, type EditorFurniture, type EditorViewProps } from "./editor-model";

function Furniture({ item, selected, scale, onSelect, onMove }: { item: EditorFurniture; selected: boolean; scale: number; onSelect: () => void; onMove: (x: number, y: number) => void }) {
  const ref = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => { if (selected && ref.current && transformer.current) { transformer.current.nodes([ref.current]); transformer.current.getLayer()?.batchDraw(); } }, [selected]);
  const fill = item.kind === "plant" ? "#7ba284" : item.kind === "desk" || item.kind === "cabinet" ? "#87979b" : "#9fb8b8";
  return <>
    <Group ref={ref} x={item.x * scale} y={item.y * scale} rotation={item.rotation ?? 0} draggable={item.movable !== false} onClick={(e) => { e.cancelBubble = true; onSelect(); }} onTap={(e) => { e.cancelBubble = true; onSelect(); }} onDragEnd={(e) => onMove(e.target.x() / scale, e.target.y() / scale)}>
      {item.kind === "plant" ? <><Circle x={item.width * scale / 2} y={item.depth * scale / 2} radius={item.width * scale / 2} fill={fill} stroke="#496f56" /><Line points={[item.width*.2*scale,item.depth*.5*scale,item.width*.8*scale,item.depth*.5*scale]} stroke="#d7e7d8" /></> : <Rect width={item.width * scale} height={item.depth * scale} cornerRadius={item.kind === "chair" ? 7 : 3} fill={fill} stroke={selected ? c.teal : "#64767a"} strokeWidth={(selected ? 3 : 1) / Math.max(scale, .5)} shadowColor="#2b3838" shadowOpacity={.09} shadowBlur={4} />}
      {item.kind === "chair" && <Line points={[8*scale,item.depth*.72*scale,(item.width-8)*scale,item.depth*.72*scale]} stroke="#657b7d" />}
    </Group>
    {selected && <Transformer ref={transformer} rotateEnabled enabledAnchors={[]} borderStroke={c.teal} anchorFill="#fff" anchorStroke={c.teal} />}
  </>;
}

export function Floorplan2D({ plan = clinicPlan, selectedId, onSelect, onFurnitureMove, showHeatmap = true, showRoute = true, className }: EditorViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  useEffect(() => { if (!host.current) return; const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height })); observer.observe(host.current); return () => observer.disconnect(); }, []);
  const scale = Math.min(size.width / plan.width, size.height / plan.depth) * .92;
  const offset = { x: (size.width - plan.width * scale) / 2, y: (size.height - plan.depth * scale) / 2 };
  const grid = useMemo(() => { const lines = []; for (let x=0;x<=plan.width;x+=25) lines.push(<Line key={`x${x}`} points={[x*scale,0,x*scale,plan.depth*scale]} stroke="#dfe5e3" strokeWidth={.6}/>); for(let y=0;y<=plan.depth;y+=25) lines.push(<Line key={`y${y}`} points={[0,y*scale,plan.width*scale,y*scale]} stroke="#dfe5e3" strokeWidth={.6}/>); return lines; }, [plan, scale]);
  return <div ref={host} className={className} style={{ width: "100%", height: "100%", minHeight: 430, background: "#e8ece9", overflow: "hidden" }}>
    <Stage width={size.width} height={size.height} onClick={() => onSelect?.(null)} onTap={() => onSelect?.(null)}>
      <Layer x={offset.x} y={offset.y}>
        <Rect width={plan.width*scale} height={plan.depth*scale} fill="#f7f9f6" shadowColor="#172426" shadowOpacity={.12} shadowBlur={18} shadowOffsetY={5}/>{grid}
        {plan.rooms.map(room => <Group key={room.id}><Rect x={room.x*scale} y={room.y*scale} width={room.width*scale} height={room.depth*scale} fill={c.room} stroke={c.ink} strokeWidth={5*scale}/><Text x={(room.x+16)*scale} y={(room.y+14)*scale} text={room.label} fontSize={11} fontStyle="bold" fill={c.muted} letterSpacing={1.2}/></Group>)}
        {showHeatmap && <Group opacity={.42} listening={false}><Circle x={465*scale} y={365*scale} radius={82*scale} fill={c.red}/><Circle x={555*scale} y={298*scale} radius={62*scale} fill={c.amber}/><Circle x={300*scale} y={445*scale} radius={70*scale} fill="#e7b64a"/></Group>}
        {showRoute && <><Line points={plan.route.flatMap(p=>[p.x*scale,p.y*scale])} stroke="#fff" strokeWidth={15*scale} lineCap="round" lineJoin="round" opacity={.9}/><Line points={plan.route.flatMap(p=>[p.x*scale,p.y*scale])} stroke={c.route} strokeWidth={7*scale} dash={[12*scale,8*scale]} lineCap="round" lineJoin="round"/><Circle x={80*scale} y={490*scale} radius={8*scale} fill={c.route}/><Text x={92*scale} y={477*scale} text="ENTRY" fontSize={10} fontStyle="bold" fill={c.route}/></>}
        {plan.furniture.map(item => <Furniture key={item.id} item={item} scale={scale} selected={selectedId===item.id} onSelect={()=>onSelect?.(item.id)} onMove={(x,y)=>onFurnitureMove?.(item.id,clampFurniture(item,{x,y},plan))}/>)}
        <Line points={[60*scale,590*scale,180*scale,590*scale]} stroke={c.ink} strokeWidth={3}/><Text x={60*scale} y={596*scale} text="2 m" fontSize={10} fill={c.ink}/>
      </Layer>
    </Stage>
  </div>;
}
export default Floorplan2D;
