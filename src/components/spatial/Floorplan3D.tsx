"use client";

import React, { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Text } from "@react-three/drei";
import * as THREE from "three";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { type SpatialFurniture } from "@/lib/spatial-model";
import {
  RotateCcw,
} from "lucide-react";
import { Spatial3DErrorBoundary } from "./Spatial3DErrorBoundary";

/* Scale: 800 x 600 cm -> divide by 100 for Three.js meters
 * Center of the scene is (4.0, 3.0) -> offset to origin (-4.0, -3.0)
 */
const to3DX = (xCm: number) => (xCm - 400) / 100;
const to3DZ = (yCm: number) => (yCm - 300) / 100;
const to3DDim = (dimCm: number) => dimCm / 100;

/* ── 3D Furniture Geometries ── */

function Chair3D({
  w,
  d,
  isSelected,
  isHazard,
}: {
  w: number;
  d: number;
  isSelected: boolean;
  isHazard: boolean;
}) {
  const seatH = 0.42;
  const backH = 0.4;
  const t = 0.035;

  const color = isSelected ? "#1e7168" : isHazard ? "#ef4444" : "#94a3b8";

  return (
    <group position={[0, 0, 0]}>
      {/* Seat cushion */}
      <mesh position={[0, seatH, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, seatH + backH / 2, -d / 2 + t / 2]} castShadow>
        <boxGeometry args={[w * 0.95, backH, t]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Armrests */}
      <mesh position={[-w / 2 + t / 2, seatH + 0.14, 0]} castShadow>
        <boxGeometry args={[t, 0.22, d * 0.7]} />
        <meshStandardMaterial color="#64748b" roughness={0.4} />
      </mesh>
      <mesh position={[w / 2 - t / 2, seatH + 0.14, 0]} castShadow>
        <boxGeometry args={[t, 0.22, d * 0.7]} />
        <meshStandardMaterial color="#64748b" roughness={0.4} />
      </mesh>
      {/* 4 legs */}
      {[-1, 1].map((xSign) =>
        [-1, 1].map((zSign) => (
          <mesh
            key={`leg-${xSign}-${zSign}`}
            position={[xSign * (w / 2 - 0.04), seatH / 2, zSign * (d / 2 - 0.04)]}
            castShadow
          >
            <cylinderGeometry args={[0.015, 0.012, seatH, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.5} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Desk3D({
  w,
  d,
  h = 0.75,
  color = "#cbd5e1",
}: {
  w: number;
  d: number;
  h?: number;
  color?: string;
}) {
  const topT = 0.04;
  return (
    <group>
      {/* Work surface */}
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topT, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Front privacy panel */}
      <mesh position={[0, h / 2 + 0.05, d / 2 - 0.02]} castShadow>
        <boxGeometry args={[w * 0.95, h - 0.1, 0.03]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </mesh>
      {/* Side leg panels */}
      <mesh position={[-w / 2 + 0.03, h / 2, 0]} castShadow>
        <boxGeometry args={[0.04, h, d * 0.9]} />
        <meshStandardMaterial color="#64748b" roughness={0.5} />
      </mesh>
      <mesh position={[w / 2 - 0.03, h / 2, 0]} castShadow>
        <boxGeometry args={[0.04, h, d * 0.9]} />
        <meshStandardMaterial color="#64748b" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Bench3D({ w, d }: { w: number; d: number }) {
  const seatH = 0.44;
  return (
    <group>
      <mesh position={[0, seatH, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.06, d]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} />
      </mesh>
      <mesh position={[-w / 2 + 0.08, seatH / 2, 0]} castShadow>
        <boxGeometry args={[0.04, seatH, d * 0.8]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>
      <mesh position={[w / 2 - 0.08, seatH / 2, 0]} castShadow>
        <boxGeometry args={[0.04, seatH, d * 0.8]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Plant3D({ r }: { r: number }) {
  return (
    <group>
      {/* Ceramic pot */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[r * 0.8, r * 0.6, 0.44, 16]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[r * 1.1, 12, 12]} />
        <meshStandardMaterial color="#3f6212" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Mat3D({ w, d }: { w: number; d: number }) {
  return (
    <mesh position={[0, 0.008, 0]} receiveShadow>
      <boxGeometry args={[w, 0.015, d]} />
      <meshStandardMaterial color="#d97706" roughness={0.9} />
    </mesh>
  );
}

/* ── 3D Scene Contents ── */

function ClinicScene({
  customFurniture,
  isBeforeCondition = false,
}: {
  customFurniture?: SpatialFurniture[];
  isBeforeCondition?: boolean;
}) {
  const {
    activeStage,
    rooms,
    walls,
    furniture: storeFurniture,
    hazards,
    routeWaypoints,
    selectedFurnitureId,
    selectedHazardId,
    selectFurniture,
    selectHazard,
    layerToggles,
  } = useSafeSpaceStore();

  const furniture = customFurniture || storeFurniture;
  const isImprovedScene = !isBeforeCondition && activeStage === "improve";

  return (
    <>
      {/* Lighting: Architectural ambient & directional */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={30}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-6, 10, -5]} intensity={0.4} />

      {/* Main Base Slab Floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[8.4, 0.1, 6.4]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
      </mesh>

      {/* Room Floors with subtle tone shifts */}
      {rooms.map((room) => {
        const cx = to3DX(room.x + room.width / 2);
        const cz = to3DZ(room.y + room.depth / 2);
        const w = to3DDim(room.width);
        const d = to3DDim(room.depth);

        return (
          <mesh key={room.id} position={[cx, 0.002, cz]} receiveShadow>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial
              color={room.id === "room-corridor" ? "#f3f4f6" : "#ffffff"}
              roughness={0.8}
            />
          </mesh>
        );
      })}

      {/* Low-height architectural cutaway walls */}
      {layerToggles.walls &&
        walls.map((w) => {
          const x1 = to3DX(w.start.x);
          const z1 = to3DZ(w.start.y);
          const x2 = to3DX(w.end.x);
          const z2 = to3DZ(w.end.y);

          const mx = (x1 + x2) / 2;
          const mz = (z1 + z2) / 2;
          const len = Math.hypot(x2 - x1, z2 - z1);
          const angle = Math.atan2(x2 - x1, z2 - z1);
          const wallHeight = 0.85; // Low-height cutaway per spec!

          return (
            <group key={w.id} position={[mx, wallHeight / 2, mz]} rotation={[0, angle, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[to3DDim(w.thickness), wallHeight, len]} />
                <meshStandardMaterial color="#475569" roughness={0.7} />
              </mesh>
              {/* Wall top cap line */}
              <mesh position={[0, wallHeight / 2 + 0.005, 0]}>
                <boxGeometry args={[to3DDim(w.thickness) * 1.05, 0.01, len]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            </group>
          );
        })}

      {/* Corridor Handrail (Improved state ONLY) */}
      {isImprovedScene && (
        <group position={[to3DX(380), 0.88, to3DZ(400)]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.02, 0.02, 2.4, 12]} />
            <meshStandardMaterial color="#0f766e" roughness={0.3} metalness={0.4} />
          </mesh>
        </group>
      )}

      {/* Heatmap zones projected on floor (Stage 4 & 5) */}
      {layerToggles.heatmap &&
        hazards.map((h) => {
          const isResolved =
            isImprovedScene &&
            (h.id === "hz-01" || h.id === "hz-02" || h.id === "hz-03" || h.id === "hz-06");
          if (isResolved) return null;

          const px = to3DX(h.position.x);
          const pz = to3DZ(h.position.y);
          const r = h.severity === "high" ? 0.75 : 0.55;

          return (
            <mesh key={`heat-3d-${h.id}`} position={[px, 0.005, pz]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[r, 32]} />
              <meshBasicMaterial
                color={h.severity === "high" ? "#dc2626" : "#d97706"}
                transparent
                opacity={0.32}
              />
            </mesh>
          );
        })}

      {/* 3D Walking Route Line Ribbon */}
      {layerToggles.route && routeWaypoints.length > 1 && (
        <group position={[0, 0.02, 0]}>
          {routeWaypoints.map((pt, i) => {
            if (i === routeWaypoints.length - 1) return null;
            const next = routeWaypoints[i + 1];
            const p1 = new THREE.Vector3(to3DX(pt.x), 0.02, to3DZ(pt.y));
            const p2 = new THREE.Vector3(to3DX(next.x), 0.02, to3DZ(next.y));
            const mid = p1.clone().add(p2).multiplyScalar(0.5);
            const dist = p1.distanceTo(p2);
            const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);

            const isConstrained =
              !isImprovedScene &&
              ((pt.id === "pt-3" && next.id === "pt-4") ||
                (pt.id === "pt-4" && next.id === "pt-5"));

            return (
              <mesh
                key={`route-seg-3d-${pt.id}`}
                position={mid}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[0.08, 0.008, dist]} />
                <meshBasicMaterial color={isConstrained ? "#dc2626" : "#2563eb"} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 3D Furniture Objects */}
      {furniture.map((item) => {
        const posX = to3DX(item.x + item.width / 2);
        const posZ = to3DZ(item.y + item.depth / 2);
        const w = to3DDim(item.width);
        const d = to3DDim(item.depth);
        const rotY = -(item.rotation || 0) * (Math.PI / 180);
        const isSelected = selectedFurnitureId === item.id;
        const isHazard = item.id === "chair-c04" && !isImprovedScene;

        return (
          <group
            key={item.id}
            position={[posX, 0, posZ]}
            rotation={[0, rotY, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectFurniture(item.id);
            }}
          >
            {item.category === "chair" && (
              <Chair3D w={w} d={d} isSelected={isSelected} isHazard={isHazard} />
            )}
            {item.category === "desk" && (
              <Desk3D
                w={w}
                d={d}
                h={to3DDim(item.height)}
                color={isSelected ? "#1e7168" : "#cbd5e1"}
              />
            )}
            {item.category === "table" && (
              <Desk3D w={w} d={d} h={0.45} color={isSelected ? "#1e7168" : "#e2e8f0"} />
            )}
            {item.category === "bench" && <Bench3D w={w} d={d} />}
            {item.category === "plant" && <Plant3D r={w / 2} />}
            {item.category === "mat" && <Mat3D w={w} d={d} />}
            {(item.category === "cabinet" || item.category === "medical-fixture") && (
              <mesh position={[0, to3DDim(item.height) / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[w, to3DDim(item.height), d]} />
                <meshStandardMaterial
                  color={isSelected ? "#1e7168" : "#94a3b8"}
                  roughness={0.5}
                />
              </mesh>
            )}

            {/* Selection Ring Indicator */}
            {isSelected && (
              <group position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh>
                  <ringGeometry args={[Math.max(w, d) * 0.65, Math.max(w, d) * 0.75, 32]} />
                  <meshBasicMaterial color="#1e7168" side={THREE.DoubleSide} />
                </mesh>
                <mesh>
                  <circleGeometry args={[Math.max(w, d) * 0.62, 32]} />
                  <meshBasicMaterial color="#1e7168" transparent opacity={0.15} side={THREE.DoubleSide} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* 3D Hazard Pins (Billboard Markers) */}
      {layerToggles.hazards &&
        hazards.map((h, i) => {
          const isResolved =
            isImprovedScene &&
            (h.id === "hz-01" || h.id === "hz-02" || h.id === "hz-03" || h.id === "hz-06");

          const px = to3DX(h.position.x);
          const pz = to3DZ(h.position.y);
          const isSelected = selectedHazardId === h.id;
          const pinColor = isResolved ? "#16a34a" : h.severity === "high" ? "#dc2626" : "#d97706";

          return (
            <group
              key={`hazard-pin-3d-${h.id}`}
              position={[px, 0.9, pz]}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectHazard(h.id);
              }}
            >
              {/* Vertical pin needle */}
              <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.015, 0.008, 0.8, 8]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
              {/* Pin head orb */}
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[isSelected ? 0.17 : 0.13, 16, 16]} />
                <meshStandardMaterial color={pinColor} roughness={0.3} metalness={0.2} />
              </mesh>
              {/* Selection floor indicator */}
              {isSelected && (
                <mesh position={[0, -0.89, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.25, 0.32, 32]} />
                  <meshBasicMaterial color={pinColor} side={THREE.DoubleSide} />
                </mesh>
              )}
              {/* Text label billboard */}
              <Text
                position={[0, 0.22, 0]}
                fontSize={0.16}
                color="#0f172a"
                anchorX="center"
                anchorY="middle"
              >
                {`${i + 1}`}
              </Text>
            </group>
          );
        })}

      {/* Subtle architectural contact shadows */}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.35}
        scale={10}
        blur={1.8}
        far={2}
        resolution={512}
        color="#1e293b"
      />
    </>
  );
}

/* ── Camera Helper & Controls ── */

function CameraHandler() {
  const { cameraPreset, setCameraPreset, selectedHazardId, hazards } = useSafeSpaceStore();
  const { camera } = useThree();

  useEffect(() => {
    if (!cameraPreset) return;

    if (cameraPreset === "isometric") {
      camera.position.set(6, 7.5, 6);
      camera.lookAt(0, 0.2, 0);
    } else if (cameraPreset === "top") {
      camera.position.set(0, 10, 0.1);
      camera.lookAt(0, 0, 0);
    } else if (cameraPreset === "reset") {
      camera.position.set(5.5, 6.8, 5.5);
      camera.lookAt(0, 0.2, 0);
    }
    setCameraPreset(null);
  }, [cameraPreset, camera, setCameraPreset]);

  // Focus hazard when selected
  useEffect(() => {
    if (!selectedHazardId) return;
    const h = hazards.find((item) => item.id === selectedHazardId);
    if (!h) return;
    const targetX = to3DX(h.position.x);
    const targetZ = to3DZ(h.position.y);
    camera.position.set(targetX + 2.5, 3.2, targetZ + 2.5);
    camera.lookAt(targetX, 0.5, targetZ);
  }, [selectedHazardId, hazards, camera]);

  return null;
}

export function Floorplan3D({
  customFurniture,
  isBeforeCondition = false,
  className = "",
}: {
  customFurniture?: SpatialFurniture[];
  isBeforeCondition?: boolean;
  className?: string;
}) {
  const { setCameraPreset, layerToggles, toggleLayer, setViewMode } = useSafeSpaceStore();

  return (
    <Spatial3DErrorBoundary onFallbackTo2D={() => setViewMode("2d")}>
      <div className={`relative flex flex-col h-full w-full select-none overflow-hidden bg-[#f1f3f0] border border-[#e2e8e4] rounded-lg ${className}`}>
      {/* 3D Control overlay (top-left) */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-[#e2e8e4] px-2.5 py-1.5 rounded-md shadow-xs text-xs text-[#2c3d3a]">
        <span className="font-semibold tracking-wide text-[#1e7168]">3D ISOMETRIC</span>
        <span className="text-[#a4b2ad]">|</span>
        <button
          onClick={() => setCameraPreset("isometric")}
          className="px-2 py-0.5 rounded text-[#475569] hover:bg-slate-100 transition"
          title="Isometric View"
        >
          Iso
        </button>
        <button
          onClick={() => setCameraPreset("top")}
          className="px-2 py-0.5 rounded text-[#475569] hover:bg-slate-100 transition"
          title="Top Plan View"
        >
          Top
        </button>
        <button
          onClick={() => setCameraPreset("reset")}
          className="px-2 py-0.5 rounded text-[#475569] hover:bg-slate-100 transition flex items-center gap-1"
          title="Reset Camera"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Layer Visibility Toggles (top-right) */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-[#e2e8e4] p-1 rounded-md shadow-xs text-xs">
        <button
          onClick={() => toggleLayer("walls")}
          className={`px-2 py-1 rounded transition text-xs ${
            layerToggles.walls ? "bg-[#e8f3f1] text-[#1e7168] font-medium" : "text-[#64748b]"
          }`}
          title="Toggle Walls"
        >
          Walls
        </button>
        <button
          onClick={() => toggleLayer("route")}
          className={`px-2 py-1 rounded transition text-xs ${
            layerToggles.route ? "bg-[#e8f3f1] text-[#1e7168] font-medium" : "text-[#64748b]"
          }`}
          title="Toggle Route"
        >
          Route
        </button>
        <button
          onClick={() => toggleLayer("heatmap")}
          className={`px-2 py-1 rounded transition text-xs ${
            layerToggles.heatmap ? "bg-[#e8f3f1] text-[#1e7168] font-medium" : "text-[#64748b]"
          }`}
          title="Toggle Heatmap"
        >
          Heatmap
        </button>
      </div>

      {/* R3F Canvas */}
      <Canvas
        shadows
        camera={{ position: [5.5, 6.8, 5.5], fov: 38 }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <CameraHandler />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2.05} // Prevent going below floor
        />
        <ClinicScene customFurniture={customFurniture} isBeforeCondition={isBeforeCondition} />
      </Canvas>

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-xs border border-[#e2e8e4] px-2.5 py-1 rounded text-[11px] text-[#64748b]">
        <span>Left-click: Rotate | Right-click: Pan | Scroll: Zoom</span>
      </div>
    </div>
    </Spatial3DErrorBoundary>
  );
}
