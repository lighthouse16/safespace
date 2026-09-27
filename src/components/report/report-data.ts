export type ReportAction = { id: string; action: string; owner: string; due: string; cost: string; status: "ready" | "open" };
export type AssessmentReportData = {
  reportId: string;
  facility: string;
  area: string;
  preparedFor: string;
  issuedAt: string;
  reviewer: string;
  credentials: string;
  snapshotId: string;
  checksum: string;
  actions: ReportAction[];
};

export const sampleReport: AssessmentReportData = {
  reportId: "SSR-2026-1048",
  facility: "Queen Care Clinic",
  area: "Waiting Area and Consultation Corridor",
  preparedFor: "Queen Care Community Health Services",
  issuedAt: "27 September 2026",
  reviewer: "Dr. Adrian Lau",
  credentials: "Registered Occupational Therapist, HKROT",
  snapshotId: "SS-2026-0927-01",
  checksum: "9C7A–4E20–B1F8",
  actions: [
    { id: "A-01", action: "Relocate Waiting Chairs A & B against west perimeter wall", owner: "Facility operations", due: "30 Sep 2026", cost: "HK$0", status: "ready" },
    { id: "A-02", action: "Mount 1.8 m continuous wall handrail along consultation corridor (88 cm height)", owner: "Licensed Contractor", due: "4 Oct 2026", cost: "HK$500", status: "open" },
    { id: "A-03", action: "Install high-efficiency diffuse LED fixture at corridor doorway threshold (200 lux min)", owner: "Maintenance Electrician", due: "5 Oct 2026", cost: "HK$350", status: "open" },
    { id: "A-04", action: "Install high-visibility rounded protective buffer on magazine table corner", owner: "Facility operations", due: "30 Sep 2026", cost: "HK$0", status: "ready" },
  ],
};
