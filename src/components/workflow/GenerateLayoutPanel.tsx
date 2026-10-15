"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { generateM3DLayout, readStoredApiBase, storeApiBase } from "@/lib/m3dlayout/client";
import { translateUserQuery } from "@/lib/m3dlayout/prompt-agent";
import { layoutFrameFromWorkspace, sceneToFurniture } from "@/lib/m3dlayout/scene-adapter";
import type { SpatialFurniture } from "@/lib/spatial-model";

export function GenerateLayoutPanel() {
  const rooms = useSafeSpaceStore((state) => state.rooms);
  const canonicalBoundary = useSafeSpaceStore((state) => state.canonicalBoundary);
  const addCustomFurnitureBatch = useSafeSpaceStore((state) => state.addCustomFurnitureBatch);
  const [apiUrl, setApiUrl] = useState("");
  const [query, setQuery] = useState("a living room with a sofa, a coffee table, and a television");
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SpatialFurniture[]>([]);

  useEffect(() => {
    setApiUrl(readStoredApiBase());
  }, []);

  const translation = useMemo(() => translateUserQuery(query), [query]);

  const onGenerate = async () => {
    setError(null);
    setPending([]);
    if (!translation.ready) {
      setError(translation.note);
      return;
    }
    setBusy(true);
    try {
      storeApiBase(apiUrl);
      const scene = await generateM3DLayout(apiUrl, translation.prompt, seed);
      const frame = layoutFrameFromWorkspace({ canonicalBoundary, rooms });
      const furniture = sceneToFurniture(scene, frame);
      if (furniture.length === 0) {
        setError("The model answered, but none of the boxes could be placed.");
        return;
      }
      setPending(furniture);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Layout generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const onAccept = () => {
    if (pending.length === 0) return;
    addCustomFurnitureBatch(pending);
    setPending([]);
  };

  return (
    <section className="mb-5 rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] p-3 space-y-2">
      <div>
        <h2 className="text-xs font-bold text-[#0B514B] uppercase tracking-wider">Generate layout</h2>
        <p className="text-[11px] text-[#647078] leading-snug mt-1">
          A prompt agent rewrites your sentence into the description style M3DLayout was trained on, then asks the Colab model for furniture boxes. Nothing is added until you accept the list.
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
        What should the room contain?
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
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

      <p className="text-[11px] text-[#17252B] leading-snug">
        <span className="font-semibold">Model prompt. </span>
        {translation.ready ? translation.prompt : translation.note}
      </p>

      <button
        type="button"
        onClick={onGenerate}
        disabled={busy || !translation.ready}
        className="w-full py-1.5 px-2 bg-[#0B514B] hover:bg-[#083f3a] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {busy ? "Generating on Colab…" : "Generate layout"}
      </button>

      {translation.ready && <p className="text-[11px] text-[#647078] leading-snug">{translation.note}</p>}

      {pending.length > 0 && (
        <div className="rounded-lg border border-[#E2E6E8] bg-white p-2 space-y-2">
          <p className="text-[11px] font-semibold text-[#17252B]">{pending.length} objects ready to add</p>
          <ul className="max-h-28 overflow-y-auto text-[11px] text-[#647078] space-y-0.5">
            {pending.map((item) => (
              <li key={item.id}>
                {item.name} · {Math.round(item.width)}×{Math.round(item.depth)} cm
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onAccept}
            className="w-full py-1.5 px-2 border border-[#0B514B] bg-[#F0F5F4] text-[#0B514B] rounded-lg text-xs font-semibold cursor-pointer"
          >
            Add to layout
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
