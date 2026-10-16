"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { generateM3DLayout, readStoredApiBase, storeApiBase } from "@/lib/m3dlayout/client";
import { splitRoomRequests } from "@/lib/m3dlayout/prompt-agent";
import { composeRoomFrames, placeOpenings, type GeneratedPlan } from "@/lib/m3dlayout/room-plan";
import { sceneToFurniture } from "@/lib/m3dlayout/scene-adapter";
import { placeModelFurniture } from "@/lib/m3dlayout/placement-policy";
import { wallToObstacleFootprint, doorToObstacleFootprint } from "@/lib/spatial/geometry/placement";
import type { SpatialDoor, SpatialFurniture } from "@/lib/spatial-model";

type PendingPlan = GeneratedPlan & { furniture: SpatialFurniture[]; openings: SpatialDoor[] };

export function GenerateLayoutPanel() {
  const applyGeneratedPlan = useSafeSpaceStore((state) => state.applyGeneratedPlan);
  const canonicalBoundary = useSafeSpaceStore((state) => state.canonicalBoundary);
  const [apiUrl, setApiUrl] = useState("");
  const [query, setQuery] = useState("a living room with a sofa, a coffee table, and a television");
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlan | null>(null);
  const [placementNote, setPlacementNote] = useState<string | null>(null);

  useEffect(() => { const task = window.setTimeout(() => setApiUrl(readStoredApiBase()), 0); return () => window.clearTimeout(task); }, []);

  const requests = useMemo(() => splitRoomRequests(query), [query]);
  const ready = requests.every((request) => request.ready);

  const onGenerate = async () => {
    setError(null);
    setPending(null);
    setPlacementNote(null);
    if (!ready) {
      setError(requests[0]?.note || "Name each room and its furniture.");
      return;
    }
    const plan = composeRoomFrames(
      requests,
      canonicalBoundary && canonicalBoundary.length >= 3 ? { polygon: canonicalBoundary } : undefined,
    );
    if (!plan) {
      setError("Name each room and its furniture.");
      return;
    }
    setBusy(true);
    try {
      storeApiBase(apiUrl);
      const furniture: SpatialFurniture[] = [];
      const boundary = canonicalBoundary && canonicalBoundary.length >= 3 ? canonicalBoundary : plan.boundary;
      const openings = placeOpenings(plan.walls, boundary, requests);
      const fixedObstacles = [
        ...plan.walls.map(wallToObstacleFootprint),
        ...openings.filter((door) => door.name !== "Window").map(doorToObstacleFootprint),
      ];
      for (let index = 0; index < plan.framed.length; index += 1) {
        const room = plan.framed[index];
        setStatus(`Generating ${room.name} (${index + 1} of ${plan.framed.length})…`);
        const scene = await generateM3DLayout(apiUrl, room.prompt, seed + index);
        const modeled = sceneToFurniture(scene, room.frame, room.id);
        if (modeled.length === 0) {
          throw new Error(`Colab returned no usable furniture boxes for ${room.name}. The plan was not changed.`);
        }
        const roomGeometry = plan.rooms.find((candidate) => candidate.id === room.id);
        const placed = placeModelFurniture(modeled, room.frame, {
          roomBoundary: roomGeometry?.polygon,
          fixedObstacles,
        });
        if (placed.unplaced.length > 0) {
          throw new Error(`${room.name}: ${placed.unplaced.length} of ${modeled.length} model objects cannot fit without overlap. Nothing was applied. Try fewer items or a larger room.`);
        }
        furniture.push(...placed.furniture);
      }
      if (furniture.length === 0) {
        setError("The model answered, but none of the boxes could be placed.");
        return;
      }
      setPending({ ...plan, furniture, openings });
      setPlacementNote("Colab model positions were used and validated for collisions. Review the generated rooms before applying.");
      setStatus(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Layout generation failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const onAccept = () => {
    if (!pending) return;
    const outline = canonicalBoundary && canonicalBoundary.length >= 3 ? canonicalBoundary : null;
    applyGeneratedPlan({
      furniture: pending.furniture,
      rooms: pending.rooms,
      walls: outline ? pending.walls.filter((wall) => !wall.isExterior) : pending.walls,
      boundary: outline ?? pending.boundary,
      doors: pending.openings,
    });
    setPending(null);
  };

  return (
    <section className="mb-5 rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] p-3 space-y-2">
      <div>
        <h2 className="text-xs font-bold text-[#0B514B] uppercase tracking-wider">Generate layout</h2>
        <p className="text-[11px] text-[#647078] leading-snug mt-1">
          Rooms use your traced outline. Furniture positions come from the Colab model and are checked for overlap before they can be applied. If the model cannot fit every object, no layout is applied. Review all positions manually before safety analysis.
        </p>
      </div>

      <label className="block text-[11px] text-[#647078]">
        Colab API URL
        <input
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value)}
          placeholder="https://your-subdomain.ngrok-free.app"
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-[#E2E6E8] bg-white px-2 py-1.5 text-xs text-[#17252B]"
        />
      </label>

      <label className="block text-[11px] text-[#647078]">
        What should the rooms contain?
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={4}
          className="mt-1 w-full resize-y rounded-lg border border-[#E2E6E8] bg-white px-2 py-1.5 text-xs text-[#17252B]"
        />
      </label>

      <label className="block text-[11px] text-[#647078]">
        Seed
        <input
          type="number"
          value={seed}
          onChange={(event) => setSeed(Number(event.target.value) || 0)}
          className="mt-1 w-20 rounded-lg border border-[#E2E6E8] bg-white px-2 py-1.5 text-xs text-[#17252B]"
        />
      </label>

      <div className="space-y-1.5">
        {requests.map((request, index) => (
          <p key={`${request.roomType}-${index}`} className="text-[11px] text-[#17252B] leading-snug">
            <span className="font-semibold">{request.roomType || "Room"}. </span>
            {request.ready ? request.prompt : request.note}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={busy || !ready}
        className="w-full py-1.5 px-2 bg-[#0B514B] hover:bg-[#083f3a] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {busy ? status || "Generating on Colab…" : "Generate layout"}
      </button>

      {placementNote && <p className="text-[11px] text-[#0B514B]">{placementNote}</p>}

      {pending && (
        <div className="rounded-lg border border-[#E2E6E8] bg-white p-2 space-y-2">
          <p className="text-[11px] font-semibold text-[#17252B]">
            {pending.rooms.length} room frames, {pending.furniture.length} objects
          </p>
          <ul className="max-h-28 overflow-y-auto text-[11px] text-[#647078] space-y-0.5">
            {pending.rooms.map((room) => (
              <li key={room.id}>
                {room.name} · {pending.furniture.filter((item) => item.roomId === room.id).length} objects
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onAccept}
            className="w-full py-1.5 px-2 border border-[#0B514B] bg-[#F0F5F4] text-[#0B514B] rounded-lg text-xs font-semibold cursor-pointer"
          >
            Add room frames
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-amber-900 leading-snug">
          {error}
        </p>
      )}
    </section>
  );
}
