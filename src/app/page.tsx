import Link from "next/link";
import { AppShell } from "@/components/shell";

const rows = [
  {
    name: "Waiting Area & Consultation Corridor",
    type: "Transit & Waiting",
    status: "Analysis complete",
    risk: "68 · High risk",
    updated: "12 min ago",
    href: "/assessments/queen-care-clinic/analysis",
  },
  {
    name: "Consultation Room 2",
    type: "Clinical Consultation",
    status: "Safe",
    risk: "14 · Low risk",
    updated: "24 Sep",
    href: "/assessments/queen-care-clinic/model",
  },
  {
    name: "North Patient Corridor",
    type: "Circulation Corridor",
    status: "Review pending",
    risk: "34 · Moderate",
    updated: "Yesterday",
    href: "/reviews/queen-care-clinic",
  },
];

export default function Dashboard() {
  return (
    <AppShell activePath="/">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Queen Care Clinic · Operations Workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Facility Safety Overview</h1>
            <p className="mt-2 text-slate-600">
              AI-assisted environmental fall-risk assessment and interior layout optimization for older adults.
            </p>
          </div>
          <Link
            href="/assessments/new"
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-800"
          >
            + New assessment
          </Link>
        </header>

        <section className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 lg:grid-cols-4">
          <Metric value="3" label="Monitored spaces" note="Waiting area, corridor, consultation" />
          <Metric value="1" label="Critical finding" note="Walker route obstructed (54 cm clear)" />
          <Metric value="41" label="Risk points reduced" note="Balanced option (HK$850)" />
          <Metric value="OT Approved" label="Professional sign-off" note="Dr. Adrian Lau, HKROT" />
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_20rem]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Clinic Spaces & Assessments</h2>
              <Link href="/assessments" className="text-sm font-semibold text-teal-700">View all</Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Space / Area</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                    <th className="px-4 py-3">Safety Risk</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r) => (
                    <tr key={r.name} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <Link href={r.href} className="font-semibold text-slate-900 hover:text-teal-700">{r.name}</Link>
                        <span className="block text-xs text-slate-500">{r.updated}</span>
                      </td>
                      <td className="hidden px-4 py-4 text-slate-600 sm:table-cell">{r.type}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.risk.includes("High")
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : r.risk.includes("Moderate")
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-teal-50 text-teal-700 border border-teal-200"
                        }`}>
                          {r.risk}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link href={r.href} className="text-xs font-semibold text-teal-700 hover:underline">
                          Open &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Action Required</p>
              <h2 className="mt-2 font-semibold text-slate-950">Waiting Area: Hazard HZ-001</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Waiting chair narrows walker clearance to <strong>54 cm</strong> (min 90 cm required). Route obstructed.
              </p>
              <Link href="/assessments/queen-care-clinic/analysis" className="mt-4 inline-block rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">
                Triage in Safety Analysis &rarr;
              </Link>
            </div>

            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Optimized Layout</p>
              <h2 className="mt-2 font-semibold text-slate-950">Balanced Layout (HK$850)</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Clearance increases to <strong>96 cm</strong>. Risk drops <strong>68 &rarr; 27</strong>.
              </p>
              <Link href="/assessments/queen-care-clinic/options" className="mt-4 inline-block text-xs font-semibold text-teal-800 hover:underline">
                Compare Before & After 3D &rarr;
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}
