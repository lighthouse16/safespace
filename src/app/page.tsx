"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { TopAppBar } from "@/components/workflow/TopAppBar";
import { Stage1Layout } from "@/components/workflow/Stage1Layout";
import { Stage2Profile } from "@/components/workflow/Stage2Profile";
import { Stage3Routes } from "@/components/workflow/Stage3Routes";
import { Stage4Analysis } from "@/components/workflow/Stage4Analysis";
import { Stage5Improve } from "@/components/workflow/Stage5Improve";
import { AnalysisTransition } from "@/components/workflow/AnalysisTransition";
import { ReportModal } from "@/components/workflow/ReportModal";
import {
  loadPersistedAssessment,
  loadActiveWorkspace,
  saveActiveWorkspace,
  type PersistedAssessmentState,
} from "@/lib/storage/persistence";
import {
  ArrowRight,
  ShieldCheck,
  FolderOpen,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";

export default function SafeSpaceApp() {
  const { activeStage, assessmentType, hydrateFromStorage } = useSafeSpaceStore();
  const [persistedAssessment, setPersistedAssessment] = useState<PersistedAssessmentState | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  useEffect(() => {
    const active = loadActiveWorkspace();
    const stored = loadPersistedAssessment();
    if (stored.success && stored.data.assessmentType === "user") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPersistedAssessment(stored.data);
      if (active === "user") {
        hydrateFromStorage();
      }
    } else {
      setPersistedAssessment(null);
    }
    setIsClientLoaded(true);
  }, [hydrateFromStorage]);

  const handleOpenSaved = () => {
    saveActiveWorkspace("user");
    hydrateFromStorage();
  };

  // If user assessment is currently active in store, show spatial workspace
  const showWorkspace = isClientLoaded && assessmentType === "user";

  if (!isClientLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f7f8f6]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1e7168] border-t-transparent" />
      </div>
    );
  }

  if (showWorkspace) {
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

  // Fresh visitor onboarding & landing hero
  return (
    <div className="min-h-screen w-screen bg-[#f7f8f6] text-[#192329] flex flex-col font-sans antialiased">
      {/* Simple Header */}
      <header className="h-14 border-b border-[#e2e8e4] bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#1e7168] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            S
          </div>
          <span className="font-bold text-[#192329] tracking-tight text-base">
            SafeSpace
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500 font-medium">
            Walking-Space & Accessibility Assessment
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/assessments"
            className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded transition"
          >
            Assessments
          </Link>
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e7168] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#175b54] transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ New Assessment</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        {/* Saved Assessment Banner if present */}
        {persistedAssessment && (
          <div className="mb-8 rounded-xl border border-emerald-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Saved on this device
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {persistedAssessment.metadata?.facilityName || "Custom Facility"}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-600">
                  {persistedAssessment.metadata?.spaceName || "Room"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Calibrated scale ({persistedAssessment.calibration?.pixelsPerCm.toFixed(1)} px/cm) · {persistedAssessment.furniture.length} fixtures · {persistedAssessment.routeWaypoints.length} path points
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenSaved}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e7168] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175b54] transition cursor-pointer shadow-xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open saved assessment &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* Hero Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200/60 px-3 py-1 text-xs font-medium text-teal-800 mb-6">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Deterministic Spatial Clearance Audits</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 max-w-xl mx-auto">
            Check your space
          </h1>

          <p className="mt-4 text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Assess walking-space constraints, fall risks, and clearance along critical routes for walkers and wheelchairs. Real geometric measurements from your own floorplan.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/assessments/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e7168] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#175b54] transition cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/assessments"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <span>View all assessments</span>
            </Link>
          </div>

          {/* 3-Step Process Summary */}
          <div className="mt-12 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                1
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Import & Calibrate
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload a floorplan image or sketch boundaries manually, then calibrate scale with one known measurement.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                2
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Path & Clearance Audit
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Position furniture, choose mobility profiles (walker, wheelchair, cane), and trace transit corridors.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                3
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Improve & Report
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Evaluate layout modifications to eliminate pinches, review exact movements, and generate reports.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <p className="mt-8 text-center text-xs text-slate-400">
          All data is processed and stored strictly on this device in local browser storage. No cloud uploads or external telemetry.
        </p>
      </main>
    </div>
  );
}
