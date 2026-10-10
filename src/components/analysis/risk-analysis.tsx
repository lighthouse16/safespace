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
    id: "HZ-001",
    severity: "Critical",
    title: "Waiting chair obstructing the route",
    location: "Waiting Area · Main transit path",
    objectId: "chair-1",
    reason: "Waiting chair A narrows the walker transit route to 54 cm, well below the 90 cm minimum clearance required for older adults using a wheeled walking frame.",
    affectedProfiles: ["Older adult using walker", "Wheelchair user"],
    measured: "54 cm",
    required: "90 cm",
    gap: "36 cm below target",
    evidence: "Route simulation intersects the chair envelope for 1.8 m between entrance and reception approach.",
    suggestedFix: "Move two waiting chairs (Chairs A & B) 60 cm against the west perimeter wall.",
    confidence: 96,
    provenance: "Spatial model v3 · Transit clearance analysis",
  },
  {
    id: "HZ-002",
    severity: "High",
    title: "Sharp furniture corner close to the route",
    location: "Reception approach · Magazine table",
    objectId: "corner-table",
    reason: "Sharp table edge projects into the walker turning corridor, presenting impact and balance destabilization risks.",
    affectedProfiles: ["Older adult using walker"],
    measured: "68 cm clearance",
    required: "90 cm",
    gap: "22 cm below target",
    evidence: "Turning path radius of 150 cm clips table edge corner during transition to corridor.",
    suggestedFix: "Reposition table to alcove or install high-visibility rounded edge protection.",
    confidence: 91,
    provenance: "Spatial model v3 · Corner collision detection",
  },
  {
    id: "HZ-003",
    severity: "Medium",
    title: "Low doorway illumination check",
    location: "Consultation corridor threshold",
    objectId: null,
    reason: "Visual contrast requires evaluation for older adults with reduced contrast sensitivity.",
    affectedProfiles: ["Low-vision user", "Older adult using walker"],
    measured: "Visual check only",
    required: "On-site photometer check",
    gap: "Pending physical lux audit",
    evidence: "Threshold illuminance requires physical site survey with calibrated lux meter.",
    suggestedFix: "Perform on-site photometric survey at corridor threshold.",
    confidence: 88,
    provenance: "Visual inspection notes · Physical photometer survey required",
  },
  {
    id: "HZ-004",
    severity: "Medium",
    title: "2.1-metre route section without stable support",
    location: "Consultation corridor wall",
    objectId: "corridor-bench",
    reason: "A continuous 2.1 m section lacks handrails or stable tactile touchpoints for balance recovery during walking.",
    affectedProfiles: ["Older adult using walker", "Cane user"],
    measured: "2.1 m span",
    required: "1.2 m max span",
    gap: "0.9 m unsupported",
    evidence: "Continuous wall run between waiting exit and consultation room lacks grab rail or architectural support.",
    suggestedFix: "Mount a 1.8 m continuous architectural handrail at 88 cm height.",
    confidence: 85,
    provenance: "Spatial model v3 · Continuous support scan",
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
      {/* Risk Overview Banner */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(30,50,52,0.07)]">
        <div className="grid gap-5 border-b border-slate-200 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <ShieldWarningIcon size={24} weight="duotone" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="risk-title" className="text-xl font-semibold tracking-tight text-slate-950">
                  Critical route clearance compromised
                </h2>
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                  Clearance Deficit
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Minimum route clearance is <strong className="text-slate-900">54 cm</strong> (required <strong className="text-slate-900">90 cm</strong>). Waiting chair A obstructs the step-free transit route from entrance to consultation corridor for older adults using a walker.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Route Clearance Evaluation</p>
              <p className="text-2xl font-semibold tabular-nums text-red-700">
                54 cm<span className="text-sm font-medium text-slate-500"> (min 90 cm)</span>
              </p>
            </div>
            <div className="h-9 w-px bg-slate-200" />
            <p className="max-w-32 text-xs leading-5 text-slate-500">
              Deterministic spatial evaluation. SafeSpace reports physical geometry, not synthetic risk scores.
            </p>
          </div>
        </div>

        {/* Metric Badges */}
        <dl className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 px-5 py-4">
            <WarningCircleIcon size={20} className="text-red-700" weight="fill" aria-hidden="true" />
            <div>
              <dt className="text-xs text-slate-500">Prioritized Hazards</dt>
              <dd className="font-semibold text-slate-900">{summary.critical} Critical · 3 Other</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <RulerIcon size={20} className="text-teal-700" aria-hidden="true" />
            <div>
              <dt className="text-xs text-slate-500">Narrowest Clearance</dt>
              <dd className="font-semibold text-slate-900">54 cm (36 cm below target)</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <UserCircleCheckIcon size={20} className="text-slate-600" aria-hidden="true" />
            <div>
              <dt className="text-xs text-slate-500">Professional Review</dt>
              <dd className="font-semibold text-slate-900">{reviewed} of {hazards.length} items reviewed</dd>
            </div>
          </div>
        </dl>
      </div>

      {/* Main Review Workspace: Queue + Floorplan + Inspector */}
      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(30,50,52,0.07)] xl:grid-cols-[18rem_minmax(26rem,1fr)_23rem]">
        {/* Left: Prioritized Queue */}
        <aside aria-label="Findings requiring review" className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Prioritized Hazards</h3>
                <p className="mt-0.5 text-xs text-slate-500">Deterministic rule-based scan</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {summary.open} open
              </span>
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
                    className={`w-full border-l-4 px-4 py-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600 ${
                      active ? "border-l-teal-700 bg-teal-50/70" : "border-l-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityStyle[hazard.severity]}`}>
                        {hazard.severity}
                      </span>
                      {decision ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                          <CheckCircleIcon weight="fill" /> Reviewed
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">#{index + 1}</span>
                      )}
                    </span>
                    <span className="mt-2 block text-sm font-semibold leading-5 text-slate-950">{hazard.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPinIcon aria-hidden="true" /> {hazard.location}
                    </span>
                    <span className="mt-2 block text-xs font-medium text-slate-700">
                      {hazard.measured} observed · {hazard.required} required
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Center: Spatial Plan Evidence */}
        <div className="flex min-h-[500px] flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Spatial Route Evidence</h3>
              <p className="text-xs text-slate-500">Critical Route: Entrance → Reception → Waiting Seat → Consultation Room</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-red-500" /> Hazard Zone</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-teal-700" /> Critical Route</span>
            </div>
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
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <EyeIcon aria-hidden="true" /> Spatial Hazard Map
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                Click objects on the plan or select from the queue to view clearance evidence.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Inspector Details & Decision */}
        <HazardDetail
          hazard={selected}
          decision={selectedDecision}
          onDecision={(decision) => setDecisions((current) => ({ ...current, [selected.id]: decision }))}
        />
      </div>

      {/* Review Footer / Progression */}
      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_34px_rgba(30,50,52,0.16)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardTextIcon size={22} className="text-teal-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {reviewed} of {hazards.length} hazards verified
            </p>
            <p className="text-xs text-slate-500">
              {allReviewed
                ? "All hazards triaged. Proceed to layout optimization options."
                : "Review and verify identified hazards to unlock layout recommendations."}
            </p>
          </div>
        </div>
        {allReviewed ? (
          <Link
            href="/assessments/queen-care-clinic/options"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Generate Layout Options <ArrowRightIcon aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => document.getElementById("finding-review-actions")?.focus()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2"
          >
            Review Selected Hazard <ArrowRightIcon aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500">
        <XCircleIcon className="mt-0.5 shrink-0" aria-hidden="true" />
        SafeSpace is a clinical decision-support tool. It does not replace an occupational therapist or clinical judgment. Verify all measurements on site.
      </p>
    </section>
  );
}
