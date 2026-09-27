"use client";

import { useState } from "react";
import { WorkspaceShell } from "@/components/shell";
import { EditorShell } from "@/components/editor";
import type { EditorFurniture } from "@/components/editor";
import Link from "next/link";

export default function ModelPage() {
  const [selected, setSelected] = useState<EditorFurniture | null>(null);

  return (
    <WorkspaceShell activeStep="model">
      <div className="p-4 lg:p-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Space model · Version 3</p>
            <h1 className="mt-1 text-2xl font-semibold">Verify the activity room</h1>
            <p className="mt-1 text-sm text-slate-600">Check AI-detected structure, furniture, and safety context before analysis.</p>
          </div>
          <Link href="/assessments/queen-care-clinic/analysis" className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">
            Run safety assessment
          </Link>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="h-[calc(100dvh-11rem)] min-h-[620px]">
            <EditorShell onSelectedChange={setSelected} />
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selection</p>
            
            {selected ? (
              <>
                <h2 className="mt-2 font-semibold">{selected.label}</h2>
                {selected.movable && (
                  <span className="mt-2 inline-block rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">Movable</span>
                )}
                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Dimensions</dt>
                    <dd className="font-semibold">{selected.width} × {selected.depth} cm</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Type</dt>
                    <dd className="font-semibold capitalize">{selected.kind}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">AI confidence</dt>
                    <dd className="font-semibold">94% · Verified</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Surface</dt>
                    <dd className="font-semibold">Matte vinyl tile</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <h2 className="mt-2 font-semibold text-slate-400">No item selected</h2>
                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Overview</dt>
                    <dd className="font-semibold">15 objects</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Scale</dt>
                    <dd className="font-semibold">1:50</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Profile</dt>
                    <dd className="font-semibold">Walker</dd>
                  </div>
                </dl>
              </>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold">Readiness</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>✓ Scale calibrated</li>
                <li>✓ 15 objects verified</li>
                <li>✓ Walker profile selected</li>
                <li>✓ Critical route defined</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}

