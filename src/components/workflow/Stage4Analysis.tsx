"use client";

import React, { useState } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";
import {
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SpatialFindingClassification } from "@/lib/spatial";
import { isCloudAccountsEnabled } from "@/lib/cloud-mode";

export function Stage4Analysis() {
  const {
    selectedFindingId,
    selectFinding,
    setStage,
    getSpatialFindings,
    setReportModalOpen,
    zoom,
    setZoom,
    layerToggles,
    toggleLayer,
    assessmentId,
    assessmentMetadata,
    activeProfile,
  } = useSafeSpaceStore();

  const evaluation = getSpatialFindings();
  const { summary, findings } = evaluation;

  const [filterClassification, setFilterClassification] = useState<
    "all" | SpatialFindingClassification
  >("all");
  const [mobileTab, setMobileTab] = useState<"canvas" | "findings">("canvas");
  const [aiExplaining, setAiExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<{
    executiveSummary: string;
    clinicalRiskNarrative: string;
    caregiverRecommendations: string[];
    disclaimer: string;
  } | null>(null);
  const [aiExplanationOpen, setAiExplanationOpen] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);

  const handleGenerateAIExplanation = async () => {
    setAiExplainError(null);
    setAiExplaining(true);
    try {
      if (!isCloudAccountsEnabled()) {
        // No model is called. Every statement is derived from the evaluator.
        const clearance = summary.minimumClearanceCm;
        setAiExplanation({
          executiveSummary: "Local spatial evaluator: " +
            String(summary.actionableDeficitsCount) + " actionable finding(s), " +
            String(summary.advisoryObservationsCount) + " advisory observation(s), and " +
            String(summary.unassessedScopeCount) + " unassessed scope item(s).",
          clinicalRiskNarrative: [
            "Based only on the drafted floorplan, route and selected mobility profile.",
            clearance === null ? "Minimum route clearance not measured." :
              "Minimum computed route clearance: " + clearance.toFixed(1) + " cm.",
            findings.length ? "Recorded findings: " +
              findings.slice(0, 5).map((f) => f.title).join("; ") + "." :
              "No evaluator findings were reported; this does not prove the space is safe.",
          ].join(" "),
          caregiverRecommendations: findings.slice(0, 4).map((f) =>
            "Review " + f.title + ": " + f.description
          ),
          disclaimer: "Automated geometry analysis, not medical advice or a certified safety inspection. Verify measurements and recommendations on site.",
        });
        setAiExplanationOpen(true);
        return;
      }
      const res = await fetch(`/api/v1/assessments/${assessmentId || "active"}/ai/explanation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userConsent: true,
          assessmentName: assessmentMetadata?.name || "Floorplan Assessment",
          profileLabel: activeProfile?.name || "Mobility Profile",
          findings: findings.map((f) => ({
            title: f.title,
            severity: f.severity,
            description: f.description,
            evidence: f.evidence?.rawEvidenceString,
          })),
          metrics: {
            actionableDeficitsCount: summary.actionableDeficitsCount,
            minimumClearanceCm: summary.minimumClearanceCm,
            routeFeasibility: summary.routeFeasibility,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Explanation generation failed");
      }

      setAiExplanation(data.explanation);
      setAiExplanationOpen(true);
    } catch (err: unknown) {
      setAiExplainError(err instanceof Error ? err.message : "Failed to generate explanation");
    } finally {
      setAiExplaining(false);
    }
  };

  const effectiveFindings = findings;
  const filteredFindings = effectiveFindings.filter((f) =>
    filterClassification === "all" ? true : f.classification === filterClassification
  );

  const displayLengthM = summary.pathLengthM !== null
    ? `${summary.pathLengthM} m`
    : "Not measured";

  const displayMinClearanceM = summary.minimumClearanceCm !== null
    ? `${(summary.minimumClearanceCm / 100).toFixed(2)} m`
    : "Not measured";

  const deficitsCount = summary.actionableDeficitsCount;
  const advisoryCount = summary.advisoryObservationsCount;
  const unassessedCount = summary.unassessedScopeCount;
  const totalFindingsCount = effectiveFindings.length;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#F7F8F8]">
      {/* Mobile view switcher */}
      <div className="flex lg:hidden border-b border-[#E2E6E8] bg-white px-3 py-1.5 justify-center gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMobileTab("canvas")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "canvas"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Clearance Map
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("findings")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            mobileTab === "findings"
              ? "bg-[#0B514B] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Findings ({filteredFindings.length})
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden p-4 lg:p-6 gap-6 relative">
        {/* Left Side: Spatial Canvas matching 09-workspace-analysis.png */}
        <main
          className={`flex-1 h-full bg-white rounded-2xl border border-[#E2E6E8] p-4 lg:p-5 shadow-xs overflow-hidden flex flex-col relative ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Canvas Top Bar matching 09-workspace-analysis.png */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-[#E2E6E8] mb-3 z-20">
            {/* Canvas layer toggles */}
            <div className="flex items-center gap-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => toggleLayer("route")}
                aria-pressed={layerToggles.route}
                className={`shrink-0 py-2 text-xs font-semibold transition cursor-pointer ${layerToggles.route ? "text-[#17252B] border-b-2 border-[#0B514B]" : "text-[#647078] hover:text-[#17252B]"}`}
              >
                Route overlay
              </button>
              <button
                type="button"
                onClick={() => toggleLayer("clearance")}
                aria-pressed={layerToggles.clearance}
                className={`shrink-0 py-2 text-xs font-semibold transition cursor-pointer ${layerToggles.clearance ? "text-[#17252B] border-b-2 border-[#0B514B]" : "text-[#647078] hover:text-[#17252B]"}`}
              >
                Clearance overlay
              </button>
              <button
                type="button"
                onClick={() => toggleLayer("hazards")}
                aria-pressed={layerToggles.hazards}
                className={`shrink-0 py-2 text-xs font-semibold transition cursor-pointer ${layerToggles.hazards ? "text-[#17252B] border-b-2 border-[#0B514B]" : "text-[#647078] hover:text-[#17252B]"}`}
              >
                Finding markers
              </button>
            </div>

            {/* Report action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E6E8] bg-white text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#647078]" />
                <span>Open report</span>
              </button>
            </div>
          </div>

          {/* Canvas Container with zoom controls */}
          <div className="flex-1 relative rounded-xl border border-[#E2E6E8] bg-white overflow-hidden shadow-2xs">
            {/* Bottom Left Zoom Controls matching 09-workspace-analysis.png */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
              <div className="flex items-center bg-white border border-[#E2E6E8] rounded-lg shadow-sm px-2 py-1 text-xs text-[#17252B]">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(zoom - 0.15, 0.4))}
                  className="p-1 hover:text-[#0B514B] cursor-pointer"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs px-2 font-medium">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(zoom + 0.15, 2.5))}
                  className="p-1 hover:text-[#0B514B] cursor-pointer"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom to 100%"
                className="px-2 py-1.5 bg-white border border-[#E2E6E8] rounded-lg shadow-sm hover:text-[#0B514B] cursor-pointer text-xs"
              >
                Reset zoom
              </button>
            </div>

            {/* Floorplan2D Canvas */}
            <Floorplan2D hideControls={true} className="w-full h-full border-0 rounded-none bg-[#FAFBF9]" />
          </div>
        </main>

        {/* Right Findings & Evaluation Panel matching 09-workspace-analysis.png */}
        <aside
          aria-label="Spatial route and boundary evaluation"
          className={`w-full lg:w-[480px] xl:w-[500px] flex flex-col justify-between z-10 shrink-0 select-none h-full overflow-hidden ${
            mobileTab === "findings" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-[#17252B] tracking-tight">
                Spatial route & boundary evaluation
              </h2>
              <p className="text-xs text-[#647078] mt-1 leading-relaxed">
                Analysis of movement routes, space clearances and accessibility risks within the assessed area.
              </p>
            </div>

            {/* 4 Metric Cards matching 09-workspace-analysis.png */}
            <div className="grid grid-cols-4 gap-2.5">
              {/* Route length */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="text-[#0B514B]">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="4" r="2" />
                    <path d="M12 7v7M9 10l3-2 3 2M10 20l2-6 2 6" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-[#17252B]">{displayLengthM}</div>
                <div className="text-[11px] text-[#647078]">Route length</div>
              </div>

              {/* Min clearance */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="text-[#0B514B]">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 3v18M20 3v18M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-[#17252B]">{displayMinClearanceM}</div>
                <div className="text-[11px] text-[#647078]">Min. clearance</div>
              </div>

              {/* Deficits */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="size-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[11px] font-bold">
                  !
                </div>
                <div className="text-lg font-bold text-[#17252B]">{deficitsCount}</div>
                <div className="text-[11px] text-[#647078]">Deficits</div>
              </div>

              {/* Unassessed */}
              <div className="p-3 rounded-xl border border-[#E2E6E8] bg-white space-y-1">
                <div className="size-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-[11px] font-bold">
                  ?
                </div>
                <div className="text-lg font-bold text-[#17252B]">{unassessedCount}</div>
                <div className="text-[11px] text-[#647078]">Unassessed</div>
              </div>
            </div>

            {/* Filter Pills matching 09-workspace-analysis.png */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterClassification("all")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "all"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                All ({totalFindingsCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterClassification("actionable-deficit")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "actionable-deficit"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                Deficits ({deficitsCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterClassification("advisory-observation")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "advisory-observation"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                Advisory ({advisoryCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterClassification("unassessed-scope")}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filterClassification === "unassessed-scope"
                    ? "bg-[#0B514B] text-white"
                    : "bg-white border border-[#E2E6E8] text-[#17252B] hover:bg-[#F7F8F8]"
                }`}
              >
                Unassessed ({unassessedCount})
              </button>
            </div>

            {/* Findings List matching 09-workspace-analysis.png */}
            <div className="space-y-2.5 max-h-[calc(100vh-27rem)] overflow-y-auto pr-1">
              {filteredFindings.length === 0 && (
                <p className="rounded-xl border border-[#E2E6E8] bg-white p-4 text-xs text-[#647078]" role="status">
                  {totalFindingsCount === 0
                    ? "No evaluator findings available for this assessment. This does not confirm the space is safe."
                    : "No findings match this filter. Other findings remain available under All."}
                </p>
              )}
              {filteredFindings.map((f) => {
                const isSelected = selectedFindingId === f.id;

                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => selectFinding(f.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "border-[#0B514B] bg-[#F0F5F4] ring-1 ring-[#0B514B]"
                        : "border-[#E2E6E8] bg-white hover:border-slate-300 hover:bg-[#FAFBF9]"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Status Icon */}
                      <div className="shrink-0 mt-0.5">
                        {f.classification === "actionable-deficit" ? (
                          <div className="size-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold">
                            !
                          </div>
                        ) : f.classification === "advisory-observation" ? (
                          <div className="size-5 flex items-center justify-center shrink-0">
                            <svg className="size-5" viewBox="0 0 20 20" fill="none">
                              <path d="M10 2L1 18h18L10 2z" fill="#F59E0B" />
                              <path d="M10 7.5v4.5M10 14.5v1" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          </div>
                        ) : (
                          <div className="size-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold">
                            ?
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-bold text-xs sm:text-sm text-[#17252B] truncate">
                          {f.title}
                        </h4>
                        <p className="text-[11px] text-[#647078] leading-tight line-clamp-2">
                          {f.description}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#647078] shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Clinical Insights Section */}
          <div className="rounded-xl border border-teal-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B514B]">
                  <Sparkles size={14} className="text-[#0B514B]" />
                  <span>{isCloudAccountsEnabled() ? "AI evidence explanation" : "Local evidence summary"}</span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAIExplanation}
                  disabled={aiExplaining}
                  className="rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-[#0B514B] hover:bg-teal-100 transition disabled:opacity-50"
                >
                  {aiExplaining
                    ? "Generating..."
                    : aiExplanation
                    ? "Regenerate"
                    : isCloudAccountsEnabled() ? "Synthesize insights" : "Summarize findings"}
                </button>
              </div>

              {aiExplainError && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  {aiExplainError}
                </div>
              )}

              {aiExplanation && (
                <div className="space-y-2 pt-1 border-t border-slate-100 text-xs text-[#17252B]">
                  <p className="font-semibold text-[11px] text-[#647078] uppercase tracking-wider">
                    Executive Summary
                  </p>
                  <p className="text-slate-800 leading-relaxed text-[11px]">
                    {aiExplanation.executiveSummary}
                  </p>
                  {aiExplanationOpen && (
                    <>
                      <p className="font-semibold text-[11px] text-[#647078] uppercase tracking-wider pt-1">
                        Spatial Evidence Review
                      </p>
                      <p className="text-slate-800 leading-relaxed text-[11px]">
                        {aiExplanation.clinicalRiskNarrative}
                      </p>
                      {aiExplanation.caregiverRecommendations.length > 0 && (
                        <>
                          <p className="font-semibold text-[11px] text-[#647078] uppercase tracking-wider pt-1">
                            Recommendations
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-800">
                            {aiExplanation.caregiverRecommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <p className="text-[10px] text-slate-400 italic pt-1">
                        {aiExplanation.disclaimer}
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setAiExplanationOpen(!aiExplanationOpen)}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#0B514B] hover:underline"
                  >
                    <span>{aiExplanationOpen ? "Show less" : "Read full spatial evidence"}</span>
                    {aiExplanationOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              )}
            </div>

            {/* Action Footer matching 09-workspace-analysis.png */}
            <div className="pt-3 shrink-0">
            <button
              type="button"
              onClick={() => setStage("improve")}
              className="w-full py-3.5 px-4 bg-[#0B514B] hover:bg-[#073D38] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <span>Continue to layout improvement</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
