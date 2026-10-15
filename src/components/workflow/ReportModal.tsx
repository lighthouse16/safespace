"use client";

import React, { useEffect } from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { X, Printer, ShieldCheck, AlertCircle, ShieldAlert } from "lucide-react";
import type { SpatialEvaluationSummary } from "@/lib/spatial";
import { Floorplan2D } from "@/components/spatial/Floorplan2D";

export interface ReportStatusPresentation {
  statusLabel: string;
  isClear: boolean;
  isAmber: boolean;
  isRed: boolean;
  statusBadgeClass: string;
  deficitsBadgeLabel: string;
  deficitsBadgeClass: string;
  clearanceBadgeLabel: string;
  clearanceBadgeClass: string;
}

export function resolveReportStatus(summary: SpatialEvaluationSummary): ReportStatusPresentation {
  const isAdequate = summary.routeFeasibility === "adequate";
  const hasDeficits = summary.actionableDeficitsCount > 0;

  if (isAdequate && !hasDeficits) {
    return {
      statusLabel: "Configured route target satisfied (limited 2D scope)",
      isClear: true,
      isAmber: false,
      isRed: false,
      statusBadgeClass: "text-emerald-700",
      deficitsBadgeLabel: "No Detected Deficits (2D Scope)",
      deficitsBadgeClass: "text-emerald-700",
      clearanceBadgeLabel: "Target Satisfied (2D Scope)",
      clearanceBadgeClass: "text-emerald-700",
    };
  }

  if (summary.routeFeasibility === "unconfigured") {
    return {
      statusLabel: "Incomplete — Transit Route Unconfigured",
      isClear: false,
      isAmber: true,
      isRed: false,
      statusBadgeClass: "text-amber-700",
      deficitsBadgeLabel: "Route Unconfigured",
      deficitsBadgeClass: "text-amber-700",
      clearanceBadgeLabel: "Unconfigured",
      clearanceBadgeClass: "text-slate-500",
    };
  }

  if (summary.routeFeasibility === "invalid-geometry") {
    return {
      statusLabel: "Incomplete — Invalid Geometry / Input Validation",
      isClear: false,
      isAmber: true,
      isRed: false,
      statusBadgeClass: "text-amber-700",
      deficitsBadgeLabel: "Invalid Geometry",
      deficitsBadgeClass: "text-amber-700",
      clearanceBadgeLabel: "Invalid Geometry",
      clearanceBadgeClass: "text-amber-700",
    };
  }

  if (summary.routeFeasibility === "out-of-bounds") {
    return {
      statusLabel: "Incomplete — Waypoints Outside Room Boundary",
      isClear: false,
      isAmber: true,
      isRed: false,
      statusBadgeClass: "text-amber-700",
      deficitsBadgeLabel: "Out of Bounds",
      deficitsBadgeClass: "text-amber-700",
      clearanceBadgeLabel: "Out of Bounds",
      clearanceBadgeClass: "text-amber-700",
    };
  }

  // Clearance deficit, blocked route, or physical deficits detected
  return {
    statusLabel: hasDeficits
      ? `${summary.actionableDeficitsCount} Deficit(s) Detected`
      : "Designated Route Impassable",
    isClear: false,
    isAmber: false,
    isRed: true,
    statusBadgeClass: "text-red-700",
    deficitsBadgeLabel: "Action Required",
    deficitsBadgeClass: "text-red-600",
    clearanceBadgeLabel:
      summary.routeFeasibility === "clearance-deficit"
        ? "Clearance Deficit"
        : summary.routeFeasibility === "unreachable"
        ? "Route Blocked"
        : "Action Required",
    clearanceBadgeClass: "text-red-600",
  };
}

export function ReportModal() {
  const {
    reportModalOpen,
    setReportModalOpen,
    activeProfile,
    assessmentType,
    assessmentMetadata,
    assessmentId,
    routeWaypoints,
    calibrationProvenance,
    appliedCandidateId,
    activeOptimizationResult,
    getSpatialFindings,
  } = useSafeSpaceStore();

  useEffect(() => {
    if (!reportModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReportModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reportModalOpen, setReportModalOpen]);

  if (!reportModalOpen) return null;

  const isUserAssessment = assessmentType === "user";
  const evaluation = getSpatialFindings();
  const { summary, findings } = evaluation;
  const deficits = findings.filter((f) => f.classification === "actionable-deficit");
  const reportStatus = resolveReportStatus(summary);
  const appliedCandidate = appliedCandidateId
    ? activeOptimizationResult?.candidates.find((candidate) => candidate.id === appliedCandidateId)
    : null;
  const routeMeasured = summary.routeFeasibility === "adequate" && summary.pathLengthM !== null;
  const evaluatedAt = new Date(evaluation.evaluatedAt).toLocaleString();
  const facilityName = isUserAssessment
    ? assessmentMetadata?.facilityName || "Unnamed facility"
    : "Queen Care Clinic";
  const spaceName = isUserAssessment
    ? assessmentMetadata?.spaceName || "Unnamed space"
    : "Waiting & Consultation Corridor";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") setReportModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none print:static print:block print:bg-white print:p-0"
    >
      <style>{`@media print {
        body:has(#report-modal-title) * { visibility: hidden !important; }
        body:has(#report-modal-title) #report-printable,
        body:has(#report-modal-title) #report-printable * { visibility: visible !important; }
        #report-printable { position: absolute; left: 0; top: 0; width: 100%; max-height: none !important; overflow: visible !important; }
      }`}</style>
      <div id="report-printable" className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden print:block print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0B514B]" />
            <h2 id="report-modal-title" className="font-bold text-base text-slate-900">
              SafeSpace Assessment Summary Report
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setReportModalOpen(false)}
            aria-label="Close summary report"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B514B] print:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm print:overflow-visible print:p-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">FACILITY</span>
              <span className="font-semibold text-slate-900">
                {facilityName}{" "}
                <span className="font-normal text-[10px] text-slate-500">
                  ({isUserAssessment ? "User Assessment" : "Demo Fixture"})
                </span>
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ASSESSED SPACE</span>
              <span className="font-semibold text-slate-900">{spaceName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">MOBILITY PROFILE</span>
              <span className="font-semibold text-[#0B514B]">{activeProfile.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">EVALUATION STATUS</span>
              <span className={`font-semibold uppercase text-[11px] ${reportStatus.statusBadgeClass}`}>
                {reportStatus.statusLabel}
              </span>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <p><strong>Assessment:</strong> {assessmentMetadata?.name || (isUserAssessment ? "User assessment" : "Demo fixture")} · {isUserAssessment ? assessmentId : "Demo"}</p>
            <p><strong>Evaluated:</strong> {evaluatedAt} (local time)</p>
            <p><strong>Scope:</strong> 2D boundary, authored furniture footprints and route; {calibrationProvenance ? `calibrated from ${calibrationProvenance.realLength} ${calibrationProvenance.unit}` : "demo geometry, not site verified"}.</p>
            <p><strong>Route:</strong> {routeWaypoints.length >= 2 ? routeWaypoints.map((waypoint) => waypoint.name).join(" → ") : "Unconfigured (at least two checkpoints needed)"}</p>
            {isUserAssessment && assessmentMetadata?.environmentType && <p><strong>Environment:</strong> {assessmentMetadata.environmentType}</p>}
          </div>

          <figure className="break-inside-avoid">
            <figcaption className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Assessed floorplan · current layout</figcaption>
            <div className="h-60 print:h-[60mm]">
              <Floorplan2D readOnly hideControls overrideStage="routes" className="print:border-0" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Live floorplan preview; depicted route comes from current workspace, not a certified site survey.</p>
          </figure>

          {/* Objective Spatial Evidence Table */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              Objective 2D Spatial Evidence
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">Evaluation Parameter</th>
                    <th className="p-2.5">Measured Value</th>
                    <th className="p-2.5">Target / Benchmark</th>
                    <th className="p-2.5">Evidence Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-slate-800">
                      Minimum Route Clearance Radius
                    </td>
                    <td
                      className={`p-2.5 font-bold ${
                        routeMeasured && summary.minimumClearanceCm !== null &&
                        summary.requiredClearanceRadiusCm !== null &&
                        summary.minimumClearanceCm >= summary.requiredClearanceRadiusCm
                          ? "text-emerald-700"
                          : routeMeasured && summary.minimumClearanceCm !== null
                          ? "text-red-600"
                          : "text-slate-400"
                      }`}
                    >
                      {routeMeasured && summary.minimumClearanceCm !== null
                        ? `${summary.minimumClearanceCm} cm`
                        : "Not measured"}
                    </td>
                    <td className="p-2.5 text-slate-600 font-sans">
                      {summary.requiredClearanceRadiusCm !== null
                        ? `≥ ${summary.requiredClearanceRadiusCm} cm radius (${summary.corridorWidthCm} cm corridor)`
                        : "Unconfigured"}
                    </td>
                    <td className="p-2.5 font-sans font-semibold">
                      <span className={reportStatus.clearanceBadgeClass}>
                        {reportStatus.clearanceBadgeLabel}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-slate-800">
                      Critical Route Length
                    </td>
                    <td className="p-2.5 text-slate-800 font-bold">
                      {routeMeasured ? `${summary.pathLengthM} m` : "Not measured"}
                    </td>
                    <td className="p-2.5 text-slate-600 font-sans">Authored checkpoints</td>
                    <td className="p-2.5 font-sans text-slate-500">
                      {routeMeasured ? "Computed Path" : "Uncomputed"}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-slate-800">
                      Actionable Geometric Deficits
                    </td>
                    <td
                      className={`p-2.5 font-bold ${
                        summary.actionableDeficitsCount > 0
                          ? "text-red-600"
                          : reportStatus.isClear
                          ? "text-emerald-700"
                          : "text-slate-500"
                      }`}
                    >
                      {summary.actionableDeficitsCount} recorded
                    </td>
                    <td className="p-2.5 text-slate-600 font-sans">0 collisions / deficits</td>
                    <td className="p-2.5 font-sans font-semibold">
                      <span className={reportStatus.deficitsBadgeClass}>
                        {reportStatus.deficitsBadgeLabel}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-slate-800">
                      Unassessed Scope Categories
                    </td>
                    <td className="p-2.5 text-slate-600 font-bold">
                      {summary.unassessedScopeCount} categories
                    </td>
                    <td className="p-2.5 text-slate-500 font-sans">Physical audit required</td>
                    <td className="p-2.5 font-sans text-amber-700">Scope Boundary</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actionable Findings Breakdown */}
          {deficits.length > 0 && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-red-800 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>Actionable Geometric Deficits ({deficits.length})</span>
              </h3>
              <div className="space-y-2">
                {deficits.map((d, idx) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-lg border border-red-200 bg-red-50/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {idx + 1}. {d.title}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-red-100 text-red-800">
                        {d.severity}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{d.description}</p>
                    <p className="text-slate-600 text-[11px]">
                      Evidence ({d.evidence.source}): {d.evidence.rawEvidenceString}
                      {d.requirement && ` · Target: ${d.requirement.targetValue} ${d.requirement.unit} (${d.requirement.sourceDescription})`}
                    </p>
                    {d.uncertaintyExplanation && <p className="text-slate-500 text-[11px]">Limit: {d.uncertaintyExplanation}</p>}
                    {d.suggestedAction && (
                      <p className="text-[#0B514B] text-[11px] font-medium pt-0.5">
                        Recommendation: {d.suggestedAction.label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <section className="break-inside-avoid text-xs">
            <h3 className="font-bold uppercase tracking-wider text-slate-500 mb-2">Improvement state</h3>
            {appliedCandidate ? (
              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <p><strong>Applied layout candidate:</strong> {appliedCandidate.name} · {appliedCandidate.moveCount} furniture move(s). Digital layout only; onsite work not verified.</p>
                <ul className="list-disc pl-5">
                  {appliedCandidate.moves.map((move) => (
                    <li key={move.furnitureId}>{move.furnitureName}: ({move.fromPosition.x}, {move.fromPosition.y}) cm to ({move.toPosition.x}, {move.toPosition.y}) cm.</li>
                  ))}
                </ul>
                <p>Baseline: {activeOptimizationResult?.baselineEvaluation.summary.routeFeasibility}; {activeOptimizationResult?.baselineEvaluation.summary.actionableDeficitsCount} deficit(s). Current: {summary.routeFeasibility}; {summary.actionableDeficitsCount} deficit(s).</p>
              </div>
            ) : <p>No optimization candidate applied to current assessment. Suggested actions above remain recommendations, not completed work.</p>}
          </section>

          {/* Unassessed Environmental Scope Boundaries */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Unassessed Environmental Scope (Physical Inspection Required)</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <strong className="text-slate-800 block">Illumination & Glare:</strong>
                Requires physical lux photometer audit under representative conditions.
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <strong className="text-slate-800 block">Flooring Traction:</strong>
                Requires tactile inspection of transition strip heights and slip resistance.
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <strong className="text-slate-800 block">Structural Anchorage:</strong>
                Requires physical structural audit of grab bars and wall fixings.
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <strong className="text-slate-800 block">Moisture & Drainage:</strong>
                Requires onsite audit of plumbing splash zones and floor drainage slopes.
              </div>
            </div>
          </div>

          {/* Honest Disclaimer */}
          <div className="p-3 bg-slate-50 rounded text-xs text-slate-500 border border-slate-200 leading-relaxed">
            Deterministic 2D spatial clearance and footprint boundary evaluation. Zero detected findings does not constitute proof of clinical safety or statutory building compliance. SafeSpace measures geometric clearances along configured pathways; it does not certify clinical safety, building code compliance, or hazard exemption. Environmental factors (illumination, traction, anchorage, moisture) and 3D architectural clearances remain unassessed.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => setReportModalOpen(false)}
            className="px-4 py-1.5 bg-[#0B514B] hover:bg-[#073D38] text-white rounded text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
