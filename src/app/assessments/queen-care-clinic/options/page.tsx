"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/shell";
import { EditorShell } from "@/components/editor";

type LayoutOption = {
  id: string; name: string; objective: string;
  score: number; cost: string; effort: string; disruption: string;
  changes: string[];
};

const options: LayoutOption[] = [
  {
    id: "current", name: "Current layout", objective: "Baseline",
    score: 68, cost: "HK$0", effort: "None", disruption: "None", changes: [],
  },
  {
    id: "balanced", name: "Balanced", objective: "Best safety-to-cost ratio",
    score: 27, cost: "HK$850", effort: "Half day", disruption: "Medium",
    changes: ["Move group table A north", "Relocate supply cabinet to storage", "Reposition 2 chairs", "Add threshold contrast strip"],
  },
];

export default function OptionsPage() {
  const router = useRouter();
  const [chosen, setChosen] = useState("balanced");
  const selected = options.find(o => o.id === chosen)!;
  const mode = chosen === "current" ? "current" as const : "proposed" as const;

  return (
    <WorkspaceShell activeStep="options">
      <div className="p-4 lg:p-6">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Proposed layout · AI-assisted</p>
          <h1 className="mt-1 text-2xl font-semibold">Compare current and Balanced layout</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review the single proposed layout against the current room. All improvements are projected until verified on site.
          </p>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Editor with Before/After */}
          <div className="h-[calc(100dvh-14rem)] min-h-[500px]">
            <EditorShell
              showBeforeAfter
              mode={mode}
              onModeChange={(m) => setChosen(m === "proposed" ? "balanced" : "current")}
            />
          </div>

          {/* Side panel */}
          <aside className="space-y-5">
            {/* Option selector */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold">Layout view</h2>
              </div>
              {options.map(o => (
                <button
                  key={o.id}
                  onClick={() => setChosen(o.id)}
                  aria-pressed={chosen === o.id}
                  className={`w-full border-b border-slate-100 p-4 text-left last:border-0 ${
                    chosen === o.id ? "bg-teal-50 ring-2 ring-inset ring-teal-700" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{o.name}</span>
                    <span className="text-xl font-semibold tabular-nums">
                      {o.score}<small className="text-xs font-normal text-slate-500"> /100</small>
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{o.objective}</span>
                </button>
              ))}
            </div>

            {/* Projected impact */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold">Projected impact</h3>
              <dl className="mt-3 divide-y divide-slate-100 text-sm">
                {[
                  ["Risk score", `68 → ${selected.score}`],
                  ["Route clearance", selected.id === "balanced" ? "52 → 96 cm" : "52 cm"],
                  ["Hazard zones", selected.id === "balanced" ? "3 → 0" : "3"],
                  ["Cost", selected.cost],
                  ["Effort", selected.effort],
                  ["Disruption", selected.disruption],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 py-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-semibold text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Changed objects */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold">Changes</h3>
              {selected.changes.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {selected.changes.map(c => <li key={c}>{c}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No changes in baseline.</p>
              )}
            </div>

            {/* Action */}
            <button
              disabled={selected.id === "current"}
              onClick={() => router.push("/assessments/queen-care-clinic/report")}
              className="h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Confirm {selected.name}
            </button>

            <p className="text-center text-xs text-slate-500">
              Modeled estimate · Verify dimensions and clearance on site
            </p>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}

