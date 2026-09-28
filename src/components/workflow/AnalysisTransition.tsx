"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  "Reading spatial structure & room boundaries",
  "Checking walker route clearance envelopes",
  "Testing door-swing access zones & egress clearances",
  "Identifying photometric & environmental trip hazards",
  "Synthesizing recommendations for professional review",
];

export function AnalysisTransition() {
  const { isTransitioning, transitionStep } = useSafeSpaceStore();

  if (!isTransitioning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8e4] p-6 max-w-md w-full space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-lg bg-[#e8f3f1] text-[#1e7168] flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Running Environmental Safety Analysis
            </h3>
            <p className="text-xs text-slate-500">
              Evaluating Queen Care Clinic against configured walker profile
            </p>
          </div>
        </div>

        {/* Step-by-step technical progression */}
        <div className="space-y-3">
          {STEPS.map((step, idx) => {
            const isDone = idx < transitionStep;
            const isCurrent = idx === transitionStep;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 text-xs transition duration-200 ${
                  isDone
                    ? "text-[#1e7168] font-medium"
                    : isCurrent
                    ? "text-slate-900 font-semibold"
                    : "text-slate-400"
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1e7168]" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1e7168] animate-ping" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  )}
                </div>
                <span>{step}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#1e7168] h-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, (transitionStep + 1) * 20)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
