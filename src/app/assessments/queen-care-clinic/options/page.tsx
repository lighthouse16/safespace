"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/shell";
import { EditorShell } from "@/components/editor";

type LayoutOption = {
  id: string;
  name: string;
  objective: string;
  score: number;
  cost: string;
  effort: string;
  disruption: string;
  clearance: string;
  hazardsRemaining: number;
  changes: string[];
};

const options: LayoutOption[] = [
  {
    id: "current",
    name: "Current Layout",
    objective: "Unmodified baseline",
    score: 68,
    cost: "HK$0",
    effort: "None",
    disruption: "None",
    clearance: "54 cm",
    hazardsRemaining: 4,
    changes: [],
  },
  {
    id: "minimum",
    name: "Minimum Cost",
    objective: "Eliminate critical blockage without purchases",
    score: 39,
    cost: "HK$0",
    effort: "1 hour",
    disruption: "Low",
    clearance: "54 → 90 cm",
    hazardsRemaining: 2,
    changes: ["Move Waiting Chair A & B 60 cm against west wall", "Preserve 90 cm transit lane past reception"],
  },
  {
    id: "balanced",
    name: "Balanced (Recommended)",
    objective: "Best safety-to-cost ratio for walker transit",
    score: 27,
    cost: "HK$850",
    effort: "Half day",
    disruption: "Low",
    clearance: "54 → 96 cm",
    hazardsRemaining: 0,
    changes: [
      "Move Waiting Chair A & B to perimeter wall",
      "Mount 1.8 m continuous corridor handrail",
      "Install 200 lux doorway LED fixture",
      "Apply rounded protective buffer at table corner",
    ],
  },
  {
    id: "maximum",
    name: "Maximum Safety",
    objective: "Maximize turning radius & continuous balance support",
    score: 18,
    cost: "HK$3,200",
    effort: "2 days",
    disruption: "Medium",
    clearance: "54 → 110 cm",
    hazardsRemaining: 0,
    changes: [
      "Relocate seating bank to dedicated alcove",
      "Continuous dual-height handrails along corridor",
      "Automated sensor illumination at all thresholds",
      "Install rounded reception corner unit",
    ],
  },
];

export default function OptionsPage() {
  const router = useRouter();
  const [chosen, setChosen] = useState("balanced");
  const selected = options.find((o) => o.id === chosen) ?? options[2];
  const mode = chosen === "current" ? ("current" as const) : ("proposed" as const);

  return (
    <WorkspaceShell activeStep="options">
      <div className="p-4 lg:p-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Layout Optimization · 3 Objectives</p>
            <h1 className="mt-1 text-2xl font-semibold">Compare Alternative Layouts</h1>
            <p className="mt-1 text-sm text-slate-600">
              Evaluate generated alternatives against the baseline space model. All metrics are deterministic estimates for professional verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              Target Profile: Walker (90 cm min)
            </span>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* 2D/3D Floorplan Editor with Before/After */}
          <div className="h-[calc(100dvh-14rem)] min-h-[520px]">
            <EditorShell
              showBeforeAfter
              mode={mode}
              onModeChange={(m) => setChosen(m === "proposed" ? "balanced" : "current")}
            />
          </div>

          {/* Side panel: Optimization Objectives & Impact */}
          <aside className="space-y-4">
            {/* Objective Selector */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Optimization Objectives</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {options.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setChosen(o.id)}
                    aria-pressed={chosen === o.id}
                    className={`w-full p-3.5 text-left transition ${
                      chosen === o.id
                        ? "bg-teal-50/80 ring-2 ring-inset ring-teal-700"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-slate-900">{o.name}</span>
                      <span className="text-lg font-semibold tabular-nums text-slate-900">
                        {o.score}
                        <small className="text-xs font-normal text-slate-500"> /100</small>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-normal">{o.objective}</p>
                    <div className="mt-2.5 flex items-center gap-3 text-[11px] font-medium text-slate-600">
                      <span>Cost: <strong className="text-slate-900">{o.cost}</strong></span>
                      <span>·</span>
                      <span>Effort: <strong className="text-slate-900">{o.effort}</strong></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Measured Impact */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Projected Safety Impact</h3>
              <dl className="mt-3 divide-y divide-slate-100 text-sm">
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Environmental Risk Index</dt>
                  <dd className="font-semibold text-slate-900">68 → {selected.score}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Route Clearance</dt>
                  <dd className="font-semibold text-teal-800">{selected.clearance}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Open Hazards</dt>
                  <dd className="font-semibold text-slate-900">{selected.hazardsRemaining} unresolved</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Implementation Cost</dt>
                  <dd className="font-semibold text-slate-900">{selected.cost}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Operational Disruption</dt>
                  <dd className="font-semibold text-slate-900">{selected.disruption}</dd>
                </div>
              </dl>
            </div>

            {/* Modifications List */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Proposed Modifications</h3>
              {selected.changes.length ? (
                <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs text-slate-600 leading-normal">
                  {selected.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Unmodified baseline layout.</p>
              )}
            </div>

            {/* Workflow Action */}
            <div className="space-y-2 pt-1">
              <button
                disabled={selected.id === "current"}
                onClick={() => router.push("/reviews/queen-care-clinic")}
                className="h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Submit {selected.name} for OT Review &rarr;
              </button>
              <button
                onClick={() => router.push("/assessments/queen-care-clinic/report")}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-teal-700 hover:underline"
              >
                Preview Draft Implementation Report
              </button>
            </div>

            <p className="text-center text-[11px] leading-relaxed text-slate-400">
              SafeSpace decision-support estimate. Environmental modifications require professional review before execution.
            </p>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
