"use client";

import React from "react";
import Link from "next/link";
import { useSafeSpaceStore, type WorkflowStage } from "@/store/safespace-store";
import {
  Check,
  ChevronRight,
} from "lucide-react";
import { Tooltip } from "@/components/ui";

const STAGES: { id: WorkflowStage; label: string; stepNumber: number }[] = [
  { id: "layout", label: "Layout", stepNumber: 1 },
  { id: "profile", label: "Profile", stepNumber: 2 },
  { id: "routes", label: "Routes", stepNumber: 3 },
  { id: "analysis", label: "Analysis", stepNumber: 4 },
  { id: "improve", label: "Improve", stepNumber: 5 },
];

export function TopAppBar() {
  const {
    activeStage,
    setStage,
    assessmentType,
    assessmentMetadata,
    storageStatus,
  } = useSafeSpaceStore();

  const currentStageIndex = STAGES.findIndex((s) => s.id === activeStage);
  const isUserAssessment = assessmentType === "user";

  return (
    <header className="h-14 border-b border-[#e2e8e4] bg-[#ffffff] px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand & Assessment Context */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#1e7168] flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
            S
          </div>
          <span className="font-bold text-[#192329] tracking-tight text-base">
            SafeSpace
          </span>
        </Link>

        <span className="text-[#cbd5e1] font-light">/</span>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1e293b]">
            {assessmentMetadata?.facilityName || "Custom Assessment"}
          </span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
            {isUserAssessment ? "Saved Assessment" : "Workspace"}
          </span>
          <span className="text-[#94a3b8] text-xs hidden lg:inline">·</span>
          <span className="text-xs text-[#64748b] hidden lg:inline">
            {assessmentMetadata?.spaceName || "Calibrated Room"}
          </span>
        </div>

        <Tooltip
          position="bottom"
          label={
            storageStatus === "saved"
              ? "Saved locally on this device. Retained if you refresh."
              : "Changes stay in memory. Finish assessment or edit to save."
          }
        >
          <div className="hidden lg:flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-[#f1f5f3] border border-[#e2e8e4] text-[11px] text-[#475569] cursor-help">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                storageStatus === "saved"
                  ? "bg-emerald-600"
                  : storageStatus === "error" || storageStatus === "quota_exceeded"
                  ? "bg-red-600"
                  : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            <span className="font-medium">
              {storageStatus === "saved" ? "Saved on device" : "Unsaved changes"}
            </span>
          </div>
        </Tooltip>
      </div>

      {/* 5-Step Progress Stepper Indicator */}
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Assessment stages">
        {STAGES.map((s, idx) => {
          const isCurrent = s.id === activeStage;
          const isPassed = idx < currentStageIndex;

          return (
            <button
              key={s.id}
              onClick={() => setStage(s.id)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Step ${s.stepNumber}: ${s.label}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1e7168] ${
                isCurrent
                  ? "bg-[#e8f3f1] text-[#1e7168] ring-1 ring-[#1e7168]/20 font-semibold"
                  : isPassed
                  ? "text-[#334155] hover:bg-[#f1f5f9]"
                  : "text-[#94a3b8] hover:text-[#64748b]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCurrent
                    ? "bg-[#1e7168] text-white"
                    : isPassed
                    ? "bg-[#cbd5e1] text-[#334155]"
                    : "border border-[#cbd5e1] text-[#94a3b8]"
                }`}
              >
                {isPassed ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : s.stepNumber}
              </span>
              <span className="hidden lg:inline">{s.label}</span>
              {idx < STAGES.length - 1 && (
                <ChevronRight className="w-3 h-3 text-[#cbd5e1] ml-1 hidden lg:inline" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Quick Controls */}
      <div className="flex items-center gap-2">
        <Link
          href="/assessments/new"
          className="text-xs text-[#1e7168] hover:bg-[#f0f7f5] px-2.5 py-1 rounded-md border border-[#1e7168]/30 font-medium transition flex items-center gap-1 cursor-pointer"
        >
          <span>+ New Assessment</span>
        </Link>

        <Link
          href="/assessments"
          className="text-xs text-[#64748b] hover:text-[#1e7168] px-2.5 py-1 rounded-md border border-transparent hover:border-[#cbd5e1] hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
        >
          <span>All assessments</span>
        </Link>
      </div>
    </header>
  );
}
