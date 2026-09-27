"use client";

import { useMemo, useState } from "react";
import { DecisionModal, type ReviewDecision } from "./decision-modal";

export type ReviewNote = { id: string; author: string; role: string; body: string; location: string; createdAt: string; resolved?: boolean };
export type ReviewSnapshot = { id: string; label: string; createdAt: string; createdBy: string; checksum: string };
type Props = { title?: string; notes?: ReviewNote[]; snapshots?: ReviewSnapshot[]; onDecision?: (decision: ReviewDecision, rationale: string) => void };

const sampleNotes: ReviewNote[] = [
  { id: "note-01", author: "Dr. Maya Chan", role: "Occupational therapist", body: "Confirm the proposed 96 cm turning clearance after the chair is relocated.", location: "Activity room · Pin 01", createdAt: "26 Sep 2026, 14:32" },
  { id: "note-02", author: "Alex Wong", role: "Facility manager", body: "Power outlet remains accessible. Contractor confirmed no wall work is required.", location: "Reception wall · Pin 02", createdAt: "26 Sep 2026, 16:05", resolved: true },
];
const sampleSnapshots: ReviewSnapshot[] = [
  { id: "SS-2026-0926-04", label: "Balanced option · Revision 4", createdAt: "26 Sep 2026, 16:18 HKT", createdBy: "Alex Wong", checksum: "9C7A–4E20–B1F8" },
];

export function ReviewWorkspace({ title = "Harmony Elder Care Centre — Activity Room", notes = sampleNotes, snapshots = sampleSnapshots, onDecision }: Props) {
  const [view, setView] = useState<"before" | "proposed">("proposed");
  const [activeNote, setActiveNote] = useState(notes[0]?.id);
  const [checked, setChecked] = useState(() => new Set(["measurements", "route"]));
  const [modalOpen, setModalOpen] = useState(false);
  const resolvedCount = useMemo(() => notes.filter((note) => note.resolved).length, [notes]);
  const toggle = (id: string) => setChecked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <section className="min-h-[720px] bg-slate-100 text-slate-950" aria-labelledby="review-title">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 lg:px-7">
      <div><div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500"><span>Professional review</span><span aria-hidden>/</span><span>REV-1048</span></div><h1 id="review-title" className="text-xl font-semibold tracking-tight">{title}</h1></div>
      <div className="flex items-center gap-3"><span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Review pending</span><button type="button" onClick={() => setModalOpen(true)} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 active:translate-y-px">Record decision</button></div>
    </header>
    <div className="grid min-h-[650px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="border-r border-slate-200 p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Plan version">{(["before", "proposed"] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === option ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{option === "before" ? "Current" : "Proposed"}</button>)}</div><p className="text-xs text-slate-500">Read-only review view · Scale 1:50</p></div>
        <div className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-xl border border-slate-300 bg-white p-8 shadow-sm">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative h-[350px] w-full max-w-[700px] border-[6px] border-slate-700 bg-slate-50"><div className="absolute left-[45%] top-0 h-[66%] border-l-4 border-slate-700"/><div className="absolute bottom-[28%] left-0 w-[45%] border-t-4 border-slate-700"/><div className={`absolute left-[19%] top-[52%] h-20 w-24 border-2 ${view === "proposed" ? "border-teal-700 bg-teal-100" : "border-red-700 bg-red-100"}`}><span className="absolute -top-6 text-xs font-semibold">Chair</span></div><div className="absolute bottom-[12%] right-[8%] h-16 w-32 border-2 border-slate-500 bg-slate-200 p-2 text-xs">Reception</div><div className={`absolute left-[5%] top-[34%] h-16 rounded-full border-2 border-dashed ${view === "proposed" ? "w-[48%] border-teal-600 bg-teal-50/70" : "w-[29%] border-red-600 bg-red-50/70"}`}><span className="absolute left-2 top-5 text-xs font-semibold">{view === "proposed" ? "96 cm clear" : "54 cm clear"}</span></div>{notes.map((note, index) => <button key={note.id} type="button" onClick={() => setActiveNote(note.id)} aria-label={`Open ${note.location}`} className={`absolute grid size-8 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${activeNote === note.id ? "bg-teal-700 ring-4 ring-teal-200" : "bg-slate-700"}`} style={{ left: `${32 + index * 38}%`, top: `${44 + index * 22}%` }}>{String(index + 1).padStart(2, "0")}</button>)}</div>
          <div className="absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-sm"><span className="font-semibold">Risk score</span> <span className="text-slate-500">68 → </span><strong className="text-teal-800">27</strong></div>
        </div>
      </main>
      <aside className="bg-white" aria-label="Review details">
        <section className="border-b border-slate-200 p-5"><div className="mb-4 flex items-baseline justify-between"><h2 className="font-semibold">Review notes</h2><span className="text-xs text-slate-500">{resolvedCount}/{notes.length} resolved</span></div><div className="space-y-2">{notes.map((note) => <button key={note.id} type="button" onClick={() => setActiveNote(note.id)} className={`w-full rounded-lg border p-3 text-left ${activeNote === note.id ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}><span className="flex items-center justify-between gap-2 text-xs font-semibold"><span>{note.location}</span><span className={note.resolved ? "text-teal-700" : "text-amber-700"}>{note.resolved ? "Resolved" : "Open"}</span></span><span className="mt-2 block text-sm leading-5 text-slate-700">{note.body}</span><span className="mt-2 block text-xs text-slate-500">{note.author} · {note.createdAt}</span></button>)}</div></section>
        <section className="border-b border-slate-200 p-5"><h2 className="mb-3 font-semibold">Evidence reviewed</h2><div className="space-y-3">{[["measurements", "Measured clearances"], ["route", "Mobility route simulation"], ["photos", "Site photographs"], ["cost", "Cost and disruption estimate"]].map(([id, label]) => <label key={id} className="flex cursor-pointer items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={checked.has(id)} onChange={() => toggle(id)} className="mt-0.5 size-4 accent-teal-700"/><span>{label}</span></label>)}</div></section>
        <section className="p-5"><h2 className="mb-3 font-semibold">Version record</h2>{snapshots[0] && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><strong className="block">{snapshots[0].label}</strong><span className="mt-1 block text-xs text-slate-500">{snapshots[0].id} · {snapshots[0].createdAt}</span><p className="mt-3 text-xs leading-5 text-slate-600"><strong>Immutable snapshot.</strong> Decision applies only to this locked geometry, evidence set, and analysis result. Later edits create a new review version.</p><code className="mt-2 block text-xs text-slate-500">Checksum {snapshots[0].checksum}</code></div>}</section>
      </aside>
    </div>
    <DecisionModal open={modalOpen} snapshot={snapshots[0]} onClose={() => setModalOpen(false)} onSubmit={(decision, rationale) => { onDecision?.(decision, rationale); setModalOpen(false); }}/>
  </section>;
}

