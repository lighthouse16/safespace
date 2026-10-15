"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { generateM3DLayout, readStoredApiBase, storeApiBase } from "@/lib/m3dlayout/client";
import { translateUserQuery } from "@/lib/m3dlayout/prompt-agent";
import { layoutFrameFromWorkspace, sceneToFurniture } from "@/lib/m3dlayout/scene-adapter";

export function GenerateLayoutPanel() {
  const rooms = useSafeSpaceStore((state) => state.rooms);
  const canonicalBoundary = useSafeSpaceStore((state) => state.canonicalBoundary);
  const replaceFurnitureLayout = useSafeSpaceStore((state) => state.replaceFurnitureLayout);
  const [apiUrl, setApiUrl] = useState("");
  const [query, setQuery] = useState("a living room with a sofa, a coffee table, and a television");
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentPrompt, setSentPrompt] = useState<string | null>(null);

  useEffect(() => {
    setApiUrl(readStoredApiBase());
  }, []);

  const translation = useMemo(() => translateUserQuery(query), [query]);

  const onGenerate = async () => {
    setError(null);
    setSentPrompt(null);
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
      replaceFurnitureLayout(furniture);
      setSentPrompt(translation.prompt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Layout generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border border-[#d5e6e2] bg-[#f4faf8] rounded-lg p-2.5 space-y-2">
      <div>
        <h2 className="text-[11px] font-semibold text-[#1e7168] uppercase tracking-wider">
          Generate layout
        </h2>
        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
          A prompt agent rewrites your sentence into the description style M3DLayout was trained on, then asks the Colab model for furniture boxes.
        </p>
      </div>

      <label className="block text-[10px] text-slate-500">
        Colab API URL
        <input
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value)}
          placeholder="https://your-subdomain.ngrok-free.app"
          spellCheck={false}
          className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800"
        />
      </label>

      <label className="block text-[10px] text-slate-500">
        What should the room contain?
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          className="mt-0.5 w-full resize-y rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800"
        />
      </label>

      <label className="block text-[10px] text-slate-500">
        Seed
        <input
          type="number"
          value={seed}
          onChange={(event) => setSeed(Number(event.target.value) || 0)}
          className="mt-0.5 w-20 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800"
        />
      </label>

      <p className="text-[10px] text-slate-600 leading-snug">
        <span className="font-semibold text-slate-700">Model prompt. </span>
        {translation.ready ? translation.prompt : translation.note}
      </p>

      <button
        type="button"
        onClick={onGenerate}
        disabled={busy || !translation.ready}
        className="w-full py-1.5 px-2 bg-[#1e7168] hover:bg-[#185e56] disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {busy ? "Generating on Colab…" : "Generate layout"}
      </button>

      {translation.ready && (
        <p className="text-[10px] text-slate-500 leading-snug">{translation.note}</p>
      )}
      {sentPrompt && !error && (
        <p className="text-[10px] text-teal-800 leading-snug">
          Placed the model result. Confirm each object before continuing.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[10px] text-amber-900 leading-snug">
          {error}
        </p>
      )}
    </section>
  );
}
