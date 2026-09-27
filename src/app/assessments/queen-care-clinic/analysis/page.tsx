import { WorkspaceShell } from "@/components/shell";
import { RiskAnalysis } from "@/components/analysis";

export default function AnalysisPage() {
  return (
    <WorkspaceShell activeStep="analysis">
      <div className="p-4 lg:p-6">
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>Queen Care Clinic</span><span aria-hidden="true">/</span><span>Waiting Area & Consultation Corridor</span><span aria-hidden="true">/</span><span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">Professional review pending</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Environmental Safety & Risk Analysis</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Mobility profile: Older adult using walker · Critical route: Entrance → Reception → Waiting Seat → Consultation Room</p>
        </header>
        <RiskAnalysis />
      </div>
    </WorkspaceShell>
  );
}
