"use client";

import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/shell";
import { OptionsCompare } from "@/components/options";

export default function OptionsPage() {
  const router = useRouter();

  return (
    <WorkspaceShell activeStep="options">
      <div className="p-4 lg:p-6">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Generated layouts · AI Optimization</p>
          <h1 className="mt-1 text-2xl font-semibold">Compare Implementation Paths</h1>
          <p className="mt-1 text-sm text-slate-600">Evaluate safety score improvement, cost, effort, and disruption for Queen Care Clinic.</p>
        </header>
        <OptionsCompare
          onSelect={() => {
            router.push("/assessments/queen-care-clinic/report");
          }}
        />
      </div>
    </WorkspaceShell>
  );
}
