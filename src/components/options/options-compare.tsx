"use client";

import { useState } from "react";

export type LayoutOption = {
  id: string;
  name: string;
  objective: string;
  score: number;
  cost: string;
  effort: string;
  disruption: string;
  changes: string[];
};

export const layoutOptions: LayoutOption[] = [
  {
    id: "current",
    name: "Current layout",
    objective: "Baseline (54 cm clearance)",
    score: 0,
    cost: "Pending contractor survey",
    effort: "None",
    disruption: "None",
    changes: [],
  },
  {
    id: "minimum",
    name: "Minimum rearrangement",
    objective: "Clear transit pinch point",
    score: 0,
    cost: "No vendor purchase required",
    effort: "1 hour",
    disruption: "Low",
    changes: ["Move visitor chair", "Mark clear route"],
  },
  {
    id: "balanced",
    name: "Balanced",
    objective: "Restore compliant walker clearance (96 cm)",
    score: 0,
    cost: "Requires contractor quote",
    effort: "Half day",
    disruption: "Medium",
    changes: ["Move 2 furniture items", "Add threshold strip", "Relocate cabinet"],
  },
  {
    id: "maximum",
    name: "Maximum clearance",
    objective: "Extended accessible clearance (110 cm)",
    score: 0,
    cost: "Requires contractor quote",
    effort: "2 days",
    disruption: "High",
    changes: ["Reposition reception desk approach", "Widen corridor approach", "Move 3 furniture items"],
  },
];

function Plan({ after = false }: { after?: boolean }) {
  return (
    <div
      className="relative h-52 border-2 border-slate-400 bg-slate-50"
      aria-label={after ? "Proposed floor plan" : "Current floor plan"}
    >
      <div className="absolute left-[15%] top-[15%] h-[70%] w-[18%] border border-slate-300 bg-white" />
      <div className="absolute left-[36%] top-[15%] h-[70%] w-[50%] border border-slate-300 bg-white" />
      <div
        className={`absolute h-10 w-14 border-2 ${
          after
            ? "bottom-[15%] right-[18%] border-teal-600 bg-teal-50"
            : "bottom-[35%] left-[28%] border-red-600 bg-red-50"
        }`}
      >
        <span className="sr-only">Visitor chair</span>
      </div>
      <div
        className={`absolute bottom-[25%] left-[18%] h-1 ${
          after ? "w-[60%] bg-teal-600" : "w-[22%] bg-red-600"
        }`}
      />
    </div>
  );
}

export function OptionsCompare({ onSelect }: { onSelect?: (option: LayoutOption) => void }) {
  const [chosen, setChosen] = useState("balanced");
  const [highlight, setHighlight] = useState(true);
  const selected = layoutOptions.find((o) => o.id === chosen)!;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Scenario comparison</p>
          <h2 className="mt-1 text-lg font-semibold">Choose an implementation path</h2>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            className="accent-teal-700"
          />
          Highlight changes
        </label>
      </header>

      <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {layoutOptions.map((o) => (
          <button
            key={o.id}
            onClick={() => setChosen(o.id)}
            aria-pressed={chosen === o.id}
            className={`p-4 text-left ${
              chosen === o.id ? "bg-teal-50 ring-2 ring-inset ring-teal-700" : "hover:bg-slate-50"
            }`}
          >
            <span className="text-sm font-semibold">{o.name}</span>
            <span className="mt-1 block text-xs text-slate-500">{o.objective}</span>
            <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span>
                <b className="block text-slate-500">Cost</b>
                {o.cost}
              </span>
              <span>
                <b className="block text-slate-500">Effort</b>
                {o.effort}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[1fr_1fr_18rem]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Before · Baseline clearance: 54 cm
          </p>
          <Plan />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            After · Proposed clearance: {selected.id === "balanced" ? "96 cm" : selected.id === "maximum" ? "110 cm" : "90 cm"}
          </p>
          <Plan after={highlight} />
        </div>
        <aside>
          <h3 className="text-sm font-semibold">Measured impact</h3>
          <dl className="mt-3 divide-y divide-slate-200 border-y border-slate-200 text-sm">
            {[
              [
                "Route clearance",
                selected.id === "balanced"
                  ? "54 → 96 cm"
                  : selected.id === "maximum"
                  ? "54 → 110 cm"
                  : selected.id === "current"
                  ? "54 cm"
                  : "54 → 90 cm",
              ],
              ["Evaluation", "Deterministic clearance check"],
              ["Contractor cost", selected.cost],
              ["Disruption", selected.disruption],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-4 text-sm font-semibold">Changed objects</h3>
          {selected.changes.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {selected.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No changes in baseline.</p>
          )}
          <button
            disabled={selected.id === "current"}
            onClick={() => onSelect?.(selected)}
            className="mt-5 h-10 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Select {selected.name}
          </button>
        </aside>
      </div>
    </section>
  );
}
