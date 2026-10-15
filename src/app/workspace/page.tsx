"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { AppShell } from "@/components/shell";
import { TopAppBar } from "@/components/workflow/TopAppBar";
import { Stage1Layout } from "@/components/workflow/Stage1Layout";
import { Stage2Profile } from "@/components/workflow/Stage2Profile";
import { Stage3Routes } from "@/components/workflow/Stage3Routes";
import { Stage4Analysis } from "@/components/workflow/Stage4Analysis";
import { Stage5Improve } from "@/components/workflow/Stage5Improve";
import { AnalysisTransition } from "@/components/workflow/AnalysisTransition";
import { ReportModal } from "@/components/workflow/ReportModal";
import { loadActiveWorkspace } from "@/lib/storage/persistence";

export default function WorkspacePage() {
  const { activeStage, assessmentType, assessmentMetadata, hydrateFromStorage } = useSafeSpaceStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loadActiveWorkspace() === "user") hydrateFromStorage();
    // Browser storage is unavailable during server render; release loading only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true);
  }, [hydrateFromStorage]);

  if (!loaded) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-[#647078]">
        Opening workspace…
      </div>
    );
  }

  if (assessmentType !== "user") {
    return (
      <AppShell activePath="/workspace">
        <div className="mx-auto flex max-w-xl flex-col justify-center gap-4 py-16">
          <h1 className="text-2xl font-bold text-[#17252B]">No assessment open</h1>
          <p className="text-[#647078]">
            Open your saved assessment or create a new one to use the spatial workspace.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/assessments"
              className="rounded-lg bg-[#0B514B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#073D38]"
            >
              View assessments
            </Link>
            <Link
              href="/assessments/new"
              className="rounded-lg border border-[#E2E6E8] bg-white px-4 py-2.5 text-sm font-medium text-[#17252B] hover:bg-[#F7F8F8]"
            >
              Create assessment
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      activePath="/assessments"
      facilityName={null}
      assessmentName={assessmentMetadata?.name || null}
      spaceName={assessmentMetadata?.spaceName || null}
      showCurrentAssessment={activeStage === "layout"}
      fullHeight={true}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">
        <TopAppBar />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {activeStage === "layout" && <Stage1Layout />}
          {activeStage === "profile" && <Stage2Profile />}
          {activeStage === "routes" && <Stage3Routes />}
          {activeStage === "analysis" && <Stage4Analysis />}
          {activeStage === "improve" && <Stage5Improve />}
        </div>
        <AnalysisTransition />
        <ReportModal />
      </div>
    </AppShell>
  );
}
