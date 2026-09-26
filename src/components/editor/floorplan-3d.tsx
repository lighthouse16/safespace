"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useThree, useFrame, ThreeEvent } from "@react-three/fiber";
import { MapControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { EditorPlan, EditorRoom, Point, EditorFurniture, editorPalette, FurnitureKind } from "./editor-model";

const U = 0.01;

function CameraRig({ preset }: { preset: "iso" | "top" | "front" }) {
  const { camera, invalidate } = useThree();
  const targetPos = useRef(new THREE.Vector3(10, 10, 10));

  useEffect(() => {
    if (preset === "iso") targetPos.current.set(10, 10, 10);
    else if (preset === "top") targetPos.current.set(0, 15, 0.1); 
    else if (preset === "front") targetPos.current.set(0, 5, 15);
    invalidate();
  }, [preset, invalidate]);

  useFrame(() => {
    if (camera.position.distanceToSquared(targetPos.current) > 0.001) {
      camera.position.lerp(targetPos.current, 0.1);
      invalidate();
    }
  });
  return null;
}

function FurnitureMesh({ kind, w, d }: { kind: FurnitureKind; w: number; d: number }) {
  if (kind === "chair") {
    return (
      <group>
        <mesh position={[0, 0.45 * U, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.05 * U, d]} />
          <meshStandardMaterial color={editorPalette.ink} />
        </mesh>
        <mesh position={[0, 0.9 * U, -d/2 + 0.05*U]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.9 * U, 0.05 * U]} />
          <meshStandardMaterial color={editorPalette.ink} />
        </mesh>
        {[-1, 1].map((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * (w/2 - 0.05*U), 0.225 * U, z * (d/2 - 0.05*U)]} castShadow>
              <cylinderGeometry args={[0.02 * U, 0.02 * U, 0.45 * U]} />
              <meshStandardMaterial color={editorPalette.ink} />
            </mesh>
          ))
        )}
      </group>
    );
  }
  if (kind === "desk") {
    return (
      <group>
        <mesh position={[0, 0.75 * U, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.05 * U, d]} />
          <meshStandardMaterial color={editorPalette.amber} />
        </mesh>
        <mesh position={[0, 0.6 * U, d/2 - 0.02*U]} castShadow receiveShadow>
          <boxGeometry args={[w * 0.9, 0.2 * U, 0.04 * U]} />
          <meshStandardMaterial color={editorPalette.ink} />
        </mesh>
        {[-1, 1].map((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * (w/2 - 0.05*U), 0.375 * U, z * (d/2 - 0.05*U)]} castShadow>
              <cylinderGeometry args={[0.03 * U, 0.03 * U, 0.75 * U]} />
              <meshStandardMaterial color={editorPalette.ink} />
            </mesh>
          ))
        )}
      </group>
    );
  }
  if (kind === "cabinet") {
    return (
      <group>
        <mesh position={[0, 1.0 * U, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 2.0 * U, d]} />
          <meshStandardMaterial color={editorPalette.muted} />
        </mesh>
        <mesh position={[0, 1.0 * U, d/2 + 0.01*U]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.02 * U, 0.02 * U]} />
          <meshStandardMaterial color={editorPalette.ink} />
        </mesh>
        <mesh position={[0, 1.0 * U, d/2 + 0.01*U]}>
          <boxGeometry args={[0.02 * U, 2.0 * U, 0.02 * U]} />
          <meshStandardMaterial color={editorPalette.ink} />
        </mesh>
      </group>
    );
  }
  if (kind === "plant") {
    return (
      <group>
        <mesh position={[0, 0.3 * U, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2 * U, 0.15 * U, 0.6 * U]} />
          <meshStandardMaterial color={editorPalette.amber} />
        </mesh>
        <mesh position={[0, 0.9 * U, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.4 * U]} />
          <meshStandardMaterial color={editorPalette.teal} />
        </mesh>
      </group>
    );
  }
  if (kind === "bench") {
    return (
      <group>
        <mesh position={[0, 0.45 * U, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.05 * U, d]} />
          <meshStandardMaterial color={editorPalette.amber} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * (w/2 - 0.1*U), 0.225 * U, 0]} castShadow>
            <boxGeometry args={[0.1 * U, 0.45 * U, d * 0.8]} />
            <meshStandardMaterial color={editorPalette.ink} />
          </mesh>
        ))}
      </group>
    );
  }
  
  return (
    <mesh position={[0, 0.5 * U, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, 1.0 * U, d]} />
      <meshStandardMaterial color={editorPalette.muted} />
    </mesh>
  );
}

function FurnitureItem({
  item,
  selected,
  onSelect,
  onMove,
}: {
  item: EditorFurniture;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove?: (id: string, pos: Point) => void;
}) {
  const { invalidate } = useThree();
  const controlsRef = useRef<{ enabled: boolean } | null>(null);
  const isDragging = useRef(false);
  const offset = useRef(new THREE.Vector3());
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const [hovered, setHovered] = useState(false);

  // Grab controls ref once mounted
  const { controls: threeControls } = useThree();
  useEffect(() => {
    controlsRef.current = threeControls as { enabled: boolean } | null;
  }, [threeControls]);

  const w = item.width * U;
  const d = item.depth * U;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(item.id);
    if (!item.movable || !onMove) return;
    
    (e.nativeEvent.target as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    if (controlsRef.current) controlsRef.current.enabled = false;
    
    const intersection = new THREE.Vector3();
    e.ray.intersectPlane(plane, intersection);
    offset.current.copy(intersection).sub(new THREE.Vector3(item.x * U, 0, item.y * U));
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    const intersection = new THREE.Vector3();
    e.ray.intersectPlane(plane, intersection);
    if (intersection) {
      const newX = (intersection.x - offset.current.x) / U;
      const newY = (intersection.z - offset.current.z) / U;
      onMove?.(item.id, { x: newX, y: newY });
      invalidate();
    }
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    (e.nativeEvent.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDragging.current = false;
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  return (
    <group
      position={[item.x * U, 0, item.y * U]}
      rotation={[0, -(item.rotation || 0) * (Math.PI / 180), 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); invalidate(); }}
      onPointerOut={() => { setHovered(false); invalidate(); }}
    >
      <group scale={hovered ? 1.02 : 1}>
        <FurnitureMesh kind={item.kind} w={w} d={d} />
        {selected && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[Math.max(w, d) / 2 + 0.1, Math.max(w, d) / 2 + 0.15, 32]} />
            <meshBasicMaterial color={editorPalette.teal} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function HeatmapLayer({ plan }: { plan: EditorPlan }) {
  return (
    <group position={[0, 0.005, 0]}>
      {plan.furniture.map((f, i) => (
        <mesh key={i} position={[f.x * U, 0, f.y * U]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.0, 32]} />
          <meshBasicMaterial color={editorPalette.red} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function RouteLayer({ points }: { points: Point[] }) {
  const pts = points.map((p) => new THREE.Vector3(p.x * U, 0.01, p.y * U));
  if (pts.length < 2) return null;
  return (
    <Line
      points={pts}
      color={editorPalette.route}
      lineWidth={3}
      dashed
      dashSize={0.2}
      gapSize={0.1}
    />
  );
}

export function Floorplan3D({
  plan,
  selectedId,
  onSelect,
  onFurnitureMove,
  showHeatmap,
  showRoute,
  className,
}: import("./editor-model").EditorViewProps) {
  const [preset, setPreset] = useState<"iso" | "top" | "front">("iso");

  if (!plan) return null;

  return (
    <div className={`relative w-full h-full ${className || ""}`}>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button className="px-3 py-1 bg-white shadow rounded text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setPreset("iso")}>Iso</button>
        <button className="px-3 py-1 bg-white shadow rounded text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setPreset("top")}>Top</button>
        <button className="px-3 py-1 bg-white shadow rounded text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setPreset("front")}>Front</button>
      </div>

      <Canvas frameloop="demand" dpr={[1, 1.5]} shadows camera={{ position: [10, 10, 10], fov: 50 }}>
        <MapControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        <CameraRig preset={preset} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20, 0.1, 50]} />
        </directionalLight>

        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          receiveShadow 
          onPointerDown={(e) => { e.stopPropagation(); onSelect?.(null); }}
        >
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color={editorPalette.floor} />
        </mesh>

        <group position={[-plan.width * U / 2, 0, -plan.depth * U / 2]}>
          {plan.rooms.map((room: EditorRoom) => (
            <group key={room.id} position={[room.x * U + (room.width * U)/2, 0, room.y * U + (room.depth * U)/2]}>
              <mesh position={[0, 1.4 * U, 0]} receiveShadow castShadow>
                <boxGeometry args={[room.width * U, 2.8 * U, room.depth * U]} />
                <meshStandardMaterial color={editorPalette.room} transparent opacity={0.7} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}

          {plan.furniture.map((f) => (
            <FurnitureItem
              key={f.id}
              item={f}
              selected={selectedId === f.id}
              onSelect={(id) => onSelect?.(id)}
              onMove={onFurnitureMove}
            />
          ))}

          {showHeatmap && <HeatmapLayer plan={plan} />}
          {showRoute && plan.route && <RouteLayer points={plan.route} />}
        </group>
      </Canvas>
    </div>
  );
}

export default Floorplan3D;
