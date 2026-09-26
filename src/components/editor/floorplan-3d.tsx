"use client";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Html, Line, MapControls, RoundedBox, Text } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clinicPlan, editorPalette as c, type EditorFurniture, type EditorViewProps, type Point } from "./editor-model";
const U = 0.01;

function PlanCamera({ preset }: { preset: "iso" | "top" | "front" }) {
  const { camera, invalidate } = useThree();
  useEffect(() => { const positions: Record<"iso" | "top" | "front", readonly [number, number, number]> = { iso: [6.8,7.5,7.6], top: [4.8,11,3.1], front: [4.8,4.2,8.5] }; const position = positions[preset]; camera.position.set(position[0], position[1], position[2]); camera.lookAt(4.8,0,3.1); camera.updateProjectionMatrix(); invalidate(); }, [camera, invalidate, preset]);
  return null;
}

function FurnitureMesh({ item, selected, onSelect, onMove }: { item: EditorFurniture; selected: boolean; onSelect: () => void; onMove: (point: Point) => void }) {
  const [dragging, setDragging] = useState(false); const offset = useRef(new THREE.Vector3());
  const x=(item.x+item.width/2)*U, z=(item.y+item.depth/2)*U, w=item.width*U, d=item.depth*U;
  const move=(e:ThreeEvent<PointerEvent>)=>{ if(!dragging)return; e.stopPropagation(); const nx=e.point.x-offset.current.x-w/2, ny=e.point.z-offset.current.z-d/2; onMove({x:Math.max(0,nx/U),y:Math.max(0,ny/U)}); };
  const down=(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();onSelect();if(item.movable!==false){offset.current.set(e.point.x-x,0,e.point.z-z);setDragging(true);(e.target as HTMLElement).setPointerCapture?.(e.pointerId);}};
  const color=item.kind==="plant"?"#648c6f":item.kind==="desk"||item.kind==="cabinet"?"#71878a":"#91aaaa";
  const height=item.kind==="cabinet"?1.25:item.kind==="desk"?.72:item.kind==="plant"?.65:.48;
  return <group position={[x,0,z]} rotation={[0,-(item.rotation??0)*Math.PI/180,0]} onPointerDown={down} onPointerMove={move} onPointerUp={()=>setDragging(false)} onPointerMissed={()=>setDragging(false)}>
    <RoundedBox args={[w,height,d]} position={[0,height/2,0]} radius={.04} smoothness={2} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.75} emissive={selected?c.teal:"#000"} emissiveIntensity={selected?.22:0}/></RoundedBox>
    {selected&&<mesh position={[0,.025,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[Math.max(w,d)*.7,Math.max(w,d)*.85,32]}/><meshBasicMaterial color={c.teal}/></mesh>}
  </group>;
}

function ClinicScene({ plan, selectedId, onSelect, onFurnitureMove, showHeatmap, showRoute, preset }: Required<Pick<EditorViewProps,"plan">> & EditorViewProps & { preset:"iso"|"top"|"front" }) {
  return <>
    <PlanCamera preset={preset}/><ambientLight intensity={1.4}/><directionalLight position={[3,8,5]} intensity={1.6} castShadow shadow-mapSize={[1024,1024]}/>
    <mesh position={[plan.width*U/2,-.04,plan.depth*U/2]} receiveShadow onPointerDown={()=>onSelect?.(null)}><boxGeometry args={[plan.width*U,.08,plan.depth*U]}/><meshStandardMaterial color={c.floor}/></mesh>
    {plan.rooms.map(room=><group key={room.id}><mesh position={[(room.x+room.width/2)*U,.02,(room.y+room.depth/2)*U]} receiveShadow><boxGeometry args={[room.width*U,.04,room.depth*U]}/><meshStandardMaterial color={c.room}/></mesh><Text position={[(room.x+18)*U,.07,(room.y+22)*U]} rotation={[-Math.PI/2,0,0]} fontSize={.105} color={c.muted} anchorX="left">{room.label}</Text>{[[room.x,room.y,room.width,.12],[room.x,room.y+room.depth,room.width,.12],[room.x,room.y,.12,room.depth],[room.x+room.width,room.y,.12,room.depth]].map(([x,z,w,d],i)=><mesh key={i} position={[(x+w/2)*U,.55,(z+d/2)*U]} castShadow><boxGeometry args={[Math.max(w*U,.035),1.1,Math.max(d*U,.035)]}/><meshStandardMaterial color="#d9dfdc" transparent opacity={.82}/></mesh>)}</group>)}
    {showHeatmap&&<><mesh position={[4.65,.035,3.65]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.85,48]}/><meshBasicMaterial color={c.red} transparent opacity={.32} depthWrite={false}/></mesh><mesh position={[5.5,.04,3]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.62,48]}/><meshBasicMaterial color={c.amber} transparent opacity={.3} depthWrite={false}/></mesh></>}
    {showRoute&&<Line points={plan.route.map(p=>[p.x*U,.09,p.y*U])} color={c.route} lineWidth={4}/>} 
    {plan.furniture.map(item=><FurnitureMesh key={item.id} item={item} selected={selectedId===item.id} onSelect={()=>onSelect?.(item.id)} onMove={p=>onFurnitureMove?.(item.id,p)}/>)}
    <MapControls makeDefault enableDamping dampingFactor={.08} minDistance={4} maxDistance={18} maxPolarAngle={Math.PI/2.05} target={[4.8,0,3.1]}/>
  </>;
}

export function Floorplan3D({ plan=clinicPlan, selectedId, onSelect, onFurnitureMove, showHeatmap=true, showRoute=true, className }:EditorViewProps){
  const [preset,setPreset]=useState<"iso"|"top"|"front">("iso");
  return <div className={className} style={{position:"relative",width:"100%",height:"100%",minHeight:430,background:"#e8ece9"}}>
    <div style={{position:"absolute",zIndex:2,top:14,right:14,display:"flex",gap:4,padding:4,background:"#fff",border:"1px solid #d4dcda",borderRadius:8}}>{(["iso","top","front"] as const).map(p=><button key={p} type="button" aria-pressed={preset===p} onClick={()=>setPreset(p)} style={{border:0,borderRadius:5,padding:"7px 10px",background:preset===p?"#dcecea":"transparent",color:"#33464b",font:"600 11px system-ui",cursor:"pointer",textTransform:"capitalize"}}>{p}</button>)}</div>
    <Canvas shadows frameloop="demand" dpr={[1,1.5]} camera={{fov:42,near:.1,far:100}} gl={{antialias:true}}><color attach="background" args={["#e8ece9"]}/><fog attach="fog" args={["#e8ece9",11,22]}/><Suspense fallback={<Html center style={{font:"600 12px system-ui",color:c.muted}}>Preparing spatial view…</Html>}><ClinicScene plan={plan} selectedId={selectedId} onSelect={onSelect} onFurnitureMove={onFurnitureMove} showHeatmap={showHeatmap} showRoute={showRoute} preset={preset}/></Suspense></Canvas>
  </div>;
}
export default Floorplan3D;

