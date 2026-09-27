export type ReportAction = { id: string; action: string; owner: string; due: string; cost: string; status: "ready" | "open" };
export type AssessmentReportData = { reportId: string; facility: string; area: string; preparedFor: string; issuedAt: string; reviewer: string; credentials: string; snapshotId: string; checksum: string; actions: ReportAction[] };
export const sampleReport: AssessmentReportData = { reportId: "SSR-2026-1048", facility: "Harmony Elder Care Centre", area: "Activity Room", preparedFor: "Queen Care Community Health Services", issuedAt: "27 September 2026", reviewer: "Dr. Maya Chan", credentials: "Registered Occupational Therapist, HKROT", snapshotId: "SS-2026-0926-04", checksum: "9C7A–4E20–B1F8", actions: [
  { id: "A-01", action: "Relocate visitor chair outside primary mobility route", owner: "Facility manager", due: "30 Sep 2026", cost: "HK$0", status: "ready" },
  { id: "A-02", action: "Apply high-contrast edge marking at reception turn", owner: "Maintenance", due: "4 Oct 2026", cost: "HK$350", status: "open" },
  { id: "A-03", action: "Install low-profile cable cover beside check-in kiosk", owner: "Contractor", due: "7 Oct 2026", cost: "HK$500", status: "open" },
] };
