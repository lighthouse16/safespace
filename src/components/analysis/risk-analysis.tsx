"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  EyeIcon,
  MapPinIcon,
  RulerIcon,
  ShieldWarningIcon,
  UserCircleCheckIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { Floorplan2D } from "@/components/editor/floorplan-2d";
import { currentPlan } from "@/components/editor/editor-model";
import { HazardDetail, type Hazard, type ReviewDecision } from "./hazard-detail";

export const hazards: Hazard[] = [
  {
    id: "HZ-014",
    severity: "Critical",
    title: "Table blocks the primary route",
    location: "Activity room · Centre zone",
    objectId: "table-a",
    reason: "Group table A leaves too little space for Mrs. Chan to pass safely with her walker on the only step-free route to the WC corridor.",
    affectedProfiles: ["Walker user", "Wheelchair user"],
    measured: "52 cm",
    required: "90 cm",
    gap: "38 cm below target",
    evidence: "The walker clearance envelope intersects the table and adjacent chair zone for 2.1 m of the assessed route.",
    suggestedFix: "Move Group table A 70 cm north and reposition the two southern chairs.",
    confidence: 94,
    provenance: "Spatial model v3 · Route clearance check",
  },
  {
    id: "HZ-009",
    severity: "High",
    title: "Cabinet narrows the WC approach",
    location: "Activity room · East wall",
    objectId: "cabinet",
    reason: "The supply cabinet creates a second pinch point where the route turns into the WC corridor.",
    affectedProfiles: ["Walker user"],
    measured: "58 cm",
    required: "90 cm",
    gap: "32 cm below target",
    evidence: "The clearance envelope clips the cabinet footprint during the turn from the activity room into the corridor.",
    suggestedFix: "Relocate the supply cabinet to the storage room.",
    confidence: 89,
    provenance: "Spatial model v3 · Turning clearance check",
  },
  {
    id: "HZ-021",
    severity: "Medium",
    title: "Threshold contrast is too low",
    location: "WC corridor entry",
    objectId: null,
    reason: "The floor transition may be difficult to identify for an older adult with reduced contrast sensitivity.",
    affectedProfiles: ["Low-vision user"],
    measured: "12 LRV",
    required: "30 LRV",
    gap: "18 LRV below target",
    evidence: "Adjacent material values were sampled from the calibrated site photographs attached to this assessment.",
    suggestedFix: "Add a matte contrast strip across the threshold and verify the finish on site.",
    confidence: 82,
    provenance: "Site photo set 03 · Material contrast check",
  },
];

const severityStyle = {
  Critical: "border-red-200 bg-red-50 text-red-800",
  High: "border-amber-200 bg-amber-50 text-amber-900",
  Medium: "border-slate-200 bg-slate-100 text-slate-700",
} as const;

export function countReviewed(decisions: Record<string, ReviewDecision>) {
  return Object.values(decisions).filter(Boolean).length;
}

export function RiskAnalysis() {
  const [selectedId, setSelectedId] = useState(hazards[0].id);
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const selected = hazards.find((hazard) => hazard.id === selectedId) ?? hazards[0];
  const reviewed = countReviewed(decisions);
  const selectedDecision = decisions[selected.id];
  const allReviewed = reviewed === hazards.length;
  const selectedObject = selected.objectId;

  const summary = useMemo(() => ({
    critical: hazards.filter((hazard) => hazard.severity === "Critical").length,
    open: hazards.length - reviewed,
  }), [reviewed]);

  const chooseHazard = (hazard: Hazard) => setSelectedId(hazard.id);
  const chooseObject = (objectId: string | null) => {
    const match = hazards.find((hazard) => hazard.objectId === objectId);
    if (match) setSelectedId(match.id);
  };

  return (
    <section aria-labelledby="risk-title" className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(30,50,52,0.07)]">
        <div className="grid gap-5 border-b border-slate-200 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <ShieldWarningIcon size={24} weight="duotone" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="risk-title" className="text-xl font-semibold tracking-tight text-slate-950">Route unsafe for walker use</h2>
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">High risk</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Narrowest clearance is <strong className="text-slate-900">52 cm</strong>; target is <strong className="text-slate-900">90 cm</strong>. Group table A and the supply cabinet obstruct Mrs. Chan&apos;s route to the WC corridor.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Model estimate</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-950">68<span className="text-sm font-medium text-slate-500"> / 100</span></p>
            </div>
            <div className="h-9 w-px bg-slate-200" />
            <p className="max-w-28 text-xs leading-5 text-slate-500">Lower is safer. Professional review pending.</p>
          </div>
        </div>

        <dl className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 px-5 py-4">
            <WarningCircleIcon size={20} className="text-red-700" weight="fill" aria-hidden="true" />
            <div><dt className="text-xs text-slate-500">Priority findings</dt><dd className="font-semibold text-slate-900">{summary.critical} critical · 2 other</dd></div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <RulerIcon size={20} className="text-teal-700" aria-hidden="true" />
            <div><dt className="text-xs text-slate-500">Clearance gap</dt><dd className="font-semibold text-slate-900">38 cm below target</dd></div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <UserCircleCheckIcon size={20} className="text-slate-600" aria-hidden="true" />
            <div><dt className="text-xs text-slate-500">Review progress</dt><dd className="font-semibold text-slate-900">{reviewed} of {hazards.length} reviewed</dd></div>
          </div>
        </dl>
      </div>

      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(30,50,52,0.07)] xl:grid-cols-[18rem_minmax(26rem,1fr)_23rem]">
        <aside aria-label="Findings requiring review" className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-950">Review queue</h3><p className="mt-0.5 text-xs text-slate-500">Prioritized by route impact</p></div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{summary.open} open</span>
            </div>
          </div>
          <ol className="divide-y divide-slate-100">
            {hazards.map((hazard, index) => {
              const decision = decisions[hazard.id];
              const active = selected.id === hazard.id;
              return (
                <li key={hazard.id}>
                  <button
                    type="button"
                    onClick={() => chooseHazard(hazard)}
                    aria-current={active ? "true" : undefined}
                    className={`w-full border-l-4 px-4 py-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600 ${active ? "border-l-teal-700 bg-teal-50/70" : "border-l-transparent hover:bg-slate-50"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityStyle[hazard.severity]}`}>{hazard.severity}</span>
                      {decision ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700"><CheckCircleIcon weight="fill" /> Reviewed</span>
                      ) : <span className="text-[11px] font-medium text-slate-400">#{index + 1}</span>}
                    </span>
                    <span className="mt-2 block text-sm font-semibold leading-5 text-slate-950">{hazard.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPinIcon aria-hidden="true" /> {hazard.location}</span>
                    <span className="mt-2 block text-xs font-medium text-slate-700">{hazard.measured} observed · {hazard.required} target</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="flex min-h-[500px] flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div><h3 className="text-sm font-semibold text-slate-950">Route evidence</h3><p className="text-xs text-slate-500">Entrance → Activity area → WC corridor</p></div>
            <div className="flex items-center gap-3 text-xs text-slate-600"><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-red-500" /> Risk zone</span><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-teal-700" /> Assessed route</span></div>
          </div>
          <div className="relative min-h-[430px] flex-1 bg-slate-100">
            <Floorplan2D
              plan={currentPlan}
              selectedId={selectedObject}
              onSelect={chooseObject}
              showHeatmap
              showRoute
              readOnly
              className="absolute inset-0"
            />
            <div className="pointer-events-none absolute left-4 top-4 max-w-64 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><EyeIcon aria-hidden="true" /> Read-only review</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Select a highlighted object to inspect its finding. Scroll to zoom.</p>
            </div>
          </div>
        </div>

        <HazardDetail
          hazard={selected}
          decision={selectedDecision}
          onDecision={(decision) => setDecisions((current) => ({ ...current, [selected.id]: decision }))}
        />
      </div>

      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_34px_rgba(30,50,52,0.16)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardTextIcon size={22} className="text-teal-700" aria-hidden="true" />
          <div><p className="text-sm font-semibold text-slate-900">{reviewed} of {hazards.length} findings reviewed</p><p className="text-xs text-slate-500">{allReviewed ? "Review complete. Projected layout can now be compared." : "Verify each finding before using the proposed layout."}</p></div>
        </div>
        {allReviewed ? (
          <Link href="/assessments/queen-care-clinic/options" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">Compare safer layout <ArrowRightIcon aria-hidden="true" /></Link>
        ) : (
          <button type="button" onClick={() => document.getElementById("finding-review-actions")?.focus()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2">Review selected finding <ArrowRightIcon aria-hidden="true" /></button>
        )}
      </div>

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><XCircleIcon className="mt-0.5 shrink-0" aria-hidden="true" /> Decision support only. Verify dimensions, route clearance, and recommendations on site before implementation.</p>
    </section>
  );
}
