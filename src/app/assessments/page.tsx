import Link from "next/link";
import { AppShell } from "@/components/shell";

export default function AssessmentsPage() {
  return (
    <AppShell activePath="/assessments">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SafeSpace Workspace
              </p>
              <span
                role="status"
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200"
              >
                Session only
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#192329] sm:text-3xl">
              Assessments & Spaces
            </h1>
            <p className="mt-1.5 text-xs text-[#64748b]">
              Evaluate environmental fall risks, calibrate floorplans, and audit critical routes across living and care environments.
            </p>
          </div>

          <Link
            href="/assessments/new"
            className="inline-flex items-center justify-center rounded-lg bg-[#1e7168] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#175b54] transition cursor-pointer shrink-0"
          >
            + New assessment
          </Link>
        </header>

        {/* Real Assessments Empty State */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto size-11 rounded-full bg-slate-100 border border-slate-200 grid place-items-center text-slate-500">
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="mt-3 text-sm font-semibold text-[#192329]">
            No assessments saved yet
          </h2>
          <p className="mt-1 text-xs text-[#64748b] max-w-md mx-auto">
            Intake drafts exist only while the intake session remains open; leaving or refreshing discards unsaved session state until canonical project storage is connected.
          </p>
          <div className="mt-4">
            <Link
              href="/assessments/new"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Start an assessment
            </Link>
          </div>
        </div>

        {/* Labelled Demo Fixture Section */}
        <section aria-labelledby="demo-fixtures-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="demo-fixtures-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Pre-Configured Demo Fixture
            </h2>
            <span className="text-[11px] text-slate-500">
              Interactive sample scenario
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#192329]">
                    Queen Care Clinic
                  </span>
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                    Demo Fixture
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Waiting Area & Consultation Corridor · Pre-scripted baseline floorplan
                </p>
                <p className="text-[11px] text-slate-400">
                  Critical Route: Entrance &rarr; Reception &rarr; Waiting Seat &rarr; Consultation Room
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/assessments/queen-care-clinic/analysis"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  View analysis demo
                </Link>
                <Link
                  href="/assessments/queen-care-clinic/model"
                  className="rounded-lg bg-[#1e7168] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#175b54] transition"
                >
                  Open demo &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
