"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas, useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, ContactShadows, Environment, Line, Grid, useCursor } from "@react-three/drei";
import * as THREE from "three";
import type { EditorViewProps, EditorFurniture, EditorRoom, Point, FurnitureKind } from "./editor-model";
import { editorPalette as c, clinicPlan } from "./editor-model";
import { snapAndClampPosition } from "./floorplan-drag";

/* ── Scale: 1 model unit = 1 cm → divide by 100 for meters ── */
const S = 0.01;
const toM = (v: number) => v * S;

/* ── Colors ── */
const furnitureColors: Record<FurnitureKind, string> = {
  chair: "#8a9eab",
  desk: "#b09470",
  cabinet: "#6b7b82",
  plant: "#5a8a5e",
  bench: "#a09080",
  shelf: "#7a6e5e",
  tv: "#1a2530",
};

/* ── Furniture 3D geometry ── */
function Chair({ w, d }: { w: number; d: number }) {
  const seatH = 0.45, legH = 0.44, backH = 0.40, t = 0.03, legR = 0.015;
  return (
    <group>
      {/* Seat */}
      <mesh position={[0, seatH, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color={furnitureColors.chair} roughness={0.7} />
      </mesh>
      {/* Back */}
      <mesh position={[0, seatH + backH / 2, -d / 2 + t / 2]} castShadow>
        <boxGeometry args={[w, backH, t]} />
        <meshStandardMaterial color={furnitureColors.chair} roughness={0.7} />
      </mesh>
      {/* 4 legs */}
      {([-1, 1] as const).flatMap(x =>
        ([-1, 1] as const).map(z => (
          <mesh key={`${x}${z}`} position={[x * (w / 2 - 0.03), legH / 2, z * (d / 2 - 0.03)]} castShadow>
            <cylinderGeometry args={[legR, legR, legH, 8]} />
            <meshStandardMaterial color="#5c6a70" roughness={0.6} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Desk({ w, d }: { w: number; d: number }) {
  const topH = 0.75, t = 0.04, legR = 0.02, legH = topH - t;
  return (
    <group>
      {/* Top */}
      <mesh position={[0, topH, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color={furnitureColors.desk} roughness={0.5} />
      </mesh>
      {/* Drawer panel */}
      <mesh position={[0, topH - 0.12, d / 2 - 0.015]} castShadow>
        <boxGeometry args={[w * 0.85, 0.18, 0.025]} />
        <meshStandardMaterial color="#967755" roughness={0.6} />
      </mesh>
      {/* 4 legs */}
      {([-1, 1] as const).flatMap(x =>
        ([-1, 1] as const).map(z => (
          <mesh key={`${x}${z}`} position={[x * (w / 2 - 0.04), legH / 2, z * (d / 2 - 0.04)]} castShadow>
            <cylinderGeometry args={[legR, legR, legH, 8]} />
            <meshStandardMaterial color="#5c6a70" roughness={0.6} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Cabinet({ w, d }: { w: number; d: number }) {
  const h = 1.6;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={furnitureColors.cabinet} roughness={0.65} />
      </mesh>
      {/* Shelf lines */}
      {[0.4, 0.8, 1.2].map(y => (
        <mesh key={y} position={[0, y, d / 2 + 0.002]}>
          <boxGeometry args={[w * 0.95, 0.008, 0.004]} />
          <meshStandardMaterial color="#4a5a60" />
        </mesh>
      ))}
      {/* Door split */}
      <mesh position={[0, h / 2, d / 2 + 0.002]}>
        <boxGeometry args={[0.008, h * 0.9, 0.004]} />
        <meshStandardMaterial color="#4a5a60" />
      </mesh>
    </group>
  );
}

function Plant({ w }: { w: number }) {
  const r = w / 2;
  return (
    <group>
      {/* Pot */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[r * 0.7, r * 0.55, 0.30, 16]} />
        <meshStandardMaterial color="#8B6F4E" roughness={0.8} />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[r * 1.1, 16, 12]} />
        <meshStandardMaterial color={furnitureColors.plant} roughness={0.85} />
      </mesh>
    </group>
  );
}

function Bench({ w, d }: { w: number; d: number }) {
  const seatH = 0.45, t = 0.04;
  return (
    <group>
      {/* Seat */}
      <mesh position={[0, seatH, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color={furnitureColors.bench} roughness={0.6} />
      </mesh>
      {/* 2 end supports */}
      {([-1, 1] as const).map(x => (
        <mesh key={x} position={[x * (w / 2 - 0.06), seatH / 2, 0]} castShadow>
          <boxGeometry args={[0.06, seatH, d * 0.85]} />
          <meshStandardMaterial color="#7a6e62" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Shelf({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 1.2, d]} />
        <meshStandardMaterial color="#7a6e5e" roughness={0.75} />
      </mesh>
      {[0.25, 0.5, 0.75, 1.0].map(y => (
        <mesh key={y} position={[0, y * 1.2, d / 2 + 0.003]}>
          <boxGeometry args={[w * 0.95, 0.008, 0.003]} />
          <meshStandardMaterial color="#5a4e3e" />
        </mesh>
      ))}
    </group>
  );
}

function TV({ w, d }: { w: number; d: number }) {
  return (
    <group>
      {/* Screen */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[w, w * 0.56, d]} />
        <meshStandardMaterial color="#1a2530" roughness={0.3} />
      </mesh>
      {/* Inner screen */}
      <mesh position={[0, 1.3, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.92, w * 0.50]} />
        <meshStandardMaterial color="#2a3a45" roughness={0.2} />
      </mesh>
    </group>
  );
}

function FurnitureShape({ kind, w, d }: { kind: FurnitureKind; w: number; d: number }) {
  switch (kind) {
    case "chair": return <Chair w={w} d={d} />;
    case "desk": return <Desk w={w} d={d} />;
    case "cabinet": return <Cabinet w={w} d={d} />;
    case "plant": return <Plant w={w} />;
    case "bench": return <Bench w={w} d={d} />;
    case "shelf": return <Shelf w={w} d={d} />;
    case "tv": return <TV w={w} d={d} />;
    default: return (
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.6, d]} />
        <meshStandardMaterial color="#9aa" roughness={0.7} />
      </mesh>
    );
  }
}

/* ── Draggable furniture wrapper ── */
function FurnitureItem({
  item, selected, onSelect, onMove, controlsRef, planWidth, planDepth,
}: {
  item: EditorFurniture;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove?: (id: string, pos: Point) => void;
  controlsRef: React.RefObject<CameraControls | null>;
  planWidth: number;
  planDepth: number;
}) {
  const { gl, camera } = useThree();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRaycaster = useRef(new THREE.Raycaster());
  const groupRef = useRef<THREE.Group>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef(new THREE.Vector3());
  const previewRef = useRef(new THREE.Vector3());
  const finalRef = useRef<Point>({ x: item.x, y: item.y });
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitRef = useRef(new THREE.Vector3());
  const pointerRef = useRef(new THREE.Vector2());
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const w = toM(item.width);
  const d = toM(item.depth);
  const px = toM(item.x) + w / 2;
  const pz = toM(item.y) + d / 2;
  useCursor(dragging || (hovered && Boolean(item.movable)), dragging ? "grabbing" : "grab");

  useEffect(() => {
    canvasRef.current = gl.domElement;
  }, [gl]);

  const restoreInteraction = useCallback(() => {
    draggingRef.current = false;
    pointerIdRef.current = null;
    setDragging(false);
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, [controlsRef]);

  const projectPointer = useCallback((event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    dragRaycaster.current.setFromCamera(pointerRef.current, camera);
    return dragRaycaster.current.ray.intersectPlane(floorPlane.current, hitRef.current);
  }, [camera]);

  useFrame(() => {
    if (!draggingRef.current || !groupRef.current) return;
    groupRef.current.position.copy(previewRef.current);
  });

  useEffect(() => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controls = controlsRef.current;

    const handleMove = (event: PointerEvent) => {
      if (!draggingRef.current || event.pointerId !== pointerIdRef.current) return;
      event.preventDefault();
      const hit = projectPointer(event);
      if (!hit) return;

      const centerX = hit.x - offsetRef.current.x;
      const centerZ = hit.z - offsetRef.current.z;
      const next = snapAndClampPosition(
        { x: (centerX - w / 2) / S, y: (centerZ - d / 2) / S },
        { planWidth, planDepth, itemWidth: item.width, itemDepth: item.depth, grid: 5 },
      );

      finalRef.current = next;
      previewRef.current.set(toM(next.x) + w / 2, 0.08, toM(next.y) + d / 2);
    };

    const finish = (event?: PointerEvent) => {
      if (!draggingRef.current) return;
      if (event && event.pointerId !== pointerIdRef.current) return;

      const pointerId = pointerIdRef.current;
      if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
      const final = finalRef.current;
      if (groupRef.current) groupRef.current.position.set(toM(final.x) + w / 2, 0, toM(final.y) + d / 2);
      onMove?.(item.id, final);
      restoreInteraction();
    };

    const cancel = () => {
      if (groupRef.current) groupRef.current.position.set(px, 0, pz);
      restoreInteraction();
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      if (controls) controls.enabled = true;
    };
  }, [dragging, item.depth, item.id, item.width, onMove, planDepth, planWidth, projectPointer, px, pz, restoreInteraction, w, d, controlsRef]);

  const handleDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(item.id);
    if (!item.movable || !onMove || draggingRef.current) return;

    const hit = e.ray.intersectPlane(floorPlane.current, hitRef.current);
    if (!hit) return;

    e.nativeEvent.preventDefault();
    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    finalRef.current = { x: item.x, y: item.y };
    previewRef.current.set(px, 0.08, pz);
    offsetRef.current.set(hit.x - px, 0, hit.z - pz);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    if (controlsRef.current) controlsRef.current.enabled = false;
    setDragging(true);
  }, [controlsRef, item.id, item.movable, item.x, item.y, onMove, onSelect, px, pz]);

  return (
    <group
      ref={groupRef}
      position={[px, 0, pz]}
      rotation={[0, -(item.rotation ?? 0) * Math.PI / 180, 0]}
      onPointerDown={handleDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!draggingRef.current) setHovered(true);
      }}
      onPointerOut={() => {
        if (!draggingRef.current) setHovered(false);
      }}
    >
      <group scale={hovered && item.movable ? 1.03 : 1}>
        <FurnitureShape kind={item.kind} w={w} d={d} />
      </group>
      {(selected || dragging) && (
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(w, d) * 0.65, Math.max(w, d) * 0.72, 48]} />
          <meshBasicMaterial color={c.teal} transparent opacity={dragging ? 0.9 : 0.6} depthWrite={false} />
        </mesh>
      )}
      {dragging && (
        <mesh position={[0, -0.074, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.08, d + 0.08]} />
          <meshBasicMaterial color={c.teal} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ── Room walls ── */
function RoomWalls({ room }: { room: EditorRoom }) {
  const x = toM(room.x), z = toM(room.y), w = toM(room.width), d = toM(room.depth);
  const wallH = 2.6, wallT = 0.08;
  const cx = x + w / 2, cz = z + d / 2;

  // 4 walls — slightly transparent so you see interior
  const walls: [number, number, number, number, number][] = [
    [cx, cz - d / 2 + wallT / 2, w, wallH, wallT], // back
    [cx, cz + d / 2 - wallT / 2, w, wallH, wallT], // front
    [cx - w / 2 + wallT / 2, cz, wallT, wallH, d], // left
    [cx + w / 2 - wallT / 2, cz, wallT, wallH, d], // right
  ];

  return (
    <group>
      {/* Floor tile per room */}
      <mesh position={[cx, 0.002, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f0f2ee" roughness={0.9} />
      </mesh>
      {/* Walls */}
      {walls.map(([wx, wz, ww, wh, wd], i) => (
        <mesh key={i} position={[wx, wh / 2, wz]} castShadow receiveShadow>
          <boxGeometry args={[ww, wh, wd]} />
          <meshStandardMaterial color="#e2e6e0" roughness={0.85} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Heatmap overlay ── */
function HeatmapOverlay() {
  // Risk zones matching the activity room layout
  const zones: [number, number, number, string][] = [
    [toM(420), toM(340), 1.2, c.red],      // critical: cabinet pinch point
    [toM(260), toM(190), 1.4, c.amber],    // high: table A blockage
    [toM(440), toM(450), 0.8, "#e7b64a"],  // moderate: corridor entry
  ];
  return (
    <group>
      {zones.map(([x, z, r, color], i) => (
        <group key={i} position={[x, 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Stacked concentric circles for gradient effect */}
          {[1, 0.7, 0.4].map((s, j) => (
            <mesh key={j}>
              <circleGeometry args={[r * s, 32]} />
              <meshBasicMaterial color={color} transparent opacity={0.12 + j * 0.08} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ── Route line ── */
function RouteLine({ points }: { points: Point[] }) {
  if (points.length < 2) return null;
  const pts = points.map(p => new THREE.Vector3(toM(p.x), 0.015, toM(p.y)));
  return (
    <group>
      {/* White outline */}
      <Line points={pts} color="#ffffff" lineWidth={6} />
      {/* Teal dashed route */}
      <Line points={pts} color={c.route} lineWidth={3} dashed dashSize={0.12} gapSize={0.08} />
      {/* Entry marker */}
      <mesh position={[pts[0].x, 0.02, pts[0].z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color={c.route} />
      </mesh>
    </group>
  );
}

/* ── Animated camera presets ── */
function CameraPresets({ preset, target }: { preset: string; target: [number, number, number] }) {
  const controls = useThree(s => s.controls) as CameraControls | null;

  const prevPreset = useRef(preset);
  useFrame(() => {
    if (!controls || prevPreset.current === preset) return;
    prevPreset.current = preset;

    const [tx, , tz] = target;
    if (preset === "iso") controls.setLookAt(tx + 6, 7, tz + 6, tx, 0.5, tz, true);
    else if (preset === "top") controls.setLookAt(tx, 12, tz + 0.01, tx, 0, tz, true);
    else if (preset === "front") controls.setLookAt(tx, 3, tz + 8, tx, 1, tz, true);
  });

  return null;
}

/* ── Main component ── */
export function Floorplan3D({
  plan = clinicPlan,
  selectedId,
  onSelect,
  onFurnitureMove,
  showHeatmap = true,
  showRoute = true,
  className,
}: EditorViewProps) {
  const [preset, setPreset] = useState<"iso" | "top" | "front">("iso");
  const controlsRef = useRef<CameraControls>(null);

  const pw = toM(plan.width);
  const pd = toM(plan.depth);
  const cx = pw / 2;
  const cz = pd / 2;

  return (
    <div
      className={`relative w-full h-full min-h-[430px] ${className ?? ""}`}
      style={{ background: "#e8ece9", touchAction: "none", cursor: "default" }}
    >
      {/* Camera preset buttons */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
        {(["iso", "top", "front"] as const).map(p => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              preset === p
                ? "bg-teal-50 text-teal-800"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [cx + 6, 7, cz + 6], fov: 45, near: 0.1, far: 100 }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}
      >
        {/* Background */}
        <color attach="background" args={["#e8ece9"]} />

        {/* Controls */}
        <CameraControls
          ref={controlsRef}
          makeDefault
          maxPolarAngle={Math.PI / 2.1}
          minDistance={2}
          maxDistance={20}
          dollySpeed={0.5}
          smoothTime={0.25}
        />
        <CameraPresets preset={preset} target={[cx, 0, cz]} />

        {/* Lighting — Environment for professional reflections */}
        <Environment preset="city" environmentIntensity={0.3} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[cx + 5, 12, cz + 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        >
          <orthographicCamera attach="shadow-camera" args={[-12, 12, 12, -12, 0.5, 30]} />
        </directionalLight>

        {/* Ground plane + grid */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[cx, -0.001, cz]}
          receiveShadow
          onPointerDown={(e) => { e.stopPropagation(); onSelect?.(null); }}
        >
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#dde1dc" roughness={0.95} />
        </mesh>
        <Grid
          position={[cx, 0.001, cz]}
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.4}
          cellColor="#c8cec8"
          sectionSize={2.5}
          sectionThickness={0.8}
          sectionColor="#b0b8b0"
          fadeDistance={18}
          fadeStrength={1.5}
        />

        {/* Contact shadows under furniture */}
        <ContactShadows
          position={[cx, 0.001, cz]}
          opacity={0.35}
          scale={15}
          blur={2.5}
          far={3}
        />

        {/* Scene content */}
        {plan.rooms.map(room => (
          <RoomWalls key={room.id} room={room} />
        ))}

        {plan.furniture.map(f => (
          <FurnitureItem
            key={f.id}
            item={f}
            selected={selectedId === f.id}
            onSelect={id => onSelect?.(id)}
            onMove={onFurnitureMove}
            controlsRef={controlsRef}
            planWidth={plan.width}
            planDepth={plan.depth}
          />
        ))}

        {showHeatmap && <HeatmapOverlay />}
        {showRoute && plan.route && <RouteLine points={plan.route} />}
      </Canvas>
    </div>
  );
}

export default Floorplan3D;
