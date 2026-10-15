"use client";

import React, { useState } from "react";
import { X, Sparkles, Check, ShieldCheck } from "lucide-react";
import type { InterpretedElementCandidate } from "@/lib/server/ai/floorplan-interpreter";
export type { InterpretedElementCandidate };

export interface AIInterpretationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: InterpretedElementCandidate[];
  onAccept: (accepted: InterpretedElementCandidate[]) => void;
  isLoading?: boolean;
}

export function AIInterpretationReviewModal({
  isOpen,
  onClose,
  candidates,
  onAccept,
  isLoading = false,
}: AIInterpretationReviewModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.id))
  );

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const accepted = candidates.filter((c) => selectedIds.has(c.id));
    onAccept(accepted);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-[#E2E6E8] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E6E8] shrink-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-teal-50 p-2 text-[#0B514B]">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="ai-review-title" className="text-base font-bold text-[#17252B]">
                Review AI-Detected Floorplan Elements
              </h2>
              <p className="text-xs text-[#647078]">
                Gemini detected {candidates.length} candidate objects. Review and select items to add to your layout.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#647078] hover:bg-[#F0F3F4] hover:text-[#17252B]"
            aria-label="Close review dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Human-in-the-loop notice */}
        <div className="mt-3 shrink-0 flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-900">
          <ShieldCheck size={16} className="shrink-0 mt-0.5 text-[#0B514B]" />
          <span>
            <strong>Human Verification Required:</strong> AI assists in digitizing visible floorplan objects.
            You have full control to approve, modify, or reject any element before it enters your safety assessment.
          </span>
        </div>

        {/* Controls */}
        <div className="mt-4 shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#647078]">
            <span>{selectedIds.size} of {candidates.length} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[#0B514B] hover:underline font-medium"
            >
              Select all
            </button>
            <span className="text-[#CBD5E1]">·</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-[#647078] hover:underline"
            >
              Deselect all
            </button>
          </div>
        </div>

        {/* Candidate List */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {candidates.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#647078]">
              No elements detected in the provided floorplan image.
            </div>
          ) : (
            candidates.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? "border-[#0B514B] bg-[#F0F7F6]"
                      : "border-[#E2E6E8] bg-white hover:bg-[#F7F8F8]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded flex items-center justify-center border transition ${
                        isSelected
                          ? "bg-[#0B514B] border-[#0B514B] text-white"
                          : "border-[#CBD5E1] bg-white"
                      }`}
                    >
                      {isSelected && <Check size={14} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#17252B]">{item.name}</span>
                        <span className="rounded-md bg-[#E2E6E8] px-1.5 py-0.5 text-[10px] uppercase font-bold text-[#647078]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#647078]">
                        Dimensions: ~{item.width} × {item.depth} cm · Confidence: {Math.round(item.confidence * 100)}%
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-[#E2E6E8] shrink-0 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || isLoading}
            onClick={handleConfirm}
            className="rounded-xl bg-[#0B514B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083E39] transition disabled:opacity-50"
          >
            {isLoading
              ? "Applying..."
              : `Add ${selectedIds.size} Selected ${selectedIds.size === 1 ? "Element" : "Elements"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
