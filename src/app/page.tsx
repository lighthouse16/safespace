"use client";

import React, { useEffect } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { TopAppBar } from "@/components/workflow/TopAppBar";
import { Stage1Layout } from "@/components/workflow/Stage1Layout";
import { Stage2Profile } from "@/components/workflow/Stage2Profile";
import { Stage3Routes } from "@/components/workflow/Stage3Routes";
import { Stage4Analysis } from "@/components/workflow/Stage4Analysis";
import { Stage5Improve } from "@/components/workflow/Stage5Improve";
import { AnalysisTransition } from "@/components/workflow/AnalysisTransition";
import { ReportModal } from "@/components/workflow/ReportModal";

export default function SafeSpaceApp() {
  const { activeStage, hydrateFromStorage } = useSafeSpaceStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f7f8f6] text-[#192329] font-sans antialiased">
      {/* Top Application Bar */}
      <TopAppBar />

      {/* Main Workspace Area (Dynamic per 5-Stage Stepper) */}
      <div className="flex-1 overflow-hidden relative">
        {activeStage === "layout" && <Stage1Layout />}
        {activeStage === "profile" && <Stage2Profile />}
        {activeStage === "routes" && <Stage3Routes />}
        {activeStage === "analysis" && <Stage4Analysis />}
        {activeStage === "improve" && <Stage5Improve />}
      </div>

      {/* 2-Second Transition Modal between Routes and Analysis */}
      <AnalysisTransition />

      {/* Executive Report Preview Modal */}
      <ReportModal />
    </div>
  );
}
