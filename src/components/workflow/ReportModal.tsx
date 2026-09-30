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
  } = useSafeSpaceStore();

  if (!reportModalOpen) return null;

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
              <span className="font-semibold text-slate-900">Queen Care Clinic <span className="font-normal text-[10px] text-slate-500">(Demo Fixture)</span></span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ASSESSED SPACE</span>
              <span className="font-semibold text-slate-900">Waiting & Corridor</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">MOBILITY PROFILE</span>
              <span className="font-semibold text-[#1e7168]">{activeProfile.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">STATUS</span>
              <span className="font-semibold text-emerald-700 uppercase">
                {approvalStatus === "approved" ? "OT Approved" : "Pending Sign-off"}
              </span>
            </div>
          </div>

          {/* Metric Transition Table */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              Objective Risk & Clearance Metrics
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
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
            </div>
          </div>

          {/* Implementation Actions Checklist */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              Prescribed Modification Schedule (Est. HK$850)
            </h3>
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
          </div>

          {/* Disclaimer */}
          <div className="p-3 bg-slate-50 rounded text-xs text-slate-500 border border-slate-200 leading-relaxed">
            This document certifies environmental geometry evaluation conducted via SafeSpace v0.1. It provides objective physical measurements and architectural recommendations for facility operations and occupational therapy consultation.
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
