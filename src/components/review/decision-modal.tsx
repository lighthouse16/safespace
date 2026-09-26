"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewSnapshot } from "./review-workspace";

export type ReviewDecision = "approved" | "changes" | "rejected" | "inspection";
type Props = { open: boolean; snapshot?: ReviewSnapshot; onClose: () => void; onSubmit: (decision: ReviewDecision, rationale: string) => void };
const choices: Array<{ value: ReviewDecision; label: string; detail: string }> = [
  { value: "approved", label: "Approve", detail: "Accept this snapshot for implementation." },
  { value: "changes", label: "Request changes", detail: "Return it with specific required revisions." },
  { value: "inspection", label: "Site inspection required", detail: "Hold decision until conditions are checked in person." },
  { value: "rejected", label: "Reject", detail: "Record why this proposal cannot proceed." },
];

export function DecisionModal({ open, snapshot, onClose, onSubmit }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [rationale, setRationale] = useState("");
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { const node = dialog.current; if (open && !node?.open) node?.showModal(); else if (!open && node?.open) node.close(); }, [open]);
  const submit = () => { setAttempted(true); if (rationale.trim().length < 12) return; onSubmit(decision, rationale.trim()); setRationale(""); setAttempted(false); };
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialog.current) onClose(); }} className="m-auto w-[min(92vw,620px)] rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55">
    <div className="border-b border-slate-200 px-6 py-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Record professional decision</h2><p className="mt-1 text-sm text-slate-600">Decision and rationale become part of review record.</p></div><button type="button" onClick={onClose} aria-label="Close decision dialog" className="rounded-md px-2 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button></div></div>
    <div className="space-y-5 p-6"><fieldset><legend className="mb-3 text-sm font-semibold">Decision</legend><div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => <label key={choice.value} className={`cursor-pointer rounded-lg border p-3 ${decision === choice.value ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}><span className="flex gap-2"><input type="radio" name="decision" value={choice.value} checked={decision === choice.value} onChange={() => setDecision(choice.value)} className="accent-teal-700"/><span><strong className="block text-sm">{choice.label}</strong><span className="mt-1 block text-xs leading-4 text-slate-600">{choice.detail}</span></span></span></label>)}</div></fieldset>
      <div><label htmlFor="review-rationale" className="block text-sm font-semibold">Clinical rationale <span className="text-red-700">Required</span></label><textarea id="review-rationale" rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} aria-invalid={attempted && rationale.trim().length < 12} aria-describedby="rationale-help rationale-error" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-200" placeholder="State evidence considered, remaining limitations, and reason for this decision."/><p id="rationale-help" className="mt-1 text-xs text-slate-500">Minimum 12 characters. Avoid personal or unnecessary patient data.</p>{attempted && rationale.trim().length < 12 && <p id="rationale-error" role="alert" className="mt-1 text-xs font-semibold text-red-700">Add a clear rationale before recording decision.</p>}</div>
      {snapshot && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="block text-slate-900">Snapshot locked on submission</strong>{snapshot.id} · {snapshot.label}<br/>Checksum {snapshot.checksum}. Approval is professional review of this exact snapshot, not certification of future site conditions or automated analysis.</div>}
    </div>
    <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">Cancel</button><button type="button" onClick={submit} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Record decision</button></div>
  </dialog>;
}
