"use client";

import { useState } from "react";
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
    assessmentType,
    storageStatus,
    storageError,
    remoteSyncStatus,
    remoteSyncError,
    mediaCleanupWarning,
    retryPendingMediaCleanup,
    clearMediaCleanupWarning,
  } = useSafeSpaceStore();
  const [retrying, setRetrying] = useState(false);

  const activeIndex = stages.findIndex((s) => s.id === activeStage);

  const title = assessmentMetadata?.name || "Current assessment";
  const facility = assessmentMetadata?.facilityName;
  const space = assessmentMetadata?.spaceName;

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
            {(facility || space) && (
              <p className="mt-0.5 text-xs text-[#647078] truncate">
                {facility && <span>{facility}</span>}
                {facility && space && <span className="mx-2" aria-hidden="true">·</span>}
                {space && <span>{space}</span>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
          <span
            role={storageStatus === "error" || storageStatus === "quota_exceeded" ? "alert" : "status"}
            title={storageError || undefined}
            className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-semibold ${
              storageStatus === "error" || storageStatus === "quota_exceeded"
                ? "bg-red-50 text-red-800"
                : assessmentType === "user" && storageStatus === "saved"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
            }`}
          >
            {storageStatus === "error" || storageStatus === "quota_exceeded"
              ? "Error"
              : assessmentType === "user" && storageStatus === "saved"
                ? "Saved locally"
                : assessmentType === "demo"
                  ? "Demo · Unsaved"
                  : "Unsaved"}
          </span>
          {assessmentType === "user" && remoteSyncStatus !== "idle" && (
            <span role={remoteSyncStatus === "failed" || remoteSyncStatus === "conflicted" ? "alert" : "status"}
              title={remoteSyncError || undefined}
              className={"rounded-full px-2.5 py-1 text-xs font-semibold " +
                (remoteSyncStatus === "synced" ? "bg-teal-50 text-teal-800" :
                 remoteSyncStatus === "pending" ? "bg-blue-50 text-blue-800" :
                 "bg-rose-50 text-rose-800")}>
              {remoteSyncStatus === "synced" ? "Cloud synced" :
                remoteSyncStatus === "pending" ? "Syncing" :
                remoteSyncStatus === "conflicted" ? "Sync conflict" : "Cloud incomplete"}
            </span>
          )}
          </div>
        </div>

        {/* Row 2: 5-Stage Stepper spanning full width */}
        <nav
          aria-label="Assessment stages"
          className="w-full overflow-x-auto no-scrollbar py-0.5"
        >
          <ol className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3.5 min-w-max">
            {stages.map((stage, index) => {
              const isPrior = index < activeIndex;
              const isCurrent = index === activeIndex;

              return (
                <li key={stage.id} className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3.5">
                  <button
                    type="button"
                    onClick={() => setStage(stage.id)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`${stage.label}${isCurrent ? " (current step)" : ""}`}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold transition cursor-pointer hover:opacity-80"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        isCurrent
                          ? "bg-[#0B514B] text-white"
                          : "bg-[#F0F3F4] text-[#647078]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={
                        isCurrent
                          ? "text-[#17252B] font-bold"
                          : isPrior
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
