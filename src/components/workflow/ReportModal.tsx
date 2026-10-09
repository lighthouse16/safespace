"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { X, Printer, CheckCircle2, ShieldCheck } from "lucide-react";

export function ReportModal() {
  const {
    reportModalOpen,
    setReportModalOpen,
    activeProfile,
    approvalStatus,
    assessmentType,
    assessmentMetadata,
    getLiveMetrics,
  } = useSafeSpaceStore();

  if (!reportModalOpen) return null;

  const isUserAssessment = assessmentType === "user";
  const metrics = getLiveMetrics();

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
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
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
                  : "Waiting & Corridor"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">MOBILITY PROFILE</span>
              <span className="font-semibold text-[#1e7168]">{activeProfile.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">STATUS</span>
              <span className="font-semibold text-emerald-700 uppercase">
                {isUserAssessment
                  ? "Calibrated Draft"
                  : approvalStatus === "approved"
                  ? "OT Approved"
                  : "Pending Sign-off"}
              </span>
            </div>
          </div>

          {/* Metric Transition Table */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              Objective Risk & Clearance Metrics
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {isUserAssessment ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Evaluation Parameter</th>
                      <th className="p-2.5">Measured Value</th>
                      <th className="p-2.5">Standard / Benchmark</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Minimum Walking Clearance
                      </td>
                      <td className={`p-2.5 font-bold ${
                        metrics.minClearanceCm >= activeProfile.minClearanceCm / 2
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}>
                        {metrics.minClearanceCm > 0 ? `${metrics.minClearanceCm} cm` : "—"}
                      </td>
                      <td className="p-2.5 text-slate-600">
                        ≥ {activeProfile.minClearanceCm / 2} cm (corridor {activeProfile.minClearanceCm} cm)
                      </td>
                      <td className="p-2.5 font-sans font-semibold">
                        {metrics.minClearanceCm >= activeProfile.minClearanceCm / 2 ? (
                          <span className="text-emerald-700">Meets Standard</span>
                        ) : (
                          <span className="text-red-600">Constrained</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Critical Route Length
                      </td>
                      <td className="p-2.5 text-slate-800 font-bold">
                        {metrics.routeLengthM > 0 ? `${metrics.routeLengthM} m` : "—"}
                      </td>
                      <td className="p-2.5 text-slate-600 font-sans">Authored checkpoints</td>
                      <td className="p-2.5 font-sans text-slate-500">Verified Path</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Environmental Risk Index
                      </td>
                      <td className="p-2.5 text-slate-500 font-sans">
                        {metrics.riskIndex !== null ? `${metrics.riskIndex} (${metrics.riskLevel})` : "Pending OT Review"}
                      </td>
                      <td className="p-2.5 text-slate-500 font-sans">&lt; 30 (Target)</td>
                      <td className="p-2.5 font-sans text-amber-700">Scheduled Gate 3</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Identified Hazards
                      </td>
                      <td className="p-2.5 text-slate-800 font-bold">0 recorded</td>
                      <td className="p-2.5 text-slate-500 font-sans">Zero critical</td>
                      <td className="p-2.5 font-sans text-emerald-700">Clear</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Evaluation Parameter</th>
                      <th className="p-2.5">Current Condition</th>
                      <th className="p-2.5">Proposed (Balanced)</th>
                      <th className="p-2.5">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Environmental Risk Index
                      </td>
                      <td className="p-2.5 text-red-600 font-bold">68 (High)</td>
                      <td className="p-2.5 text-emerald-700 font-bold">27 (Low)</td>
                      <td className="p-2.5 text-emerald-700 font-semibold">-41 pts (-60%)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Minimum Walking Clearance
                      </td>
                      <td className="p-2.5 text-red-600 font-bold">54 cm</td>
                      <td className="p-2.5 text-emerald-700 font-bold">96 cm</td>
                      <td className="p-2.5 text-emerald-700 font-semibold">+42 cm (+77%)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        Critical Route Length
                      </td>
                      <td className="p-2.5 text-slate-600">11.8 m</td>
                      <td className="p-2.5 text-slate-800 font-semibold">10.4 m</td>
                      <td className="p-2.5 text-slate-700 font-semibold">-1.4 m (-12%)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-slate-800">
                        High-Priority Hazards
                      </td>
                      <td className="p-2.5 text-red-600 font-bold">3 detected</td>
                      <td className="p-2.5 text-emerald-700 font-bold">0 remaining</td>
                      <td className="p-2.5 text-emerald-700 font-semibold">-3 resolved</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Implementation Actions Checklist */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              {isUserAssessment
                ? "Custom Space Modification Protocol"
                : "Prescribed Modification Schedule (Est. HK$850)"}
            </h3>
            {isUserAssessment ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <p>• <strong>Geometric Clearance Verification:</strong> Walking corridor evaluated at {metrics.minClearanceCm} cm narrowest margin.</p>
                <p>• <strong>Occupational Therapy Sign-off:</strong> Prescriptions and custom furniture rearrangement will be enabled in Gate 3.</p>
              </div>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Move waiting chair C-04 by 70 cm into north perimeter row (Zero cost).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Rotate chair C-05 by 90 degrees outward away from consultation arc.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Remove loose curl-edge entrance mat and restore flush threshold.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Install 2.4 m wall-mounted continuous corridor handrail (HK$620).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Install 3000K warm LED downlight luminaire at consultation portal (HK$230).</span>
                </li>
              </ul>
            )}
          </div>

          {/* Disclaimer */}
          <div className="p-3 bg-slate-50 rounded text-xs text-slate-500 border border-slate-200 leading-relaxed">
            {isUserAssessment
              ? `Preliminary unverified draft for ${assessmentMetadata?.facilityName || "user assessment"}. SafeSpace calculates geometric clearance along authored routes; it does not certify clinical safety, building code compliance, or hazard exemption. Hazard indexing and layout modifications are pending occupational therapy review.`
              : "Demonstration assessment fixture for Queen Care Clinic. Spatial clearance calculations and layout recommendations are illustrative prototype outputs and do not constitute clinical, occupational therapy, or architectural certification."}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => setReportModalOpen(false)}
            className="px-4 py-1.5 bg-[#1e7168] hover:bg-[#185e56] text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
