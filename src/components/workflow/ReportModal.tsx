"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { X, Printer, ShieldCheck, AlertCircle, ShieldAlert } from "lucide-react";

export function ReportModal() {
  const {
    reportModalOpen,
    setReportModalOpen,
    activeProfile,
    assessmentType,
    assessmentMetadata,
    getSpatialFindings,
  } = useSafeSpaceStore();

  if (!reportModalOpen) return null;

  const isUserAssessment = assessmentType === "user";
  const evaluation = getSpatialFindings();
  const { summary, findings } = evaluation;
  const deficits = findings.filter((f) => f.classification === "actionable-deficit");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1e7168]" />
            <h2 className="font-bold text-base text-slate-900">
              SafeSpace Assessment Summary Report
            </h2>
          </div>
          <button
            onClick={() => setReportModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">FACILITY</span>
              <span className="font-semibold text-slate-900">
                {isUserAssessment
                  ? assessmentMetadata?.facilityName || "Custom Assessment"
                  : "Queen Care Clinic"}{" "}
                <span className="font-normal text-[10px] text-slate-500">
                  ({isUserAssessment ? "User Assessment" : "Demo Fixture"})
                </span>
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ASSESSED SPACE</span>
              <span className="font-semibold text-slate-900">
                {isUserAssessment
                  ? assessmentMetadata?.spaceName || "Calibrated Space"
                  : "Waiting & Consultation Corridor"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">MOBILITY PROFILE</span>
              <span className="font-semibold text-[#1e7168]">{activeProfile.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">EVALUATION STATUS</span>
              <span
                className={`font-semibold uppercase text-[11px] ${
                  summary.actionableDeficitsCount > 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {summary.actionableDeficitsCount > 0
                  ? `${summary.actionableDeficitsCount} Deficit(s)`
                  : "Passage Clear"}
              </span>
            </div>
          </div>

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
                      Minimum Walking Clearance
                    </td>
                    <td
                      className={`p-2.5 font-bold ${
                        summary.minimumClearanceCm !== null &&
                        summary.requiredClearanceRadiusCm !== null &&
                        summary.minimumClearanceCm >= summary.requiredClearanceRadiusCm
                          ? "text-emerald-700"
                          : summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0
                          ? "text-red-600"
                          : "text-slate-400"
                      }`}
                    >
                      {summary.minimumClearanceCm !== null && summary.minimumClearanceCm > 0
                        ? `${summary.minimumClearanceCm} cm`
                        : "—"}
                    </td>
                    <td className="p-2.5 text-slate-600 font-sans">
                      {summary.requiredClearanceRadiusCm !== null
                        ? `≥ ${summary.requiredClearanceRadiusCm} cm radius (${summary.corridorWidthCm} cm corridor)`
                        : "Unconfigured"}
                    </td>
                    <td className="p-2.5 font-sans font-semibold">
                      {summary.routeFeasibility === "adequate" ? (
                        <span className="text-emerald-700">Target Satisfied</span>
                      ) : summary.routeFeasibility === "clearance-deficit" ? (
                        <span className="text-red-600">Clearance Deficit</span>
                      ) : summary.routeFeasibility === "out-of-bounds" ? (
                        <span className="text-red-600">Out of Bounds</span>
                      ) : summary.routeFeasibility === "invalid-geometry" ? (
                        <span className="text-amber-700">Invalid Geometry</span>
                      ) : summary.routeFeasibility === "unreachable" ? (
                        <span className="text-red-600">Route Blocked</span>
                      ) : (
                        <span className="text-slate-500">Unconfigured</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-slate-800">
                      Critical Route Length
                    </td>
                    <td className="p-2.5 text-slate-800 font-bold">
                      {summary.pathLengthM !== null && summary.pathLengthM > 0
                        ? `${summary.pathLengthM} m`
                        : "—"}
                    </td>
                    <td className="p-2.5 text-slate-600 font-sans">Authored checkpoints</td>
                    <td className="p-2.5 font-sans text-slate-500">
                      {summary.pathLengthM !== null ? "Computed Path" : "Uncomputed"}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-slate-800">
                      Actionable Geometric Deficits
                    </td>
                    <td
                      className={`p-2.5 font-bold ${
                        summary.actionableDeficitsCount > 0 ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {summary.actionableDeficitsCount} recorded
                    </td>
                    <td className="p-2.5 text-slate-600 font-sans">0 collisions / deficits</td>
                    <td className="p-2.5 font-sans font-semibold">
                      {summary.actionableDeficitsCount === 0 ? (
                        <span className="text-emerald-700">No Geometric Deficits</span>
                      ) : (
                        <span className="text-red-600">Action Required</span>
                      )}
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
                    {d.suggestedAction && (
                      <p className="text-[#1e7168] text-[11px] font-medium pt-0.5">
                        Recommendation: {d.suggestedAction.label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
            Deterministic 2D spatial clearance and footprint boundary evaluation. SafeSpace measures geometric clearances along configured pathways; it does not certify clinical safety, building code compliance, or hazard exemption. Composite risk scoring and multi-alternative layout optimization are scheduled for Gate 3 delivery.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => setReportModalOpen(false)}
            className="px-4 py-1.5 bg-[#1e7168] hover:bg-[#185e56] text-white rounded text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
