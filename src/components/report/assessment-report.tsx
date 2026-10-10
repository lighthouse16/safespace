"use client";

import { useState } from "react";
import { sampleReport, type AssessmentReportData } from "./report-data";

type Audience = "manager" | "contractor" | "funder";
type Props = { data?: AssessmentReportData; onPrint?: () => void };

export function AssessmentReport({ data = sampleReport, onPrint }: Props) {
  const [audience, setAudience] = useState<Audience>("manager");
  const [detail, setDetail] = useState<"summary" | "full">("full");
  const print = () => {
    onPrint?.();
    window.print();
  };

  return (
    <section className="bg-slate-100 px-4 py-6 text-slate-950 print:bg-white print:p-0" aria-label="Safety assessment report">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <label className="text-sm font-medium">
            Audience
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="manager">Facility manager</option>
              <option value="contractor">Contractor</option>
              <option value="funder">Funding partner</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Detail
            <select
              value={detail}
              onChange={(e) => setDetail(e.target.value as "summary" | "full")}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="full">Full report</option>
              <option value="summary">Executive summary</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={print}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Print / Save PDF
        </button>
      </div>

      <article className="report-sheet mx-auto max-w-[210mm] bg-white shadow-sm print:max-w-none print:shadow-none">
        <header className="border-b-4 border-teal-700 px-10 py-9">
          <div className="flex items-start justify-between gap-8">
            <div>
              <span className="text-sm font-bold tracking-[0.16em] text-teal-800">SAFESPACE</span>
              <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight">Environmental safety assessment</h1>
              <p className="mt-3 text-lg text-slate-600">{data.facility} · {data.area}</p>
            </div>
            <div className="text-right text-xs leading-5 text-slate-500">
              <strong className="block text-slate-900">{data.reportId}</strong>
              Issued {data.issuedAt}<br />
              Deterministic spatial record
            </div>
          </div>
        </header>

        <div className="px-10 py-8">
          <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-slate-200 pb-7 text-sm sm:grid-cols-4">
            <ReportFact label="Baseline clearance" value="54 cm" detail="Critical transit path" />
            <ReportFact label="Proposed clearance" value="96 cm" detail="Meets 90 cm threshold" />
            <ReportFact label="Evaluation method" value="Deterministic" detail="Physical geometry" />
            <ReportFact label="Contractor cost" value="Pending quote" detail="On-site quote required" />
          </section>

          <ReportSection number="01" title="Executive summary">
            <p>
              Evaluation identifies environmental hazards affecting an older adult using a walker along the critical route. The proposed layout removes route blockages and improves continuous wall support while preserving clinical seating capacity. Minimum route clearance increases from 54 cm to 96 cm.
            </p>
            <div className="mt-5 border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm">
              <strong>Professional review notice:</strong> Spatial evaluations provide deterministic geometric measurements. Independent registered clinician review and licensed contractor quotes are required prior to physical implementation.
            </div>
          </ReportSection>

          {detail === "full" && (
            <>
              <ReportSection number="02" title="Method and scope">
                <p>
                  Assessment combines scaled floor-plan geometry, measured route clearances, mobility-profile requirements, and deterministic spatial evaluations. Automated findings support clinical triage; they do not constitute independent clinical certification.
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Profile</dt>
                    <dd className="font-semibold">Older adult using walker (min 90 cm)</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Critical route</dt>
                    <dd className="font-semibold">Entrance → Reception → Waiting Seat → Consultation Room</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Evaluation basis</dt>
                    <dd className="font-semibold">Deterministic geometric clearance</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Review status</dt>
                    <dd className="font-semibold">Pending qualified clinician sign-off</dd>
                  </div>
                </dl>
              </ReportSection>

              <ReportSection number="03" title="Before and proposed layout">
                <div className="grid grid-cols-2 gap-5">
                  <PlanSummary title="Current layout" status="Clearance: 54 cm" clearance="54 cm" tone="risk" />
                  <PlanSummary title="Proposed layout" status="Clearance: 96 cm" clearance="96 cm" tone="safe" />
                </div>
              </ReportSection>
            </>
          )}

          <ReportSection
            number={detail === "full" ? "04" : "02"}
            title={audience === "contractor" ? "Implementation schedule" : "Action plan"}
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-slate-300 text-xs text-slate-500">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.actions.map((action) => (
                  <tr key={action.id} className="border-b border-slate-200 align-top">
                    <td className="py-3 pr-3 font-mono text-xs">{action.id}</td>
                    <td className="py-3 pr-3 font-medium">{action.action}</td>
                    <td className="py-3 pr-3">{action.owner}</td>
                    <td className="py-3 pr-3 whitespace-nowrap">{action.due}</td>
                    <td className="py-3 text-right whitespace-nowrap">{action.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportSection>

          {detail === "full" && (
            <ReportSection number="05" title="Residual risk and follow-up">
              <ul className="list-disc space-y-2 pl-5">
                <li>Verify on-site door threshold and transit transitions under wheeled mobility frames.</li>
                <li>Verify physical clearances after furniture arrangement before admitting clients.</li>
                <li>Escalate any physical divergence from digital model for re-evaluation.</li>
              </ul>
            </ReportSection>
          )}

          <section className="mt-12 break-inside-avoid border-t-2 border-slate-900 pt-6">
            <div className="grid grid-cols-2 gap-10">
              <div>
                <p className="text-xs text-slate-500">Clinician verification</p>
                <p className="mt-8 border-b border-slate-400 pb-2 font-semibold">Pending qualified clinician evaluation</p>
                <p className="mt-1 text-xs text-slate-500">SafeSpace does not fabricate professional clinician sign-offs.</p>
              </div>
              <div className="text-xs leading-5 text-slate-600">
                <strong className="block text-slate-900">Digital spatial record</strong>
                Snapshot {data.snapshotId}<br />
                Checksum {data.checksum}<br />
                Issued {data.issuedAt}
              </div>
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-200 px-10 py-5 text-[10px] leading-4 text-slate-500">
          <strong>Important limitation.</strong> This report documents deterministic spatial analysis of digital floor plans. It is not a building-code certificate, clinical guarantee of safety, or substitute for on-site statutory inspection. SafeSpace does not fabricate clinician sign-offs or contractor quotes.
        </footer>
      </article>
    </section>
  );
}

function ReportFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      <span className="text-xs text-slate-500">{detail}</span>
    </div>
  );
}

function ReportSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-b border-slate-200 py-8">
      <div className="grid grid-cols-[36px_1fr] gap-4">
        <span className="font-mono text-xs text-teal-800">{number}</span>
        <div>
          <h2 className="mb-4 text-xl font-semibold">{title}</h2>
          <div className="text-sm leading-6 text-slate-700">{children}</div>
        </div>
      </div>
    </section>
  );
}

function PlanSummary({ title, status, clearance, tone }: { title: string; status: string; clearance: string; tone: "risk" | "safe" }) {
  return (
    <div className="border border-slate-300 p-4">
      <div className="mb-4 flex justify-between">
        <strong>{title}</strong>
        <span className={tone === "safe" ? "text-teal-800" : "text-red-800"}>{status}</span>
      </div>
      <div className="relative h-32 border-4 border-slate-600 bg-slate-50">
        <div className="absolute left-1/2 top-0 h-20 border-l-2 border-slate-500" />
        <div className={`absolute left-4 top-12 h-9 rounded-full border-2 border-dashed ${tone === "safe" ? "w-2/3 border-teal-600" : "w-1/3 border-red-600"}`} />
      </div>
      <p className="mt-3 text-xs">Primary route clearance: <strong>{clearance}</strong></p>
    </div>
  );
}
