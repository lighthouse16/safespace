import Link from "next/link";
import type { ReactNode } from "react";
import type { WorkflowStep } from "@/lib/types";
const steps: readonly { id: WorkflowStep; label: string; href: string }[] = [
  { id: "model", label: "1. Space Model (2D/3D)", href: "/assessments/queen-care-clinic/model" },
  { id: "analysis", label: "2. Risk Analysis", href: "/assessments/queen-care-clinic/analysis" },
  { id: "options", label: "3. Layout Options", href: "/assessments/queen-care-clinic/options" },
  { id: "report", label: "4. Implementation Report", href: "/assessments/queen-care-clinic/report" },
];
export function WorkspaceShell({ children, activeStep, status = "Saved" }: { children: ReactNode; activeStep: WorkflowStep; status?: string }) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/assessments" className="text-sm font-medium text-slate-600 hover:text-slate-950">&larr; Assessments</Link>
          <span className="text-slate-300">/</span>
          <strong className="truncate text-sm font-semibold text-slate-900">Harmony Elder Care Centre — Activity Room</strong>
        </div>
        <div className="flex items-center gap-3">
          <span role="status" className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">{status}</span>
        </div>
      </header>
      <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100dvh-4rem)] lg:border-b-0 lg:border-r">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Assessment Workflow</p>
          <ol className="flex gap-1 overflow-x-auto lg:grid lg:gap-1" aria-label="Assessment progress">
            {steps.map((step, index) => (
              <li key={step.id}>
                <Link
                  href={step.href}
                  aria-current={step.id === activeStep ? "step" : undefined}
                  className="flex min-w-max items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 aria-[current=step]:bg-teal-50 aria-[current=step]:font-semibold aria-[current=step]:text-teal-800"
                >
                  <span
                    className={`grid size-5 place-items-center rounded-full text-[11px] font-semibold ${
                      index < activeIndex
                        ? "bg-teal-700 text-white"
                        : index === activeIndex
                        ? "border-2 border-teal-700 text-teal-800"
                        : "border border-slate-300 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {step.label.replace(/^\d+\.\s*/, '')}
                </Link>
              </li>
            ))}
          </ol>
        </aside>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
