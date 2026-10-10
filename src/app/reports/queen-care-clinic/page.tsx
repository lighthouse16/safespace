import Link from "next/link";

export default function RetiredLegacyReportPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16 text-slate-900">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Legacy Route Retired
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
          Legacy Demonstration Route Decommissioned: Queen Care Clinic Legacy Report
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          SafeSpace uses the canonical workspace with client-persistent assessments and deterministic spatial evaluations.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            Open Canonical Workspace
          </Link>
          <Link
            href="/assessments"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
          >
            Return to Assessments
          </Link>
        </div>
      </div>
    </main>
  );
}
