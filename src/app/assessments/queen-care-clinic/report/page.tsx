import { WorkspaceShell } from "@/components/shell";
import { AssessmentReport } from "@/components/report";

export default function AssessmentReportPage() {
  return (
    <WorkspaceShell activeStep="report">
      <div className="p-4 lg:p-6">
        <AssessmentReport />
      </div>
    </WorkspaceShell>
  );
}
