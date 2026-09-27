"use client";

import { CheckCircleIcon, InfoIcon, MapPinIcon, RulerIcon, WrenchIcon, XCircleIcon } from "@phosphor-icons/react";

export type ReviewDecision = "verified" | "site-check" | "dismissed";
export type Hazard = {
  id: string;
  severity: "Critical" | "High" | "Medium";
  title: string;
  location: string;
  objectId: string | null;
  reason: string;
  affectedProfiles: string[];
  measured: string;
  required: string;
  gap: string;
  evidence: string;
  suggestedFix: string;
  confidence: number;
  provenance: string;
};

const decisionCopy: Record<ReviewDecision, string> = {
  verified: "Finding verified",
  "site-check": "Site check requested",
  dismissed: "Finding dismissed",
};

export function HazardDetail({ hazard, decision, onDecision }: { hazard: Hazard; decision?: ReviewDecision; onDecision: (decision: ReviewDecision) => void }) {
  return (
    <aside aria-label="Selected finding details" className="flex flex-col bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-500">{hazard.id}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{decision ? decisionCopy[decision] : "Needs review"}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-6 text-slate-950">{hazard.title}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><MapPinIcon aria-hidden="true" /> {hazard.location}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{hazard.reason}</p>
      </div>

      <div className="flex-1 space-y-5 p-5">
        <section aria-labelledby="clearance-heading">
          <h4 id="clearance-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><RulerIcon className="text-teal-700" aria-hidden="true" /> Observed clearance</h4>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3"><dt className="text-xs text-red-700">Observed</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-red-900">{hazard.measured}</dd></div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3"><dt className="text-xs text-teal-700">Target</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-teal-900">{hazard.required}</dd></div>
          </dl>
          <p className="mt-2 text-xs font-medium text-red-700">{hazard.gap}</p>
        </section>

        <section aria-labelledby="evidence-heading">
          <h4 id="evidence-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><InfoIcon className="text-teal-700" aria-hidden="true" /> Evidence</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">{hazard.evidence}</p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <p>{hazard.provenance}</p>
            <p className="mt-1">Detection confidence: <strong className="text-slate-700">{hazard.confidence}%</strong> · Not a review decision</p>
          </div>
        </section>

        <section aria-labelledby="action-heading">
          <h4 id="action-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><WrenchIcon className="text-teal-700" aria-hidden="true" /> Recommended change</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">{hazard.suggestedFix}</p>
          <p className="mt-2 text-xs text-slate-500">Affected: {hazard.affectedProfiles.join(", ")}</p>
        </section>
      </div>

      <div id="finding-review-actions" tabIndex={-1} className="border-t border-slate-200 bg-slate-50 p-4 focus:outline-none">
        <p className="mb-3 text-xs font-semibold text-slate-700">Professional review decision</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onDecision("verified")} aria-pressed={decision === "verified"} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 ${decision === "verified" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}`}><CheckCircleIcon aria-hidden="true" /> Verify</button>
          <button type="button" onClick={() => onDecision("site-check")} aria-pressed={decision === "site-check"} className={`h-9 rounded-lg border px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 ${decision === "site-check" ? "border-amber-600 bg-amber-50 text-amber-900" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}`}>Request site check</button>
          <button type="button" onClick={() => onDecision("dismissed")} aria-pressed={decision === "dismissed"} className={`col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 ${decision === "dismissed" ? "border-slate-600 bg-slate-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}><XCircleIcon aria-hidden="true" /> Dismiss finding</button>
        </div>
      </div>
    </aside>
  );
}
