"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useSafeSpaceStore, type WorkflowStage } from "@/store/safespace-store";

const stages: { id: WorkflowStage; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "profile", label: "Profile" },
  { id: "routes", label: "Routes" },
  { id: "analysis", label: "Analysis" },
  { id: "improve", label: "Improve" },
];

export function TopAppBar() {
  const {
    activeStage,
    setStage,
    assessmentMetadata,
    mediaCleanupWarning,
    retryPendingMediaCleanup,
    clearMediaCleanupWarning,
  } = useSafeSpaceStore();
  const [retrying, setRetrying] = useState(false);

  const activeIndex = stages.findIndex((s) => s.id === activeStage);

  const title = assessmentMetadata?.name || "Unit A12 accessibility review";
  const facility = assessmentMetadata?.facilityName || "Harbor View Residence";
  const space = assessmentMetadata?.spaceName || "Living room & corridor";

  return (
    <header className="shrink-0 bg-white border-b border-[#E2E6E8] px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
      {mediaCleanupWarning && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950"
        >
          <span>{mediaCleanupWarning}</span>
          <button
            type="button"
            disabled={retrying}
            className="font-semibold underline cursor-pointer"
            onClick={async () => {
              setRetrying(true);
              try {
                await retryPendingMediaCleanup();
              } finally {
                setRetrying(false);
              }
            }}
          >
            {retrying ? "Retrying…" : "Retry cleanup"}
          </button>
          <button
            type="button"
            className="font-semibold underline cursor-pointer"
            onClick={clearMediaCleanupWarning}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* Row 1: Assessment identity */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17252B] truncate">
              {title}
            </h1>
            <p className="mt-0.5 text-xs text-[#647078] truncate">
              <span>{facility}</span>
              <span className="mx-2">·</span>
              <span>{space}</span>
            </p>
          </div>
        </div>

        {/* Row 2: 5-Stage Stepper spanning full width */}
        <nav
          aria-label="Assessment stages"
          className="w-full overflow-x-auto no-scrollbar py-0.5"
        >
          <ol className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3.5 min-w-max">
            {stages.map((stage, index) => {
              const isCompleted = index < activeIndex;
              const isCurrent = index === activeIndex;

              return (
                <li key={stage.id} className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3.5">
                  <button
                    type="button"
                    onClick={() => setStage(stage.id)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`${stage.label}${
                      isCompleted ? " (completed)" : isCurrent ? " (current step)" : ""
                    }`}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold transition cursor-pointer hover:opacity-80"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        isCompleted || isCurrent
                          ? "bg-[#0B514B] text-white"
                          : "bg-[#F0F3F4] text-[#647078]"
                      }`}
                    >
                      {isCompleted ? (
                        <Check size={12} strokeWidth={3} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={
                        isCurrent
                          ? "text-[#17252B] font-bold"
                          : isCompleted
                          ? "text-[#17252B] font-medium"
                          : "text-[#647078]"
                      }
                    >
                      {stage.label}
                    </span>
                  </button>

                  {index < stages.length - 1 && (
                    <div
                      className={`h-0.5 w-2 sm:w-4 lg:w-8 shrink-0 rounded-full ${
                        index < activeIndex ? "bg-[#0B514B]" : "bg-[#E2E6E8]"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </header>
  );
}
