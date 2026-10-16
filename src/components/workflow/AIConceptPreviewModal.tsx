"use client";

import React, { useState, useMemo } from "react";
import { X, Sparkles, AlertCircle, ShieldAlert, Image as ImageIcon, Loader2 } from "lucide-react";
import { requestInteriorVisualization } from "@/lib/services/gemini-gateway-client";
import type { SpatialFurniture, SpatialRoom } from "@/lib/spatial-model";

interface AIConceptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  layoutTitle: string;
  furniture: SpatialFurniture[];
  rooms: SpatialRoom[];
  isAlternative?: boolean;
}

// Scene fingerprint cache to avoid duplicate expensive model calls
const imageCacheByFingerprint = new Map<string, {
  base64: string;
  mimeType: string;
  model: string;
  disclaimer: string;
  timestamp: string;
}>();

export function AIConceptPreviewModal({
  isOpen,
  onClose,
  layoutTitle,
  furniture,
  rooms,
  isAlternative = false,
}: AIConceptPreviewModalProps) {
  const [modelTier, setModelTier] = useState<"standard" | "premium">("standard");
  const [userConsent, setUserConsent] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute layout fingerprint based on furniture IDs, positions, and categories
  const fingerprint = useMemo(() => {
    const sorted = [...furniture].sort((a, b) => a.id.localeCompare(b.id));
    return sorted.map((f) => `${f.id}:${f.category}:${Math.round(f.x)}:${Math.round(f.y)}:${f.width}:${f.depth}`).join("|");
  }, [furniture]);

  const cachedResult = imageCacheByFingerprint.get(fingerprint);
  const [activeImage, setActiveImage] = useState(cachedResult || null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!userConsent) {
      setError("Please confirm user consent to send room layout description to Google Gemini.");
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      const roomType = rooms[0]?.name || rooms[0]?.category || "Clinic & Care Space";
      const furnitureList = furniture.map((f) => ({
        name: f.name,
        category: f.category,
        widthCm: f.width,
        depthCm: f.depth,
      }));

      const res = await requestInteriorVisualization({
        userConsent: true,
        roomType,
        furnitureList,
        layoutTitle,
        isAlternative,
        isPremium: modelTier === "premium",
      });

      const result = {
        base64: res.imageBase64,
        mimeType: res.imageMimeType,
        model: res.model,
        disclaimer: res.disclaimer,
        timestamp: res.timestamp,
      };

      imageCacheByFingerprint.set(fingerprint, result);
      setActiveImage(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate concept preview";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-visual-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-[#E2E6E8] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E6E8] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-teal-50 p-2 text-[#0B514B]">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="ai-visual-title" className="text-base font-bold text-[#17252B]">
                AI Conceptual Interior Visualization
              </h2>
              <p className="text-xs text-[#647078]">
                Perspective preview for: <strong className="text-[#17252B]">{layoutTitle}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#647078] hover:bg-[#F0F3F4] hover:text-[#17252B] cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Prominent Truthfulness Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-700" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-bold text-amber-900 block">AI concept visualization — not to scale</span>
              <span>
                Conceptual artistic depiction only. Never use generated imagery to judge clearances, wheelchair turning radiuses, or regulatory compliance. All safety evaluations are computed strictly by SafeSpace&apos;s 2D deterministic spatial engine.
              </span>
            </div>
          </div>

          {/* Active Image or Generation Card */}
          {activeImage ? (
            <div className="space-y-3">
              <div className="relative rounded-xl border border-[#E2E6E8] overflow-hidden bg-slate-950 flex items-center justify-center min-h-[320px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${activeImage.mimeType};base64,${activeImage.base64}`}
                  alt="AI concept visualization of the layout"
                  className="w-full h-auto max-h-[460px] object-contain select-none"
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-md bg-black/75 text-[11px] font-bold text-white tracking-wide border border-white/20">
                    AI concept visualization — not to scale
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 text-[10px] text-slate-300">
                    Model: {activeImage.model}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#647078]">
                <span>Generated: {new Date(activeImage.timestamp).toLocaleTimeString()}</span>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerate}
                  className="text-xs text-[#0B514B] hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? "Regenerating..." : "Regenerate concept image"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFBF9] p-8 text-center space-y-4">
              <div className="mx-auto size-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#0B514B]">
                <ImageIcon size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-bold text-[#17252B]">
                  Visualize Accessible Room Concept
                </h3>
                <p className="text-xs text-[#647078] leading-relaxed">
                  Sends current spatial layout metadata ({furniture.length} fixtures, room boundary) to Gemini to produce an architectural interior visualization (target 1K resolution).
                </p>
              </div>

              {/* Controls */}
              <div className="max-w-xs mx-auto space-y-3 pt-2 text-left">
                <label className="block text-xs font-medium text-[#17252B]">
                  Model Quality
                  <select
                    value={modelTier}
                    onChange={(e) => setModelTier(e.target.value as "standard" | "premium")}
                    className="mt-1 w-full rounded-lg border border-[#E2E6E8] bg-white px-2.5 py-1.5 text-xs text-[#17252B]"
                  >
                    <option value="standard">gemini-3.1-flash-lite-image (1K Standard, Cost-Efficient)</option>
                    <option value="premium">gemini-3.1-flash-image (Premium Quality)</option>
                  </select>
                </label>

                <label className="flex items-start gap-2 text-xs text-[#647078] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userConsent}
                    onChange={(e) => setUserConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#0B514B] focus:ring-[#0B514B]"
                  />
                  <span>
                    I consent to processing layout furniture descriptions through Google Gemini.
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !userConsent}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B514B] hover:bg-[#083E39] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Rendering concept...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate AI concept visualization</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <span className="font-bold block">Concept Preview Unavailable</span>
                <span className="leading-relaxed block">{error}</span>
                {error.includes("quota") && (
                  <span className="text-[11px] text-rose-700 block mt-1">
                    Tip: Google AI Studio Free Tier keys have 0 daily requests for image models. Attach billing to your Gemini API project to enable visual generation. All CAD spatial safety features remain fully functional.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E2E6E8] shrink-0 flex items-center justify-between text-xs text-[#647078]">
          <span>SafeSpace Spatial Assistant</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-1.5 font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
