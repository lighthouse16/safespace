"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { generateM3DLayout, readStoredApiBase, storeApiBase } from "@/lib/m3dlayout/client";
import { splitRoomRequests } from "@/lib/m3dlayout/prompt-agent";
import { composeRoomFrames, type GeneratedPlan } from "@/lib/m3dlayout/room-plan";
import { arrangeRoomFurniture } from "@/lib/m3dlayout/arrange";
import { sceneToFurniture, type LayoutFrame } from "@/lib/m3dlayout/scene-adapter";
import type { SpatialFurniture } from "@/lib/spatial-model";

type PendingPlan = GeneratedPlan & { furniture: SpatialFurniture[]; source: string };

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setApiUrl(readStoredApiBase()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const requests = useMemo(() => splitRoomRequests(query), [query]);
  const ready = requests.every((request) => request.ready);

  const onGenerate = async () => {
    setError(null);
    setPending(null);
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
      const isColabConfigured = Boolean(apiUrl.trim());
      if (isColabConfigured) {
        storeApiBase(apiUrl);
      }
      const furniture: SpatialFurniture[] = [];
      let usedModelCount = 0;

      for (let index = 0; index < plan.framed.length; index += 1) {
        const room = plan.framed[index];
        const requested = requests[index]?.pieces ?? [];

        if (isColabConfigured) {
          setStatus(`Calling M3DLayout for ${room.name} (${index + 1} of ${plan.framed.length})…`);
          try {
            const scene = await generateM3DLayout(apiUrl, room.prompt, seed + index);
            const frame: LayoutFrame = {
              roomId: room.id,
              centerX: room.rect.x + room.rect.width / 2,
              centerY: room.rect.y + room.rect.depth / 2,
              maxWidthCm: Math.max(60, room.rect.width - 20),
              maxDepthCm: Math.max(60, room.rect.depth - 20),
            };
            const modelItems = sceneToFurniture(scene, frame, room.id);
            if (modelItems.length > 0) {
              furniture.push(...modelItems);
              usedModelCount += 1;
              continue;
            }
          } catch (modelErr) {
            console.warn(`[M3DLayout] Model call failed for ${room.name}, falling back to procedural:`, modelErr);
          }
        }

        // Truthful offline procedural fallback
        setStatus(`Arranging ${room.name} procedurally (${index + 1} of ${plan.framed.length})…`);
        const arranged = arrangeRoomFurniture({
          pieces: requested,
          roomType: room.roomType,
          rect: room.rect,
          roomId: room.id,
          idPrefix: room.id,
        });
        furniture.push(...arranged);
      }

      if (furniture.length === 0) {
        setError("Could not place furniture within the given boundary.");
        return;
      }

      const sourceLabel = usedModelCount > 0
        ? `M3DLayout Diffusion Model (${usedModelCount} room${usedModelCount > 1 ? "s" : ""})`
        : "Offline Procedural Planner";

      setPending({ ...plan, furniture, source: sourceLabel });
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
    });
    setPending(null);
  };

  return (
    <section className="mb-5 rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] p-3 space-y-2">
      <div>
        <h2 className="text-xs font-bold text-[#0B514B] uppercase tracking-wider">Generate layout</h2>
        <p className="text-[11px] text-[#647078] leading-snug mt-1">
          Rooms are built from the outline you traced. A room with more furniture gets a larger share of that outline, so the living room does not swallow the plan. A sofa sits in front of the television, chairs sit around the table, and the bathtub stays on the bathroom wall.
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
        {busy ? status || "Generating layout…" : apiUrl.trim() ? "Generate with M3DLayout (Colab)" : "Generate layout (Offline Procedural)"}
      </button>

      {pending && (
        <div className="rounded-lg border border-[#E2E6E8] bg-white p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-[#17252B]">
              {pending.rooms.length} room frames, {pending.furniture.length} objects
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-50 text-[#0B514B] border border-teal-200">
              {pending.source}
            </span>
          </div>
          <ul className="max-h-28 overflow-y-auto text-[11px] text-[#647078] space-y-0.5">
            {pending.rooms.map((room) => (
              <li key={room.id}>
                {room.name} · {pending.furniture.filter((item) => item.roomId === room.id).length} objects
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="flex-1 py-1.5 px-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 py-1.5 px-2 border border-[#0B514B] bg-[#F0F5F4] text-[#0B514B] hover:bg-teal-100 rounded-lg text-xs font-semibold cursor-pointer transition"
            >
              Apply proposal
            </button>
          </div>
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
