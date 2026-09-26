import { redirect } from "next/navigation";

export default function LegacyReportRedirect() {
  redirect("/assessments/queen-care-clinic/report");
}
