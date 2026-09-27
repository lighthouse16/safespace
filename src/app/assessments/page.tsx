import Link from "next/link";
import { AppShell } from "@/components/shell";

const spaces = [
  {
    id: "queen-care-clinic",
    name: "Activity Room & Main Entrance",
    category: "Lobby & Reception",
    status: "Analysis Complete",
    risk: "68 · High risk",
    riskClass: "bg-red-50 text-red-700 border-red-200",
    updated: "12 min ago",
    targetRoute: "Entrance → Waiting Seats → Consultation Room",
    href: "/assessments/queen-care-clinic/model"
  },
  {
    id: "north-corridor",
    name: "North Circulation Corridor",
    category: "Circulation / Hallway",
    status: "Review Pending",
    risk: "34 · Moderate",
    riskClass: "bg-amber-50 text-amber-700 border-amber-200",
    updated: "Yesterday",
    targetRoute: "Ward Entrance → Accessible WC",
    href: "/assessments/queen-care-clinic/model"
  },
  {
    id: "consultation-2",
    name: "Consultation Room 2",
    category: "Clinical Consultation",
    status: "Safe",
    risk: "14 · Low risk",
    riskClass: "bg-teal-50 text-teal-700 border-teal-200",
    updated: "24 Sep",
    targetRoute: "Doctor Desk → Examination Bed",
    href: "/assessments/queen-care-clinic/model"
  },
  {
    id: "rehab-hall",
    name: "Physiotherapy & Exercise Hall",
    category: "Rehabilitation",
    status: "Draft",
    risk: "Not analyzed",
    riskClass: "bg-slate-100 text-slate-600 border-slate-200",
    updated: "3 days ago",
    targetRoute: "Parallel Bars → Rest Bench",
    href: "/assessments/new"
  }
];

export default function AssessmentsPage() {
  return (
    <AppShell activePath="/assessments">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Harmony Elder Care Centre</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Spaces & Assessments</h1>
            <p className="mt-2 text-slate-600">Manage spatial fall-risk evaluations, 2D/3D floorplans, and route audits across your facility.</p>
          </div>
          <Link
            href="/assessments/new"
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-800"
          >
            + New assessment
          </Link>
        </header>

        <div className="mt-6 flex flex-wrap gap-3 border-y border-slate-200 py-4">
          <input
            aria-label="Search facility areas"
            placeholder="Search room, corridor, or area name..."
            className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-teal-700 focus:outline-none"
          />
          <select aria-label="Filter status" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option>All statuses</option>
            <option>Analysis Complete</option>
            <option>Review Pending</option>
            <option>Draft</option>
          </select>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 md:grid md:grid-cols-[1fr_12rem_10rem_7rem]">
            <span>Space / Critical Route</span>
            <span>Category & Status</span>
            <span>Safety Risk</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-slate-200">
            {spaces.map((s) => (
              <div
                key={s.id}
                className="grid gap-3 p-5 transition hover:bg-slate-50 md:grid-cols-[1fr_12rem_10rem_7rem] md:items-center"
              >
                <div>
                  <Link href={s.href} className="text-base font-semibold text-slate-900 hover:text-teal-700">
                    {s.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    Route: <span className="text-slate-700">{s.targetRoute}</span>
                  </p>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-500">{s.category}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-800">{s.status}</span>
                </div>

                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.riskClass}`}>
                    {s.risk}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-400">Updated {s.updated}</span>
                </div>

                <div className="text-right">
                  <Link
                    href={s.href}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-600 hover:text-teal-800"
                  >
                    Open &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
