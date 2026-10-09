"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import {
  FileText,
  ChevronLeft,
  Clock,
} from "lucide-react";

export function Stage5Improve() {
  const {
    assessmentType,
    assessmentMetadata,
    loadDemoAssessment,
    setReportModalOpen,
    setStage,
    getSpatialFindings,
  } = useSafeSpaceStore();

  const evaluation = getSpatialFindings();
  const { summary } = evaluation;
  const isUserAssessment = assessmentType === "user";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#f7f8f6]">
      {/* Top Stage 5 Toolbar */}
      <div className="h-10 bg-white border-b border-[#e2e8e4] px-3.5 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1e7168]">
            Stage 5 · Layout Alternatives
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500">
            {isUserAssessment
              ? assessmentMetadata?.facilityName || "Custom Assessment"
              : "Queen Care Clinic Fixture"}
          </span>
        </div>
        <button
          onClick={() => setReportModalOpen(true)}
          className="px-2.5 py-1 rounded bg-[#1e7168] text-white text-xs font-semibold hover:bg-[#175b54] transition cursor-pointer flex items-center gap-1 shadow-xs"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>View Summary Report</span>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-lg w-full bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-[#1e7168]">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Pending Gate 3 Delivery
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-2">
              Layout Alternatives & Optimization
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Automated layout alternatives, iterative furniture repositioning, and cost-benefit scheduling are scheduled for Gate 3 delivery. Live evaluation for this space is provided deterministically in Stage 4 Evidence Findings without synthetic risk scores or unvalidated optimizer claims.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-left text-xs font-mono space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Active Space:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[240px]">
                {evaluation.sceneLabel}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Route Status:</span>
              <span className="font-semibold text-slate-800">
                {summary.overallStatusLabel}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Narrowest Clearance:</span>
              <span
                className={`font-semibold ${
                  summary.minimumClearanceCm !== null &&
                  summary.requiredClearanceRadiusCm !== null &&
                  summary.minimumClearanceCm >= summary.requiredClearanceRadiusCm
                    ? "text-emerald-700"
                    : summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0
                    ? "text-red-700"
                    : "text-slate-400"
                }`}
              >
                {summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0
                  ? `${summary.minimumClearanceCm} cm`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Actionable Deficits:</span>
              <span
                className={`font-semibold ${
                  summary.actionableDeficitsCount > 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {summary.actionableDeficitsCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Unassessed Scope:</span>
              <span className="font-semibold text-slate-600">
                {summary.unassessedScopeCount} categories
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => setStage("analysis")}
              className="w-full py-2 px-3 bg-[#1e7168] text-white rounded-lg text-xs font-semibold hover:bg-[#185e56] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Evidence Findings (Stage 4)</span>
            </button>
            <button
              onClick={() => setStage("routes")}
              className="w-full py-1.5 px-3 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
            >
              Inspect Route Clearance (Stage 3)
            </button>
            {isUserAssessment && (
              <button
                onClick={loadDemoAssessment}
                className="w-full py-1.5 px-3 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Switch to Demo Clinic Scenario
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
